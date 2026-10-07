import { useLayoutEffect, useRef } from 'react';
import { cx } from '../../ui';
import type { ReelRow } from '../../lib/scriptureReel';
import './scriptureTravel.css';

/*
 * The scripture list's way from one place in the Bible to another.
 *
 * When a verse goes live somewhere the list is not showing, the list goes
 * there — and it is seen to go. Scrolling the real Bible from Genesis to
 * John would take minutes and load a thousand chapters, so this is the
 * gesture of it: a reel of rows in the list's own shape flicks past, up when
 * the verse is further on, down when it is further back, and slows onto the
 * place itself. On the way the rows are placeholders — a reference, and a
 * bar where the words would be — and the references count through the books
 * between, so the direction and the distance can both be read.
 *
 * It lands on rows that match the real list (`arrival`, upgraded to the
 * chapter's real references the moment it loads), so the hand-over to the
 * list underneath is a fade, not a jump. The parent skips it entirely under
 * reduced motion.
 */
export interface ScriptureTravelProps {
  /** +1 moves on through the Bible, so rows rise; -1 goes back, so they fall. */
  dir: 1 | -1;
  /** What was on screen as the list left, top first. */
  departure: ReelRow[];
  /** References passed on the way, in Bible order. */
  passing: ReelRow[];
  /** What the list lands on, top first. Same length as `departure`. */
  arrival: ReelRow[];
  rowHeight: number;
  height: number;
  ms: number;
  onDone: () => void;
}

/** A verse's length as a bar: a short verse is a short line. */
const barWidth = (length: number) => Math.round(28 + 68 * Math.min(1, length / 160));

export function ScriptureTravel({ dir, departure, passing, arrival, rowHeight, height, ms, onDone }: ScriptureTravelProps) {
  const reel = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const rows = dir > 0 ? [...departure, ...passing, ...arrival] : [...arrival, ...passing, ...departure];
  /* Far enough that the last rows to arrive end up where the first ones
     were: the landing rows sit exactly where the list will put them. */
  const far = -(passing.length + (dir > 0 ? departure.length : arrival.length)) * rowHeight;
  const [start, end] = dir > 0 ? [0, far] : [far, 0];

  useLayoutEffect(() => {
    const el = reel.current;
    if (!el) return;
    /* Fast away, slow in: most of the distance goes by in the first third,
       and the last rows settle at reading speed. */
    const animation = el.animate(
      [{ transform: `translateY(${start}px)` }, { transform: `translateY(${end}px)` }],
      { duration: ms, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
    );
    animation.onfinish = () => done.current();
    return () => animation.cancel();
    /* One journey per mount: the parent keys this by journey. The rows may
       be re-rendered on the way (the arrival upgrading to real references)
       without restarting the flight. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scripture-travel" style={{ height }} aria-hidden>
      <div ref={reel} className="scripture-travel__reel" style={{ transform: `translateY(${start}px)` }}>
        {rows.map((row, i) => (
          <div key={i} className={cx('scripture-travel__row', row.live && 'is-live')} style={{ height: rowHeight }}>
            <span className="scripture-travel__ref">{row.ref}</span>
            {row.ref ? (
              <span className="scripture-travel__text">
                <span style={{ width: `${barWidth(row.length)}%` }} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
