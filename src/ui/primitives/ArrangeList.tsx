import { Fragment, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cx } from '../lib/cx';
import { CheckIcon, GripIcon } from '../icons';

/*
 * Pick a set, then put it in order — in one list.
 *
 * The run of service is not a menu choice. It is a handful of segments out
 * of a fixed vocabulary, in a sequence that matters, and the two halves of
 * that decision were being asked in two different places: tick things in a
 * menu, then drag them about in the rail afterwards. So the ordering was
 * done blind, against a list the operator could no longer see.
 *
 * Here they are the same list. Ticking a segment lifts it to the top —
 * under whatever was ticked before it, so picking in the order you will
 * run them is enough on its own — and the block at the top is the rail,
 * already in the order it will import. Nothing has to be imagined.
 *
 * The resting order below the line is by how often a church actually uses
 * a segment, not by when it falls in a service, because that list is being
 * scanned rather than read: the thing you reach for most should be the
 * thing nearest your hand.
 */

export interface ArrangeOption {
  id: string;
  label: string;
}

export interface ArrangeListProps {
  /** The vocabulary, in resting order — most-reached-for first. */
  options: ArrangeOption[];
  /** Picked ids, in the order they will import. Uncontrolled if omitted. */
  value?: string[];
  onChange?: (ids: string[]) => void;
  /** The affirmative row at the foot. Omitted, there is no commit row. */
  commitLabel?: string;
  onCommit?: (picked: ArrangeOption[]) => void;
  className?: string;
}

/* The gap between rows, in px. Read by the drag maths, so it is a number
   here and a style below rather than a Tailwind class in both places. */
const ROW_GAP = 4;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Move one item without mutating — the whole reorder, in a line. */
function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

interface Drag {
  id: string;
  /** Where the row started, in the picked block. */
  from: number;
  /** Where it would land if you let go now. */
  to: number;
  /** Raw pointer travel, for the row under the finger. */
  dy: number;
  /** One row plus one gap — the distance between two positions. */
  step: number;
}

