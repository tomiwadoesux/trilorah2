/**
 * Intent engine — the "understand, don't just listen" layer.
 *
 * A small deterministic state machine that tracks what the preacher is
 * DOING, so detection sensitivity can follow:
 *
 *   idle → intent ("turn with me to…") → reference → reading → commentary
 *
 * - In `intent`/`reference`, bare book mentions are allowed through
 *   (the preacher is clearly heading somewhere).
 * - In `commentary`/narrative ("there was a man…", "Paul wrote to the
 *   Romans…"), bare book mentions are suppressed — only explicit
 *   chapter/verse references display.
 * - The GRACE WINDOW: when a reference is announced, congregations flip
 *   pages for 15-30s. We arm the verse and push it live the moment the
 *   preacher actually starts reading it (opening words matched) — the
 *   display feels telepathic instead of eager.
 * - "We'll come back to that" → the reference goes to the mentioned-queue
 *   instead of the screen.
 */

import { DEFAULT_COMMANDS, type CommandPhraseConfig } from './commandConfig'

export type IntentState = 'idle' | 'intent' | 'reference' | 'reading' | 'commentary'

const INTENT_HOLD_MS = 20_000
const NARRATIVE_HOLD_MS = 30_000
const GRACE_WINDOW_MS = 45_000
/** How many of the verse's opening words must appear to call it "reading". */
const GRACE_MATCH_WORDS = 3

export interface ArmedVerse {
  ref: string
  openingWords: string[]
  armedAt: number
}

export interface IntentEngineCallbacks {
  onStateChange?: (state: IntentState) => void
  /** Fired when the armed verse's opening words are spoken. */
  onReadingStarted?: (ref: string) => void
  /** Fired when a detection should be queued instead of displayed. */
  onDefer?: () => void
}

export interface IntentEngineOptions {
  /** Phrase lists (intentPhrases / narrativeMarkers / deferPhrases). */
  config?: Pick<CommandPhraseConfig, 'intentPhrases' | 'narrativeMarkers' | 'deferPhrases'>
  /** Chinese etc.: match phrases without word boundaries. */
  substringMode?: boolean
  now?: () => number
}

export class IntentEngine {
  private state: IntentState = 'idle'
  private stateAt = 0
  private narrativeUntil = 0
  private deferUntil = 0
  private armed: ArmedVerse | null = null
  private recentWords: string[] = []
  private cb: IntentEngineCallbacks
  private now: () => number
  private intentPhrases: string[]
  private narrativeMarkers: string[]
  private deferPhrases: string[]
  private substringMode: boolean

  constructor(cb: IntentEngineCallbacks = {}, opts: IntentEngineOptions = {}) {
    this.cb = cb
    this.now = opts.now ?? Date.now
    const config = opts.config ?? DEFAULT_COMMANDS
    this.intentPhrases = config.intentPhrases
    this.narrativeMarkers = config.narrativeMarkers
    this.deferPhrases = config.deferPhrases
    this.substringMode = opts.substringMode ?? false
  }

  /** Swap phrase lists live (language/config change). */
  setConfig(
    config: Pick<CommandPhraseConfig, 'intentPhrases' | 'narrativeMarkers' | 'deferPhrases'>,
    substringMode = false
  ): void {
    this.intentPhrases = config.intentPhrases
    this.narrativeMarkers = config.narrativeMarkers
    this.deferPhrases = config.deferPhrases
    this.substringMode = substringMode
  }

  getState(): IntentState {
    return this.state
  }

  /** True while a "we'll come back to that" defer window is open. */
  shouldDefer(): boolean {
    return this.now() < this.deferUntil
  }

  /** Gate for bare book mentions (no chapter/verse spoken). */
  allowBareBook(): boolean {
    if (this.now() < this.narrativeUntil) return false
    return this.state === 'intent' || this.state === 'reference' || this.state === 'reading'
  }

  /** Arm the grace window with the verse's opening words.
   *  Unicode-aware so non-English verse text ("Porque de tal manera amó
   *  Dios…") arms correctly. */
  armGraceWindow(ref: string, verseText: string): void {
    const words = verseText
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 6)
    if (words.length < GRACE_MATCH_WORDS) return
    this.armed = { ref, openingWords: words, armedAt: this.now() }
    console.log(`🕊️ Grace window armed for ${ref}: "${words.join(' ')}…"`)
  }

  disarmGraceWindow(): void {
    this.armed = null
  }

  /** Case/punctuation-insensitive phrase containment (substring for CJK). */
  private matches(t: string, raw: string, phrase: string): boolean {
    if (this.substringMode && raw.includes(phrase)) return true
    const p = phrase.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim()
    return t.includes(' ' + p + ' ') || t.includes(' ' + p)
  }

  process(text: string): void {
    const now = this.now()
    const raw = text.toLowerCase()
    const t = ' ' + raw.replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim() + ' '

    for (const p of this.deferPhrases) {
      if (this.matches(t, raw, p)) {
        this.deferUntil = now + 8000
        this.cb.onDefer?.()
        break
      }
    }

    if (this.intentPhrases.some((p) => this.matches(t, raw, p))) {
      this.setState('intent', now)
    } else if (this.narrativeMarkers.some((p) => this.matches(t, raw, p))) {
      this.narrativeUntil = now + NARRATIVE_HOLD_MS
      if (this.state !== 'reading') this.setState('commentary', now)
    } else if (this.state === 'intent' && now - this.stateAt > INTENT_HOLD_MS) {
      this.setState('idle', now)
    }

    // Grace window: is the preacher reading the armed verse?
    if (this.armed) {
      if (now - this.armed.armedAt > GRACE_WINDOW_MS) {
        this.armed = null
      } else {
        const words = t.split(' ').filter(Boolean)
        this.recentWords.push(...words)
        if (this.recentWords.length > 40) {
          this.recentWords = this.recentWords.slice(-40)
        }
        const hits = this.armed.openingWords.filter((w) =>
          this.recentWords.includes(w)
        ).length
        if (hits >= GRACE_MATCH_WORDS) {
          const ref = this.armed.ref
          this.armed = null
          this.recentWords = []
          this.setState('reading', now)
          console.log(`🕊️ Reading started — pushing ${ref} live`)
          this.cb.onReadingStarted?.(ref)
        }
      }
    }
  }

  /** Called when the session detects a full reference. */
  onReferenceDetected(): void {
    this.setState('reference', this.now())
  }

  /** Called when a displayed verse is dismissed. */
  onDisplayCleared(): void {
    if (this.state === 'reading' || this.state === 'reference') {
      this.setState('commentary', this.now())
    }
  }

  private setState(next: IntentState, now: number): void {
    if (next === this.state) return
    this.state = next
    this.stateAt = now
    this.cb.onStateChange?.(next)
  }
}
