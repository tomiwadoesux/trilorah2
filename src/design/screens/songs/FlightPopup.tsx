import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '../../../ui';
import { boxInShell, EASE, FLIGHT_MS, reducedMotion, targetBox, type Box } from '../dashboard/expand';

/*
 * The brand's opening, for things that are not dashboard tiles.
 *
 * `Expandable` (dashboard/expand.tsx) owns both the tile and the thing it
 * opens into, which is right for a tile and wrong for a song card: the card
 * lives in a grid that filters, scrolls and re-renders under it, and the
 * editor has to outlive all of that. So this is the same flight — the same
 * clock, curve, ground and landing box, imported rather than copied — driven
 * from outside: hand it the element to lift off from and say when it is open.
 *
 * With an origin it is FLIP, exactly as the tiles do it: start at the card's
 * box, one transition to the centre, and the way back on close. Without one
 * (the add-song dialog is opened from a 28px dock button, and growing a
 * dialog out of a dot reads as a glitch) it rises into place from a slightly
 * smaller box at the centre — same clock, same curve.
 */

export interface FlightPopupProps {
  open: boolean;
  /** Where it lifts off from and lands back on. Read once, as it opens. */
  origin?: HTMLElement | null;
  size: { w: number; h: number };
  label: string;
  /** Esc, the ground, or ✕. The owner decides whether that closes it. */
  onRequestClose: () => void;
  /** The flight home has finished and nothing is on screen any more. */
  onClosed?: () => void;
  /** The header's left side. The ✕ is drawn for you. */
  header: ReactNode;
  footer?: ReactNode;
  overlay?: ReactNode;
  attention?: number;
  children: ReactNode;
  /**
   * The ground's z-index; the box sits ten above it. 40 is the dashboard
   * tiles' own layer. A popup opened FROM an open tile (a preacher's
   * profile, out of the preachers list) passes more, so its ground covers
   * the tile's box instead of sliding under it.
   */
  layer?: number;
}

type Phase = 'closed' | 'opening' | 'open' | 'closing';

export function FlightPopup({
  open,
  origin,
  size,
  label,
  onRequestClose,
  onClosed,
  header,
  footer,
  overlay,
  attention = 0,
  children,
  layer = 40,
}: FlightPopupProps) {
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!attention || reducedMotion()) return;
    const animation = card.current?.animate(
      [0, -4, 4, -2, 2, 0].map(x => ({ transform: `translateX(${x}px)` })),
      { duration: 240, easing: 'ease-in-out' },
    );
    return () => animation?.cancel();
  }, [attention]);
  const anchor = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<Phase>('closed');
  const [from, setFrom] = useState<Box | null>(null);
  const [to, setTo] = useState<Box | null>(null);
  const [shell, setShell] = useState<HTMLElement | null>(null);
  /* Whether `from` is a real card. A rise from the centre also fades; a
     flight from a card must not, or the card appears to vanish and a ghost
     to arrive. */
  const [anchored, setAnchored] = useState(false);

  const closedRef = useRef(onClosed);
  closedRef.current = onClosed;
  const requestRef = useRef(onRequestClose);
  requestRef.current = onRequestClose;

  useLayoutEffect(() => {
    if (open && (phase === 'closed' || phase === 'closing')) {
      const host = anchor.current?.closest<HTMLElement>('[data-shell]') ?? document.body;
      const landing = targetBox(host, size);
      const lift = origin && origin.isConnected ? boxInShell(origin, host) : null;
      setShell(host);
      setTo(landing);
      setAnchored(!!lift);
      setFrom(
        lift ?? {
          left: landing.left + landing.width * 0.03,
          top: landing.top + landing.height * 0.03 + 10,
          width: landing.width * 0.94,
          height: landing.height * 0.94,
        },
      );
      setPhase('opening');
    } else if (!open && (phase === 'open' || phase === 'opening')) {
      setPhase('closing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* One frame at the start box so the transition has somewhere to leave
     from — see Expandable, which this mirrors. */
  useLayoutEffect(() => {
    if (phase === 'opening') {
      const id = requestAnimationFrame(() => setPhase('open'));
      return () => cancelAnimationFrame(id);
    }
    if (phase === 'closing') {
      const t = setTimeout(() => {
        setPhase('closed');
        closedRef.current?.();
      }, reducedMotion() ? 0 : FLIGHT_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  /* The landing box is measured once, as it opens — so a window resized (or
     maximised) with the popup up used to leave it where the OLD centre was.
     While open it re-centres; the box's own transition carries it there. */
  useEffect(() => {
    if (phase !== 'open' || !shell) return;
    const recentre = () => setTo(targetBox(shell, size));
    window.addEventListener('resize', recentre);
    return () => window.removeEventListener('resize', recentre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shell, size.w, size.h]);

  useEffect(() => {
    if (phase !== 'open') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      requestRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const flying = phase !== 'closed';
  const atTarget = phase === 'open';
  const box = atTarget ? to : from;
  const still = reducedMotion();
  const motion = still
    ? 'none'
    : ['left', 'top', 'width', 'height', 'opacity'].map((p) => `${p} ${FLIGHT_MS}ms ${EASE}`).join(', ');

  return (
    <>
      <span ref={anchor} hidden />
      {flying && box && shell
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="close"
                tabIndex={-1}
                onClick={onRequestClose}
                className="absolute inset-0 cursor-default"
                style={{
                  zIndex: layer,
                  background: 'var(--tri-pop-scrim)',
                  opacity: atTarget ? 1 : 0,
                  transition: still ? 'none' : `opacity ${FLIGHT_MS}ms ${EASE}`,
                }}
              />
              <section
                ref={card}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                /* Read by an open dashboard tile: while this is up, Esc is
                   this popup's to answer, not the tile's under it. Off as
                   soon as it starts home — it no longer answers Esc then,
                   so the next press must reach the tile. */
                data-flight-popup={phase === 'closing' ? undefined : ''}
                className="tri-rounded-surface absolute flex flex-col overflow-hidden"
                style={{
                  ...box,
                  zIndex: layer + 10,
                  background: 'var(--tri-pop)',
                  opacity: atTarget || anchored ? 1 : 0,
                  boxShadow:
                    'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.08), 0 30px 80px rgb(0 0 0 / 0.5)',
                  transition: motion,
                }}
              >
                {/* Everything inside arrives after the box has landed and
                    leaves before it takes off, so nothing is read at the
                    wrong size — the rule the tiles follow. */}
                <div
                  inert={!!overlay}
                  aria-hidden={overlay ? true : undefined}
                  className="flex min-h-0 flex-1 flex-col"
                  style={{
                    opacity: atTarget ? 1 : 0,
                    transition: still
                      ? 'none'
                      : `opacity ${atTarget ? 200 : 90}ms ${EASE} ${atTarget ? FLIGHT_MS * 0.6 : 0}ms`,
                  }}
                >
                  <header className="flex shrink-0 items-start justify-between gap-4 px-6 pt-5">
                    <div className="min-w-0 flex-1">{header}</div>
                    <button
                      type="button"
                      onClick={onRequestClose}
                      title="close (esc)"
                      aria-label="close"
                      className="tri-rounded-control grid size-[28px] shrink-0 place-items-center text-[rgb(229_243_242_/_0.5)] transition-colors hover:bg-[rgb(255_255_255_/_0.06)] hover:text-[var(--tri-ink)]"
                    >
                      <CloseIcon size={13} />
                    </button>
                  </header>
                  {children}
                  {footer}
                </div>
                {overlay}
              </section>
            </>,
            shell,
          )
        : null}
    </>
  );
}
