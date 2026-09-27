import { useMemo, type CSSProperties } from 'react';
import { cx } from '../../../ui';
import type { Spoken } from './types';

/*
 * The transcript strip as it shipped before the D-27 options: two lines,
 * centred, the older one dimmed a rung. Moved here out of Live.tsx unchanged
 * so the options can be compared against it on the same demo sermon.
 */

/**
 * How many sentences of the sermon the context bar holds at once.
 *
 * Two, not three. The strip is a glance, not a reading surface — the owner
 * asked for the current sentence and the one that set it up, and nothing
 * more. The full log is a click away on the dashboard, which is exactly why
 * the pill now opens it.
 */
const TRANSCRIPT_ROWS = 2;

/*
 * The ladder, as numbers, indexed by distance from the newest line.
 *
 * One rung per row, so LADDER.length must track TRANSCRIPT_ROWS. At two
 * rows the older line is the only context there is, so it drops to 0.55
 * rather than the 0.25 a third row used to get — dimmed enough to be
 * plainly behind the current sentence, bright enough to still be read. See
 * .tri-transcript-line in tokens.css for how a row gets from one rung to
 * the next.
 */
const LADDER = [1, 0.55];

/*
 * A sentence Deepgram has not finished hearing is dimmer than one it has.
 *
 * It sits between the newest rung and the one below, which is the point:
 * the operator can tell at a glance that the bottom line may still change
 * its mind. When the line goes final the row is the SAME DOM node (see the
 * key below), so it brightens to 1 over the ladder duration instead of the
 * text jumping.
 */
const PARTIAL_ALPHA = 0.72;

/**
 * The preacher's speech in the top context bar — two sentences deep,
 * newest at the bottom, the older one dimming a rung as the next arrives.
 *
 * Replaces a single line that was thrown away the instant the next one
 * landed. The owner's complaint was exactly that: nobody can read one
 * sentence in the time it takes to say the next, so the strip showed text
 * that could not be used. Depth plus a ladder of opacity makes the bar
 * readable at a glance and gives the current sentence its context.
 *
 * The strip is a glance and nothing more, which is why the whole pill is a
 * button: the scrollable log of everything said lives on the dashboard, and
 * the natural thing to do when two lines are not enough is to reach for the
 * text itself. Clicking it goes there.
 *
 * Why the rows are built as a fixed-length array with the partial folded in
 * as the last entry: every row then knows its distance from the newest, and
 * that distance is the ONLY input to its opacity. When a sentence lands,
 * every row's distance goes up by one and CSS moves them all together —
 * there is no per-row state, no timer, and nothing to fall out of step.
 */
