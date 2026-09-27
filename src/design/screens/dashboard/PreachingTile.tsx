import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Panel } from '../parts';
import { EmptyMark, UnrollArt } from '../emptyArt';
import { useEngine } from '../engine';
import { useLineMeasure, wrap } from '../transcript/measure';
import { nextLineId, referenceRanges, wordsOf, type Word } from '../transcript/words';
import { Expandable } from './expand';
import { cx } from '../../../ui';
import '../transcript/transcript.css';

/*
 * PreachingTile — the preacher's words, as they are said.
 *
 * The card is a history running up and away, and a PILL at its foot holding
 * the sentence in flight. Words land in the pill; when the pill is full,
 * the whole card rolls up a line and the line that left the pill joins the
 * history above it. Nothing is ever swapped out: a sentence completes where
 * it stands and travels upward, dimming as it goes, so the eye never loses
 * the line it was reading at the moment it finishes.
 *
 * The pill hugs its content. It used to reserve four lines of height for a
 * sentence that is usually one, which left most of the card an empty
 * rectangle; now it is one line tall and grows to two or three only while a
 * long sentence is actually in it.
 *
 * Pressing the card opens it, and the opened card is the whole service:
 * everything said, scrollable, with the references lit. The booth's
 * question after "he just quoted something" is "what was it", and that
 * question is answered here rather than on another screen.
 *
 * The rolling paragraph is the same mechanism as the operator screen's
 * transcript strip (see transcript/RollUp): wrapped here rather than by the
 * browser, because a browser-wrapped paragraph re-wraps from its first word
 * every time the text changes — and this text changes at both ends, so one
 * word falling off the front would re-break every line below it and the
 * line being read would jump.
 */

/* Committed lines above the pill, newest first. Past the end of the list,
   everything shares the last value — a deeper ladder made old lines
   decorative rather than readable, and a preacher who says "as I read a
   moment ago" needs that sentence. */
const LADDER = [0.68, 0.52, 0.42];
const ROLL_MS = 280;
/** Staggered arrival for words the engine hands over in one update. */
const STAGGER_MS = 45;
const STAGGER_MAX = 4;
/** Spaces before a new utterance, so sentence boundaries are visible. */
const UTTERANCE_GAP = 2;
/** Words kept in the rolling paragraph. The opened card holds the rest. */
const KEEP_WORDS = 600;
/** Lines the pill shows before its own oldest line rolls out into history. */
const PILL_MAX_LINES = 3;
const PILL_FONT = 16;
const PILL_LEADING = 1.5;
/* The pill's interior is EXACTLY three lines, always. Not a minimum it
   grows past: a box that changes height while a sentence is being said
   drags the history and the footer with it, and a moving box is unreadable
   at exactly the moment it has the most to say. Three lines of room, fixed,
   and the text sits at the BOTTOM of them. */
const PILL_LINE_H = Math.round(PILL_FONT * PILL_LEADING);
/* A line box is exactly its leading, so the last line's descenders — the
   tails of g, y, p — fall BELOW it and an overflow-hidden box at exactly
   three leadings shaves them off. The extra few pixels are that overhang,
   not padding: without them "straightway" is cut through the middle. */
const PILL_DESCENT = 5;
/* Words in the pill from a sentence that has already finished. Close to
   full: they are still the live text, just no longer the newest of it. */
const PILL_SETTLED_A = 0.78;
const PILL_BODY_H = PILL_LINE_H * PILL_MAX_LINES + PILL_DESCENT;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/* A line with its scripture references lit — the one thing on this card
   drawn in a colour, because catching a quoted verse is what it is for. */
function Marked({ text, dim }: { text: string; dim?: boolean }) {
  const ranges = referenceRanges(text);
  if (ranges.length === 0) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a > at) out.push(text.slice(at, a));
    out.push(
      <span
        key={i}
        className="font-semibold"
        style={{ color: dim ? 'rgb(228 216 122 / 0.6)' : 'var(--tri-accent-yellow)' }}
      >
        {text.slice(a, b)}
      </span>,
    );
    at = b;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

/** One word, with its arrival and its in-place correction. */
function WordSpan({ w, opacity, delay }: { w: Word; opacity: number; delay: number }) {
  return (
    <span
      className={cx('tri-word tri-word--in', w.ref && 'font-semibold text-[var(--tri-accent-yellow)]')}
      style={{ opacity, animationDelay: `${delay}ms` }}
    >
      {/* Keyed by the TEXT: when the engine revises a word the inner span
          remounts and crossfades, while the word keeps its place. */}
      <span key={w.text} className="tri-word-swap">
        {w.text}
      </span>
    </span>
  );
}

