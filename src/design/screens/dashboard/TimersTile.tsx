import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Panel } from '../parts';
import { Expandable } from './expand';
import { useBoxSize } from './useBoxSize';
import { formatTimerDisplay } from '../../../../shared/timerDisplay';
import { getTimerInk } from '../../../../shared/timerColor';
import { PauseIcon, PlayIcon, ResetIcon, TrashIcon } from '../../../ui';

interface Snapshot {
  id: string;
  name: string;
  kind: 'countdown' | 'to-time' | 'elapsed';
  state: 'stopped' | 'running' | 'paused';
  remainingMs: number;
  overrunning: boolean;
  display: string;
  durationSec?: number;
  extraSec?: number;
  inExtension?: boolean;
  phaseTotalMs?: number;
}

/** The face the tile shows with no timer running, and what DELETE returns to. */
const DEFAULT_DURATION_SEC = 45 * 60;

/*
 * Grace the operator can hand the preacher, in minutes.
 *
 * Three sizes, because this is pressed once, at the front, while a sermon is
 * running long and everyone is watching: a short "land it", a normal "take
 * your time", and a generous "finish the thought". A six-wide grid of
 * 1/2/5/10/12/15 asked the operator to do arithmetic at the exact moment
 * they had none to spare.
 */
const EXTRA_MINUTES_OPTIONS = [3, 5, 7];

/**
 * What the face should read right now, extrapolated between engine ticks.
 *
 * The store only emits on mutation, so between broadcasts the tile carries
 * the number forward itself. The subtlety is the extension boundary: a plain
 * `remainingMs - drift` keeps diving past zero, but the engine will hand back
 * the extension's full value the instant it recomputes, so the face would
 * dip negative and then snap up to 5:00. Extrapolation stops at the boundary
 * and lets the next broadcast do the handover.
 */
function faceMs(t: Snapshot, takenAt: number): number {
  if (t.state !== 'running') return t.remainingMs;
  const drift = Date.now() - takenAt;
  if (t.kind === 'elapsed') return t.remainingMs + drift;

  const next = t.remainingMs - drift;
  const grace = Math.max(0, t.extraSec ?? 0) * 1000;
  if (!t.inExtension && grace > 0 && next < 0) return 0;
  return next;
}

/* ---------------------------------------------------------------------------
 * The face, as six digits.
 *
 * A duration lives here as exactly six characters, HHMMSS, and typing SHIFTS
 * IN FROM THE RIGHT the way a microwave or a desk phone does: press 4, 5, 0,
 * 0 and you have 00:45:00.
 *
 * The alternative — six separately focusable boxes, one keystroke each — was
 * rejected because it makes the operator AIM. Aiming is the one thing you
 * cannot do at 10:58 on a Sunday with the worship team walking off the
 * platform. Shift-in needs no aim: click anywhere on the clock, type the
 * number the way you would say it, done. Backspace shifts the other way,
 * which is the same gesture in reverse and so needs no explaining.
 *
 * The cost is that half-typed digits sit at the right and travel left, so
 * "forty-five minutes" reads 00:00:04 → 00:00:45 → 00:04:50 → 00:45:00 as it
 * is typed. That is visible and self-correcting, and far cheaper than a box
 * you have to hit.
 * ------------------------------------------------------------------------- */

/*
 * The stage screen's numerals, borrowed for the dashboard.
 *
 * .timer-screen-digits in src/output.css sets exactly this stack for the
 * full-screen timer the preacher reads. The bento face is the same clock at
 * a smaller size, so it wears the same face — a booth glancing between the
 * tile and the wall should not see two different timers. Both pages load
 * Orbitron (index.html / design.html / output.html).
 */
const TIMER_FONT = "'Orbitron', 'Share Tech Mono', monospace";

/* The tile's clock, and the width it needs at that size — six 52px boxes,
   two 16px colons and the gaps between them, all times the scale. FaceFit
   shrinks below this only when the card is narrower than that. */
