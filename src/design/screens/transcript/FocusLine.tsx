import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TranscriptStripProps } from './types';
import { nextLineId, wordsOf, type Word } from './words';
import { StripShell, emptyLine, D27_FONT, D27_HEIGHT, D27_LEADING } from './StripShell';
import { WordSpan, refRuns, splitTail } from './wordView';
import './transcript.css';

/*
 * D-27 option: FOCUS LINE — what is being said now, large; what led into
 * it, small above.
 *
 * The bottom row is the utterance being heard, one line, a size up from
 * the rest of the strip. It is TAIL-ANCHORED: it grows from a hard left
 * margin until it meets the right edge, and from then on slides left as
 * each word arrives, so the newest word is always on screen — the shipped
 * strip truncated the END of a long sentence, which hid precisely the
 * words being said. Where earlier words leave on the left they fade.
 *
 * The slide is a FLIP on the line's own position (160ms, retargeting from
 * wherever it is if the next word lands mid-slide), so the line glides a
 * word at a time rather than jumping.
 *
 * The top row is the utterance before, smaller and at half strength, also
 * tail-anchored: its end is what leads into the line below. When the
 * engine commits an utterance and the next begins, the line PROMOTES — it
 * travels from the bottom row to the top, shrinking and dimming into place
 * in one 240ms gesture — so the eye can follow the sentence it was reading
 * rather than see it vanish.
 *
 * Scripture references are lit as a soft pill: the one thing an operator
 * scanning this strip mid-service is looking for is a verse being called,
 * and a pill is found by the eye before it is read.
 */

const PROMOTE_MS = 240;
const SLIDE_MS = 160;
const CONTEXT_A = 0.5;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Current translateX of an element mid-transition, in px. */
function liveX(el: HTMLElement) {
  const t = getComputedStyle(el).transform;
  return t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : 0;
}

/**
 * The words of one line, references grouped into pills. A reference's
 * closing punctuation is drawn after the pill, not inside it — the pill is
 * the verse, and "John 3:16." with the full stop boxed reads as a typo.
 * `arrive` is off for the context line: its words were heard already.
 */
function Words({ words, pills, arrive }: { words: Word[]; pills: boolean; arrive: boolean }) {
  return (
    <>
      {refRuns(words).map((run, i) => {
        const lastW = run.words[run.words.length - 1];
        const [lastText, tail] = run.ref && pills ? splitTail(lastW.text) : [lastW.text, ''];
        const inner = run.words.map((w, j) => (
          <span key={w.key}>
            {j > 0 && ' '}
            <WordSpan w={w} arrive={arrive} text={w === lastW ? lastText : undefined} />
          </span>
        ));
        return (
          <span key={run.words[0].key}>
            {i > 0 && ' '}
            {run.ref && pills ? (
              <>
                <span className="rounded-[6px] bg-[color-mix(in_srgb,var(--tri-accent-yellow)_14%,transparent)] px-[5px] py-px">
                  {inner}
                </span>
                {tail && <span style={{ opacity: lastW.partial ? 0.8 : 1 }}>{tail}</span>}
              </>
            ) : (
              inner
            )}
          </span>
        );
      })}
    </>
  );
}

