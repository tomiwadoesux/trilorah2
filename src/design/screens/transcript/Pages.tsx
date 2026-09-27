import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TranscriptStripProps } from './types';
import { nextLineId, wordsOf, type Word } from './words';
import { StripShell, emptyLine, D27_FONT, D27_HEIGHT, D27_LEADING } from './StripShell';
import { WordSpan } from './wordView';
import './transcript.css';
import { useLineMeasure, wrap, type Measure, type Placed } from './measure';

/*
 * D-27 option: PAGES — film subtitles.
 *
 * One caption of up to two lines holds perfectly still while it fills;
 * when the next word will not fit, the caption is replaced by a fresh one
 * that starts with that word. Nothing the eye is on ever moves: text only
 * ever APPEARS (at the end of the caption) or LEAVES (all of it at once,
 * when the page turns). That is the whole bargain of subtitles, and why a
 * film audience can read them without effort.
 *
 * A page also turns at a natural break: once it is more than 60% full, a
 * new utterance starts on a fresh page rather than being split across two.
 * Deepgram commits at pauses, so this is a turn at a breath, where the
 * reader has just been given time to finish. Words are never held back —
 * the new page is on screen the instant its first word is heard.
 *
 * Measure. A caption is capped at about 100 characters a line and centred
 * as a BLOCK, with its lines left-aligned inside it. Across the full ~1100px
 * strip a line runs 170 characters, far past what can be taken in at a
 * glance; centring each line (as films do) would move every line's start,
 * and re-finding a moving start is exactly the hunting the shipped
 * centred strip made the eye do. A centred block with a hard left edge
 * keeps both: the caption sits where the eye expects it, and every line
 * starts at the same x.
 *
 * The page being left fades out and lifts 4px over 160ms while the new one
 * arrives in its place — one quick turn, not a slide.
 */

const LINES = 2;
/** Characters a caption line may hold, at most. */
const MEASURE_CH = 100;
/** How full a page must be before a new utterance gets a fresh one. */
const TURN_AT = 0.6;
const UTTERANCE_GAP = 2;

interface Page {
  key: string;
  lines: Placed[][];
}

/** Width of an average character in this font, for the measure cap. */
function chWidth(measure: Measure) {
  return measure('abcdefghijklmnopqrstuvwxyz') / 26;
}

/*
 * Lay out the page starting at `from`, turning it as needed. Returns where
 * the page now starts and its lines.
 */
function paginate(words: Word[], from: number, room: number, measure: Measure) {
  for (let guard = 0; guard < 400; guard++) {
    const lines = wrap(words.slice(from), room, measure, UTTERANCE_GAP);
    if (lines.length > LINES) {
      /* Overflow: the word that would start line three starts the next page. */
      from = words.indexOf(lines[LINES][0].w);
      continue;
    }
    /* A natural break: the newest utterance start inside this page, if the
       page before it is already TURN_AT full. */
    let breakAt = -1;
    let fillAtBreak = 0;
    lines.forEach((line, li) => {
      let x = 0;
      for (const p of line) {
        if (p.w.index === 0 && (li > 0 || x > 0)) {
          breakAt = words.indexOf(p.w);
          fillAtBreak = (li * room + x) / (LINES * room);
        }
        x += p.lead + measure(p.w.text, p.w.ref);
      }
    });
    if (breakAt > from && fillAtBreak >= TURN_AT) {
      from = breakAt;
      continue;
    }
    return { from, lines };
  }
  return { from, lines: wrap(words.slice(from), room, measure, UTTERANCE_GAP).slice(0, LINES) };
}

export function PagesTranscript({ spoken, asr, onOpenDashboard }: TranscriptStripProps) {
  const [box, setBox] = useState<HTMLSpanElement | null>(null);
  const { measure, width } = useLineMeasure(box);
  const words = useMemo(() => wordsOf(spoken, 400), [spoken]);
  const currentId = spoken.partial ? nextLineId(spoken) : spoken.lines[spoken.lines.length - 1]?.id;

  const start = useRef<string | null>(null);
  const room = measure && width > 0 ? Math.min(width, chWidth(measure) * MEASURE_CH) : 0;
  const page = useMemo<Page | null>(() => {
    if (!measure || room <= 0 || words.length === 0) return null;
    let from = start.current ? words.findIndex((w) => w.key === start.current) : 0;
    if (from < 0) from = 0;
    const out = paginate(words, from, room, measure);
    start.current = words[out.from]?.key ?? null;
    return { key: words[out.from].key, lines: out.lines };
  }, [words, room, measure]);

  /*
   * The page being turned away. Held for the length of its exit and then
   * dropped. What leaves is the page exactly as it was last drawn.
   */
  const shown = useRef<Page | null>(null);
  const [leaving, setLeaving] = useState<Page | null>(null);
  useLayoutEffect(() => {
    const was = shown.current;
    shown.current = page;
    if (!was || !page || was.key === page.key) return;
    setLeaving(was);
    const t = window.setTimeout(() => setLeaving((l) => (l === was ? null : l)), 200);
    return () => window.clearTimeout(t);
  }, [page]);

  const draw = (p: Page, out: boolean) => (
    <span
      key={(out ? 'out:' : '') + p.key}
      aria-hidden={out || undefined}
      className={out ? 'tri-page-out absolute inset-0 block' : 'absolute inset-0 block'}
    >
      {p.lines.map((line) => (
        <span key={line[0].w.key} className="block whitespace-nowrap" style={{ height: D27_LEADING }}>
          {line.map(({ w, lead }) => (
            <WordSpan
              key={w.key}
              w={w}
              strength={w.lineId === currentId || out ? 1 : 0.6}
              style={{ marginLeft: lead }}
            />
          ))}
        </span>
      ))}
    </span>
  );

  return (
    <StripShell live={asr === 'listening'} onOpen={onOpenDashboard} height={D27_HEIGHT} padInline="1.25rem">
      <span
        ref={setBox}
        className="relative flex min-w-0 flex-1 self-stretch justify-center font-medium"
        style={{ fontSize: D27_FONT, lineHeight: D27_LEADING, color: 'var(--tri-ink)' }}
      >
        <span className="relative block h-full text-left" style={{ width: room || '100%' }}>
          {words.length === 0 ? (
            <span className="block whitespace-nowrap opacity-45">{emptyLine(asr)}</span>
          ) : (
            <>
              {leaving && draw(leaving, true)}
              {page && draw(page, false)}
            </>
          )}
        </span>
      </span>
    </StripShell>
  );
}
