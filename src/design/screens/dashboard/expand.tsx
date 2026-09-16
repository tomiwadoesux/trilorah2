import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx, PlusIcon } from '../../../ui';

/*
 * A tile that opens.
 *
 * The companion, giving, voice-command and connections tiles each carry a
 * handful of settings that used to be a page in S-10. On the dashboard the
 * tile shows the one or two things worth glancing at; pressing it lifts the
 * tile off the grid, grows it to the centre of the window and fills it with
 * the whole set, the ground darkening behind. Press the ground, or ✕, or
 * Esc, and it goes back the way it came.
 *
 * The motion is FLIP by hand — measure the tile, place a copy at exactly
 * that box, and let one CSS transition carry it to the centre. No library:
 * four tiles might do this and each one costs a single element and one
 * transition. It animates the box (left/top/width/height) rather than
 * scaling a transform, because a scaled box stretches its own text on the
 * way and settings copy read mid-flight is the whole point of the effect.
 * One element, 360ms, a soft ease — that is well within what layout can do
 * at 60fps, and it respects prefers-reduced-motion by skipping the flight.
 *
 * Boxes are measured against the shell (`data-shell`) rather than the
 * viewport: the sandbox draws every screen inside a scaled artboard, and
 * the real app is a plain window. Dividing by the shell's own scale makes
 * both the same case.
 */

const FLIGHT_MS = 360;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** The tile's box in the shell's own coordinates, scale removed. */
function boxInShell(el: HTMLElement, shell: HTMLElement): Box {
  const s = shell.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const scale = s.width / shell.offsetWidth || 1;
  return {
    left: (r.left - s.left) / scale,
    top: (r.top - s.top) / scale,
    width: r.width / scale,
    height: r.height / scale,
  };
}

/** Where an open tile lands: centred, capped, with room for the ground. */
function targetBox(shell: HTMLElement, wanted: { w: number; h: number }): Box {
  const W = shell.offsetWidth;
  const H = shell.offsetHeight;
  const width = Math.min(wanted.w, W - 80);
  const height = Math.min(wanted.h, H - 80);
  return { left: (W - width) / 2, top: (H - height) / 2, width, height };
}

export interface ExpandableProps {
  /** The tile as it sits in the grid. Receives the grid's className. */
  tile: (props: { onOpen: () => void; open: boolean }) => ReactNode;
  className?: string;
  title: string;
  /** One sentence under the title when open. */
  blurb?: string;
  /** What fills the open box. Scrolls if taller than the box. */
  children: ReactNode;
  /** The open size the content would like. */
  size?: { w: number; h: number };
}

export function Expandable({ tile, className, title, blurb, children, size = { w: 720, h: 640 } }: ExpandableProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [from, setFrom] = useState<Box | null>(null);
  const [to, setTo] = useState<Box | null>(null);
  /* The overlay is portalled into the shell, so its absolute box is in the
     shell's coordinates whatever the tile's own ancestors are positioned. */
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);

  const shellOf = () => anchor.current?.closest<HTMLElement>('[data-shell]') ?? null;

  const open = () => {
    const el = anchor.current;
    const shell = shellOf();
    if (!el || !shell) return;
    setShellEl(shell);
    setFrom(boxInShell(el, shell));
    setTo(targetBox(shell, size));
    setPhase('opening');
  };

  const close = () => {
    if (phase !== 'open') return;
    setPhase('closing');
  };

  /* The flight: one frame at the start box so the transition has
     somewhere to leave from, then the end box. */
  useLayoutEffect(() => {
    if (phase === 'opening') {
      const id = requestAnimationFrame(() => setPhase('open'));
      return () => cancelAnimationFrame(id);
    }
    if (phase === 'closing') {
      const t = setTimeout(() => setPhase('closed'), reducedMotion() ? 0 : FLIGHT_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'open') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const flying = phase !== 'closed';
  const atTarget = phase === 'open';
  const box = atTarget ? to : from;
  const motion = reducedMotion() ? 'none' : `left ${FLIGHT_MS}ms ${EASE}, top ${FLIGHT_MS}ms ${EASE}, width ${FLIGHT_MS}ms ${EASE}, height ${FLIGHT_MS}ms ${EASE}, opacity ${FLIGHT_MS}ms ${EASE}`;

  return (
    <>
      {/* The tile stays in the grid while its copy flies — dimmed, so the
          eye reads "that one lifted off" rather than "one appeared". */}
      <div
        ref={anchor}
        className={cx('flex min-h-0 min-w-0 flex-col transition-opacity', className)}
        style={{ opacity: flying ? 0.25 : 1, transitionDuration: `${FLIGHT_MS}ms` }}
      >
        {tile({ onOpen: open, open: flying })}
      </div>

      {flying && box && shellEl && createPortal(
        <>
          {/* The ground. Its opacity rides the same clock as the box. */}
          <button
            type="button"
            aria-label="close"
            onClick={close}
            className="absolute inset-0 z-40 bg-[rgb(0_0_0_/_0.55)]"
            style={{ opacity: atTarget ? 1 : 0, transition: reducedMotion() ? 'none' : `opacity ${FLIGHT_MS}ms ${EASE}` }}
          />
          <section
            role="dialog"
            aria-label={title}
            className="tri-rounded-surface absolute z-50 flex flex-col overflow-hidden bg-[#0e1413]"
            style={{
              ...box,
              boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.08), 0 30px 80px rgb(0 0 0 / 0.5)',
              transition: motion,
            }}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5">
              <div className="min-w-0">
                <h2 className="text-[20px] font-semibold tracking-tight text-[var(--tri-ink)]">{title}</h2>
                {blurb && <p className="mt-1 max-w-[520px] text-[length:var(--tri-size-xs)] leading-relaxed text-[rgb(229_243_242_/_0.5)]">{blurb}</p>}
              </div>
              <button
                type="button"
                onClick={close}
                title="close (esc)"
                className="grid size-[26px] shrink-0 place-items-center rounded-[7px] text-[rgb(229_243_242_/_0.5)] transition-colors hover:bg-[rgb(255_255_255_/_0.06)] hover:text-[var(--tri-ink)]"
              >
                <PlusIcon size={12} className="rotate-45" />
              </button>
            </header>
            {/* The contents arrive after the box has landed, so nothing is
                read at the wrong size. */}
            <div
              className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2"
              style={{ opacity: atTarget ? 1 : 0, transition: `opacity 200ms ${EASE} ${atTarget ? FLIGHT_MS * 0.6 : 0}ms` }}
            >
              {children}
            </div>
          </section>
        </>,
        shellEl,
      )}
    </>
  );
}
