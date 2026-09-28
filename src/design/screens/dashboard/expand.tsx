import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type Transition } from 'motion/react';
import { cx, CloseIcon } from '../../../ui';
import { ExpandCue } from '../emptyArt';

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
 * The motion is FLIP — measure the tile, place a copy at exactly that box,
 * and carry it to the centre. It animates the box (left/top/width/height)
 * rather than scaling a transform, because a scaled box stretches its own
 * text and corner radius on the way; that is also why this is NOT Motion's
 * `layoutId`, whose projection is a scale underneath (and which the
 * sandbox's scaled artboard would throw off as well). One element, 360ms, a
 * soft ease — well within what layout can do at 60fps.
 *
 * Motion drives it, on this file's clock and curve. The hand-rolled version
 * was a four-phase state machine with a timer for the way home, and the
 * phases were where it broke: Esc or the ground did nothing until the box
 * had landed, a second tile could not be reached until the first had fully
 * gone, and the home box was the one measured at lift-off even if the grid
 * had moved since. With AnimatePresence there are no phases — open is a
 * boolean, every change retargets from wherever the box is right now, and
 * the way home is measured when it starts.
 *
 * Boxes are measured against the shell (`data-shell`) rather than the
 * viewport: the sandbox draws every screen inside a scaled artboard, and
 * the real app is a plain window. Dividing by the shell's own scale makes
 * both the same case.
 */

/* Exported: the song editor and the add-song dialog open with this same
   flight (src/design/screens/songs/FlightPopup.tsx), so there is one clock
   and one curve for "a thing lifts off the grid and grows". */
export const FLIGHT_MS = 480;
export const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
/* The same clock and curve in the units Motion takes. Derived, never
   retyped — the app has one motion language and this file is its source. */
export const EASE_BEZIER = [0.32, 0.72, 0, 1] as const;
export const FLIGHT_S = FLIGHT_MS / 1000;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** The tile's box in the shell's own coordinates, scale removed. */
export function boxInShell(el: HTMLElement, shell: HTMLElement): Box {
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
export function targetBox(shell: HTMLElement, wanted: { w: number; h: number }): Box {
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
  /** For a view that owns its scrolling and needs a bounded flex body. */
  bodyClassName?: string;
  /** The open size the content would like. */
  size?: { w: number; h: number };
  /**
   * The ⤢ that appears in the top-right corner on hover. Off for a tile
   * whose own face already puts words in that corner — the glyph would sit
   * on top of them.
   */
  glyph?: boolean;
  /** The hairline that brightens round the tile on hover. Off for a tile
      with card art (./CardArt) — the drawing lighting up is its hover. */
  ring?: boolean;
}

/*
 * Every tile that can open, so a press on the ground mid-flight can find
 * the tile underneath it. See `retarget` below.
 */
const TILES = new Map<HTMLElement, () => void>();

interface Flight {
  from: Box;
  to: Box;
}

export function Expandable({ tile, className, title, blurb, children, bodyClassName, size = { w: 720, h: 640 }, glyph = true, ring = true }: ExpandableProps) {
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  /* On screen at all — true from lift-off until the way home has FINISHED,
     which is later than `open` going false. The grid tile stays dimmed for
     exactly that long. */
  const [flying, setFlying] = useState(false);
  /* Landed and resting. Until then a press on the ground may be aimed at
     another tile rather than at "close". */
  const [settled, setSettled] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  /* The overlay is portalled into the shell, so its absolute box is in the
     shell's coordinates whatever the tile's own ancestors are positioned. */
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);

  const shellOf = () => anchor.current?.closest<HTMLElement>('[data-shell]') ?? null;

  const lift = () => {
    const el = anchor.current;
    const shell = shellOf();
    if (!el || !shell) return;
    setShellEl(shell);
    setFlight({ from: boxInShell(el, shell), to: targetBox(shell, size) });
    setFlying(true);
    setOpen(true);
  };
  const liftRef = useRef(lift);
  liftRef.current = lift;

  const close = () => {
    /* Home is measured NOW. The tile never left the grid, so its box is
       always current — the one taken at lift-off is stale the moment the
       window is resized with a tile open. */
    const el = anchor.current;
    const shell = shellOf();
    if (el && shell) setFlight((f) => (f ? { ...f, from: boxInShell(el, shell) } : f));
    setSettled(false);
    setOpen(false);
  };

  useEffect(() => {
    const el = anchor.current;
    if (!el) return;
    TILES.set(el, () => liftRef.current());
    return () => void TILES.delete(el);
  }, []);

  /* A window resized with a tile open: the centre has moved, so the box
     follows it — Motion retargets from where it is. */
  useEffect(() => {
    if (!open || !shellEl) return;
    const recentre = () => setFlight((f) => (f ? { ...f, to: targetBox(shellEl, size) } : f));
    window.addEventListener('resize', recentre);
    return () => window.removeEventListener('resize', recentre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shellEl, size.w, size.h]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      /* A popup opened from inside this tile (FlightPopup) is on top and
         answers Esc itself; closing this one too would take both down. */
      if (document.querySelector('[data-flight-popup]')) return;
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /*
   * A press on the ground while the box is still in the air.
   *
   * The ground covers the grid from the first frame, so someone who pressed
   * the wrong tile and goes straight for the right one lands on the ground
   * instead — and used to get nothing at all until the first flight ended.
   * Now that press sends this tile home from wherever it is and lifts the
   * one under the pointer in the same beat. Once landed, the ground is just
   * "close": a resting dialog that opened a different one when dismissed
   * would be a surprise, not a convenience.
   */
  const onGround = (e: React.MouseEvent) => {
    close();
    if (settled) return;
    for (const [el, openIt] of TILES) {
      if (el === anchor.current) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        openIt();
        break;
      }
    }
  };

  const still = reducedMotion();
  const fly: Transition = still ? { duration: 0 } : { duration: FLIGHT_S, ease: EASE_BEZIER };

  return (
    <>
      {/* The tile stays in the grid while its copy flies — dimmed, so the
          eye reads "that one lifted off" rather than "one appeared". */}
      <div
        ref={anchor}
        className={cx(
          'group/tile relative flex min-h-0 min-w-0 flex-col transition-[opacity,transform]',
          /* The one hover every opening tile shares: it says "this opens"
             and nothing else. The glyph sits where ✕ will be once the box
             has landed, so the way in and the way out are the same corner. */
          !flying && 'hover:-translate-y-px',
          className,
        )}
        style={{ opacity: flying ? 0.25 : 1, transitionDuration: `${still ? 0 : FLIGHT_MS}ms`, transitionTimingFunction: EASE }}
      >
        {tile({ onOpen: lift, open: flying })}
        {ring && (
          <span
            aria-hidden
            className="tri-rounded-surface pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/0 transition-[box-shadow] duration-200 group-hover/tile:ring-white/20"
          />
        )}
        {/* The static ⤢ became a cue that moves: expand arrows that scale
            in under the pointer, breathe apart while it stays, and scale
            back out when it leaves. */}
        {glyph && <ExpandCue />}
      </div>

      {shellEl && flight && createPortal(
        /* `custom` reaches a child that is already leaving, which its own
           props no longer do — that is how the way home gets the box
           measured at close rather than the one from lift-off. */
        <AnimatePresence custom={flight} onExitComplete={() => setFlying(false)}>
          {open && (
            <motion.div key="flight" className="contents" initial="home" animate="open" exit="home" custom={flight}>
              {/* The ground. Its opacity rides the same clock as the box.
                  On the way home it stops taking presses, so the grid under
                  it is live again the moment close is asked for. */}
              <motion.button
                type="button"
                aria-label="close"
                tabIndex={-1}
                onClick={onGround}
                className="absolute inset-0 z-40 cursor-default bg-[rgb(0_0_0_/_0.55)]"
                variants={{ home: { opacity: 0, pointerEvents: 'none' }, open: { opacity: 1, pointerEvents: 'auto' } }}
                transition={{ ...fly, pointerEvents: { duration: 0 } }}
              />
              <motion.section
                role="dialog"
                aria-modal="true"
                aria-label={title}
                /* z-50 while open; a box on its way home drops under the
                   next one lifting off so two flights never fight for the
                   top. Both beat the ground. */
                className="tri-rounded-surface absolute flex flex-col overflow-hidden bg-[var(--tri-pop)]"
                style={{
                  boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.08), 0 30px 80px rgb(0 0 0 / 0.5)',
                }}
                variants={{
                  home: (f: Flight) => ({ ...f.from, zIndex: 45 }),
                  open: (f: Flight) => ({ ...f.to, zIndex: 50 }),
                }}
                custom={flight}
                /* z is a fact, not a journey: it switches on the first frame. */
                transition={{ ...fly, zIndex: { duration: 0 } }}
                onAnimationComplete={(name) => {
                  if (name === 'open') setSettled(true);
                }}
              >
                {/* Header and contents arrive after the box has landed and
                    are gone before it leaves, so nothing is read — or seen
                    rewrapping — at the wrong size. The title used to ride
                    the whole flight and rewrap on the way. */}
                <motion.div
                  className="flex min-h-0 flex-1 flex-col"
                  variants={{
                    home: { opacity: 0, transition: still ? { duration: 0 } : { duration: 0.09, ease: EASE_BEZIER } },
                    open: {
                      opacity: 1,
                      transition: still ? { duration: 0 } : { duration: 0.2, ease: EASE_BEZIER, delay: FLIGHT_S * 0.6 },
                    },
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
                      <CloseIcon size={12} />
                    </button>
                  </header>
                  <div className={bodyClassName ?? 'min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2'}>{children}</div>
                </motion.div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>,
        shellEl,
      )}
    </>
  );
}
