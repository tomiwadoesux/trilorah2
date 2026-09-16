import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { NoteIcon, MediaIcon } from '../../ui';
import type { QueueSource } from './run';

/*
 * Dragging things into the run of service.
 *
 * Not the browser's drag-and-drop. Native DnD freezes a snapshot of the
 * dragged element at pointerdown and cannot touch it again — no growing into
 * place, no reacting to what it is over, no second item riding along behind
 * the first. All three are the point here, so the chip is an element we
 * render and move ourselves.
 *
 * The gesture is HOLD, not press. A verse row is text somebody may want to
 * select, and a row that starts dragging the instant the pointer moves takes
 * that away. So: move too early and the row refuses with the system's nudge
 * and behaves like an ordinary click; hold still for HOLD_MS and a ring
 * fills at the pointer; when it closes, the chip scales in and the drag is
 * live. Nothing is ever dragged by accident, and nothing is ever selected by
 * accident either.
 *
 * Everything that moves is transform and opacity only, and the pointer
 * position never enters React state — it is written straight to the layer's
 * transform, so a drag across the window costs no re-renders at all.
 */

/* ------------------------------------------------------------------ */
/* Timings                                                             */
/* ------------------------------------------------------------------ */

/** How long the ring takes to close. Long enough to be a decision, short
    enough not to be a wait. */
const HOLD_MS = 450;
/** Movement that cancels the hold. Below this is hand tremor, not intent. */
const SLOP = 6;
/** The parked chip's grace period, in seconds. Long enough to cross the
    screen, change tab, find a second thing and pick it up. */
const HOLD_SECONDS = 22;
/** Two Shifts inside this are a double-tap; further apart they are two taps. */
const DOUBLE_TAP_MS = 400;
/*
 * The hold ring's radius, and the circumference the keyframe animates.
 *
 * Small: the ring is a progress hint at the pointer, not an object in the
 * layout — at its old r=9 it read as a spinner, which says "waiting for the
 * app" when the truth is the opposite (the app is waiting for you). One
 * number, because the dash animation has to be the circle's own
 * circumference or the sweep does not finish where the stroke does.
 */
const RING_R = 6;
const RING_C = 2 * Math.PI * RING_R;

/* ------------------------------------------------------------------ */
/* What is being carried                                               */
/* ------------------------------------------------------------------ */

export interface DragItem {
  source: QueueSource;
  /** The caption under the chip, and the row's label once dropped. */
  label: string;
  /** Scripture: the verse itself, for the quote inside the chip. */
  quote?: string;
  /** Media and slides: something to draw in the card. */
  preview?: string;
}

/*
 * Which gesture a source uses.
 *
 * Scripture only. The rule is "is there text here worth selecting", and a
 * verse row is the one place in the browser where the answer is yes — the
 * rest are cards whose text is a label, not content. Written as a predicate
 * on the item rather than a flag on the binding so no callsite has to
 * remember which it is; the item already knows what it is.
 */
function needsHold(item: DragItem): boolean {
  return item.source === 'scripture';
}

interface Parked extends DragItem {
  key: string;
  /** Seconds left before it lets go. Null once paused. */
  left: number | null;
  /*
   * Where it was let go of, in viewport px.
   *
   * A parked chip is off the pointer entirely — that is the whole point of
   * parking one. It stays where you left it while your hand goes to find
   * the next thing, and only rejoins the pointer once there is something
   * new being carried for it to fall in behind.
   */
  x: number;
  y: number;
}

interface DragValue {
  /** Non-null once the ring has closed — a live drag. */
  active: DragItem | null;
  /** Chips waiting to ride along, newest first. */
  parked: Parked[];
  /** The segment the pointer is over, if any. */
  over: string | null;
  /** Wire onto a row to make it a source. */
  bind: (item: () => DragItem) => SourceBinding;
  /** Register a segment as somewhere a chip can land. */
  dropProps: (segmentKey: string) => { 'data-drop-segment': string };
}

