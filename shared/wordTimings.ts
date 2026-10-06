/**
 * Word timings — the difference between a transcript that fades and one that
 * follows the preacher.
 *
 * A congregant's phone can only highlight the word being said if it knows
 * WHEN each word was said. Deepgram returns that for every word and the app
 * was discarding it, so the phone could do no better than dim one paragraph
 * and brighten the next.
 *
 * Deliberately tiny keys. A forty-minute sermon is around six thousand words,
 * every one of them travelling to every phone in the building over a realtime
 * socket; `{w,s,e}` against `{word,start,end}` is roughly a third of the bytes
 * for exactly the same information.
 *
 * Pure and import-free: written by the Electron main process, read by the
 * Next.js companion page, and the two share nothing else.
 */

export interface WordTiming {
  /** The word as it should be READ — the recogniser's own casing. */
  w: string
  /** Seconds from the start of the recognised audio. */
  s: number
  e: number
  /** Session-local diarization label; never a preacher identity. */
  speaker?: number
}

/** Deepgram's per-word shape, as it arrives on the wire. */
interface DeepgramWord {
  word?: string
  punctuated_word?: string
  start?: number
  end?: number
  speaker?: number
}

/**
 * Deepgram's words → ours.
 *
 * `punctuated_word` is preferred because it carries the comma and the capital;
 * a phone showing "lord" where the preacher said "Lord," is the sort of detail
 * a congregation notices. Anything without a usable time is dropped rather
 * than guessed: a wrong highlight is worse than none.
 */
export function toWordTimings(words: unknown): WordTiming[] | null {
  if (!Array.isArray(words) || words.length === 0) return null
  const out: WordTiming[] = []
  for (const raw of words as DeepgramWord[]) {
    const w = (raw?.punctuated_word ?? raw?.word ?? '').trim()
    const s = typeof raw?.start === 'number' ? raw.start : NaN
    const e = typeof raw?.end === 'number' ? raw.end : NaN
    if (!w || !Number.isFinite(s) || !Number.isFinite(e) || e < s) continue
    out.push({ w, s: round(s), e: round(e), ...(Number.isInteger(raw.speaker) && raw.speaker! >= 0 ? { speaker: raw.speaker } : {}) })
  }
  return out.length > 0 ? out : null
}

/** Milliseconds are as fine as any of this gets; the rest is noise and bytes. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * How far into a chunk a listener is, given the clock the PHONE is running on.
 *
 * Two lags stack up and they are not the same thing. The stream a congregant
 * is watching runs behind the room (`streamDelayMs` — twenty to thirty
 * seconds is normal for YouTube). On top of that the page holds the
 * transcript back deliberately (`holdMs`), so a word lights up as it is heard
 * rather than a beat before, and so Deepgram's habit of revising the tail of
 * a sentence happens off-screen.
 */
export function playheadSeconds(
  now: number,
  serviceStartedAt: number,
  streamDelayMs: number,
  holdMs: number
): number {
  return Math.max(0, (now - serviceStartedAt - streamDelayMs - holdMs) / 1000)
}

/** Where a word sits against the playhead. */
export type WordState = 'said' | 'saying' | 'coming'

export function wordState(word: WordTiming, playhead: number): WordState {
  if (playhead >= word.e) return 'said'
  if (playhead >= word.s) return 'saying'
  return 'coming'
}

/**
 * The index of the word being spoken, or the last one finished.
 *
 * Returns -1 before the first word, so a caller can tell "nothing yet" from
 * "the first word". Linear from a hint index because it is called every
 * animation frame and the playhead only ever creeps forward — a binary search
 * would be more code to do the same job slower.
 */
export function activeWordIndex(words: readonly WordTiming[], playhead: number, hint = 0): number {
  if (words.length === 0 || playhead < words[0].s) return -1
  let i = Math.max(0, Math.min(hint, words.length - 1))
  while (i > 0 && words[i].s > playhead) i--
  while (i + 1 < words.length && words[i + 1].s <= playhead) i++
  return i
}
