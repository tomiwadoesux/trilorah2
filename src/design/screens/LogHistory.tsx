import { useEffect, useRef, useState } from 'react';
import { cx, surface } from '../../ui';
import { EmptyMark, OrbitLogArt } from './emptyArt';

/*
 * The service log, as a column of cards.
 *
 * The bar in the header shows the line being said NOW; it has room for one.
 * On the dashboard the column under it was empty, and an operator glancing
 * over after a busy minute had no way to see what they had missed. So the
 * log's past lives here: every line the bar has said, one card each, newest
 * at the top. A new line arrives from above and the older cards move down
 * to make room — the same direction a chat or a terminal scrolls in reverse,
 * chosen because the top of the column sits directly under the bar, so the
 * newest card reads as the bar's own line settling into the record.
 *
 * A card that offers a way out (an `action`) is gold, the app's colour for
 * "this needs you"; everything else is quiet. No red: nothing in this log is
 * an alarm, and a column that shouts is a column people stop reading.
 */

export interface HistoryEntry {
  id: number;
  text: string;
  /** When it was said, ms since epoch. */
  at: number;
  action?: { label: string };
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "just now", "3m", "1h 12m" — re-read every half minute so it stays true. */
function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function LogHistory({
  entries,
  onAction,
  className,
  style,
}: {
  entries: HistoryEntry[];
  onAction?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  /* Stay pinned to the top for new arrivals — unless the operator has scrolled
     down to read something older, in which case yanking them back up mid-read
     is the rudest thing a log can do. */
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const newest = entries[entries.length - 1]?.id;
  useEffect(() => {
    if (pinned.current) scroller.current?.scrollTo({ top: 0 });
  }, [newest]);

  const ordered = [...entries].reverse();

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        pinned.current = e.currentTarget.scrollTop < 8;
      }}
      className={cx('tri-log-history flex min-h-0 flex-col gap-[var(--tri-gap)] overflow-y-auto', className)}
      style={style}
      aria-label="service log history"
      role="log"
    >
      <style>{KEYFRAMES}</style>
      {ordered.length === 0 ? (
        <EmptyMark
          art={<OrbitLogArt />}
          w={170}
          h={170}
          plain
          play="hover"
          line="nothing has happened yet"
          hint="what the service does lands here"
        />
      ) : (
        ordered.map((e, i) => (
          <article
            key={e.id}
            className={cx(
              surface({ tone: 'default', shape: 'control' }),
              'tri-log-card group/log shrink-0 px-3 py-2.5',
              e.action && 'tri-log-card--ask',
            )}
            /* Only the card that just arrived animates; the rest are moved
               by layout, which is what makes them read as being pushed. */
            data-fresh={i === 0 ? '' : undefined}
          >
            <p
              className={cx(
                'text-[length:var(--tri-size-body)] leading-snug',
                e.action ? 'text-[#e4d87a]' : 'text-[rgb(229_243_242_/_0.78)]',
              )}
            >
              {e.text}
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-[length:var(--tri-size-eyebrow)] tabular-nums text-[rgb(229_243_242_/_0.32)]">
              {/* When, on hover only — an old line otherwise stays quiet. The
                  newest line keeps its time, since "just now" is the one
                  thing a glance at the log is checking. */}
              <span className={cx('flex items-center gap-2 transition-opacity', i === 0 ? 'opacity-100' : 'opacity-0 group-hover/log:opacity-100')}>
                <span>{clock(e.at)}</span>
                <span aria-hidden>·</span>
                <span>{ago(e.at, now)}</span>
              </span>
              {e.action && onAction ? (
                <button
                  type="button"
                  onClick={onAction}
                  className="ml-auto text-[#e4d87a] underline decoration-[1px] underline-offset-[3px] hover:decoration-[1.5px]"
                >
                  {e.action.label}
                </button>
              ) : null}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

/* Inline, like the log bar's own keyframes: this column ships with the app,
   and sandbox.css does not. Opacity + transform only. */
const KEYFRAMES = `
.tri-log-history { scrollbar-width: thin; scrollbar-color: rgb(255 255 255 / 0.12) transparent; }
.tri-log-card--ask { box-shadow: inset 0 0 0 1px rgb(228 216 122 / 0.28); }
.tri-log-card[data-fresh] { animation: tri-log-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes tri-log-in { from { opacity: 0; transform: translateY(-10px) scale(0.985); } }
@media (prefers-reduced-motion: reduce) { .tri-log-card[data-fresh] { animation: none; } }
`;
