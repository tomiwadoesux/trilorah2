/**
 * MIRROR of /shared/wordTimings.ts — the playhead half of it.
 *
 * Copied rather than imported on purpose. The Vercel project for this app has
 * its root directory set to `web/`, so `../shared` is outside the build
 * context: an alias or tsconfig path resolves fine on a laptop and then the
 * deploy cannot find the file. Four pure functions with their own tests are a
 * smaller risk than a build that only breaks in production.
 *
 * `toWordTimings` is deliberately NOT mirrored — that one runs in the Electron
 * main process against Deepgram's wire shape and the phone never sees it. If
 * the shared module's playhead maths changes, change it here too; both sides
 * have tests that would catch a divergence in behaviour, not in text.
 */

export interface WordTiming {
  /** The word as it should be READ — the recogniser's own casing. */
  w: string;
  /** Seconds from the start of the recognised audio. */
  s: number;
  e: number;
}

/**
 * How far into a chunk a listener is, given the clock the PHONE is running on.
 *
 * Two lags stack up and they are not the same thing. The stream a congregant
 * is watching runs behind the room (`streamDelayMs` — twenty to thirty
 * seconds is normal for YouTube). On top of that the page holds the transcript
 * back deliberately (`holdMs`), so a word lights up as it is heard rather than
 * a beat before, and so Deepgram's habit of revising the tail of a sentence
 * happens off-screen.
 */
export function playheadSeconds(
  now: number,
  serviceStartedAt: number,
  streamDelayMs: number,
  holdMs: number,
): number {
  return Math.max(0, (now - serviceStartedAt - streamDelayMs - holdMs) / 1000);
}

/** Where a word sits against the playhead. */
export type WordState = "said" | "saying" | "coming";

export function wordState(word: WordTiming, playhead: number): WordState {
  if (playhead >= word.e) return "said";
  if (playhead >= word.s) return "saying";
  return "coming";
}

/**
 * The index of the word being spoken, or the last one finished.
 *
 * Returns -1 before the first word, so a caller can tell "nothing yet" from
 * "the first word". Linear from a hint index because it is called every
 * animation frame and the playhead only ever creeps forward — a binary search
 * would be more code to do the same job slower.
 */
export function activeWordIndex(
  words: readonly WordTiming[],
  playhead: number,
  hint = 0,
): number {
  if (words.length === 0 || playhead < words[0].s) return -1;
  let i = Math.max(0, Math.min(hint, words.length - 1));
  while (i > 0 && words[i].s > playhead) i--;
  while (i + 1 < words.length && words[i + 1].s <= playhead) i++;
  return i;
}