export interface SourceBinding {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
}

const DragContext = createContext<DragValue | null>(null);

export function useDrag(): DragValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDrag must be used inside a DragProvider');
  return ctx;
}

/* ------------------------------------------------------------------ */

export function DragProvider({
  children,
  onDrop,
}: {
  children: ReactNode;
  /** Everything being carried, dropped on a segment. */
  /** The segment dropped on, or null for a drop on the run but not on any
      segment — see dropInto in run.tsx. */
  onDrop: (segmentKey: string | null, items: DragItem[]) => void;
}) {
  const [active, setActive] = useState<DragItem | null>(null);
  const [parked, setParked] = useState<Parked[]>([]);
  const [over, setOver] = useState<string | null>(null);
  /*
   * What is showing at the pointer.
   *
   *   holding   the ring, while the hold is being counted out
   *   refused   "hold to drag", shown ONLY at the moment the gesture is
   *             turned down — pressed and moved too early
   *
   * Deliberately not a hover hint. A label on every row the pointer crosses
   * is noise you learn to look past, and it arrives before you have asked
   * the question. Shown on the refusal it arrives in the half-second you
   * are actually wondering why nothing happened, in the place you are
   * already looking, alongside the shake that says the same thing wordlessly.
   */
  const [pointerState, setPointerState] = useState<'idle' | 'refused' | 'holding'>('idle');

  /* Everything positional lives in refs. Putting the pointer in state would
     re-render the whole screen on every mousemove for no visual gain — the
     only thing that has to move is one transform. */
  const layer = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const held = useRef<DragItem | null>(null);
  const source = useRef<HTMLElement | null>(null);
  const seq = useRef(0);
  /* Set while the gesture is being abandoned, so the pointerup that follows
     does not read as a drop. */
  const dead = useRef(false);

  const pos = useRef({ x: 0, y: 0 });

  const place = useCallback((x: number, y: number) => {
    pos.current = { x, y };
    const el = layer.current;
    if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  /*
   * A drag that ends over a segment is followed by a click on the row it
   * started from — pointer capture does not suppress it. Left alone, every
   * drop also previewed the verse it had just carried away. One capturing
   * listener eats exactly one click and takes itself off again.
   */
  const swallowNextClick = useCallback(() => {
    const eat = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      document.removeEventListener('click', eat, true);
    };
    document.addEventListener('click', eat, true);
    /* If no click follows — the pointer left the row mid-drag — the listener
       would sit there and eat an unrelated one later. */
    window.setTimeout(() => document.removeEventListener('click', eat, true), 350);
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    held.current = null;
    source.current = null;
    setActive(null);
    setOver(null);
    setPointerState('idle');
    /* Text selection is turned off for the length of a carry — once the ring
       closes the pointer is moving with the button down, which is a
       selection gesture to everything that is not us. */
    document.body.style.removeProperty('user-select');
  }, []);

  /* --- the refusal ------------------------------------------------ */
  /* Moving before the ring closes is not a drag. The row does what a click
     does, and shakes to say the gesture was seen and was not the one. */
  const refuse = useCallback(() => {
    const el = source.current;
    clearTimer();
    held.current = null;
    /* The words and the shake are the same message twice, at the same
       instant and in the same place. It clears itself — a hint you have to
       dismiss is a second thing to do while already confused. */
    setPointerState('refused');
    window.setTimeout(
      () => setPointerState((cur) => (cur === 'refused' ? 'idle' : cur)),
      1400,
    );
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    el.animate(
      reduced
        ? [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }]
        : [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-3px)' },
            { transform: 'translateX(2.4px)' },
            { transform: 'translateX(-1.35px)' },
            { transform: 'translateX(0)' },
          ],
      { duration: 220, easing: 'ease-out' },
    );
    source.current = null;
  }, []);

  /* --- the source binding ----------------------------------------- */
  /*
   * Two gestures, chosen by what is being picked up.
   *
   * Scripture rows are TEXT — a verse is something an operator may want to
   * select and copy, so a row that starts dragging the moment the pointer
   * moves would steal that. Those keep the hold: the ring counts out, and
   * moving early refuses and behaves as a click.
   *
   * Everything else is a CARD — a song section, a slide, a photo. There is
   * no text selection to protect on a card, so the hold was pure tax: half a
   * second of ring before a drag that was never ambiguous. Cards therefore
   * arm on pointerdown and go live the moment the pointer clears SLOP, which
   * is also what makes a plain click on a card still a click: the drag only
   * begins if you actually move.
   */
  const bind = useCallback(
    (item: () => DragItem): SourceBinding => ({
      onPointerDown: (e) => {
        /* Left button only, and never on top of a live drag. */
        if (e.button !== 0 || active) return;
        dead.current = false;
        source.current = e.currentTarget;
        const carried = item();
        held.current = carried;
        origin.current = { x: e.clientX, y: e.clientY };
        place(e.clientX, e.clientY);
        e.currentTarget.setPointerCapture(e.pointerId);
        clearTimer();
        /* A card has no ring and no timer — it waits for movement instead,
           in onPointerMove below. */
        if (!needsHold(carried)) return;
        setPointerState('holding');
        timer.current = window.setTimeout(() => {
          timer.current = null;
          const still = held.current;
          if (!still) return;
          setActive(still);
          setPointerState('idle');
          document.body.style.setProperty('user-select', 'none');
        }, HOLD_MS);
      },
      onPointerMove: (e) => {
        place(e.clientX, e.clientY);
        if (active) {
          /* Hit-test rather than rely on events: the chip is under the
             pointer and would swallow every enter/leave otherwise. It is
             pointer-events:none, so elementFromPoint sees straight past it. */
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const target = el?.closest('[data-drop-segment]');
          setOver(target?.getAttribute('data-drop-segment') ?? null);
          return;
        }
        if (!held.current) return;
        const dx = e.clientX - origin.current.x;
        const dy = e.clientY - origin.current.y;
        if (Math.hypot(dx, dy) <= SLOP) return;
        /* Past the slop. For a verse that is the wrong gesture and the row
           refuses; for a card it IS the gesture, and the drag starts here. */
        if (needsHold(held.current)) {
          refuse();
          return;
        }
        clearTimer();
        setActive(held.current);
        setPointerState('idle');
        document.body.style.setProperty('user-select', 'none');
      },
      onPointerUp: (e) => {
        if (source.current === e.currentTarget) {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* already gone — releasing twice is not an error worth raising */
          }
        }
        if (dead.current) {
          dead.current = false;
          return;
        }
        /* Released before the ring closed: an ordinary click, no drag, and
           no refusal either — nothing was asked for. */
        if (!active) {
          clearTimer();
          held.current = null;
          setPointerState('idle');
          return;
        }
        /* `over` is '' on the rail's own backdrop and a key on a segment;
           both are drops. Only null — the pointer was over neither — is a
           miss, so the empty string must not be tested for truthiness. */
        if (over !== null) {
          onDrop(over === '' ? null : over, [...parked.map(stripParked), active]);
          setParked([]);
        }
        /*
         * A miss lets the active chip go — it does NOT park it. Holding is
         * a deliberate act with its own gesture (the Shift double-tap), and
         * a release that quietly parked things would grow a shelf of chips
         * nobody remembered putting down. Chips already parked were parked
         * on purpose, so they stay and their countdown resumes.
         */
        swallowNextClick();
        reset();
      },
      onPointerCancel: () => {
        dead.current = true;
        setParked([]);
        reset();
      },
    }),
    [active, over, parked, place, refuse, reset, onDrop, swallowNextClick],
  );

  /* --- shift double-tap parks the carry ---------------------------- */
  useEffect(() => {
    if (!active) return;
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Shift' || e.repeat) return;
      const now = e.timeStamp;
      if (now - last < DOUBLE_TAP_MS) {
        last = 0;
        setParked((prev) => [
          {
            ...active,
            key: `parked-${(seq.current += 1)}`,
            left: HOLD_SECONDS,
            /* Frozen here. From this instant the pointer has no say over it
               — you can move the mouse, leave the row, cross the window,
               and it stays exactly where you set it down. */
            x: pos.current.x,
            y: pos.current.y,
          },
          /*
           * Everything already parked goes back to a full count.
           *
           * They are one collection, not a set of independent egg timers:
           * parking a third thing is evidence you are still working, and
           * having the first one expire out from under you while you do is
           * the collection punishing you for taking your time. One clock,
           * restarted by any arrival.
           *
           * A chip the operator paused by hand stays paused — that was a
           * deliberate act and it already outlasts any count.
           */
          ...prev.map((p) => (p.left === null ? p : { ...p, left: HOLD_SECONDS })),
        ]);
        /* The drag ends so the hand is free to go and fetch the next thing;
           the chip stays on screen, counting, and will fall in behind
           whatever is picked up next. */
        dead.current = true;
        swallowNextClick();
        reset();
      } else {
        last = now;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, reset, swallowNextClick]);

  /* --- the parked countdown ---------------------------------------- */
  useEffect(() => {
    /*
     * Stopped while something is being carried. Once a new drag starts the
     * parked chips are part of that carry — they leave their positions, fall
     * in behind the chip under the pointer, and the tally counts them. They
     * are in hand, not waiting, and a thing in your hand should not be able
     * to expire out of it halfway to the rail.
     */
    if (active) return;
    if (!parked.some((p) => p.left !== null)) return;
    const id = window.setInterval(() => {
      setParked((prev) =>
        prev
          .map((p) => (p.left === null ? p : { ...p, left: p.left - 1 }))
          .filter((p) => p.left === null || p.left > 0),
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [parked, active]);

  /* The shelf is one card, so its ✕ empties it. There is no longer a
     per-chip target on screen to aim a per-chip cancel at. */
  const cancelAll = useCallback(() => {
    setParked([]);
  }, []);

  /*
   * Double-click on anything that is not a chip clears the whole shelf —
   * every ✕ at once. Only while chips are parked and nothing is in hand:
   * with a carry live, a double-click is part of whatever the hand is
   * doing, not a verdict on the shelf.
   */
  useEffect(() => {
    if (active || parked.length === 0) return;
    const onDbl = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.('[data-drag-chip]')) return;
      setParked([]);
    };
    document.addEventListener('dblclick', onDbl);
    return () => document.removeEventListener('dblclick', onDbl);
  }, [active, parked.length]);

  /*
   * Pause or resume the whole shelf, on one rule for all of it.
   *
   * If ANY chip is still counting, the gesture is "pause" and everything
   * stops; only when all of them are already paused does it resume. Deciding
   * per chip would leave a shelf half running after one press, which is not
   * a state the single card can show.
   */
  const pauseAll = useCallback(() => {
    setParked((prev) => {
      const anyRunning = prev.some((p) => p.left !== null);
      return prev.map((p) => ({ ...p, left: anyRunning ? null : HOLD_SECONDS }));
    });
  }, []);

  const dropProps = useCallback(
    (segmentKey: string) => ({ 'data-drop-segment': segmentKey }),
    [],
  );

  const value = useMemo(
    () => ({ active, parked, over, bind, dropProps }),
    [active, parked, over, bind, dropProps],
  );

  return (
    <DragContext.Provider value={value}>
      {children}
      <DragLayer
        layerRef={layer}
        state={pointerState}
        active={active}
        parked={parked}
        onPauseAll={pauseAll}
        onCancelAll={cancelAll}
      />
    </DragContext.Provider>
  );
}

const stripParked = (p: Parked): DragItem => ({
  source: p.source,
  label: p.label,
  quote: p.quote,
  preview: p.preview,
});

/* ------------------------------------------------------------------ */
/* The layer                                                           */
/* ------------------------------------------------------------------ */

/*
 * One fixed element at the top-left of the window, moved by transform. The
 * chips hang off it with their own offsets, so a whole stack rides on a
 * single transform write per pointer move.
 */
function DragLayer({
  layerRef,
  state,
  active,
  parked,
  onPauseAll,
  onCancelAll,
}: {
  layerRef: React.RefObject<HTMLDivElement | null>;
  state: 'idle' | 'refused' | 'holding';
  active: DragItem | null;
  parked: Parked[];
  /** The shelf's own controls — it is one card, so they take all of it. */
  onPauseAll: () => void;
  onCancelAll: () => void;
}) {
  /* Everything being carried at once. The bubble only earns its place from
     two upward — a "1" on a single chip is telling you what you can see. */
  const carrying = parked.length + (active ? 1 : 0);

  return createPortal(
    <>
      {/*
       * Parked and detached.
       *
       * Rendered outside the moving layer, at the coordinates each chip was
       * set down at, so nothing about the pointer reaches them. They rejoin
       * the pointer below, but only once there is something new to fall in
       * behind — which is why this half disappears the moment `active` does
       * not.
       */}
      {!active && parked.length > 0 && (
        <div
          data-drag-chip
          className="fixed z-[100]"
          /* Where the NEWEST one was set down. The shelf is one object, so
             it has one position, and the last place the operator put
             something is where they are looking. */
          style={{
            left: parked[0].x + 16,
            top: parked[0].y + 16,
            animation: 'tri-chip-in 200ms var(--tri-ease-out) both',
          }}
        >
          <Chip
            item={parked[0]}
            count={parked.length > 1 ? parked.length : undefined}
            /*
             * The countdown, the pause and the cancel belong to the SHELF
             * now, not to one chip on it.
             *
             * `left` is the soonest expiry, because that is the one that
             * decides when something is about to be lost — showing the
             * newest chip's clock while an older one silently ran out would
             * be a lie told by omission. Pause and cancel take the whole
             * shelf for the same reason: with one card on screen there is
             * no way to aim at an individual chip, so a control that hit
             * only one of them would be a control you cannot see the target
             * of.
             */
            held={{
              left: parked.reduce<number | null>(
                (soonest, chip) =>
                  chip.left === null || soonest === null ? null : Math.min(soonest, chip.left),
                parked[0].left,
              ),
              onPause: onPauseAll,
              onCancel: onCancelAll,
            }}
          />
        </div>
      )}

      {/*
       * The moving layer.
       *
       * One fixed element at the window's top-left, moved by transform. The
       * chips hang off it with their own offsets, so a whole stack rides on
       * a single transform write per pointer move. Always mounted, even with
       * nothing in it: unmounting when idle throws away the ref, and place()
       * is called before the render that would bring it back — the first
       * frame of every gesture would show at the corner of the window.
       */}
      <div
        ref={layerRef}
        className="pointer-events-none fixed left-0 top-0 z-[100]"
        style={{ willChange: 'transform' }}
      >
        {/* The refusal. Sits at the pointer because that is where the eye
            already is, and arrives with the shake rather than instead of it. */}
        {state === 'refused' && !active && (
          <span
            className="absolute whitespace-nowrap rounded-[6px] bg-[rgb(0_0_0_/_0.86)] px-2 py-1 text-[length:var(--tri-size-xs)] lowercase text-[rgb(229_243_242_/_0.82)]"
            style={{ left: 14, top: 14, animation: 'tri-chip-in 140ms var(--tri-ease-out) both' }}
          >
            hold to drag
          </span>
        )}

        {/* The ring. Pure CSS on a dash offset — nothing ticks, nothing is in
            state, and it cannot drift from HOLD_MS because it IS HOLD_MS. */}
        {state === 'holding' && (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            className="absolute"
            style={{ left: 12, top: 12 }}
            aria-hidden
          >
            <circle cx="9" cy="9" r="6" fill="none" stroke="rgb(229 243 242 / 0.16)" strokeWidth="1.5" />
            <circle
              cx="9"
              cy="9"
              r="6"
              fill="none"
              stroke="var(--tri-accent-yellow)"
              strokeWidth="1.5"
              strokeLinecap="round"
              transform="rotate(-90 9 9)"
              style={{
                strokeDasharray: RING_C,
                animation: `tri-ring ${HOLD_MS}ms linear both`,
              }}
            />
          </svg>
        )}

        {/*
          One box, however many things are in it.

          These used to fan out — each parked chip further back and further
          turned. Three of them read as three objects, which was the intent,
          but it also meant the thing under the pointer changed shape and
          footprint with every pick-up, and a stack of five was a spray of
          debris the operator had to parse mid-gesture. A carry is ONE thing
          being carried; how many is a number, not a silhouette.

          So: a single chip, and the count rides at its top-right. The chips
          behind it are gone entirely rather than hidden, because nothing
          reads them — the count is the whole story.
        */}
        {active && (
          <div
            className="absolute"
            style={{ left: 16, top: 16, animation: 'tri-chip-in 180ms var(--tri-ease-out) both' }}
          >
            <Chip item={active} count={carrying > 1 ? carrying : undefined} />
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* The chip                                                            */
/* ------------------------------------------------------------------ */

/*
 * One size for everything.
 *
 * A verse, a chorus, a slide and a photo are wildly different objects, and
 * chips that sized themselves to their contents would make a stack of them
 * read as debris. Same square, same caption slot, different interior — so
 * the stack reads as "three things" at a glance and the interior answers
 * "which three" on a second look. The square and its caption are the font
 * card from the theme editor, at the size that card is drawn.
 */
const CHIP = 78;

function Chip({
  item,
  held,
  count,
}: {
  item: DragItem;
  held?: { left: number | null; onPause: () => void; onCancel: () => void };
  /** How many things are being carried. Shown from two upward. */
  count?: number;
}) {
  return (
    /* relative, and deliberately NOT clipped: the two corner badges hang off
       the card and are positioned against this, not against the card. */
    <div className="relative flex w-[78px] flex-col items-center gap-[5px]" style={{ width: CHIP }}>
      <div
        className="tri-rounded-control relative flex w-full items-center justify-center overflow-hidden bg-[#101010]"
        style={{
          height: CHIP,
          boxShadow:
            '0 12px 28px rgb(0 0 0 / 0.6), inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.16)',
        }}
      >
        <ChipFace item={item} />

        {held && (
          /* The parked overlay. Covers the face rather than sitting beside
             it — a chip that is waiting is not a chip you are reading. */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3px] bg-[rgb(0_0_0_/_0.74)] backdrop-blur-[1px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(228_216_122_/_0.95)]">
              hold
            </span>
            <button
              type="button"
              onClick={held.onPause}
              title={held.left === null ? 'resume the countdown' : 'pause the countdown'}
              className="flex size-[22px] items-center justify-center rounded-full bg-[rgb(255_255_255_/_0.14)] text-[var(--tri-ink)] transition-colors hover:bg-[rgb(255_255_255_/_0.24)]"
            >
              {held.left === null ? (
                <svg width="10" height="10" viewBox="0 0 9 9" aria-hidden>
                  <path d="M1.5 0.6 8 4.5 1.5 8.4Z" fill="currentColor" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 9 9" aria-hidden>
                  <rect x="1" y="0.8" width="2.4" height="7.4" rx="0.8" fill="currentColor" />
                  <rect x="5.6" y="0.8" width="2.4" height="7.4" rx="0.8" fill="currentColor" />
                </svg>
              )}
            </button>
            <span className="text-[13px] font-semibold tabular-nums text-[rgb(229_243_242_/_0.85)]">
              {held.left === null ? 'paused' : `${held.left}s`}
            </span>
          </div>
        )}
      </div>

      <span className="w-full truncate text-center text-[length:var(--tri-size-eyebrow)] lowercase text-[rgb(229_243_242_/_0.7)]">
        {item.label}
      </span>

      {/*
       * The corner badges.
       *
       * Siblings of the card rather than children of it: the card clips to
       * its own rounded corner so the face and any image stay inside it, and
       * anything hung on the corner from in there gets cut in half by that
       * same clip. Out here they are free to sit outside the square, which
       * is where a badge belongs — centred on the corner, half on and half
       * off, so it reads as attached to the chip rather than drawn on it.
       */}
      {/* Top-RIGHT, while cancel keeps the top-left. They used to share a
          corner, which was fine only because a chip was never both carried
          and parked at once — but the count is now the only thing that says
          how big the carry is, so it gets a corner of its own and the two
          can never land on top of each other. */}
      {count !== undefined && (
        <span
          className="absolute z-10 flex size-[19px] items-center justify-center rounded-full text-[11px] font-semibold tabular-nums text-[#101010]"
          style={{
            right: -9,
            top: -9,
            backgroundColor: 'var(--tri-accent-yellow)',
            boxShadow: '0 2px 7px rgb(0 0 0 / 0.6)',
          }}
        >
          {count}
        </span>
      )}

      {held && (
        /* Discards this one and only this one. Top-left; the carry tally
           sits opposite on the right, so the two never collide. */
        <button
          type="button"
          onClick={held.onCancel}
          title="cancel this one"
          className="absolute z-10 flex size-[19px] items-center justify-center rounded-full text-[#101010] transition-transform hover:scale-110"
          style={{
            left: -9,
            top: -9,
            backgroundColor: 'var(--tri-ink-danger)',
            boxShadow: '0 2px 7px rgb(0 0 0 / 0.6)',
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
            <path
              d="M1.2 1.2 6.8 6.8M6.8 1.2 1.2 6.8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

/*
 * The interior, by source. Each answers "which one is this" in the smallest
 * mark that can: scripture gets its own words, the picture sources get the
 * picture, and everything else gets its glyph.
 */
function ChipFace({ item }: { item: DragItem }) {
  if (item.source === 'scripture') {
    return (
      <div className="flex h-full w-full flex-col px-[7px] py-[6px]">
        <span
          aria-hidden
          className="-mb-[3px] font-serif text-[16px] leading-none text-[var(--tri-accent-yellow)]"
        >
          &ldquo;
        </span>
        {/* Three lines and no more. Enough to know which verse is in hand
            without turning the chip into something to be read. */}
        <span
          className="overflow-hidden text-[8px] leading-[1.35] text-[rgb(229_243_242_/_0.72)]"
          style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}
        >
          {item.quote ?? item.label}
        </span>
      </div>
    );
  }

  /* A deck's chip is its page, for the same reason media's is its image:
     no glyph tells anyone which of four decks they picked up. */
  if (
    (item.source === 'media' || item.source === 'song' || item.source === 'presentation') &&
    item.preview
  ) {
    return <img src={item.preview} alt="" className="h-full w-full object-cover" />;
  }

  if (item.source === 'note') {
    return <NoteIcon size={22} className="text-[rgb(229_243_242_/_0.45)]" />;
  }

  return <MediaIcon size={22} className="text-[rgb(229_243_242_/_0.45)]" />;
}

/* Kept here rather than in tokens.css: these two belong to the drag layer
   and nothing else has any use for them. */
export function DragKeyframes() {
  return (
    <style>{`
      @keyframes tri-ring {
        from { stroke-dashoffset: ${RING_C}; }
        to   { stroke-dashoffset: 0; }
      }
      @keyframes tri-chip-in {
        from { opacity: 0; transform: scale(0.72); }
        to   { opacity: 1; transform: scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes tri-chip-in {
          from { opacity: 0; transform: none; }
          to   { opacity: 1; transform: none; }
        }
      }
    `}</style>
  );
}

export { CHIP as CHIP_SIZE };
