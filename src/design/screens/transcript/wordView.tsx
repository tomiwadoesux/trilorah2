import type { CSSProperties } from 'react';
import { cx } from '../../../ui';
import type { Word } from './words';
import './transcript.css';

/*
 * One word of the transcript as every D-27 design draws it.
 *
 * Softer while the engine is still guessing (PARTIAL_A), full once the
 * utterance is committed — the same element, so it brightens in place.
 * Only a step softer: these are the words being said NOW, and at 0.6 they
 * read dimmer than the sentences before them, which inverts the whole
 * point of the strip. Designs dim OLDER context below this instead.
 * The inner span is keyed by the TEXT: when the engine revises a word
 * ("forgotten" → "begotten") only that span remounts and crossfades, the
 * word's place in the line does not.
 */
export const PARTIAL_A = 0.8;

/** The one way a scripture reference is lit in the strip. */
export const REF_CLASS = 'font-semibold text-[var(--tri-accent-yellow)]';

export function WordSpan({
  w,
  strength = 1,
  arrive = true,
  text,
  className,
  style,
}: {
  w: Word;
  /** Opacity for a committed word (older context can be dimmer). */
  strength?: number;
  /** Play the arrival. Off where a word is MOVED, not heard — a line
      promoted to context has already arrived once. */
  arrive?: boolean;
  /** Draw this instead of w.text (a reference drawn without its full stop). */
  text?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const shown = text ?? w.text;
  return (
    <span
      className={cx('tri-word', arrive && 'tri-word--in', w.ref && REF_CLASS, className)}
      style={{ opacity: w.partial ? PARTIAL_A * strength : strength, ...style }}
    >
      <span key={shown} className={arrive ? 'tri-word-swap' : undefined}>
        {shown}
      </span>
    </span>
  );
}

/** A word's trailing punctuation, split off — "3:16." → ["3:16", "."]. */
export function splitTail(text: string): [string, string] {
  const m = /^(.*?)([.,;:!?"”’)]+)$/.exec(text);
  return m && m[1] ? [m[1], m[2]] : [text, ''];
}

/** Runs of words, split where a scripture reference starts or ends. */
export function refRuns(words: Word[]): { ref: boolean; words: Word[] }[] {
  const out: { ref: boolean; words: Word[] }[] = [];
  for (const w of words) {
    const last = out[out.length - 1];
    if (last && last.ref === w.ref) last.words.push(w);
    else out.push({ ref: w.ref, words: [w] });
  }
  return out;
}
