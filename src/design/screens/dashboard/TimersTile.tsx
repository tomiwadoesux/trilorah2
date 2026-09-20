import { useEffect, useRef, useState } from 'react';
import { Panel } from '../parts';
import { Expandable } from './expand';
import { formatTimerDisplay } from '../../../../shared/timerDisplay';
import { getTimerInk } from '../../../../shared/timerColor';
import { PlayIcon, ResetIcon, TrashIcon } from '../../../ui';

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
}

const PRESET_DURATIONS = [
  { label: '15m', sec: 15 * 60, desc: 'Worship / Offering' },
  { label: '30m', sec: 30 * 60, desc: 'Bible Study' },
  { label: '45m', sec: 45 * 60, desc: 'Sermon (Standard)' },
  { label: '60m', sec: 60 * 60, desc: 'Service Window' },
];

const EXTRA_MINUTES_OPTIONS = [1, 2, 5, 10, 12, 15];

export function TimersTile({ className }: { className?: string }) {
  const [timers, setTimers] = useState<Snapshot[]>([]);
  const [, setTick] = useState(0);
  const takenAt = useRef(Date.now());

  // Form states for creating or adjusting timers
  const [newName, setNewName] = useState('Sermon');
  const [customMinutes, setCustomMinutes] = useState('45');
  const [allowOverrun, setAllowOverrun] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

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

  // Handler to remove timer
  const handleRemove = (id: string) => {
    if (window.api?.removeTimer) {
      void window.api.removeTimer(id);
    } else {
      setTimers((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // Handler to create and start a new countdown timer
  const handleCreateAndStart = async (sec: number, name?: string) => {
    const timerName = (name || newName).trim() || 'Sermon';
    if (window.api?.createTimer) {
      const created = await window.api.createTimer({
        name: timerName,
        kind: 'countdown',
        durationSec: sec,
        overrun: allowOverrun,
      });
      if (created && created.id) {
        await window.api.startTimer?.(created.id);
        showToast(`Started ${Math.round(sec / 60)} min timer for "${timerName}"`);
      }
    } else {
      const newTimer: Snapshot = {
        id: `timer-local-${Date.now()}`,
        name: timerName,
        kind: 'countdown',
        state: 'running',
        remainingMs: sec * 1000,
        overrunning: false,
        display: formatTimerDisplay(sec * 1000),
        durationSec: sec,
        extraSec: 0,
      };
      takenAt.current = Date.now();
      setTimers((prev) => [newTimer, ...prev]);
      showToast(`Started ${Math.round(sec / 60)} min timer for "${timerName}"`);
    }
  };

  // Handler to add extra minutes to a running countdown
  const handleAddMinutes = async (extraMinutes: number) => {
    if (!activeTimer) return;
    const extraSec = extraMinutes * 60;
    const currentDurationSec = activeTimer.durationSec ?? Math.max(0, Math.round(activeTimer.remainingMs / 1000));
    const newDuration = currentDurationSec + extraSec;
    const newExtra = (activeTimer.extraSec ?? 0) + extraSec;

    if (window.api?.updateTimer) {
      await window.api.updateTimer(activeTimer.id, {
        durationSec: newDuration,
        extraSec: newExtra,
        overrun: true,
      });
    } else {
      setTimers((prev) =>
        prev.map((t) =>
          t.id === activeTimer.id
            ? {
                ...t,
                durationSec: newDuration,
                extraSec: newExtra,
                remainingMs: t.remainingMs + extraSec * 1000,
              }
            : t
        )
      );
    }

    showToast(`+${extraMinutes} min added to ${activeTimer.name}!`);
  };

  return (
    <Expandable
      className={className}
      title="Service Timers"
      blurb="Set durations, adjust live countdowns, and grant extra time to the preacher."
      size={{ w: 720, h: 620 }}
      tile={({ onOpen }) => {
        const drift = activeTimer && activeTimer.state === 'running' ? Date.now() - takenAt.current : 0;
        const ms = activeTimer
          ? activeTimer.state !== 'running'
            ? activeTimer.remainingMs
            : activeTimer.kind === 'elapsed'
              ? activeTimer.remainingMs + drift
              : activeTimer.remainingMs - drift
          : 0;

        const totalMs = activeTimer && activeTimer.durationSec ? activeTimer.durationSec * 1000 : 0;
        const color = activeTimer ? getTimerInk(ms, totalMs) : 'rgb(229 243 242 / 0.4)';
        const over = Boolean(activeTimer && (activeTimer.overrunning || (activeTimer.kind === 'countdown' && ms < 0)));
        const targetFace = totalMs > 0 ? formatTimerDisplay(totalMs) : null;
        const activeFace = activeTimer ? (activeTimer.state === 'running' ? formatTimerDisplay(ms) : activeTimer.display) : null;

        return (
          <Panel
            title={`service timer${timers.length > 1 ? ` (${timers.length})` : ''}`}
            className="min-h-0 flex-1 transition-colors hover:border-neutral-700"
            bodyClass="p-3.5 flex flex-col justify-between"
          >
            <div
              onClick={onOpen}
              className="flex h-full w-full flex-col justify-between text-left cursor-pointer"
            >
              {!activeTimer ? (
                <div className="flex h-full flex-col items-center justify-center gap-2.5 py-2 text-center">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[rgb(229_243_242_/_0.45)] animate-pulse" />
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[rgb(229_243_242_/_0.5)]">
                      ready to time
                    </span>
                  </div>

                  {/* Digital face preview */}
                  <div className="font-mono text-[46px] font-black tracking-wider text-[rgb(229_243_242_/_0.2)] tabular-nums select-none leading-none my-1">
                    00:45:00
                  </div>

                  {/* Quick Presets Row */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {PRESET_DURATIONS.map((p) => (
                      <button
                        key={p.sec}
                        type="button"
                        onClick={() => handleCreateAndStart(p.sec, p.desc.split(' ')[0])}
                        className="rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 text-[11px] font-medium text-[rgb(229_243_242_/_0.85)] hover:text-white transition-all hover:scale-105 active:scale-95"
                        title={`Start ${p.desc}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Primary Quick Start */}
                  <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleCreateAndStart(45 * 60, 'Sermon')}
                      className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/[0.15] border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-[var(--tri-ink)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <PlayIcon size={12} />
                      <span>Start 45m Sermon</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-[rgb(229_243_242_/_0.4)]">
                    tap card to configure custom countdown or elapsed timer
                  </p>
                </div>
              ) : (
                <div className="flex h-full flex-col justify-between">
                  {/* Top line of tile */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: color,
                        }}
                      />
                      <span className="truncate text-xs font-bold uppercase tracking-wider text-[rgb(229_243_242_/_0.85)]">
                        {activeTimer.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {activeTimer.extraSec && activeTimer.extraSec > 0 && (
                        <span className="rounded bg-white/8 px-2 py-0.5 text-[10px] font-bold text-[rgb(229_243_242_/_0.75)] border border-white/12">
                          +{Math.round(activeTimer.extraSec / 60)}m extra
                        </span>
                      )}
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${color}18`,
                          color: color,
                          border: `1px solid ${color}35`,
                        }}
                      >
                        {activeTimer.state}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {totalMs > 0 && (
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden my-1">
                      <div
                        className="h-full transition-all duration-300 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, (ms / totalMs) * 100))}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  )}

                  {/* Big Digital Numbers */}
                  {over ? (
                    <div className="flex flex-col items-center justify-center my-auto py-1">
                      {targetFace && (
                        <span className="font-mono text-xs font-bold tracking-widest text-[rgb(229_243_242_/_0.4)] tabular-nums">
                          TARGET {targetFace}
                        </span>
                      )}
                      <span
                        className="font-mono text-[48px] font-black tracking-wider tabular-nums leading-none my-1"
                        style={{ color: 'var(--tri-ink-danger)' }}
                      >
                        {activeFace}
                      </span>
                      <span className="rounded bg-[rgb(234_199_198_/_0.12)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--tri-ink-danger)] border border-[rgb(234_199_198_/_0.28)] animate-pulse">
                        overtime exceeded
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center my-auto py-1">
                      <span
                        className="font-mono text-[48px] font-black tracking-wider tabular-nums leading-none"
                        style={{ color }}
                      >
                        {activeFace}
                      </span>
                      {targetFace && (
                        <span className="text-[11px] font-mono text-[rgb(229_243_242_/_0.45)] mt-1.5">
                          remaining of {targetFace} target
                        </span>
                      )}
                    </div>
                  )}

                  {/* Inline quick buttons at bottom */}
                  <div
                    className="flex items-center justify-between pt-2 border-t border-[rgb(255_255_255_/_0.06)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5">
                      {activeTimer.state === 'running' ? (
                        <button
                          type="button"
                          onClick={() => handlePause(activeTimer.id)}
                          className="rounded-md bg-white/10 hover:bg-white/[0.14] border border-white/15 px-2.5 py-1 text-[11px] font-bold text-[var(--tri-ink)] transition-colors"
                        >
                          PAUSE
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStart(activeTimer.id)}
                          className="rounded-md bg-white/10 hover:bg-white/[0.14] border border-white/15 px-2.5 py-1 text-[11px] font-bold text-[var(--tri-ink)] transition-colors"
                        >
                          RESUME
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleReset(activeTimer.id)}
                        className="rounded-md bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 text-[11px] text-[rgb(229_243_242_/_0.75)] hover:text-white transition-colors"
                      >
                        RESET
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAddMinutes(2)}
                        className="rounded bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 text-[11px] font-bold text-[rgb(229_243_242_/_0.8)] hover:text-[var(--tri-ink)] transition-colors"
                        title="Add 2 minutes"
                      >
                        +2m
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddMinutes(5)}
                        className="rounded bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 text-[11px] font-bold text-[rgb(229_243_242_/_0.8)] hover:text-[var(--tri-ink)] transition-colors"
                        title="Add 5 minutes"
                      >
                        +5m
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddMinutes(12)}
                        className="rounded bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 text-[11px] font-bold text-[rgb(229_243_242_/_0.8)] hover:text-[var(--tri-ink)] transition-colors"
                        title="Add 12 minutes (preacher extension)"
                      >
                        +12m
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        );
      }}
    >
      <div className="flex flex-col gap-6 py-2">
        {toast && (
          <div className="rounded-lg bg-white/[0.07] border border-white/12 px-4 py-2 text-sm font-semibold text-[var(--tri-ink)] shadow-lg">
            {toast}
          </div>
        )}

        {/* HERO LIVE TIMER CARD */}
        {activeTimer && (
          <div className="rounded-xl border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[rgb(255_255_255_/_0.06)]">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(229_243_242_/_0.4)]">
                  active display timer
                </span>
                <h3 className="text-lg font-bold text-[var(--tri-ink)]">{activeTimer.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                {activeTimer.extraSec && activeTimer.extraSec > 0 && (
                  <span className="rounded-full bg-white/8 border border-white/12 px-2.5 py-0.5 text-xs font-bold text-[rgb(229_243_242_/_0.75)]">
                    +{Math.round(activeTimer.extraSec / 60)} min added
                  </span>
                )}
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor:
                      activeTimer.state === 'running'
                        ? 'rgba(255, 255, 255, 0.10)'
                        : 'rgba(255, 255, 255, 0.05)',
                    color:
                      activeTimer.state === 'running'
                        ? 'var(--tri-ink)'
                        : 'rgb(229 243 242 / 0.5)',
                  }}
                >
                  {activeTimer.state}
                </span>
              </div>
            </div>

            {/* Giant Digital Digits Display */}
            {(() => {
              const drift = activeTimer.state === 'running' ? Date.now() - takenAt.current : 0;
              const ms =
                activeTimer.state !== 'running'
                  ? activeTimer.remainingMs
                  : activeTimer.kind === 'elapsed'
                    ? activeTimer.remainingMs + drift
                    : activeTimer.remainingMs - drift;
              const totalMs = (activeTimer.durationSec ?? 0) * 1000;
              const color = getTimerInk(ms, totalMs);
              const over = activeTimer.overrunning || (activeTimer.kind === 'countdown' && ms < 0);
              const targetFace = totalMs > 0 ? formatTimerDisplay(totalMs) : null;
              const activeFace = activeTimer.state === 'running' ? formatTimerDisplay(ms) : activeTimer.display;

              return (
                <div className="flex flex-col items-center justify-center py-6">
                  {over ? (
                    <>
                      {targetFace && (
                        <div className="text-sm font-semibold tracking-widest text-neutral-400 uppercase">
                          Target Duration: <span className="font-mono text-white font-bold">{targetFace}</span>
                        </div>
                      )}
                      <div
                        className="font-mono text-6xl font-black tracking-wider tabular-nums mt-1"
                        style={{ color: 'var(--tri-ink-danger)' }}
                      >
                        {activeFace}
                      </div>
                      <span className="mt-1 rounded bg-[rgb(234_199_198_/_0.12)] px-3 py-0.5 text-xs font-bold uppercase tracking-widest text-[var(--tri-ink-danger)] border border-[rgb(234_199_198_/_0.28)]">
                        Overtime Exceeded
                      </span>
                    </>
                  ) : (
                    <>
                      <div
                        className="font-mono text-6xl font-black tracking-wider tabular-nums"
                        style={{ color }}
                      >
                        {activeFace}
                      </div>
                      {targetFace && (
                        <span className="text-xs text-[rgb(229_243_242_/_0.4)] mt-1 font-mono">
                          of {targetFace} total
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Action buttons: Start/Pause, Reset, Remove */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {activeTimer.state === 'running' ? (
                <button
                  type="button"
                  onClick={() => handlePause(activeTimer.id)}
                  className="rounded-lg bg-white/10 hover:bg-white/[0.15] border border-white/15 px-5 py-2 text-sm font-bold text-[var(--tri-ink)] transition-colors"
                >
                  PAUSE
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStart(activeTimer.id)}
                  className="rounded-lg bg-white/10 hover:bg-white/[0.15] border border-white/15 px-5 py-2 text-sm font-bold text-[var(--tri-ink)] transition-colors flex items-center gap-1.5"
                >
                  <PlayIcon size={14} />
                  RESUME
                </button>
              )}
              <button
                type="button"
                onClick={() => handleReset(activeTimer.id)}
                className="rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-sm font-medium text-[rgb(229_243_242_/_0.8)] transition-colors flex items-center gap-1.5"
              >
                <ResetIcon size={14} />
                RESET
              </button>
              <button
                type="button"
                onClick={() => handleRemove(activeTimer.id)}
                className="rounded-lg bg-[rgb(234_199_198_/_0.08)] hover:bg-[rgb(234_199_198_/_0.16)] border border-[rgb(234_199_198_/_0.2)] px-3 py-2 text-sm text-[var(--tri-ink-danger)] transition-colors"
                title="Delete timer"
              >
                <TrashIcon size={14} />
              </button>
            </div>

            {/* LIVE EXTRA MINUTES EXTENSION BUTTONS */}
            <div className="mt-6 pt-5 border-t border-[rgb(255_255_255_/_0.06)]">
              <div className="flex items-baseline justify-between mb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--tri-ink)]">
                  Add Extra Minutes (Preacher Extension)
                </span>
                <span className="text-[11px] text-[rgb(229_243_242_/_0.4)]">
                  Instantly extends the countdown & displays badge
                </span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {EXTRA_MINUTES_OPTIONS.map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => handleAddMinutes(min)}
                    className="rounded-lg bg-[rgb(255_255_255_/_0.04)] hover:bg-[rgb(255_255_255_/_0.09)] border border-[rgb(255_255_255_/_0.08)] hover:border-[rgb(255_255_255_/_0.16)] py-2.5 text-center transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span className="block text-sm font-bold text-[var(--tri-ink)]">+{min}m</span>
                    <span className="block text-[10px] text-[rgb(229_243_242_/_0.4)]">add time</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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

        {/* CREATE NEW TIMER FORM */}
        <div className="rounded-xl border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] p-5">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--tri-ink)] mb-3">
            Start New Service Timer
          </h4>

          {/* Quick presets */}
          <div className="grid grid-cols-4 gap-2.5 mb-4">
            {PRESET_DURATIONS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleCreateAndStart(p.sec, p.desc)}
                className="rounded-lg bg-[rgb(255_255_255_/_0.04)] hover:bg-[rgb(255_255_255_/_0.08)] border border-[rgb(255_255_255_/_0.08)] p-3 text-left transition-all hover:border-[rgb(255_255_255_/_0.18)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold font-mono text-[var(--tri-ink)]">{p.label}</span>
                  <PlayIcon size={12} className="text-[rgb(229_243_242_/_0.55)]" />
                </div>
                <span className="block text-[11px] text-[rgb(229_243_242_/_0.5)] mt-0.5">{p.desc}</span>
              </button>
            ))}
          </div>

          {/* Custom Duration & Name */}
          <div className="flex items-end gap-3 pt-3 border-t border-[rgb(255_255_255_/_0.06)]">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgb(229_243_242_/_0.5)] mb-1">
                Timer Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sermon, Worship, Announcements"
                className="w-full rounded-lg bg-[rgb(255_255_255_/_0.04)] border border-[rgb(255_255_255_/_0.1)] px-3 py-2 text-sm text-[var(--tri-ink)] focus:border-[rgb(255_255_255_/_0.28)] focus:outline-none"
              />
            </div>
            <div className="w-28">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgb(229_243_242_/_0.5)] mb-1">
                Minutes
              </label>
              <input
                type="number"
                min="1"
                max="240"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="w-full rounded-lg bg-[rgb(255_255_255_/_0.04)] border border-[rgb(255_255_255_/_0.1)] px-3 py-2 text-sm text-[var(--tri-ink)] font-mono focus:border-[rgb(255_255_255_/_0.28)] focus:outline-none"
              />
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[rgb(229_243_242_/_0.7)]">
                <input
                  type="checkbox"
                  checked={allowOverrun}
                  onChange={(e) => setAllowOverrun(e.target.checked)}
                  className="rounded border-[rgb(255_255_255_/_0.2)] bg-[rgb(255_255_255_/_0.05)] text-[rgb(229_243_242_/_0.8)] focus:ring-0"
                />
                Allow Overtime
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                const mins = parseInt(customMinutes, 10) || 45;
                void handleCreateAndStart(mins * 60, newName);
              }}
              className="rounded-lg bg-white/10 hover:bg-white/[0.15] border border-white/15 px-5 py-2 text-sm font-bold text-[var(--tri-ink)] transition-colors"
            >
              START TIMER
            </button>
          </div>
        </div>
      </div>
    </Expandable>
  );
}
