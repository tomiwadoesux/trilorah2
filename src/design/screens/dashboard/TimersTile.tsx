import { useEffect, useRef, useState } from 'react';
import { Panel } from '../parts';
import { formatTimerDisplay } from '../../../../shared/timerDisplay';

/*
 * The timers, on the board.
 *
 * A placeholder in the sense that this is not yet the timer SURFACE — there
 * is no making, editing or reordering here, and BUILD-MAP 2.16 still owes a
 * real one. It is not a placeholder in the sense the other unbacked tiles
 * were: the store behind it is built and running, so what this shows is the
 * same countdown the stage monitor is showing, not a drawn number. A tile
 * that invents a clock is worse than no tile, because a clock is the one
 * thing on this board somebody might act on.
 *
 * Reading, not driving. Every other glance on the dashboard is read from
 * across the booth and this is no different — start and pause live where the
 * operator's hands already are, on the Live surface. The board says what the
 * morning is doing; it does not do it.
 *
 * THE TICK. The store deliberately emits on mutation only — a change to what
 * a timer IS, not to what it currently reads — because an IPC message sixty
 * times a second to repaint a digit would drag the whole bus along with it
 * (see electron/engine/timers.ts). So the seconds have to come from here:
 * the snapshot carries `remainingMs` as of its own instant, and a local
 * interval re-formats it between mutations. One interval for the tile, not
 * one per row, and only while something is actually running — a stopped
 * timer's face cannot change, and a booth machine should not be woken every
 * second to redraw a number that is standing still.
 */

const SHOWN = 3;

interface Snapshot {
  id: string;
  name: string;
  kind: 'countdown' | 'to-time' | 'elapsed';
  state: 'stopped' | 'running' | 'paused';
  remainingMs: number;
  overrunning: boolean;
  display: string;
}

/* The face's colour IS its state, because at booth distance the digits are
   all that carry — a running clock and a paused one are the same glyphs in
   the same place, and the word beside them is the first thing to go. Overrun
   is the exception that has to shout: a countdown past zero means something
   is running long right now, which is the only condition on this tile worth
   crossing the room for. */
function faceInk(t: Snapshot): string {
  if (t.overrunning) return '#eac7c6';
  if (t.state === 'running') return 'var(--tri-ink)';
  if (t.state === 'paused') return 'rgb(228 216 122 / 0.85)';
  return 'rgb(229 243 242 / 0.4)';
}

export function TimersTile({ className }: { className?: string }) {
  const [timers, setTimers] = useState<Snapshot[]>([]);
  /* Re-render ticks only. The VALUES stay in `timers`; this is a counter
     whose only job is to make React run the arithmetic below again, so a
     tick never has to copy the snapshot array to change what is on screen. */
  const [, setTick] = useState(0);
  /* The instant the snapshot describes. remainingMs is true as of when the
     store sent it, so the elapsed wall time since then is what has to come
     off it — without this the tile would freeze between mutations. */
  const takenAt = useRef(Date.now());

  useEffect(() => {
    const api = typeof window === 'undefined' ? undefined : window.api;
    if (!api?.onTimers) return;
    let alive = true;

    const take = (list: Snapshot[]) => {
      if (!alive) return;
      takenAt.current = Date.now();
      setTimers(list);
    };

    void api.listTimers?.().then((list) => take((list ?? []) as Snapshot[])).catch(() => undefined);
    return api.onTimers((list) => {
      take((list ?? []) as Snapshot[]);
      return undefined;
    });
  }, []);

  /* Only while something is running. A paused or stopped face is arithmetic
     on a frozen start instant and cannot change, so an interval then would
     be a wakeup a second for a number nobody asked to move. */
  const live = timers.some((t) => t.state === 'running');
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const shown = timers.slice(0, SHOWN);
  const hidden = timers.length - shown.length;

  return (
    <Panel title={`timers${timers.length ? ` (${timers.length})` : ''}`} className={className} bodyClass="pt-1">
      {shown.length === 0 ? (
        /* Says what the tile is FOR, not that it is empty. "No timers" is a
           state; this is the sentence that tells a volunteer what would put
           something here, which is the only useful thing an empty box can
           say. */
        <p className="flex h-full items-center text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.32)]">
          countdowns for the morning — the pre-service clock, the offering,
          the sermon. Add one on the live surface.
        </p>
      ) : (
        <ul className="flex h-full flex-col">
          {shown.map((t) => {
            /* A running clock's face is recomputed here rather than taken
               from the snapshot: `display` was true when the store sent it,
               and between mutations that is the one field guaranteed to go
               stale. A stopped or paused one is not moving, so its own
               display is still exactly right.

               The SIGN of the drift is the timer's direction. `remainingMs`
               is what is left on a countdown and what has accrued on a
               stopwatch, so wall time since the snapshot comes OFF the first
               and goes ON to the second. Subtracting from both — which this
               did at first — ran every stopwatch backwards through zero and
               into red, which is how the sermon clock came up reading -0:04
               four seconds after it started. */
            const drift = Date.now() - takenAt.current;
            const ms =
              t.state !== 'running'
                ? t.remainingMs
                : t.kind === 'elapsed'
                  ? t.remainingMs + drift
                  : t.remainingMs - drift;
            const face = t.state === 'running' ? formatTimerDisplay(ms) : t.display;
            /* Overrun is recomputed for the same reason — a countdown that
               was 3 seconds from zero when the snapshot arrived is past it
               now, and the red has to arrive with the minus sign, not at the
               next mutation. */
            const over = t.overrunning || (t.kind === 'countdown' && ms < 0);
            return (
              <li key={t.id} className="flex min-h-0 flex-1 items-center gap-2 py-0.5">
                <span className="min-w-0 flex-1 truncate text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.6)]">
                  {t.name}
                </span>
                {/* Tabular figures, or the whole row shifts every time a 1
                    ticks past — on a column of clocks that reads as the
                    layout twitching rather than the time passing. */}
                <span
                  className="shrink-0 text-[length:var(--tri-size)] font-semibold tabular-nums"
                  style={{ color: over ? '#eac7c6' : faceInk({ ...t, overrunning: over }) }}
                >
                  {face}
                </span>
              </li>
            );
          })}
          {hidden > 0 && (
            <li className="shrink-0 pt-0.5 text-[length:var(--tri-size-eyebrow)] lowercase text-[rgb(229_243_242_/_0.3)]">
              +{hidden} more
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}
