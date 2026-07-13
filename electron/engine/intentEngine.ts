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

export type IntentState = 'idle' | 'intent' | 'reference' | 'reading' | 'commentary'

const INTENT_PHRASES = [
  'turn with me to',
  'turn to',
  'turn in your bibles',
  'open your bibles',
  'open your bible',
  'if you have your bible',
  'go with me to',
  'come with me to',
  "let's read",
  'let us read',
  'i want to read',
  'reading from',
  'look at',
  'looking at'
]

const NARRATIVE_MARKERS = [
  'there was a',
  'there was once',
  'let me tell you',
  'i remember',
  'years ago',
  'a story',
  'the story of',
  'one day',
  'imagine'
]

const DEFER_PHRASES = [
  "we'll come back to",
  'we will come back to',
  "we'll get to",
  "we'll look at that later",
  'come back to that',
  'hold that thought',
  'later on'
]

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

export class IntentEngine {
  private state: IntentState = 'idle'
  private stateAt = 0
  private narrativeUntil = 0
  private deferUntil = 0
  private armed: ArmedVerse | null = null
  private recentWords: string[] = []
  private cb: IntentEngineCallbacks
  private now: () => number

  constructor(cb: IntentEngineCallbacks = {}, now: () => number = Date.now) {
    this.cb = cb
    this.now = now
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

  /** Arm the grace window with the verse's opening words. */
  armGraceWindow(ref: string, verseText: string): void {
    const words = verseText
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
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

  process(text: string): void {
    const now = this.now()
    const t = ' ' + text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim() + ' '

    for (const p of DEFER_PHRASES) {
      if (t.includes(p)) {
        this.deferUntil = now + 8000
        this.cb.onDefer?.()
        break
      }
    }

    if (INTENT_PHRASES.some((p) => t.includes(' ' + p + ' ') || t.includes(' ' + p))) {
      this.setState('intent', now)
    } else if (NARRATIVE_MARKERS.some((p) => t.includes(p))) {
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