export function PreachingTile({ className }: { className?: string }) {
  return (
    <Expandable
      className={className}
      title="Preacher transcript"
      glyph={false}
      blurb="Everything said this service, newest last. References the engine recognised are lit."
      size={{ w: 760, h: 660 }}
      tile={({ onOpen }) => <TranscriptFace className="min-h-0 w-full flex-1" onOpen={onOpen} />}
    >
      <FullTranscript />
    </Expandable>
  );
}

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

function TranscriptFace({ className, onOpen }: { className?: string; onOpen: () => void }) {
  const engine = useEngine();
  const { spoken, asr } = engine;

  const isLive = asr === 'listening';
  const hasRealSpeech = spoken.lines.length > 0 || Boolean(spoken.partial);

  const words = useMemo(() => wordsOf(spoken, KEEP_WORDS), [spoken]);

  /*
   * The pill holds the newest THREE LINES of speech; the history holds
   * everything above them.
   *
   * The split is by lines, not by sentence. It used to be by sentence — the
   * pill took the utterance in flight and the history took the rest — and
   * that meant the pill's contents were decided by the preacher's pauses
   * rather than by the pill. A short sentence occupied one line and left
   * two empty, then the whole sentence was evicted the instant the next one
   * began. The box was three lines tall and almost never held more than
   * one, and a sentence never got to fill it.
   *
   * Now words leave the pill for one reason only: the pill is full. Speech
   * accumulates across sentence boundaries until three lines are used, and
   * from then on each new line pushes the oldest up into the history. That
   * is what makes the roll mean something — a line leaving is the pill
   * running out of room, which is the one event worth animating.
   *
   * `currentId` is still tracked, but only to tell the live utterance from
   * the settled ones for the caret.
   */
  const currentId = spoken.partial ? nextLineId(spoken) : spoken.lines[spoken.lines.length - 1]?.id;

  /* A word's stagger is assigned ONCE, so a later render cannot reset a
     delay mid-fade and make a word skip ahead of its neighbours. */
  const delays = useRef(new Map<string, number>());
  let queued = 0;
  for (const w of words) {
    if (!delays.current.has(w.key)) delays.current.set(w.key, Math.min(queued++, STAGGER_MAX) * STAGGER_MS);
  }
  useEffect(() => {
    const live = new Set(words.map((w) => w.key));
    for (const k of delays.current.keys()) if (!live.has(k)) delays.current.delete(k);
  }, [words]);

  /* Two fields, two measures: the pill is inset from the card, so a line
     that fits the history does not necessarily fit the pill. */
  const [historyField, setHistoryField] = useState<HTMLDivElement | null>(null);
  const [pillField, setPillField] = useState<HTMLDivElement | null>(null);
  const history = useLineMeasure(historyField);
  const pill = useLineMeasure(pillField);

  /*
   * The split, decided by the PILL.
   *
   * All the speech is wrapped once at the pill's width. The newest three of
   * those lines are the pill's, plus — while it is overflowing — the one
   * above them, which is drawn faded and rolls out as the stack moves up.
   * Everything before that belongs to the history, and is re-wrapped at the
   * history's own (wider) measure, because the two fields are different
   * widths and a line that fits one does not fit the other.
   *
   * Doing it in this order is what makes the pill fill: the boundary is
   * "the pill is full", computed in the pill's geometry, rather than "the
   * preacher stopped talking".
   */
  const pillWrap = useMemo(() => {
    if (!pill.measure || pill.width <= 0 || words.length === 0) return null;
    return wrap(words, pill.width, pill.measure, UTTERANCE_GAP);
  }, [words, pill.width, pill.measure]);

  /* How many lines the pill draws: its three, and the one rolling out. */
  const pillShown = pillWrap
    ? Math.min(pillWrap.length, PILL_MAX_LINES + (pillWrap.length > PILL_MAX_LINES ? 1 : 0))
    : 0;
  const pillLines = useMemo(
    () => (pillWrap ? pillWrap.slice(pillWrap.length - pillShown) : []),
    [pillWrap, pillShown],
  );

  /* The words above the pill's three — everything the pill no longer has
     room for. The rolling-out line belongs to BOTH: it is still drawn in
     the pill as it leaves, and it has already arrived in the history, so
     the eye follows one continuous column. */
  const pastWords = useMemo(() => {
    if (!pillWrap) return [];
    const kept = pillWrap.slice(pillWrap.length - Math.min(pillWrap.length, PILL_MAX_LINES));
    const firstKept = kept[0]?.[0]?.w.key;
    if (!firstKept) return [];
    const cut = words.findIndex((w) => w.key === firstKept);
    return cut <= 0 ? [] : words.slice(0, cut);
  }, [pillWrap, words]);

  const historyLines = useMemo(() => {
    if (!history.measure || history.width <= 0 || pastWords.length === 0) return [];
    return wrap(pastWords, history.width, history.measure, UTTERANCE_GAP);
  }, [pastWords, history.width, history.measure]);

  /* Which utterance in the history is how far back, for the ladder: the
     newest sentence above the pill is brightest, the ones before it step
     down. */
  const order = useMemo(() => {
    const ids: number[] = [];
    for (let i = pastWords.length - 1; i >= 0; i--) {
      if (!ids.includes(pastWords[i].lineId)) ids.push(pastWords[i].lineId);
    }
    return ids;
  }, [pastWords]);

  /*
   * The roll. When a new bottom line appears in the history — which is what
   * "the pill filled and a line left it" looks like from up here — the
   * column is put back where it was with a transform and let go, so the
   * lines above travel upward together rather than jumping in one frame.
   */
  const stack = useRef<HTMLDivElement>(null);
  const bottomKey = historyLines[historyLines.length - 1]?.[0]?.w.key;
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

  /*
   * The pill's own roll, the same gesture one box down.
   *
   * The sentence in flight fills from the BOTTOM of the pill: the first
   * line sits on the floor of the box, the second pushes it up, the third
   * pushes again, and from then on each new line rolls the stack up by one
   * and the line off the top fades out. It is the history's motion exactly,
   * which is the point — a sentence crossing from the pill into the history
   * above it never changes the way it moves, so the two boxes read as one
   * column of speech with a lit frame around its live end.
   */
  const pillStack = useRef<HTMLDivElement>(null);
  const pillBottomKey = pillLines[pillLines.length - 1]?.[0]?.w.key;
  const lastPillBottom = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const el = pillStack.current;
    const was = lastPillBottom.current;
    lastPillBottom.current = pillBottomKey;
    if (!el || !was || !pillBottomKey || was === pillBottomKey || reducedMotion()) return;
    el.style.transition = 'none';
    el.style.transform = `translateY(${PILL_LINE_H}px)`;
    void el.offsetHeight;
    el.style.transition = `transform ${ROLL_MS}ms var(--tri-ease-out)`;
    el.style.transform = 'translateY(0)';
  }, [pillBottomKey]);

  return (
    <Panel
      className={className}
      title="preacher transcript"
      blurb="what is being said, as it is said."
      onOpen={onOpen}
      bodyClass="pt-2 px-3 pb-3"
      right={
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
          <span
            className={cx(
              'size-1.5 rounded-full transition-all',
              /* Ink, not green. The bento is deliberately colourless and the
                 pulse alone already says "live". */
              isLive ? 'animate-pulse bg-[var(--tri-ink)]' : 'bg-white/30',
            )}
          />
          <span className="text-[10px] font-medium lowercase tracking-wide text-white/70">
            {isLive ? 'live mic' : asr}
          </span>
        </div>
      }
    >
      {/* The whole face opens the card. A div with a role rather than a
          <button>: the opened card is reached from anywhere on the face,
          and a button here would swallow a future control inside it. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        title="open the whole transcript"
        className="flex h-full min-h-0 cursor-pointer flex-col justify-end gap-2 text-left outline-none"
      >
        {/* The history: bottom-anchored, so the newest line sits against the
            pill and the column grows up out of the card rather than the
            text walking down it as the service fills. */}
        <div
          ref={setHistoryField}
          /* 14 against the pill's 16 — a step, not a drop. The history was
             13 and read as a different, lesser kind of text; the booth
             reads back through it as readily as it reads the line in
             flight, so the difference is ink and weight, not size. */
          className="relative min-h-0 flex-1 overflow-hidden text-left text-[14px]"
          /* The oldest line leaves through a soft edge rather than being
             guillotined by the panel's top. */
          style={{ maskImage: 'linear-gradient(to bottom, transparent 0, #000 26px)' }}
        >
          {/* Nothing said yet: the drawing goes HERE, in the history void,
              not in the pill. The pill is never actually empty — at rest it
              holds its own sentence inside real glass chrome, and a
              hairline box drawn next to a styled one is the signature of a
              component whose CSS failed to load. What is empty is the room
              above it. */}
          {historyLines.length === 0 && (
            <div className="absolute inset-0">
              <EmptyMark w={180} h={180} plain art={<UnrollArt />} play="hover" line="" />
            </div>
          )}
          <div ref={stack} className="absolute inset-x-0 bottom-0">
            {historyLines.map((line) => (
              <p key={line[0].w.key} className="whitespace-nowrap leading-[1.5]">
                {line.map(({ w, lead }) => {
                  const back = order.indexOf(w.lineId);
                  const a = LADDER[Math.min(back < 0 ? LADDER.length - 1 : back, LADDER.length - 1)];
                  return (
                    <span key={w.key} style={{ marginLeft: lead }}>
                      <WordSpan w={w} opacity={a} delay={delays.current.get(w.key) ?? 0} />
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        </div>

        {/* The pill.
 *
 *          Three lines of room, fixed, and the sentence fills them from the
 *          BOTTOM UP: a short sentence sits on the floor of the box with
 *          the air above it, and each new line pushes what is there upward
 *          on the same roll the history uses. The words being said are
 *          therefore always in the same place — the bottom line — which is
 *          where the eye can rest and read at the speed of speech. Filling
 *          from the top instead moved the live line down the box as the
 *          sentence grew, and the eye had to follow it.
 */}
        <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <div
            ref={setPillField}
            className="relative overflow-hidden text-[16px] leading-[1.5]"
            style={{
              height: PILL_BODY_H,
              /* The fourth line — the one rolling out of the pill — leaves
                 through a soft edge instead of being cut by the border. */
              maskImage: 'linear-gradient(to bottom, transparent 0, #000 12px)',
            }}
          >
            {pillLines.length === 0 ? (
              <p
                className="absolute inset-x-0 lowercase text-white/25"
                style={{ height: PILL_LINE_H, bottom: PILL_DESCENT }}
              >
                {isLive ? 'listening for the pulpit…' : 'transcripts appear here'}
              </p>
            ) : (
              <div
                ref={pillStack}
                className="absolute inset-x-0"
                /* Bottom-anchored, and lifted by the descent so the last
                   line's tails sit in the room reserved for them rather
                   than hanging past the floor of the box. */
                style={{ bottom: PILL_DESCENT }}
              >
                {pillLines.map((line, i) => (
                  <p
                    key={line[0].w.key}
                    className="whitespace-nowrap font-medium text-[var(--tri-ink)]"
                    style={{
                      height: PILL_LINE_H,
                      /* Above the three: the line on its way into history. */
                      opacity: pillLines.length > PILL_MAX_LINES && i === 0 ? 0 : 1,
                      transition: `opacity ${ROLL_MS}ms var(--tri-ease-out)`,
                    }}
                  >
                    {line.map(({ w, lead }) => (
                      <span key={w.key} style={{ marginLeft: lead }}>
                        {/* The sentence being said now is at full strength;
                            the ones settled above it in the pill step back
                            one notch, so where the current sentence begins
                            is visible without anything moving. */}
                        <WordSpan
                          w={w}
                          opacity={w.lineId === currentId ? 1 : PILL_SETTLED_A}
                          delay={delays.current.get(w.key) ?? 0}
                        />
                      </span>
                    ))}
                    {/* The caret follows the last word of the last line. */}
                    {Boolean(spoken.partial) && line === pillLines[pillLines.length - 1] && (
                      <span
                        className="ml-1 inline-block h-[0.85em] w-[2px] translate-y-[1px] animate-pulse rounded-sm bg-[var(--tri-accent-yellow)]"
                        aria-hidden="true"
                      />
                    )}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between text-[10px] lowercase text-white/30">
          <span>{hasRealSpeech ? 'tap for the whole transcript' : 'nothing heard yet'}</span>
          <span>{hasRealSpeech ? 'live speech' : isLive ? 'waiting for speech' : 'idle'}</span>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* The opened card                                                     */
/* ------------------------------------------------------------------ */

/*
 * Everything said this service, oldest first, pinned to the bottom so the
 * newest is under the eye when it opens and the service is scrolled back
 * into rather than out of.
 *
 * Plain wrapped paragraphs here, not the measured roll: nothing is
 * arriving at a rate that matters once the card is open, and a reader
 * scrolling back wants ordinary text.
 */
function FullTranscript() {
  const { spoken, asr } = useEngine();
  const lines = spoken.partial
    ? [...spoken.lines, { id: nextLineId(spoken), text: spoken.partial }]
    : spoken.lines;

  const box = useRef<HTMLDivElement>(null);
  const tail = lines[lines.length - 1]?.text ?? '';
  useLayoutEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, tail]);

  if (lines.length === 0) {
    return (
      <p className="px-1 py-6 text-[13px] lowercase text-white/35">
        {asr === 'listening' ? 'listening for the pulpit…' : 'nothing has been heard yet this service'}
      </p>
    );
  }

  return (
    <div ref={box} className="min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="flex flex-col gap-2.5">
        {lines.map((l, i) => (
          <p
            key={l.id}
            className={cx(
              'text-[14px] leading-[1.55] select-text',
              /* The newest is where the service is now; the rest is what
                 was said, at one flat readable weight. */
              i === lines.length - 1 ? 'font-medium text-[var(--tri-ink)]' : 'text-white/55',
            )}
          >
            <Marked text={l.text} dim={i !== lines.length - 1} />
          </p>
        ))}
      </div>
    </div>
  );
}