export function ArrangeList({
  options,
  value,
  onChange,
  commitLabel,
  onCommit,
  className = '',
}: ArrangeListProps) {
  const [internal, setInternal] = useState<string[]>([]);
  const picked = value ?? internal;
  const setPicked = (next: string[]) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  const [drag, setDrag] = useState<Drag | null>(null);
  const startY = useRef(0);

  const byId = (id: string) => options.find((o) => o.id === id);
  /*
   * Normalised before anything reads it. A caller can hand us an id that is
   * not in the vocabulary, and if the picked *ids* and the picked *rows*
   * ever differ in length then every index in the drag maths is off by that
   * difference — the row you drop is not the row that moves. So the ids are
   * re-derived from the rows rather than trusted.
   */
  const pickedOptions = picked.map(byId).filter(Boolean) as ArrangeOption[];
  const pickedIds = pickedOptions.map((o) => o.id);
  const rest = options.filter((o) => !pickedIds.includes(o.id));
  /* One list, two halves. The index into this array is the position the row
     will hold in the rail, which is why the block is not a separate list. */
  const rows = [...pickedOptions, ...rest];

  const toggle = (id: string) => {
    /* Ticking appends rather than inserts: the second thing you pick goes
       under the first, so picking in running order needs no dragging at
       all. Unticking drops it back to wherever the vocabulary keeps it. */
    setPicked(pickedIds.includes(id) ? pickedIds.filter((x) => x !== id) : [...pickedIds, id]);
  };

  /*
   * Where a row is drawn while a drag is in flight.
   *
   * The DOM order never changes mid-drag — only transforms do. Reordering
   * the array under the pointer means the element being dragged jumps out
   * from under it on every swap; transforming instead lets the row follow
   * the finger exactly while its neighbours slide around it, and the array
   * is rewritten once, on release.
   */
  const drawnAt = (i: number, d: Drag): number => {
    if (i === d.from) return d.to;
    if (d.from < d.to && i > d.from && i <= d.to) return i - 1;
    if (d.from > d.to && i >= d.to && i < d.from) return i + 1;
    return i;
  };

  const onGripDown = (e: ReactPointerEvent<HTMLSpanElement>, index: number, id: string) => {
    const row = (e.currentTarget as HTMLElement).closest('[data-arrange-row]') as HTMLElement | null;
    if (!row) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    startY.current = e.clientY;
    setDrag({ id, from: index, to: index, dy: 0, step: row.offsetHeight + ROW_GAP });
  };

  const onGripMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!drag) return;
    /* Clamped to the block: a segment cannot be dragged out of the run, only
       out of its place in it. Untick is how you remove one. */
    const last = pickedIds.length - 1;
    const limit = { lo: -drag.from * drag.step, hi: (last - drag.from) * drag.step };
    const dy = clamp(e.clientY - startY.current, limit.lo, limit.hi);
    setDrag({ ...drag, dy, to: clamp(drag.from + Math.round(dy / drag.step), 0, last) });
  };

  const endDrag = () => {
    if (!drag) return;
    if (drag.to !== drag.from) setPicked(move(pickedIds, drag.from, drag.to));
    setDrag(null);
  };

  /* Alt+↑/↓ does the same thing without a pointer. A booth is dark and a
     trackpad drag in the dark is the wrong thing to require of anyone. */
  const nudge = (index: number, delta: -1 | 1) => {
    const to = clamp(index + delta, 0, pickedIds.length - 1);
    if (to !== index) setPicked(move(pickedIds, index, to));
  };

  return (
    <div className={cx('flex min-h-0 flex-col', className)} style={{ gap: ROW_GAP }}>
      {/*
        The rows scroll, the commit row does not. Nine segments clears a short
        window once the vocabulary grows, and a panel that runs off the bottom
        of the screen takes "add to run" with it — which is the one row that
        must never be the one you cannot reach.
      */}
      <div
        className="flex min-h-0 flex-col overflow-y-auto"
        style={{ gap: ROW_GAP, maxHeight: 'min(58vh, 420px)' }}
      >
      {rows.map((opt, i) => {
        const isPicked = i < pickedIds.length;
        const dragging = drag?.id === opt.id;
        const shift = drag && isPicked && !dragging ? drawnAt(i, drag) - i : 0;

        return (
          <Fragment key={opt.id}>
          <div
            data-arrange-row
            className="relative"
            style={{
              transform: dragging
                ? `translateY(${drag.dy}px)`
                : shift
                  ? `translateY(${shift * (drag?.step ?? 0)}px)`
                  : undefined,
              /* The row under the finger tracks it exactly; everything else
                 slides. A transition on the dragged row is lag. */
              transition: dragging ? 'none' : 'transform 180ms var(--tri-ease-out)',
              zIndex: dragging ? 2 : 1,
            }}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={isPicked}
              onClick={() => toggle(opt.id)}
              onKeyDown={(e) => {
                if (!isPicked || !e.altKey) return;
                if (e.key === 'ArrowUp') nudge(i, -1);
                else if (e.key === 'ArrowDown') nudge(i, 1);
                else return;
                e.preventDefault();
              }}
              /*
               * The menu's own row, exactly: same type token, same height
               * token, same gap. The panel is reached from the "+" menu and
               * sits where that menu was standing, so any difference in
               * scale between them reads as two different products rather
               * than one menu going a level deeper.
               *
               * The corner is the one thing held back from it — 8px against
               * the menu's 10 — because these rows carry a handle and a box
               * and want to read as things in a list rather than as buttons.
               */
              className={cx(
                'flex w-full items-center gap-2.5 rounded-[5px] pl-2 pr-3.5 text-left lowercase',
                'h-[var(--tri-option-h)] text-[length:var(--tri-control-size)]',
                'transition-colors duration-150',
                dragging
                  ? 'bg-[rgb(255_255_255_/_0.09)]'
                  : isPicked
                    ? 'bg-[rgb(255_255_255_/_0.05)] hover:bg-[rgb(255_255_255_/_0.075)]'
                    : 'hover:bg-[rgb(255_255_255_/_0.045)]',
              )}
              style={
                dragging
                  ? { boxShadow: '0 10px 24px rgb(0 0 0 / 0.55), inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.14)' }
                  : undefined
              }
            >
              {/*
                The handle. Present on every row so ticking one does not
                shuffle the labels sideways, but it only lights — and only
                takes the pointer — once the row is in the run, because a
                segment that is not in the run has no position to move.
              */}
              <span
                aria-hidden
                onPointerDown={isPicked ? (e) => onGripDown(e, i, opt.id) : undefined}
                onPointerMove={isPicked ? onGripMove : undefined}
                onPointerUp={isPicked ? endDrag : undefined}
                onPointerCancel={isPicked ? endDrag : undefined}
                onClick={(e) => e.stopPropagation()}
                className={cx(
                  'flex shrink-0 items-center justify-center px-0.5 transition-opacity duration-150',
                  isPicked
                    ? 'cursor-grab text-[var(--tri-ink)] opacity-45 hover:opacity-90 active:cursor-grabbing'
                    : 'pointer-events-none text-[var(--tri-ink)] opacity-[0.13]',
                )}
              >
                <GripIcon size={12} />
              </span>

              {/* The box, sized off the type rather than off a round number:
                  at 14px it caps the 12px label the way a tick box should,
                  instead of standing over it. 4px of corner — enough to
                  belong to the row's family, not enough to read as a pill. */}
              <span
                aria-hidden
                className={cx(
                  'flex size-[14px] shrink-0 items-center justify-center rounded-[4px] transition-colors duration-150',
                  isPicked ? 'bg-[var(--tri-ink)] text-[#101010]' : 'bg-[rgb(255_255_255_/_0.03)]',
                )}
                style={
                  isPicked
                    ? undefined
                    : { boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.22)' }
                }
              >
                {isPicked && <CheckIcon size={9} />}
              </span>

              {/*
                Held back from full ink on purpose, picked rows included. The
                menu is a long column of near-identical words and at full
                strength they all shout at once; softening the whole list
                lets the tick and the block position carry the state instead,
                which is what the operator is actually reading.
              */}
              <span
                className={cx(
                  'min-w-0 flex-1 truncate transition-colors duration-150',
                  isPicked ? 'text-[rgb(229_243_242_/_0.85)]' : 'text-[rgb(229_243_242_/_0.58)]',
                )}
              >
                {opt.label}
              </span>
            </button>
          </div>

          {/* The line between "in the run" and "available". Drawn under the
              last picked row rather than as a block boundary, so it exists
              only when both halves do — a rule under nothing is a scar. It
              sits outside the transformed wrapper on purpose: dragging is
              confined to the block above it, so it never has to move. */}
          {i === pickedIds.length - 1 && rest.length > 0 && (
            <span
              aria-hidden
              className="pointer-events-none mx-1 my-1 h-px shrink-0"
              style={{ background: 'rgb(255 255 255 / 0.09)' }}
            />
          )}
          </Fragment>
        );
      })}
      </div>

      {commitLabel && (
        <button
          type="button"
          /* aria-disabled, not disabled — the house rule: a refused control
             stays reachable and admits it heard you. See tokens.css. */
          aria-disabled={pickedIds.length === 0 || undefined}
          onClick={() => pickedIds.length && onCommit?.(pickedOptions)}
          className={cx(
            'mt-1 flex w-full items-center justify-center gap-2 rounded-[5px] lowercase',
            'h-[var(--tri-option-h)] text-[length:var(--tri-control-size)]',
            'transition-colors duration-150',
            pickedIds.length
              ? 'tri-surface tri-interactive text-[rgb(229_243_242_/_0.92)]'
              : 'cursor-not-allowed bg-[rgb(255_255_255_/_0.03)] text-[rgb(229_243_242_/_0.28)]',
          )}
        >
          {commitLabel}
          {pickedIds.length > 0 && (
            <span className="tabular-nums opacity-60">{pickedIds.length}</span>
          )}
        </button>
      )}
    </div>
  );
}