export function LadderTranscript({
  spoken,
  asr,
  onOpenDashboard,
}: {
  spoken: Spoken;
  asr: string;
  onOpenDashboard: () => void;
}) {
  const isLive = asr === 'listening';
  const hasRealSpeech = spoken.lines.length > 0 || Boolean(spoken.partial);

  /*
   * Newest last. The partial is appended as its own row rather than
   * replacing the newest final, because it IS the next sentence — showing
   * it in place of the last one would throw away the very context this
   * change exists to keep.
   *
   * Its key is one past the newest final's id, which is the id the engine
   * will hand the final when it commits it (spokenId is a plain counter —
   * see onTranscriptLine in engine.tsx). React therefore keeps the same
   * element across the settle, and the row transitions from provisional to
   * full strength rather than unmounting and flashing back in.
   */
  const rows = useMemo(() => {
    const settled = spoken.lines.map((l) => ({ ...l, partial: false }));
    if (spoken.partial) {
      const nextId = (spoken.lines[spoken.lines.length - 1]?.id ?? -1) + 1;
      settled.push({ id: nextId, text: spoken.partial, partial: true });
    }
    if (!hasRealSpeech) {
      /* Nothing has been heard yet. One placeholder, at the newest rung, so
         the strip says what it is for instead of reading as broken.
         Never sample scripture: an operator glancing at this strip mid-service
         must not be able to mistake filler for something the preacher said. */
      return [
        {
          id: -1,
          text: isLive ? 'listening for the pulpit…' : 'transcripts appear here',
          partial: true,
        },
      ];
    }
    return settled.slice(-TRANSCRIPT_ROWS);
  }, [spoken.lines, spoken.partial, hasRealSpeech, isLive]);

  const newestId = rows[rows.length - 1]?.id;

  return (
    <button
      type="button"
      onClick={onOpenDashboard}
      className={cx(
        '@container relative flex min-w-[64px] flex-1 cursor-pointer overflow-hidden rounded-[var(--tri-radius-control)]',
        'border border-white/10 bg-white/[0.04] px-8 backdrop-blur-md',
        /* The same neutral lift every other control on this strip uses when
           the pointer is over it. No colour: the only coloured thing in this
           pill is the live dot, and that means something. */
        'transition-colors hover:border-white/20 hover:bg-white/[0.08]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tri-accent-yellow)]',
      )}
      /* Two rows tall, and never shorter than the controls beside it —
         see --tri-topbar-live-h. Pinned rather than left to the content so
         a one-line transcript does not sit in a short pill that jumps taller
         on the second sentence. */
      style={{ height: 'var(--tri-topbar-live-h)', paddingBlock: '6px' }}
      title="live preacher transcript — click to open the dashboard, where the full transcript is"
      aria-label="Live preacher transcript. Opens the dashboard, where the full transcript is."
    >
      {/*
        The live dot is taken OUT of the text flow and parked in the corner.
        Inline it cost about 18px of every line, and at 1280 this strip is
        already the narrowest thing on the row — the owner's complaint was as
        much about lines being short as about there being one of them, and
        18px is a word. Top-right rather than top-left because the text is
        read left-to-right from a hard margin: a marker on that margin pushes
        the first character off it.
      */}
      <span
        aria-label={isLive ? 'listening' : 'not listening'}
        className={cx(
          'absolute right-2.5 top-2 size-1.5 rounded-full transition-all',
          isLive ? 'animate-pulse bg-[#6ee7b7] shadow-[0_0_8px_#10b981]' : 'bg-white/30',
        )}
      />

      {/*
        Bottom-anchored. Before the second sentence lands the stack sits at
        the FOOT of the pill, so the newest line is always on the same
        baseline — it does not walk down the pill as the service fills up.
      */}
      <div className="flex min-w-0 flex-1 flex-col justify-end overflow-hidden text-center">
        {rows.map((row, i) => {
          /* Distance from the newest, which is the rung. */
          const depth = rows.length - 1 - i;
          const alpha = row.partial && depth === 0 ? PARTIAL_ALPHA : (LADDER[depth] ?? 0);
          return (
            /* A span, not a paragraph: the pill is a button now, and a <p>
               inside one is invalid nesting. `block` keeps the row a row. */
            <span
              key={row.id}
              className={cx(
                'tri-transcript-line block truncate text-center font-medium tracking-wide select-text',
                /* Only the arriving row animates in; the rest are
                   transitioning down and must not restart their keyframe. */
                row.id === newestId && 'tri-transcript-line--new',
              )}
              style={
                {
                  '--tri-line-a': alpha,
                  fontSize: '11.5px',
                  /* The rung height is a token so the rows and the pill that
                     holds them are computed from the same number. */
                  lineHeight: 'var(--tri-transcript-leading)',
                  color: 'var(--tri-ink)',
                } as CSSProperties
              }
            >
              {row.text}
              {row.partial && depth === 0 && (
                <span
                  className="ml-1 inline-block h-[0.85em] w-[2px] translate-y-[1px] animate-pulse rounded-sm bg-[var(--tri-accent-yellow)]"
                  aria-hidden="true"
                />
              )}
            </span>
          );
        })}
      </div>
    </button>
  );
}
