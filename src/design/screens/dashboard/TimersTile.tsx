import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Panel } from '../parts';
import { Expandable } from './expand';
import { formatTimerDisplay } from '../../../../shared/timerDisplay';
import { getTimerColor } from '../../../../shared/timerColor';
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
 * tile and the wall should not see two different timers. index.html,
 * design.html and output.html all load Orbitron and Share Tech Mono.
 */
const TIMER_FONT = "'Orbitron', 'Share Tech Mono', monospace";

/* The screen's other face — titles, the clock, captions (.timer-screen-title
   and friends in src/output.css). */
const SCREEN_MONO = "'Share Tech Mono', 'Orbitron', monospace";

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
 * The timer as the preacher's screen shows it — a small copy of the
 * full-screen HDMI timer (.role-timer in src/output.css), not a separate
 * dashboard design. Name top-left, room clock top-right, one big number in
 * the phase colour with its glow, "OF 45:00" under it, and the same
 * overtime / extra-time labels. What the booth sees on the card is what the
 * pulpit sees on the wall.
 *
 * Sizes are container units, taken from output.css's vw/vh one-for-one, so
 * the copy keeps the screen's proportions at any card size.
 *
 * Read-only while a timer runs: the number showing then is the truth being
 * projected behind the preacher, and a stray keypress must not be able to
 * move it. Stopped, the number is one control — click or Enter to type,
 * Enter or blur to keep it, Escape to put back what was there.
 */
