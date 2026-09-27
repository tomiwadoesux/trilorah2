import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TranscriptStripProps } from './types';
import { nextLineId, wordsOf } from './words';
import { StripShell, emptyLine, D27_FONT, D27_HEIGHT, D27_LEADING } from './StripShell';
import { WordSpan } from './wordView';
import { useLineMeasure, wrap } from './measure';

/*
 * D-27 option: ROLL-UP — broadcast captions.
 *
 * One running paragraph, left-aligned, two lines showing. Words land at the
 * end of the bottom line; when it fills, the paragraph rolls up a line and
 * the top line leaves upward through a soft edge. It is how live TV has
 * captioned speech for forty years, for a reason: the eye can stay on the
 * bottom line and read at the speed of speech, and the line above is the
 * sentence that led into it — context for free, in reading order.
 *
 * The lines are laid out here, not by the browser (see measure.ts): the
 * paragraph is wrapped greedily from a START word that only ever moves
 * forward, a whole line at a time, so a line keeps its words once it has
 * them. A browser-wrapped paragraph would re-wrap every line each time an
 * old word fell off the front, and the line being read would jump.
 *
 * The roll is a FLIP: when a new bottom line appears the stack is put back
 * where it was with a transform and let go, 280ms on the house ease-out. It
 * is the only thing that moves, and it always moves the same way — up. The
 * line rolling out fades as it goes, so it leaves rather than being cut off
 * at the top edge.
 *
 * Words the engine hands over together (an interim result often adds two or
 * three at once) flow in one after another, 45ms apart, instead of landing
 * as a block — the strip keeps the cadence of speech even when the engine
 * does not.
 *
 * No listening dot: the status orb in the header already says whether the
 * engine is listening, and a pulsing green light in the corner of the text
 * pulled the eye off the words.
 *
 * The utterance being said is at full strength and earlier ones a step
 * dimmer, so where the current sentence starts is visible without anything
 * shifting. A new utterance also starts after a slightly wider space.
 */

/** Two showing, and the one rolling out above them. */
const KEEP_LINES = 3;
/** Committed words from earlier utterances. */
const OLDER_A = 0.55;
/** Spaces before a new utterance. */
const UTTERANCE_GAP = 2;
const ROLL_MS = 280;
/** Between words that arrived in the same update; at most STAGGER_MAX steps. */
const STAGGER_MS = 45;
const STAGGER_MAX = 4;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function RollUpTranscript({ spoken, asr, onOpenDashboard }: TranscriptStripProps) {
  const [box, setBox] = useState<HTMLSpanElement | null>(null);
  const { measure, width } = useLineMeasure(box);
  const words = useMemo(() => wordsOf(spoken, 400), [spoken]);

  /* Each word's place in the queue it arrived in: the first new word of
     an update has no delay, the next 45ms, and so on. Assigned ONCE and
     kept, so a later render cannot reset a word's delay mid-fade. */
  const delays = useRef(new Map<string, number>());
  let queued = 0;
  for (const w of words) {
    if (!delays.current.has(w.key)) delays.current.set(w.key, Math.min(queued++, STAGGER_MAX) * STAGGER_MS);
  }
  useEffect(() => {
    const live = new Set(words.map((w) => w.key));
    for (const k of delays.current.keys()) if (!live.has(k)) delays.current.delete(k);
  }, [words]);

  const currentId = spoken.partial ? nextLineId(spoken) : spoken.lines[spoken.lines.length - 1]?.id;

  /*
   * Where the paragraph starts. Advanced only by whole lines, and only
   * forward. If the start word is gone — the engine revised the partial it
   * sat in — the wrap begins again from the oldest word kept, which lands
   * on the same breaks for everything already committed.
   */
  const start = useRef<string | null>(null);
  const lines = useMemo(() => {
    if (!measure || width <= 0 || words.length === 0) return [];
    let from = start.current ? words.findIndex((w) => w.key === start.current) : 0;
    if (from < 0) from = 0;
    let ls = wrap(words.slice(from), width, measure, UTTERANCE_GAP);
    if (ls.length > KEEP_LINES) ls = ls.slice(ls.length - KEEP_LINES);
    start.current = ls[0]?.[0]?.w.key ?? null;
    return ls;
  }, [words, width, measure]);

  /* The roll. Keyed on the bottom line's first word: it changes exactly
     when a new line has started. */
  const stack = useRef<HTMLSpanElement>(null);
  const bottomKey = lines[lines.length - 1]?.[0]?.w.key;
  const lastBottom = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const el = stack.current;
    const was = lastBottom.current;
    lastBottom.current = bottomKey;
    if (!el || !was || !bottomKey || was === bottomKey || reducedMotion()) return;
    const line = el.lastElementChild as HTMLElement | null;
    const lh = line?.offsetHeight ?? 0;
    if (!lh) return;
    el.style.transition = 'none';
    el.style.transform = `translateY(${lh}px)`;
    void el.offsetHeight;
    el.style.transition = `transform ${ROLL_MS}ms var(--tri-ease-out)`;
    el.style.transform = 'translateY(0)';
  }, [bottomKey]);

  const empty = words.length === 0;

  return (
    <StripShell
      live={asr === 'listening'}
      onOpen={onOpenDashboard}
      height={D27_HEIGHT}
      padInline="1.25rem"
      dot={false}
    >
      <span
        ref={setBox}
        className="relative block min-w-0 flex-1 self-stretch overflow-hidden text-left font-medium"
        style={{
          fontSize: D27_FONT,
          lineHeight: D27_LEADING,
          color: 'var(--tri-ink)',
          /* A soft top edge, so the line rolling out fades as it leaves
             rather than being guillotined. Shallow: the top line is still
             there to be read. */
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 5px)',
        }}
      >
        <span ref={stack} className="absolute inset-x-0 bottom-0 block">
          {empty ? (
            <span className="block whitespace-nowrap opacity-45">{emptyLine(asr)}</span>
          ) : (
            lines.map((line, i) => (
              <span
                key={line[0].w.key}
                className="block whitespace-nowrap"
                style={{
                  height: D27_LEADING,
                  /* The third line up is the one rolling out of view. */
                  opacity: lines.length > 2 && i === 0 ? 0 : 1,
                  transition: `opacity ${ROLL_MS}ms var(--tri-ease-out)`,
                }}
              >
                {line.map(({ w, lead }) => (
                  <WordSpan
                    key={w.key}
                    w={w}
                    strength={w.lineId === currentId ? 1 : OLDER_A}
                    style={{ marginLeft: lead, animationDelay: `${delays.current.get(w.key) ?? 0}ms` }}
                  />
                ))}
              </span>
            ))
          )}
        </span>
      </span>
    </StripShell>
  );
}