export function FocusLineTranscript({ spoken, asr, onOpenDashboard }: TranscriptStripProps) {
  const words = useMemo(() => wordsOf(spoken, 240), [spoken]);

  /* The current utterance is the one being heard, or — in a pause — the
     one just committed; the context is the one before it. */
  const lines = spoken.lines;
  const currentId = spoken.partial ? nextLineId(spoken) : lines[lines.length - 1]?.id;
  const contextId = spoken.partial ? lines[lines.length - 1]?.id : lines[lines.length - 2]?.id;
  const current = words.filter((w) => w.lineId === currentId);
  const context = contextId === undefined ? [] : words.filter((w) => w.lineId === contextId);

  const curText = useRef<HTMLSpanElement>(null);
  const curRow = useRef<HTMLSpanElement>(null);
  const ctxText = useRef<HTMLSpanElement>(null);
  const ctxRow = useRef<HTMLSpanElement>(null);
  const [curClipped, setCurClipped] = useState(false);
  const [ctxClipped, setCtxClipped] = useState(false);

  /* Last frame's bottom line: which utterance, where it sat on screen, and
     its layout offset — what the promotion and the slide start from. */
  const last = useRef<{ id?: number; rect?: DOMRect; offset: number }>({ offset: 0 });

  useLayoutEffect(() => {
    const cur = curText.current;
    const ctx = ctxText.current;
    const was = last.current;
    const still = reducedMotion();

    setCurClipped(Boolean(cur && curRow.current && cur.scrollWidth > curRow.current.clientWidth + 1));
    setCtxClipped(Boolean(ctx && ctxRow.current && ctx.scrollWidth > ctxRow.current.clientWidth + 1));

    /* Promotion: the line that was at the bottom is now the context line. */
    if (!still && ctx && was.rect && was.id !== undefined && was.id === contextId && contextId !== currentId) {
      const now = ctx.getBoundingClientRect();
      const s = now.width > 0 ? was.rect.width / now.width : 1;
      ctx.style.transition = 'none';
      ctx.style.transformOrigin = 'left top';
      ctx.style.transform = `translate(${was.rect.left - now.left}px, ${was.rect.top - now.top}px) scale(${s})`;
      ctx.style.opacity = '1';
      void ctx.offsetHeight;
      ctx.style.transition = `transform ${PROMOTE_MS}ms var(--tri-ease-out), opacity ${PROMOTE_MS}ms var(--tri-ease-out)`;
      ctx.style.transform = '';
      ctx.style.opacity = String(CONTEXT_A);
    }

    /* The slide: the same utterance moved left because a word arrived. */
    if (cur) {
      const offset = cur.offsetLeft;
      if (!still && was.id === currentId && offset !== was.offset) {
        const from = was.offset + liveX(cur) - offset;
        cur.style.transition = 'none';
        cur.style.transform = `translateX(${from}px)`;
        void cur.offsetHeight;
        cur.style.transition = `transform ${SLIDE_MS}ms var(--tri-ease-out)`;
        cur.style.transform = '';
      }
      last.current = { id: currentId, rect: cur.getBoundingClientRect(), offset };
    } else {
      last.current = { offset: 0 };
    }
  });

  /* Earlier words leave on the left through a fade — only when there are
     earlier words off the edge, so a short line's first word is crisp. */
  const leftFade = 'linear-gradient(to right, transparent 0, #000 2.5em)';

  return (
    <StripShell live={asr === 'listening'} onOpen={onOpenDashboard} height={D27_HEIGHT} padInline="1.25rem">
      <span
        className="flex min-w-0 flex-1 flex-col justify-center self-stretch font-medium"
        style={{ color: 'var(--tri-ink)' }}
      >
        <span
          ref={ctxRow}
          className="flex min-w-0 justify-end overflow-hidden"
          style={{
            fontSize: `calc(${D27_FONT} - 2px)`,
            lineHeight: `calc(${D27_LEADING} - 3px)`,
            height: `calc(${D27_LEADING} - 3px)`,
            maskImage: ctxClipped ? leftFade : undefined,
          }}
        >
          {/* mr-auto: with room it sits left; without, justify-end wins and
              the line hangs off the LEFT, keeping its end in view. */}
          <span
            key={contextId ?? 'none'}
            ref={ctxText}
            className="mr-auto shrink-0 whitespace-nowrap"
            style={{ opacity: CONTEXT_A }}
          >
            <Words words={context} pills={false} arrive={false} />
          </span>
        </span>
        <span
          ref={curRow}
          className="flex min-w-0 justify-end overflow-hidden"
          style={{
            fontSize: `calc(${D27_FONT} + 1px)`,
            lineHeight: `calc(${D27_LEADING} + 3px)`,
            height: `calc(${D27_LEADING} + 3px)`,
            maskImage: curClipped ? leftFade : undefined,
          }}
        >
          <span key={currentId ?? 'none'} ref={curText} className="mr-auto shrink-0 whitespace-nowrap">
            {current.length ? (
              <Words words={current} pills arrive />
            ) : (
              <span className="opacity-45">{emptyLine(asr)}</span>
            )}
          </span>
        </span>
      </span>
    </StripShell>
  );
}