function ScreenFace({
  name,
  display,
  target,
  color,
  over,
  extraLabel,
  idle,
  stateLabel,
  footerRight,
  editing,
  onBeginEdit,
  onDigits,
  digits,
  onCommit,
  onCancel,
  active = true,
  className,
  style,
}: {
  name: string;
  /** The big number, already formatted. */
  display: string;
  /** Length of the phase being counted ("45:00"), or null. */
  target: string | null;
  color: string;
  over: boolean;
  extraLabel: string | null;
  /** No timer yet: the caption reads as standby. */
  idle: boolean;
  stateLabel: string | null;
  /** Replaces the state word bottom-right (the idle START button). */
  footerRight?: ReactNode;
  editing: boolean;
  onBeginEdit: () => void;
  digits: string;
  onDigits: (next: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  /*
   * Whether this copy is the one the operator can actually see.
   *
   * The tile stays mounted underneath the popup (Expandable dims it to 0.25
   * rather than unmounting), so while the popup is open BOTH faces exist and
   * share one `editing` flag. Without this they would both grab focus on the
   * same frame and the loser's blur would knock the winner straight back out
   * of edit mode. Only the visible one takes focus or listens to blur.
   */
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const clock = useRoomClock();

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

  const RED = '#ef4444';

  return (
    /* Two boxes because container units resolve against an ANCESTOR
       container: the outer one is the container, the inner one can then
       size its padding and type in cq units against it. */
    <div
      className={`flex overflow-hidden rounded-[var(--tri-radius-control)] text-white select-none ${className ?? ''}`}
      style={{
        containerType: 'size',
        background: '#080808',
        boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.07)',
        ...style,
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between" style={{ padding: '5cqh 6cqw' }}>
        {/* Top bar: the timer's name, and the room clock. */}
        <div className="flex w-full items-center justify-between">
          <span
            className="truncate font-bold uppercase"
            style={{ fontFamily: SCREEN_MONO, fontSize: 'max(9px, 2.6cqw)', letterSpacing: '0.15em', color: 'rgb(255 255 255 / 0.7)' }}
          >
            {name}
          </span>
          <span
            className="shrink-0 font-bold tabular-nums"
            style={{ fontFamily: SCREEN_MONO, fontSize: 'max(10px, 3cqw)', letterSpacing: '0.08em', color: 'rgb(255 255 255 / 0.9)' }}
          >
            {clock}
          </span>
        </div>

        {/* Centre: the number. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          {over && target && (
            <div
              className="font-bold uppercase tabular-nums"
              style={{ fontFamily: SCREEN_MONO, fontSize: 'max(9px, 3.8cqw)', letterSpacing: '0.1em', color: 'rgb(255 255 255 / 0.45)', marginBottom: '1.5cqh' }}
            >
              target: {target}
            </div>
          )}
          <div
            ref={ref}
            role="group"
            tabIndex={0}
            aria-label={editing ? 'Timer duration — type digits to set' : `Timer ${display}`}
            onKeyDown={handleKey}
            onClick={(e) => {
              e.stopPropagation();
              if (!editing) onBeginEdit();
            }}
            onBlur={() => {
              if (editing && active) onCommit();
            }}
            className="rounded-[var(--tri-radius-control)] outline-none focus-visible:ring-1 focus-visible:ring-white/25"
            style={{ cursor: editing ? 'text' : 'pointer', padding: '0 1.5cqw' }}
          >
            <span
              className="block font-black tabular-nums"
              style={{
                fontFamily: TIMER_FONT,
                fontSize: 'min(18cqw, 34cqh)',
                lineHeight: 0.9,
                letterSpacing: '0.04em',
                color: over ? RED : color,
                textShadow: over ? `0 0 1.8cqw ${RED}99` : `0 0 1.6cqw ${color}60`,
                transition: 'color 400ms ease, text-shadow 400ms ease',
                /* Typing is shown by the number dimming a touch and an
                   underline, not by a different face. */
                opacity: editing ? 0.85 : 1,
                textDecoration: editing ? 'underline' : 'none',
                textDecorationThickness: '0.04em',
                textUnderlineOffset: '0.12em',
                textDecorationColor: 'rgb(255 255 255 / 0.3)',
              }}
            >
              {display}
            </span>
          </div>
          {over ? (
            <div
              className="font-extrabold uppercase"
              style={{
                fontSize: 'max(8px, 2.2cqw)',
                letterSpacing: '0.25em',
                color: RED,
                background: 'rgb(239 68 68 / 0.15)',
                border: '1px solid rgb(239 68 68 / 0.4)',
                borderRadius: 999,
                padding: '0.6cqh 2.5cqw',
                marginTop: '2.5cqh',
              }}
            >
              overtime exceeded
            </div>
          ) : idle ? (
            <div
              className="font-bold uppercase"
              style={{ fontFamily: SCREEN_MONO, fontSize: 'max(8px, 2.5cqw)', letterSpacing: '0.25em', color: 'rgb(255 255 255 / 0.45)', marginTop: '2cqh' }}
            >
              standby · service ready
            </div>
          ) : (
            target && (
              <div
                className="font-bold uppercase tabular-nums"
                style={{ fontFamily: SCREEN_MONO, fontSize: 'max(8px, 2.5cqw)', letterSpacing: '0.1em', color: 'rgb(255 255 255 / 0.45)', marginTop: '2cqh' }}
              >
                of {target}
              </div>
            )
          )}
          {extraLabel && (
            <div
              className="font-bold uppercase"
              style={{
                fontSize: 'max(8px, 2cqw)',
                letterSpacing: '0.15em',
                color: '#34d399',
                background: 'rgb(16 185 129 / 0.15)',
                border: '1px solid rgb(16 185 129 / 0.35)',
                borderRadius: 999,
                padding: '0.4cqh 1.8cqw',
                marginTop: '2cqh',
              }}
            >
              {extraLabel}
            </div>
          )}
        </div>

        {/* Bottom bar: what the output is, and what the clock is doing. */}
        <div
          className="flex w-full items-center justify-between"
          style={{ fontSize: 'max(8px, 1.8cqw)', color: 'rgb(255 255 255 / 0.4)' }}
        >
          <span style={{ fontFamily: 'var(--verse-font, Georgia, serif)', fontSize: 'max(8px, 2cqw)', color: 'rgb(255 255 255 / 0.65)' }}>
            STAGE TIMER
          </span>
          {footerRight ??
            (stateLabel && (
              <span className="font-semibold uppercase" style={{ letterSpacing: '0.15em' }}>
                {stateLabel}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

/** The room clock the screen shows top-right, on the same format. */
function useRoomClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
   * back on the face.
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
   * What the face reads.
   *
   * A RUNNING clock owns the face outright. Otherwise the operator's draft
   * wins as soon as they are editing — including over a PAUSED timer, which
   * is the bug this shape exists to kill: the old rule showed the live value
   * for any state that was not 'stopped', so typing into a paused clock put
   * the digits into `draft` while the boxes kept showing the countdown. The
   * keystrokes vanished, and the next start used a duration nobody had seen.
   */
  const showingDraft = !activeTimer || (activeTimer.state !== 'running' && editing);

  /* Colour follows whatever the boxes are actually SHOWING. Deriving it from
     the timer while the digits came from the draft meant a stopped clock left
     near zero could tint a freshly typed 00:45:00 with the danger ink. */
  const faceOver = Boolean(
    !showingDraft &&
      activeTimer &&
      (activeTimer.overrunning ||
        (activeTimer.kind === 'countdown' && !activeTimer.inExtension && !activeTimer.extraSec && faceMsNow < 0))
  );
  /* The screen's own colours: green at rest, through amber to red as the
     phase runs out (getTimerColor, the one the HDMI timer uses). A draft
     that has not started reads in the screen's standby green. */
  const faceColor = showingDraft ? '#22c55e' : getTimerColor(faceMsNow, phaseMs);
  const faceDisplay = formatTimerDisplay(showingDraft ? digitsToSeconds(draft) * 1000 : faceMsNow);
  const faceTarget = !showingDraft && phaseMs > 0 ? formatTimerDisplay(phaseMs) : null;

  const extraBadge =
    activeTimer?.extraSec && activeTimer.extraSec > 0
      ? `+${Math.round(activeTimer.extraSec / 60)} min ${activeTimer.inExtension ? 'extra time' : 'extension'}`
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

  const theFace = (active: boolean, extra: { className?: string; style?: React.CSSProperties; footerRight?: ReactNode } = {}) => (
    <ScreenFace
      active={active}
      name={activeTimer?.name ?? name}
      display={faceDisplay}
      target={faceTarget}
      color={faceColor}
      over={faceOver}
      extraLabel={extraBadge}
      idle={!activeTimer}
      stateLabel={activeTimer?.state ?? null}
      digits={draft}
      editing={editing}
      onBeginEdit={beginEdit}
      onDigits={setDraft}
      onCommit={commitEdit}
      onCancel={cancelEdit}
      {...extra}
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
          empty={timers.length === 0}
          onOpen={onOpen}
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
          {/* The tile is the screen, small: the same face the preacher
              reads. Pressing it opens the controls. Idle, the one move
              worth making without opening anything — start — sits where
              the screen shows the clock's state. */}
          <div onClick={onOpen} className="flex min-h-0 flex-1 cursor-pointer">
            {theFace(!open, {
              className: 'min-h-0 flex-1',
              footerRight: !activeTimer ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleStartFace();
                  }}
                  className="rounded-[var(--tri-radius-control)] border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--tri-ink)] transition-colors hover:bg-white/[0.15]"
                >
                  start timer
                </button>
              ) : undefined,
            })}
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

          {theFace(true, { className: 'w-full', style: { aspectRatio: '16 / 9' } })}

          <span className="text-[11px] text-[rgb(229_243_242_/_0.45)]">
            {running
              ? activeTimer?.inExtension
                ? 'counting down the extra time'
                : 'counting down'
              : editing
                ? 'type the digits — they fill from the right · esc to undo'
                : 'click the clock to type a duration'}
          </span>

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
