import { BOOKS } from '../../../lib/books';
import type { Spoken } from './types';

/*
 * The transcript as WORDS with stable identities, for designs that animate
 * word by word.
 *
 * A word's key is its line id and its index in that line. The partial's
 * words are keyed with the id the engine will give the line when it
 * commits it (one past the newest final — spokenId is a plain counter), so
 * when an utterance goes final every word keeps its key and its element:
 * nothing remounts, a word only brightens. A word the engine revises keeps
 * its key too and changes its text in place.
 */
export interface Word {
  key: string;
  text: string;
  /** Still the engine's guess — the utterance has not been committed. */
  partial: boolean;
  lineId: number;
  index: number;
  /** Last word of its utterance (final lines only — a partial is open). */
  endsLine: boolean;
  /** Inside a scripture reference ("John 3:16", "Romans chapter 8"). */
  ref: boolean;
}

export function nextLineId(spoken: Spoken): number {
  return (spoken.lines[spoken.lines.length - 1]?.id ?? -1) + 1;
}

/** The newest `limit` words, oldest first. */
export function wordsOf(spoken: Spoken, limit = 120): Word[] {
  const out: Word[] = [];
  const push = (lineId: number, text: string, partial: boolean) => {
    const refs = referenceRanges(text);
    let at = 0;
    const parts = text.split(/\s+/).filter(Boolean);
    parts.forEach((w, index) => {
      const start = text.indexOf(w, at);
      at = start + w.length;
      out.push({
        key: `${lineId}:${index}`,
        text: w,
        partial,
        lineId,
        index,
        endsLine: !partial && index === parts.length - 1,
        ref: refs.some(([a, b]) => start < b && at > a),
      });
    });
  };
  for (const l of spoken.lines) push(l.id, l.text, false);
  if (spoken.partial) push(nextLineId(spoken), spoken.partial, true);
  return out.length > limit ? out.slice(out.length - limit) : out;
}

/*
 * Scripture references in a line, as [start, end) character ranges.
 *
 * A book name from the canon, then a chapter, then optionally a verse —
 * "John 3:16", "Romans 8:28-30", "Romans chapter 8", "John 3 verse 16".
 * Deliberately simple: this marks what to highlight in a glance strip, it
 * does not resolve anything. The resolver does that.
 */
const BOOK_ALT = [...BOOKS]
  .sort((a, b) => b.length - a.length)
  .map((b) => b.replace(/\s+/g, '\\s+'))
  .join('|');
const REF = new RegExp(
  `\\b(?:${BOOK_ALT})\\s+(?:chapter\\s+)?\\d+(?:(?::|,?\\s+verses?\\s+)\\d+(?:[-–]\\d+)?)?`,
  'gi',
);

export function referenceRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of text.matchAll(REF)) out.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  return out;
}
