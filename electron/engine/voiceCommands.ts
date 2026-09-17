/**
 * Natural voice commands spoken by the preacher — no wake word, no syntax.
 * The engine listens for phrases that already occur in real preaching:
 *
 *   "…in the King James Version"        → switch displayed translation
 *   "I said verse thirty-four"          → correct the displayed verse
 *   "not verse twenty-four, thirty-four"→ correct the displayed verse
 *   "let us pray" … "amen"              → suppress displays during prayer
 *   "take that down" / "leave it up"    → display control
 *   "next verse" / "the verse before"   → navigation
 *
 * EVERY phrase is configuration, not code: built-in defaults + the active
 * language pack + the user's voice-commands.json are unioned into the
 * CommandPhraseConfig this engine runs on (see commandConfig.ts).
 *
 * Corrections are HIGH-PRIORITY interrupts: they bypass the session's
 * command debounce and verse lockout (a correction usually arrives seconds
 * after the wrong verse went up — exactly when lockouts would eat it).
 * Every correction is also a free training sample for the correction ledger.
 */

import type { VoiceCommandEvent } from '../../shared/types'
import { normalizeWords } from './referenceResolver'
import { parseSpokenNumber } from './referenceResolver'
import { DEFAULT_COMMANDS, type CommandPhraseConfig } from './commandConfig'

export interface DisplayedRef {
  book: string
  chapter: number
  verse: number
  displayedAt: number
}

export type SpokenNumberParser = (
  words: string[],
  i: number
) => { value: number; consumed: number } | null

export interface VoiceCommandCallbacks {
  /** The verse currently (or very recently) on screen, if any. */
  getDisplayedRef: () => DisplayedRef | null
  /** Which translations exist in bible.db (upper-case codes). */
  getAvailableVersions: () => string[]
  onVersionSwitch: (version: string) => void
  onVerseCorrection: (verse: number) => void
  onChapterCorrection: (chapter: number) => void
  onDismiss: () => void
  onHold: () => void
  onNavigate: (direction: 'next' | 'previous') => void
  onPrayerChange: (inPrayer: boolean) => void
  /** Every recognized command, for logging/UI/ledger. */
  onCommand: (event: VoiceCommandEvent) => void
}

export interface VoiceCommandOptions {
  config?: CommandPhraseConfig
  /** Language-aware number parser (defaults to the English one). */
  numberParser?: SpokenNumberParser
  /** Chinese etc.: match phrases without word boundaries. */
  substringMode?: boolean
  now?: () => number
  /**
   * Per-preacher veto: utterances the operator marked "never treat as a
   * command" (see preachers/commandLog.ts). When it returns true the chunk
   * is left alone entirely.
   */
  isSuppressed?: (utterance: string) => boolean
}

/** How long after a verse leaves the screen its context still counts. */
const CONTEXT_WINDOW_MS = 60_000
const COMMAND_DEDUP_MS = 3000

export class VoiceCommandEngine {
  private cb: VoiceCommandCallbacks
  private now: () => number
  private config: CommandPhraseConfig
  private parseNum: SpokenNumberParser
  private substringMode: boolean
  private isSuppressed: (utterance: string) => boolean
  private inPrayer = false
  private lastFired: Record<string, number> = {}

  constructor(cb: VoiceCommandCallbacks, opts: VoiceCommandOptions = {}) {
    this.cb = cb
    this.now = opts.now ?? Date.now
    this.config = opts.config ?? DEFAULT_COMMANDS
    this.parseNum = opts.numberParser ?? parseSpokenNumber
    this.substringMode = opts.substringMode ?? false
    this.isSuppressed = opts.isSuppressed ?? (() => false)
  }

  isInPrayer(): boolean {
    return this.inPrayer
  }

  /** Case/punctuation-insensitive phrase containment. */
  private hasPhrase(padded: string, raw: string, phrase: string): boolean {
    if (this.substringMode && raw.includes(phrase)) return true
    const p = ' ' + normalizeWords(phrase).join(' ') + ' '
    return padded.includes(p)
  }

  private hasAny(padded: string, raw: string, phrases: string[]): boolean {
    return phrases.some((p) => this.hasPhrase(padded, raw, p))
  }