const TILE_FACE_SCALE = 1.15;
const TILE_FACE_W = Math.round((52 * 6 + 16 * 2 + 4 * 7) * TILE_FACE_SCALE);

/** Six digits, HHMMSS, from a duration in seconds. */
export function secondsToDigits(totalSec: number): string {
  const capped = Math.max(0, Math.min(99 * 3600 + 59 * 60 + 59, Math.floor(totalSec)));
  const h = Math.floor(capped / 3600);
  const m = Math.floor((capped % 3600) / 60);
  const s = capped % 60;
  return `${pad2(h)}${pad2(m)}${pad2(s)}`;
}

/**
 * Seconds from six typed digits.
 *
 * Minutes and seconds are read as written rather than refused: typing
 * 00 75 00 means the operator asked for seventy-five minutes, and
 * seventy-five minutes is what he gets (1:15:00). Rejecting it would leave
 * him staring at a clock that will not take an ordinary number.
 */
export function digitsToSeconds(digits: string): number {
  const h = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const s = Number(digits.slice(4, 6));
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return 0;
  return h * 3600 + m * 60 + s;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Shift one digit in from the right, dropping whatever falls off the left. */
function pushDigit(digits: string, d: string): string {
  return (digits + d).slice(-6);
}

/** Shift one digit out to the right, feeding a zero in at the left. */
function popDigit(digits: string): string {
  return `0${digits.slice(0, 5)}`;
}

/**
 * Six boxes in three pairs, with a ':' between the pairs.
 *
 * Read-only while a timer runs: the number showing then is the truth being
 * projected behind the preacher, and a stray keypress must not be able to
 * move it. Stopped, the whole clock is one control — click or Enter to type,
 * Enter or blur to keep it, Escape to put back what was there.
 */
function DigitFace({
  digits,
  editing,
  color,
  onBeginEdit,
  onDigits,
  onCommit,
  onCancel,
  scale = 1,
  negative = false,
  active = true,
}: {
  digits: string;
  editing: boolean;
  color: string;
  onBeginEdit: () => void;
  onDigits: (next: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  scale?: number;
  negative?: boolean;
  /*
   * Whether this copy of the face is the one the operator can actually see.
   *
   * The tile stays mounted underneath the popup (Expandable dims it to 0.25
   * rather than unmounting), so while the popup is open BOTH faces exist and
   * share one `editing` flag. Without this they would both grab focus on the
   * same frame and the loser's blur would knock the winner straight back out
   * of edit mode. Only the visible one takes focus or listens to blur.
   */
  active?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editing && active) ref.current?.focus();
  }, [editing, active]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (!editing) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onBeginEdit();
      }
      return;
    }
    if (e.key >= '0' && e.key <= '9' && e.key.length === 1) {
      e.preventDefault();
      onDigits(pushDigit(digits, e.key));
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onDigits(popDigit(digits));
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      /* Tab keeps the number rather than reverting: leaving the field is an
         ordinary way to finish typing, and losing the entry would be a nasty
         surprise. Only Escape is an undo. */
      if (e.key === 'Enter') e.preventDefault();
      onCommit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const pairs = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];

  const boxW = Math.round(52 * scale);
  const boxH = Math.round(70 * scale);
  const fontSize = Math.round(44 * scale);
  const gap = Math.round(4 * scale);

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      aria-label={
        editing
          ? 'Timer duration — type digits to set'
          : `Timer ${digits.slice(0, 2)} hours ${digits.slice(2, 4)} minutes ${digits.slice(4, 6)} seconds`
      }
      onKeyDown={handleKey}
      onClick={(e) => {
        e.stopPropagation();
        if (!editing) onBeginEdit();
      }}
      onBlur={() => {
        if (editing && active) onCommit();
      }}
      className="flex select-none items-center justify-center rounded-[var(--tri-radius-control)] outline-none focus-visible:ring-1 focus-visible:ring-white/25"
      style={{ cursor: editing ? 'text' : 'pointer', gap }}
    >
      {negative && (
        <span
          className="font-black leading-none"
          style={{ color, fontSize, marginRight: Math.round(2 * scale), fontFamily: TIMER_FONT }}
        >
          −
        </span>
      )}
      {pairs.map((pair, pi) => (
        <div key={pi} className="flex items-center" style={{ gap }}>
          {pi > 0 && (
            <span
              className="text-center font-black leading-none"
              style={{
                color,
                fontSize,
                fontFamily: TIMER_FONT,
                opacity: 0.4,
                width: Math.round(16 * scale),
                /* A colon sits on the baseline and would hang low against
                   digits that fill their whole box, so lift it to the optical
                   centre. */
                transform: `translateY(${Math.round(-0.07 * fontSize)}px)`,
              }}
            >
              :
            </span>
          )}
          {[pair[0], pair[1]].map((digit, di) => (
            <div
              key={di}
              className="flex items-center justify-center rounded-[var(--tri-radius-control)] border transition-colors"
              style={{
                width: boxW,
                height: boxH,
                borderColor: editing ? 'rgb(255 255 255 / 0.22)' : 'rgb(255 255 255 / 0.10)',
                backgroundColor: editing ? 'rgb(255 255 255 / 0.07)' : 'rgb(255 255 255 / 0.04)',
              }}
            >
              <span
                className="font-black tabular-nums leading-none"
                style={{ color, fontSize, fontFamily: TIMER_FONT }}
              >
                {digit}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TimersTile({ className }: { className?: string }) {
  const [timers, setTimers] = useState<Snapshot[]>([]);
  const [, setTick] = useState(0);
  const takenAt = useRef(Date.now());

  const [toast, setToast] = useState<string | null>(null);

  /* Six digits. Whenever nothing is running this is what the clock reads: it
     is the operator's typed intention, and the thing START acts on. */
  const [draft, setDraft] = useState(() => secondsToDigits(DEFAULT_DURATION_SEC));
  const [editing, setEditing] = useState(false);
  const beforeEdit = useRef(draft);
  const [name, setName] = useState('Sermon');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const api = typeof window === 'undefined' ? undefined : window.api;
    if (!api?.onTimers) return;
    let alive = true;

    const take = (list: Snapshot[]) => {
      if (!alive) return;
      takenAt.current = Date.now();
      setTimers(list || []);
    };

    void api.listTimers?.().then((list) => take((list ?? []) as Snapshot[])).catch(() => undefined);
    return api.onTimers((list) => {
      take((list ?? []) as Snapshot[]);
      return undefined;
    });
  }, []);

  const live = timers.some((t) => t.state === 'running');
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const activeTimer = timers.find((t) => t.state === 'running') ?? timers[0] ?? null;

  // Handler to start timer
  const handleStart = (id: string) => {
    if (window.api?.startTimer) {
      void window.api.startTimer(id);
    } else {
      takenAt.current = Date.now();
      setTimers((prev) => prev.map((t) => (t.id === id ? { ...t, state: 'running' } : t)));
    }
  };

  // Handler to pause timer
  const handlePause = (id: string) => {
    if (window.api?.pauseTimer) {
      void window.api.pauseTimer(id);
    } else {
      setTimers((prev) => prev.map((t) => (t.id === id ? { ...t, state: 'paused' } : t)));
    }
  };

  // Handler to reset timer
  const handleReset = (id: string) => {
    if (window.api?.resetTimer) {
      void window.api.resetTimer(id);
    } else {
      setTimers((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                state: 'stopped',
                remainingMs: (t.durationSec ?? 2700) * 1000,
                display: formatTimerDisplay((t.durationSec ?? 2700) * 1000),
                extraSec: 0,
              }
            : t
        )
      );
    }
  };

  /*
   * Clear the timer away.
   *
   * Deleting leaves the tile on its default 45:00 face rather than an empty
   * card: the operator who just cleared last week's countdown is almost
   * always about to set this week's, and a blank tile makes them hunt for a
   * way back in. The timer really is removed — the face is the editable
   * default, not a ghost of what was there.
   */
  /*
   * Clear the clock back to the default face.
   *
   * Every countdown goes, not just the one on screen. The store keeps a row
   * per timer ever created and the face shows the first RUNNING one, so a
   * single delete could uncover an older timer — or, worse, leave a forgotten
   * running one underneath that silently owns the face and refuses to be
   * typed into. One press, one predictable outcome: an empty store and 45:00
   * back on the boxes.
   */
  const handleRemove = () => {
    if (window.api?.removeTimer) {
      for (const t of timers) void window.api.removeTimer(t.id);
    } else {
      setTimers([]);
    }
    setDraft(secondsToDigits(DEFAULT_DURATION_SEC));
    setEditing(false);
    showToast('Timer cleared — back to 45:00');
  };

  /*
   * Grant the preacher extra time.
   *
   * This only ever moves `extraSec`. The old version added the grace to
   * `durationSec` as well, which is the bug behind "the functions are not
   * working": growing the duration grows the denominator the colour is
   * computed against, so handing five minutes to a sermon in its red last
   * minute snapped the face back to green — and the grace was spent silently
   * inside the first countdown instead of counting down on its own at the
   * end. The engine now treats extraSec as a second phase; see the note on
   * Timer.extraSec in electron/engine/timers.ts.
   */
  const handleAddMinutes = async (extraMinutes: number) => {
    if (!activeTimer) return;
    const granted = (activeTimer.extraSec ?? 0) + extraMinutes * 60;

    if (window.api?.updateTimer) {
      // Grace is only legible if the clock is allowed past zero to reach it.
      await window.api.updateTimer(activeTimer.id, { extraSec: granted, overrun: true });
    } else {
      setTimers((prev) =>
        prev.map((t) => (t.id === activeTimer.id ? { ...t, extraSec: granted } : t))
      );
    }

    showToast(`+${extraMinutes} min for ${activeTimer.name} — shown on the stage screen`);
  };

  const running = activeTimer?.state === 'running';

  /* A running clock owns the face, so editing is closed rather than left open
     over a number the operator cannot actually change. */
  useEffect(() => {
    if (running && editing) setEditing(false);
  }, [running, editing]);

  const beginEdit = () => {
    if (running) return;
    beforeEdit.current = draft;
    setEditing(true);
  };
  const commitEdit = () => setEditing(false);
  const cancelEdit = () => {
    setDraft(beforeEdit.current);
    setEditing(false);
  };

  /*
   * Start whatever is on the face.
   *
   * Reuses the one stopped countdown if there is one, rather than piling up a
   * dead timer per press across a morning. A stopped timer has run time
   * banked against its OLD duration, so it goes back to the top before the
   * newly typed duration can mean anything.
   */
  const handleStartFace = async () => {
    const sec = digitsToSeconds(draft);
    if (sec <= 0) {
      showToast('Set a time first');
      return;
    }
    const timerName = name.trim() || 'Sermon';
    const existing = timers.find((t) => t.kind === 'countdown' && t.state !== 'running');

    if (window.api?.createTimer) {
      if (existing && window.api.updateTimer) {
        await window.api.resetTimer?.(existing.id);
        await window.api.updateTimer(existing.id, {
          name: timerName,
          durationSec: sec,
          extraSec: 0,
          overrun: true,
        });
        await window.api.startTimer?.(existing.id);
      } else {
        const created = await window.api.createTimer({
          name: timerName,
          kind: 'countdown',
          durationSec: sec,
          overrun: true,
        });
        if (created?.id) await window.api.startTimer?.(created.id);
      }
      showToast(`${formatTimerDisplay(sec * 1000)} running`);
      return;
    }

    const local: Snapshot = {
      id: `timer-local-${Date.now()}`,
      name: timerName,
      kind: 'countdown',
      state: 'running',
      remainingMs: sec * 1000,
      overrunning: false,
      display: formatTimerDisplay(sec * 1000),
      durationSec: sec,
      extraSec: 0,
      inExtension: false,
      phaseTotalMs: sec * 1000,
    };
    takenAt.current = Date.now();
    setTimers([local]);
    showToast(`${formatTimerDisplay(sec * 1000)} running`);
  };

  /* The live value and its phase, shared by the tile and the popup so the two
     clocks can never disagree by a tick. */
  const faceMsNow = activeTimer ? faceMs(activeTimer, takenAt.current) : digitsToSeconds(draft) * 1000;
  const phaseMs = activeTimer
    ? activeTimer.phaseTotalMs ?? (activeTimer.durationSec ?? 0) * 1000
    : digitsToSeconds(draft) * 1000;
  /*
   * What the six boxes read.
   *
   * A RUNNING clock owns the face outright. Otherwise the operator's draft
   * wins as soon as they are editing — including over a PAUSED timer, which
   * is the bug this shape exists to kill: the old rule showed the live value
   * for any state that was not 'stopped', so typing into a paused clock put
   * the digits into `draft` while the boxes kept showing the countdown. The
   * keystrokes vanished, and the next start used a duration nobody had seen.
   */
  const showingDraft = !activeTimer || (activeTimer.state !== 'running' && editing);
  const faceDigits = showingDraft ? draft : secondsToDigits(Math.abs(faceMsNow) / 1000);

  /* Colour follows whatever the boxes are actually SHOWING. Deriving it from
     the timer while the digits came from the draft meant a stopped clock left
     near zero could tint a freshly typed 00:45:00 with the danger ink. */
  const faceOver = Boolean(
    !showingDraft &&
      activeTimer &&
      (activeTimer.overrunning ||
        (activeTimer.kind === 'countdown' && !activeTimer.inExtension && !activeTimer.extraSec && faceMsNow < 0))
  );
  const faceInk = faceOver
    ? 'var(--tri-ink-danger)'
    : showingDraft
      ? 'var(--tri-ink)'
      : getTimerInk(faceMsNow, phaseMs);

  const extraBadge =
    activeTimer?.extraSec && activeTimer.extraSec > 0
      ? `+${Math.round(activeTimer.extraSec / 60)} min ${activeTimer.inExtension ? 'extra time' : 'granted'}`
      : null;

  /* One definition of the controls, drawn at two sizes, so the tile and the
     popup cannot drift into disagreeing about what a button does. */
  const controls = (compact: boolean) => {
    const pad = compact ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-2 text-sm';
    const icon = compact ? 10 : 13;
    return (
      <div className={`flex items-center justify-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {running ? (
          <button
            type="button"
            onClick={() => activeTimer && handlePause(activeTimer.id)}
            className={`flex items-center gap-1.5 rounded-[var(--tri-radius-control)] border border-white/15 bg-white/10 font-bold text-[var(--tri-ink)] transition-colors hover:bg-white/[0.15] ${pad}`}
          >
            <PauseIcon size={icon} />
            PAUSE
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              activeTimer && activeTimer.state === 'paused'
                ? handleStart(activeTimer.id)
                : void handleStartFace()
            }
            className={`flex items-center gap-1.5 rounded-[var(--tri-radius-control)] border border-white/15 bg-white/10 font-bold text-[var(--tri-ink)] transition-colors hover:bg-white/[0.15] ${pad}`}
          >
            <PlayIcon size={icon} />
            {activeTimer && activeTimer.state === 'paused' ? 'RESUME' : 'START TIMER'}
          </button>
        )}

        <button
          type="button"
          onClick={() => activeTimer && handleReset(activeTimer.id)}
          disabled={!activeTimer}
          className={`flex items-center gap-1.5 rounded-[var(--tri-radius-control)] border border-white/10 bg-white/5 text-[rgb(229_243_242_/_0.75)] transition-colors hover:bg-white/10 hover:text-[var(--tri-ink)] disabled:opacity-35 ${pad}`}
        >
          <ResetIcon size={icon} />
          RESET
        </button>

        <button
          type="button"
          onClick={handleRemove}
          disabled={timers.length === 0}
          title="Delete — back to the default 45:00"
          className={`rounded-[var(--tri-radius-control)] border border-[rgb(234_199_198_/_0.2)] bg-[rgb(234_199_198_/_0.08)] text-[var(--tri-ink-danger)] transition-colors hover:bg-[rgb(234_199_198_/_0.16)] disabled:opacity-35 ${
            compact ? 'px-2 py-1' : 'px-3 py-2'
          }`}
        >
          <TrashIcon size={icon} />
        </button>
      </div>
    );
  };

  const extraRow = (compact: boolean) => (
    <div className={`flex items-center justify-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {EXTRA_MINUTES_OPTIONS.map((min) => (
        <button
          key={min}
          type="button"
          onClick={() => void handleAddMinutes(min)}
          title={`Give the preacher ${min} more minutes — the clock counts down again from ${min}:00`}
          className={`rounded-[var(--tri-radius-control)] border border-white/10 bg-white/5 font-bold text-[rgb(229_243_242_/_0.8)] transition-colors hover:bg-white/10 hover:text-[var(--tri-ink)] ${
            compact ? 'px-2.5 py-1 text-[11px]' : 'px-5 py-1.5 text-sm'
          }`}
        >
          +{min}
        </button>
      ))}
    </div>
  );

  /*
   * The face is laid out at a fixed pixel size, which is what lets the six
   * boxes keep their proportions. On a narrow booth window that width can
   * exceed the card, so the whole block is scaled down to whatever fits
   * rather than clipped — the clock stays as large as the card can hold and
   * never loses a digit off the edge. Wide cards hit the cap and draw at
   * full size, which is the common case.
   */
  const FaceFit = ({ width, children }: { width: number; children: ReactNode }) => {
    const { ref, width: avail } = useBoxSize<HTMLDivElement>();
    const fit = avail > 0 ? Math.min(1, avail / width) : 1;
    /* min-w-0 is what makes the measurement honest: without it this box is a
       flex item sized by its content, so it grows to the face's full width
       and reports that back — the scale would always come out 1 and the
       clock would still overhang. Constrained, it reports the width the card
       actually has. The scaled child keeps its own box, so the row's height
       is reserved from the unscaled size and nothing below it shifts. */
    return (
      <div ref={ref} className="flex w-full min-w-0 justify-center">
        <div
          style={{
            transform: `scale(${fit})`,
            transformOrigin: 'center',
            /* Give back the height the shrink frees, or a scaled-down clock
               would leave a band of dead space under it. */
            marginBlock: fit < 1 ? `${((fit - 1) * 81) / 2}px` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    );
  };

  const theFace = (scale: number, active: boolean) => (
    <DigitFace
      active={active}
      digits={faceDigits}
      editing={editing}
      color={faceInk}
      onBeginEdit={beginEdit}
      onDigits={setDraft}
      onCommit={commitEdit}
      onCancel={cancelEdit}
      scale={scale}
      negative={faceOver}
    />
  );

  return (
    <Expandable
      className={className}
      title="Service Timers"
      blurb="Set durations, adjust live countdowns, and grant extra time to the preacher."
      size={{ w: 720, h: 620 }}
      tile={({ onOpen, open }) => (
        <Panel
          title={`service timer${timers.length > 1 ? ` (${timers.length})` : ''}`}
          className="min-h-0 flex-1 transition-colors hover:border-neutral-700"
          bodyClass="p-3.5 flex flex-col"
        >
          {/*
            The tile is the CLOCK, and nothing else.
            
            It used to carry the face plus the transport row plus the extra-
            time row — three bands of controls on a card the booth only ever
            reads. Everything that is a decision now lives behind the press;
            what stays is the thing you glance at from across the room, at the
            size that makes it glanceable. Idle, it reads 45:00 with one
            button under it, because "start the sermon clock" is the only move
            worth making without opening anything.
          */}
          <div
            onClick={onOpen}
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-left"
          >
            {running || activeTimer ? (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgb(229_243_242_/_0.45)]">
                  {faceOver ? 'overtime' : activeTimer?.inExtension ? 'extra time' : (activeTimer?.name ?? name)}
                </span>
                <FaceFit width={TILE_FACE_W}>{theFace(TILE_FACE_SCALE, !open)}</FaceFit>
                {extraBadge && (
                  <span className="rounded border border-white/12 bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-[rgb(229_243_242_/_0.75)]">
                    {extraBadge}
                  </span>
                )}
              </>
            ) : (
              <>
                <FaceFit width={TILE_FACE_W}>{theFace(TILE_FACE_SCALE, !open)}</FaceFit>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleStartFace();
                  }}
                  className="rounded-[var(--tri-radius-control)] border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--tri-ink)] transition-colors hover:bg-white/[0.15]"
                >
                  start timer
                </button>
              </>
            )}
          </div>
        </Panel>
      )}
    >
      <div className="flex flex-col gap-6 py-2">
        {toast && (
          <div className="rounded-lg bg-white/[0.07] border border-white/12 px-4 py-2 text-sm font-semibold text-[var(--tri-ink)] shadow-lg">
            {toast}
          </div>
        )}

        {/* THE FACE — the centrepiece of this panel */}
        <div className="flex flex-col items-center gap-4 py-2">
          <input
            type="text"
            value={activeTimer ? activeTimer.name : name}
            onChange={(e) => setName(e.target.value)}
            disabled={running}
            placeholder="Sermon"
            aria-label="Timer name"
            className="w-64 rounded-[var(--tri-radius-control)] border border-white/10 bg-white/[0.04] px-3 py-1.5 text-center text-sm font-semibold uppercase tracking-wider text-[var(--tri-ink)] outline-none transition-colors focus:border-white/28 disabled:opacity-60"
          />

          {theFace(1, true)}

          <span className="text-[11px] text-[rgb(229_243_242_/_0.45)]">
            {running
              ? activeTimer?.inExtension
                ? 'counting down the extra time'
                : 'counting down'
              : editing
                ? 'type the digits — they fill from the right · esc to undo'
                : 'click the clock to type a duration'}
          </span>

          {extraBadge && (
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-0.5 text-xs font-bold text-[rgb(229_243_242_/_0.75)]">
              {extraBadge}
            </span>
          )}

          {controls(false)}
        </div>

        {/* Extra time, for the preacher */}
        <div className="flex w-full flex-col items-center gap-2 border-t border-white/[0.06] pt-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--tri-ink)]">
            Extra time for the preacher
          </span>
          <p className="max-w-sm text-center text-[11px] leading-relaxed text-[rgb(229_243_242_/_0.45)]">
            Pressed at the end, when the agreed time is spent and he wants a few more minutes. The
            clock counts the extra time down on its own, and his screen says so.
          </p>
          {extraRow(false)}
        </div>


        {/* THE TIMER'S OWN SCREEN

            A separate output window with its own role ('timer'), NOT the
            projector. Opening it cannot disturb what the congregation is
            reading: the scripture output is a different window with a
            different role, and this one only ever draws the countdown. That
            is why the control lives in here rather than on the tile — going
            to a screen mid-service should take a deliberate open-then-press,
            never a stray tap on the dashboard. */}
        <div className="rounded-xl border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--tri-ink)]">
                Stage Timer Display
              </h4>
              <p className="mt-1 text-[11px] leading-relaxed text-[rgb(229_243_242_/_0.5)]">
                Opens the countdown on its own screen for the preacher. It is a separate output from
                the projector — the congregation's scripture screen is untouched.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.api?.openOutput?.('timer')}
              className="shrink-0 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-[var(--tri-ink)] transition-colors hover:bg-white/[0.15] border border-white/15"
            >
              Open screen
            </button>
          </div>
        </div>

      </div>
    </Expandable>
  );
}
