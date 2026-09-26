import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Panel } from '../parts';
import { useEngine } from '../engine';
import { cx } from '../../../ui';

/*
 * PreachingTile — Preacher live transcript card (Kinetic Focus).
 *
 * Sits in the top-left panel of the dashboard. Formatted with 2-3 lines max,
 * left-aligned so words stream in from the left starting edge where the line begins,
 * allowing comfortable read-along as sentences form in real time.
 */

export function PreachingTile({ className }: { className?: string }) {
  const engine = useEngine();
  const { spoken, asr } = engine;

  const isLive = asr === 'listening';
  const hasRealSpeech = spoken.lines.length > 0 || Boolean(spoken.partial);

  /*
   * What was said before the line still forming.
   *
   * This used to keep a fixed handful of lines, because anything that did
   * not fit the tile was simply gone. The history scrolls now, so there is
   * no reason to throw any of it away — take every line the engine is still
   * holding and let the booth scroll back into the service.
   */
  const priorTexts = hasRealSpeech
    ? spoken.lines
        .slice(0, spoken.partial ? undefined : -1)
        .map((l) => l.text)
        .filter(Boolean)
    : [];

  /*
   * Before a word is heard this card used to preview itself with invented
   * scripture. On an operator surface during a service that is dangerous —
   * a glance cannot tell staged filler from what the preacher actually said.
   * The empty state now names itself and nothing more.
   */
  const activeText = hasRealSpeech
    ? spoken.partial || spoken.lines[spoken.lines.length - 1]?.text || ''
    : '';

  const isForming = Boolean(spoken.partial);

  /*
   * Stick to the bottom, unless the operator has deliberately left it.
   *
   * Speech lands every few seconds. If every new line snapped the view back
   * down, reading anything older than the last sentence would be impossible:
   * the moment the eye found a line it would be yanked away. So the view
   * only follows while it is already at the bottom. Scroll up and it holds
   * still; come back down and following re-arms itself. The test allows a
   * few pixels of slack because sub-pixel layout and momentum scrolling
   * rarely settle on an exact number.
   */
  const historyRef = useRef<HTMLDivElement | null>(null);
  const [following, setFollowing] = useState(true);
  /* Pointer over the history: hold still. Reading a line while the pulpit
     keeps talking is the one time the booth touches this tile, and a line
     that slides away under the pointer is the thing that makes them stop
     trying. Leave and it catches up. */
  const [held, setHeld] = useState(false);

  const onHistoryScroll = () => {
    const el = historyRef.current;
    if (!el) return;
    setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight <= 8);
  };

  /* Layout effect, not effect: the jump happens in the frame the new line is
     painted, so the older lines never flash at the bottom on their way past.
     Keyed on the last line's text as well as the count, because a partial
     grows in place — the sentence gets longer while the number of lines
     stays put, and a follower watching only the count would drift. */
  const historyTail = priorTexts[priorTexts.length - 1] ?? '';
  useLayoutEffect(() => {
    const el = historyRef.current;
    if (!el || !following || held) return;
    el.scrollTop = el.scrollHeight;
  }, [priorTexts.length, historyTail, following, held]);

  /* The tile lives in a bento that resizes with the window, and a shorter
     tile changes where "the bottom" is. Without this a follower ends up
     parked a line or two above the newest speech after a resize. */
  useEffect(() => {
    const el = historyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (following) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [following]);

  /*
   * The size stair.
   *
   * The card used to read big-then-small-small-small: one large live
   * sentence over a flat stack of identical 11px lines, which made the
   * history a block of grey rather than a sequence. Each step back is now a
   * little smaller and a little dimmer than the one below it, so the type
   * itself says how far back you are reading and the eye falls down the
   * stair into the sentence in flight. The steps stop shrinking after a
   * handful — below about 9px it is no longer a hierarchy, just unreadable,
   * and by then a line is context rather than something read word for word.
   */
  const STEPS: { size: number; alpha: number }[] = [
    { size: 13, alpha: 0.5 },
    { size: 12, alpha: 0.4 },
    { size: 11, alpha: 0.32 },
    { size: 10.5, alpha: 0.26 },
    { size: 10, alpha: 0.21 },
    { size: 9.5, alpha: 0.17 },
  ];
  const stepFor = (fromNewest: number) => STEPS[Math.min(fromNewest, STEPS.length - 1)];

  return (
    <Panel
      className={className}
      title="preacher transcript"
      bodyClass="pt-2 px-3 pb-3"
      right={
        <div className="flex items-center gap-2">
          {/* Live mic status badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
            <span
              className={cx(
                'size-1.5 rounded-full transition-all',
                isLive
                  /* Ink, not green. The bento is deliberately colourless and
                     the pulse alone already says "live" — a glowing mint dot
                     was the one saturated thing left on the card. */
                  ? 'animate-pulse bg-[var(--tri-ink)]'
                  : 'bg-white/30',
              )}
            />
            <span className="text-[10px] font-medium lowercase tracking-wide text-white/70">
              {isLive ? 'live mic' : asr}
            </span>
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col justify-between gap-2.5">
        {/* What came before — a scrollable history, pinned to the BOTTOM so
            the newest prior line sits nearest the sentence still forming and
            the older, smaller ones run up and off the top. flex-1 with the
            focus box left at its natural height: the history takes whatever
            the tile has spare, which is what grows when the card does.

            The bottom pinning is mt-auto on the inner column, NOT justify-end
            on the scroller. They look identical until the transcript is
            longer than the tile: justify-end on a scroll container pushes the
            overflow off the TOP, past scrollTop 0, where no scrollbar can
            reach it — the oldest lines would exist and be unreachable, which
            is the one thing this change is meant to fix. An auto margin
            collapses to nothing once the content fills the box, so a short
            transcript still sits on the focus box and a long one scrolls. */}
        <div
          ref={historyRef}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onScroll={onHistoryScroll}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden text-left"
        >
          {priorTexts.length === 0 ? (
            /* No history yet. The focus box below already says what the card
               is for, so this row stays blank rather than repeating it — two
               placeholders stacked read as a fault, not as a resting state. */
            <span aria-hidden="true" />
          ) : (
            <div className="mt-auto flex min-h-full flex-col justify-end gap-0.5">
              {priorTexts.map((t, i) => {
                const step = stepFor(priorTexts.length - 1 - i);
                return (
                  <p
                    key={`${i}-${t.slice(0, 12)}`}
                    /* Older lines sit further back AND smaller, so the eye
                       starts at the bottom without a rule to tell it to.
                       shrink-0: in a flex column the browser would otherwise
                       squeeze the lines to fit rather than let them overflow,
                       and a history that never overflows never scrolls. */
                    className="shrink-0 truncate font-normal leading-normal"
                    style={{ fontSize: `${step.size}px`, color: `rgb(255 255 255 / ${step.alpha})` }}
                  >
                    {t}
                  </p>
                );
              })}
            </div>
          )}
        </div>

        {/* Kinetic Focus Box: 2 to 3 lines max, left-aligned with streaming words */}
        {/* justify-start, not justify-center: a sentence that begins in the
            middle of the box and grows downward moves its own first line as
            it arrives, so the words the eye is already reading slide. Anchored
            to the top, new text only ever extends below what is already read. */}
        <div className="relative flex min-h-[96px] shrink-0 flex-col justify-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <div className="text-left">
            <p
              className={cx(
                'line-clamp-4 text-left text-[15px] sm:text-[16px] leading-[1.55] tracking-wide select-text',
                /* The placeholder is chrome: dim, lowercase, lighter weight,
                   so it reads as a label on an empty card and never as a
                   sentence someone spoke. */
                activeText
                  ? 'font-medium text-[var(--tri-ink)]'
                  : 'font-normal lowercase text-white/25',
              )}
            >
              {activeText || (isLive ? 'listening for the pulpit…' : 'transcripts appear here')}
              {isForming && (
                <span
                  className="ml-1 inline-block h-[0.9em] w-[2px] translate-y-[2px] animate-pulse bg-[var(--tri-accent-yellow)] rounded-sm"
                  aria-hidden="true"
                />
              )}
            </p>
          </div>
        </div>

        {/* Subtle footer. It also says when the history has been scrolled
            back, so a transcript that has stopped moving is explained on the
            card instead of being read as a mic that died. */}
        <div className="flex shrink-0 items-center justify-between text-[10px] lowercase text-white/30">
          <span>{following ? 'kinetic focus · streaming from left' : 'scrolled back · return to bottom to follow'}</span>
          {/* "preview mode" was only ever true because the card faked a
              sentence. With nothing staged, the honest word is idle. */}
          <span>{hasRealSpeech ? 'live speech' : isLive ? 'waiting for speech' : 'idle'}</span>
        </div>
      </div>
    </Panel>
  );
}
