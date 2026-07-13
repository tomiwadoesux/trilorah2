/**
 * Natural voice commands spoken by the preacher — no wake word, no syntax.
 * The engine listens for phrases that already occur in real preaching:
 *
 *   "…in the King James Version"        → switch displayed translation
 *   "I said verse thirty-four"          → correct the displayed verse
 *   "not verse twenty-four, thirty-four"→ correct the displayed verse
 *   "let us pray" … "amen"              → suppress displays during prayer
 *   "take that down" / "leave it up"    → display control
 *
 * Corrections are HIGH-PRIORITY interrupts: they bypass the session's
 * command debounce and verse lockout (a correction usually arrives seconds
 * after the wrong verse went up — exactly when lockouts would eat it).
 * Every correction is also a free training sample for the correction ledger.
 */

import type { VoiceCommandEvent } from '../../shared/types'
import { parseNumberToken, parseSpokenNumber } from './referenceResolver'

export interface DisplayedRef {
  book: string
  chapter: number
  verse: number
  displayedAt: number
}

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
  onPrayerChange: (inPrayer: boolean) => void
  /** Every recognized command, for logging/UI/ledger. */
  onCommand: (event: VoiceCommandEvent) => void
}

/** Spoken names → version codes. Only versions present in the DB fire. */
export const VERSION_PHRASES: Array<{ phrases: string[]; code: string }> = [
  { phrases: ['new king james version', 'new king james'], code: 'NKJV' },
  { phrases: ['king james version', 'king james', 'authorized version'], code: 'KJV' },
  { phrases: ['new international version', 'n i v'], code: 'NIV' },
  { phrases: ['english standard version', 'e s v'], code: 'ESV' },
  { phrases: ['new living translation', 'n l t'], code: 'NLT' },
  { phrases: ['new american standard bible', 'new american standard'], code: 'NASB' },
  { phrases: ['amplified bible', 'the amplified', 'amplified version'], code: 'AMP' },
  { phrases: ['message translation', 'the message bible'], code: 'MSG' },
  { phrases: ['world english bible'], code: 'WEB' },
  { phrases: ['american standard version'], code: 'ASV' },
  { phrases: ['revised standard version'], code: 'RSV' },
  { phrases: ['bible in basic english', 'basic english bible', 'basic english version'], code: 'BBE' },
  { phrases: ['new revised standard version'], code: 'NRSV' },
  { phrases: ['christian standard bible'], code: 'CSB' }
]

/** How long after a verse leaves the screen its context still counts. */
const CONTEXT_WINDOW_MS = 60_000
const COMMAND_DEDUP_MS = 3000

export class VoiceCommandEngine {
  private cb: VoiceCommandCallbacks
  private now: () => number
  private inPrayer = false
  private lastFired: Record<string, number> = {}

  constructor(cb: VoiceCommandCallbacks, now: () => number = Date.now) {
    this.cb = cb
    this.now = now
  }

  isInPrayer(): boolean {
    return this.inPrayer
  }

  /** Feed final ASR chunks. Returns true if a command consumed the text. */
  process(text: string): boolean {
    const t = ' ' + text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim() + ' '
    const now = this.now()

    // ---- prayer mode ----
    if (!this.inPrayer && /\b(let us pray|let's pray|bow your heads|every head bowed)\b/.test(t)) {
      this.inPrayer = true
      this.fire({ kind: 'prayer-start', utterance: text, ts: now })
      this.cb.onPrayerChange(true)
      return true
    }
    if (this.inPrayer && /\bamen\b/.test(t)) {
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
      for (const { phrases, code } of VERSION_PHRASES) {
        if (phrases.some((p) => t.includes(' ' + p + ' '))) {
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
      // "I said verse thirty four" / "I said thirty four"
      let m = t.match(/\bi said,? (?:verse )?([a-z0-9 -]{1,24}?)(?: not | i said | that's |\s*$)/)
      if (m) {
        const n = parseNumberToken(m[1].replace(/-/g, ' ').trim())
        if (n !== null && n !== displayed!.verse) {
          if (this.dedup('correct:' + n, now)) return false
          console.log(`🗣️ Correction: "${text.trim()}" → verse ${n}`)
          this.fire({ kind: 'correction-verse', utterance: text, value: n, ts: now })
          this.cb.onVerseCorrection(n)
          return true
        }
      }
      // "not verse twenty four, verse thirty four" / "not twenty four, thirty four"
      // Token-parsed (not regex) — number words contain spaces, and a lazy
      // regex splits "twenty four verse thirty four" at the wrong seam.
      {
        const words = t.trim().replace(/-/g, ' ').split(' ')
        const notIdx = words.indexOf('not')
        if (notIdx >= 0) {
          let i = notIdx + 1
          if (words[i] === 'verse') i++
          const first = parseSpokenNumber(words, i)
          if (first) {
            let j = i + first.consumed
            if (words[j] === 'but') j++
            if (words[j] === 'verse') j++
            const second = parseSpokenNumber(words, j)
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
      // "I said chapter five"
      m = t.match(/\bi said,? chapter ([a-z0-9 -]{1,24}?)\s*$/)
      if (m) {
        const n = parseNumberToken(m[1].replace(/-/g, ' ').trim())
        if (n !== null && n !== displayed!.chapter) {
          if (this.dedup('correct-ch:' + n, now)) return false
          this.fire({ kind: 'correction-chapter', utterance: text, value: n, ts: now })
          this.cb.onChapterCorrection(n)
          return true
        }
      }

      // ---- display control ----
      if (/\b(take (that|it) down|clear the screen|take it off)\b/.test(t)) {
        if (this.dedup('dismiss', now)) return false
        this.fire({ kind: 'display-dismiss', utterance: text, ts: now })
        this.cb.onDismiss()
        return true
      }
      if (/\b(leave (that|it) up|keep (that|it) up|keep it there)\b/.test(t)) {
        if (this.dedup('hold', now)) return false
        this.fire({ kind: 'display-hold', utterance: text, ts: now })
        this.cb.onHold()
        return true
      }
    }

    return false
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