  /** Feed final ASR chunks. Returns true if a command consumed the text. */
  process(text: string): boolean {
    const words = normalizeWords(text)
    const padded = ' ' + words.join(' ') + ' '
    const raw = text.toLowerCase()
    const now = this.now()
    const c = this.config

    if (this.isSuppressed(text)) return false

    // ---- prayer mode ----
    if (!this.inPrayer && this.hasAny(padded, raw, c.prayerStart)) {
      this.inPrayer = true
      this.fire({ kind: 'prayer-start', utterance: text, ts: now })
      this.cb.onPrayerChange(true)
      return true
    }
    if (this.inPrayer && this.hasAny(padded, raw, c.prayerEnd)) {
      this.inPrayer = false
      this.fire({ kind: 'prayer-end', utterance: text, ts: now })
      this.cb.onPrayerChange(false)
      return true
    }

    // ---- version switch ("…in the King James Version") ----
    // Context guard: only while a verse is (or was recently) displayed —
    // "King James" in a history anecdote with nothing on screen does nothing.
    const displayed = this.cb.getDisplayedRef()
    const hasContext =
      displayed !== null && now - displayed.displayedAt < CONTEXT_WINDOW_MS
    if (hasContext) {
      for (const { phrases, code } of c.versionPhrases) {
        if (this.hasAny(padded, raw, phrases)) {
          if (this.dedup('version:' + code, now)) return false
          const available = this.cb.getAvailableVersions()
          if (!available.includes(code)) {
            console.log(`🗣️ Version "${code}" requested but not installed (have: ${available.join(', ')})`)
            this.fire({ kind: 'version-switch', utterance: text, value: `${code} (not installed)`, ts: now })
            return false
          }
          console.log(`🗣️ Voice command: switch translation → ${code}`)
          this.fire({ kind: 'version-switch', utterance: text, value: code, ts: now })
          this.cb.onVersionSwitch(code)
          return true
        }
      }
    }

    // ---- corrections (bypass lockouts downstream) ----
    if (hasContext) {
      const verseWordSet = new Set(c.verseWords)
      const chapterWordSet = new Set(c.chapterWords)

      // "<trigger> [verse] N" — token-parsed, language-aware numbers.
      const trig = this.findTrigger(words, c.iSaidTriggers)
      if (trig !== null) {
        let i = trig
        // "i said chapter five"
        if (chapterWordSet.has(words[i])) {
          const n = this.parseNum(words, i + 1)
          if (n && n.value !== displayed!.chapter) {
            if (this.dedup('correct-ch:' + n.value, now)) return false
            this.fire({ kind: 'correction-chapter', utterance: text, value: n.value, ts: now })
            this.cb.onChapterCorrection(n.value)
            return true
          }
        }
        if (verseWordSet.has(words[i])) i++
        const n = this.parseNum(words, i)
        if (n && n.value !== displayed!.verse) {
          if (this.dedup('correct:' + n.value, now)) return false
          console.log(`🗣️ Correction: "${text.trim()}" → verse ${n.value}`)
          this.fire({ kind: 'correction-verse', utterance: text, value: n.value, ts: now })
          this.cb.onVerseCorrection(n.value)
          return true
        }
      }

      // "not verse twenty four, verse thirty four" / "not twenty four, thirty four"
      // Token-parsed (not regex) — number words contain spaces, and a lazy
      // regex splits "twenty four verse thirty four" at the wrong seam.
      {
        const notIdx = words.indexOf('not')
        if (notIdx >= 0) {
          let i = notIdx + 1
          if (verseWordSet.has(words[i])) i++
          const first = this.parseNum(words, i)
          if (first) {
            let j = i + first.consumed
            if (words[j] === 'but') j++
            if (verseWordSet.has(words[j])) j++
            const second = this.parseNum(words, j)
            if (
              second &&
              j + second.consumed >= words.length && // correction ends the utterance
              second.value !== displayed!.verse
            ) {
              if (this.dedup('correct:' + second.value, now)) return false
              console.log(`🗣️ Correction: not ${first.value}, ${second.value}`)
              this.fire({ kind: 'correction-verse', utterance: text, value: second.value, ts: now })
              this.cb.onVerseCorrection(second.value)
              return true
            }
          }
        }
      }

      // ---- display control ----
      if (this.hasAny(padded, raw, c.dismiss)) {
        if (this.dedup('dismiss', now)) return false
        this.fire({ kind: 'display-dismiss', utterance: text, ts: now })
        this.cb.onDismiss()
        return true
      }
      if (this.hasAny(padded, raw, c.hold)) {
        if (this.dedup('hold', now)) return false
        this.fire({ kind: 'display-hold', utterance: text, ts: now })
        this.cb.onHold()
        return true
      }
      if (this.hasAny(padded, raw, c.navNext)) {
        if (this.dedup('nav:next', now)) return false
        console.log('🗣️ Voice command: next verse')
        this.fire({ kind: 'navigate-next', utterance: text, ts: now })
        this.cb.onNavigate('next')
        return true
      }
      if (this.hasAny(padded, raw, c.navPrevious)) {
        if (this.dedup('nav:previous', now)) return false
        console.log('🗣️ Voice command: previous verse')
        this.fire({ kind: 'navigate-previous', utterance: text, ts: now })
        this.cb.onNavigate('previous')
        return true
      }
    }

    return false
  }

  /** Index just AFTER the first matching trigger phrase, or null. */
  private findTrigger(words: string[], triggers: string[]): number | null {
    for (const trigger of triggers) {
      const tw = normalizeWords(trigger)
      if (tw.length === 0) continue
      outer: for (let i = 0; i + tw.length <= words.length; i++) {
        for (let k = 0; k < tw.length; k++) {
          if (words[i + k] !== tw[k]) continue outer
        }
        return i + tw.length
      }
    }
    return null
  }

  private dedup(key: string, now: number): boolean {
    const last = this.lastFired[key] ?? 0
    if (now - last < COMMAND_DEDUP_MS) return true
    this.lastFired[key] = now
    return false
  }

  private fire(event: VoiceCommandEvent): void {
    this.cb.onCommand(event)
  }
}
