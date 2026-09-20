/**
 * Service timers — the countdown clocks a church runs all morning
 * (BUILD-MAP 2.16, poached from ProPresenter's Timers).
 *
 * Three shapes cover everything a Sunday needs: a plain countdown for the
 * offering, a count-to-wall-clock for "service starts at 10:30", and a
 * stopwatch for the sermon clock on the preacher's confidence monitor.
 *
 * The store keeps no interval of its own. A timer is nothing but a start
 * instant plus however much time it had already banked before the last
 * pause, so its current value is arithmetic on the injected `now()` and can
 * be asked for at any moment. That is why `onChange` fires on mutations
 * only: repainting sixty times a second is the UI's job, and a store that
 * emitted every tick would drag the whole IPC bus along with it.
 *
 * Pure module — no Electron, no Date.now() in the class body — so tests can
 * drive it on a fake clock.
 */

// The display formatter lives in shared/ because the React renderer needs it
// too, and the renderer must never import from electron/ (that would pull
// main-process code into the browser bundle). Re-exported here so callers of
// this module keep their existing import.
export { formatTimerDisplay } from '../../shared/timerDisplay'
import { formatTimerDisplay } from '../../shared/timerDisplay'

export type TimerKind = 'countdown' | 'to-time' | 'elapsed'
export type TimerState = 'stopped' | 'running' | 'paused'

export interface Timer {
  id: string
  name: string
  kind: TimerKind
  /** Seconds to count down from. Countdown only. */
  durationSec?: number
  /** 'HH:MM' 24-hour local time. 'to-time' only. */
  targetTime?: string
  /** Keep counting past zero, into negative, instead of stopping there. */
  overrun: boolean
  state: TimerState
  /** Epoch ms of the last start/resume; null while stopped. */
  startedAt: number | null
  /**
   * Epoch ms the wall-clock target was pinned to, set on the first start.
   * 'to-time' only — see the note in snapshotOf about why the target cannot
   * simply be re-resolved on every read.
   */
  anchoredAt?: number
  /** Epoch ms of the pause that is currently in effect; null otherwise. */
  pausedAt: number | null
  /** Time already banked by earlier run segments, in ms. */
  elapsedBeforePauseMs: number
  /** Extra seconds added live during countdown (e.g. +12 min). */
  extraSec?: number
}

export interface TimerSnapshot {
  id: string
  name: string
  kind: TimerKind
  state: TimerState
  /**
   * Countdown / to-time: ms left, negative once past zero. Elapsed: ms
   * counted up so far, always positive.
   */
  remainingMs: number
  overrunning: boolean
  display: string
  durationSec?: number
  extraSec?: number
}

export interface CreateTimerInput {
  name?: string
  kind: TimerKind
  durationSec?: number
  targetTime?: string
  overrun?: boolean
  extraSec?: number
}

export type UpdateTimerPatch = Partial<Omit<CreateTimerInput, 'kind'>>

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000
const SECOND_MS = 1000
const DAY_MS = 86_400_000


/** 'HH:MM' in 24-hour form, nothing else. */
export function isTargetTime(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
}

/**
 * Epoch ms of the next occurrence of 'HH:MM' local time at or after `from`.
 *
 * If the moment has already gone by today we roll to tomorrow. A church
 * setting up a 10:30 countdown on Saturday night wants Sunday morning, not
 * a timer that is already sixteen hours overrun; the same rule makes a
 * countdown built at 10:31 on Sunday read as "next week's service" rather
 * than a nonsense negative, which is the safer of the two wrong answers
 * because the operator can see it and fix the time.
 */
export function nextOccurrence(targetTime: string, from: number): number {
  const [h, m] = targetTime.split(':').map(Number)
  const target = new Date(from)
  target.setHours(h, m, 0, 0)
  let at = target.getTime()
  // Across a DST boundary the naive +24h can land on the wrong wall-clock
  // hour, so re-set the fields on the following day rather than adding ms.
  // Strictly `<`: the target instant itself has not gone by, so a countdown
  // started at exactly 10:30 reads 0:00 rather than a full day.
  if (at < from) {
    const tomorrow = new Date(from + DAY_MS)
    tomorrow.setHours(h, m, 0, 0)
    at = tomorrow.getTime()
  }
  return at
}

/**
 * How long a stopped to-time timer keeps counting past its target before it
 * gives up and aims at tomorrow. An hour covers a service running long
 * without ever leaving a stale countdown on screen the next morning.
 */
const STOPPED_ROLLOVER_GRACE_MS = HOUR_MS

/** Local midnight for the day containing `at`. */
function startOfDay(at: number): number {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export class TimerStore {
  private timers: Timer[] = []
  private seq = 0

  constructor(
    private readonly onChange: (timers: TimerSnapshot[]) => void,
    private readonly now: () => number = Date.now
  ) {}

  /**
   * Add a timer. Returns null when the input cannot make a working clock:
   * a countdown needs a positive duration, a to-time needs a real 'HH:MM'.
   * Rejecting beats silently creating a timer that shows 0:00 forever.
   */
  create(input: CreateTimerInput): Timer | null {
    if (input.kind !== 'countdown' && input.kind !== 'to-time' && input.kind !== 'elapsed') return null
    if (input.kind === 'countdown' && !isPositiveDuration(input.durationSec)) return null
    if (input.kind === 'to-time' && !isTargetTime(input.targetTime)) return null

    const timer: Timer = {
      id: `timer-${++this.seq}`,
      name: (input.name ?? '').trim() || defaultName(input.kind),
      kind: input.kind,
      overrun: input.overrun ?? false,
      state: 'stopped',
      startedAt: null,
      pausedAt: null,
      elapsedBeforePauseMs: 0
    }
    if (input.kind === 'countdown') timer.durationSec = input.durationSec
    if (input.kind === 'to-time') timer.targetTime = input.targetTime
    if (input.extraSec !== undefined) timer.extraSec = input.extraSec
    this.timers.push(timer)
    this.emit()
    return clone(timer)
  }

  /**
   * Edit a timer in place. The kind is fixed for the life of a timer — a
   * countdown that became a stopwatch would silently invalidate whatever it
   * had already banked — so only the fields that belong to the existing
   * kind are accepted, and an invalid value is rejected whole rather than
   * half-applied.
   */
  update(id: string, patch: UpdateTimerPatch): Timer | null {
    const timer = this.find(id)
    if (!timer) return null

    if (patch.durationSec !== undefined) {
      if (timer.kind !== 'countdown' || !isPositiveDuration(patch.durationSec)) return null
    }
    if (patch.targetTime !== undefined) {
      if (timer.kind !== 'to-time' || !isTargetTime(patch.targetTime)) return null
    }
    if (patch.name !== undefined && typeof patch.name !== 'string') return null

    if (patch.name !== undefined) timer.name = patch.name.trim() || defaultName(timer.kind)
    if (patch.durationSec !== undefined) timer.durationSec = patch.durationSec
    if (patch.targetTime !== undefined) timer.targetTime = patch.targetTime
    if (patch.overrun !== undefined) timer.overrun = Boolean(patch.overrun)
    if (patch.extraSec !== undefined) timer.extraSec = patch.extraSec
    this.emit()
    return clone(timer)
  }

  remove(id: string): boolean {
    const i = this.timers.findIndex((t) => t.id === id)
    if (i < 0) return false
    this.timers.splice(i, 1)
    this.emit()
    return true
  }

  /**
   * Start, or resume from a pause. Starting an already-running timer is a
   * no-op that still reports success — the operator double-clicking the
   * button must never reset the sermon clock.
   */
  start(id: string): Timer | null {
    const timer = this.find(id)
    if (!timer) return null
    if (timer.state === 'running') return clone(timer)
    const at = this.now()
    // Pin the wall-clock target on the FIRST start and never again: a pause
    // must hold the number still, so time spent paused cannot be allowed to
    // drain a countdown that is measured against the clock.
    if (timer.kind === 'to-time' && timer.anchoredAt === undefined) timer.anchoredAt = at
    timer.startedAt = at
    timer.pausedAt = null
    timer.state = 'running'
    this.emit()
    return clone(timer)
  }

  /** Bank the current segment and hold. Pausing a stopped timer does nothing. */
  pause(id: string): Timer | null {
    const timer = this.find(id)
    if (!timer) return null
    if (timer.state !== 'running') return clone(timer)
    // A to-time timer chases the wall clock, so "pause" has no coherent
    // meaning for it: freezing the number would leave it claiming minutes
    // remaining until a service that has already begun. Refuse rather than
    // drift — the operator wants reset(), or a plain countdown.
    if (timer.kind === 'to-time') return clone(timer)
    const at = this.now()
    timer.elapsedBeforePauseMs += Math.max(0, at - (timer.startedAt ?? at))
    timer.startedAt = null
    timer.pausedAt = at
    timer.state = 'paused'
    this.emit()
    return clone(timer)
  }

  /** Back to the top and stopped: full duration, or zero for a stopwatch. */
  reset(id: string): Timer | null {
    const timer = this.find(id)
    if (!timer) return null
    timer.state = 'stopped'
    timer.startedAt = null
    timer.pausedAt = null
    timer.elapsedBeforePauseMs = 0
    // Un-pin, so restarting a to-time timer measures against the clock afresh.
    delete timer.anchoredAt
    this.emit()
    return clone(timer)
  }

  /** Every timer with the value it holds at this instant. */
  snapshot(): TimerSnapshot[] {
    const at = this.now()
    return this.timers.map((t) => snapshotOf(t, at))
  }

  valueOf(id: string): TimerSnapshot | null {
    const timer = this.find(id)
    return timer ? snapshotOf(timer, this.now()) : null
  }

  list(): Timer[] {
    return this.timers.map(clone)
  }

  dispose(): void {
    this.timers = []
  }

  private find(id: string): Timer | undefined {
    return this.timers.find((t) => t.id === id)
  }

  private emit(): void {
    this.onChange(this.snapshot())
  }
}

function isPositiveDuration(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

function defaultName(kind: TimerKind): string {
  if (kind === 'countdown') return 'Countdown'
  if (kind === 'to-time') return 'Countdown to time'
  return 'Elapsed'
}

function clone(t: Timer): Timer {
  return { ...t }
}

/**
 * How much time this timer has been running for, in ms — banked segments
 * plus the live one. A stopped timer has run for nothing at all.
 */
function runMs(t: Timer, at: number): number {
  if (t.state === 'running' && t.startedAt !== null) {
    return t.elapsedBeforePauseMs + Math.max(0, at - t.startedAt)
  }
  if (t.state === 'paused') return t.elapsedBeforePauseMs
  return 0
}

function snapshotOf(t: Timer, at: number): TimerSnapshot {
  let remainingMs: number

  if (t.kind === 'elapsed') {
    remainingMs = runMs(t, at)
  } else if (t.kind === 'countdown') {
    const total = (t.durationSec ?? 0) * SECOND_MS
    remainingMs = total - runMs(t, at)
  } else {
    // to-time chases a wall-clock instant, so the gap is fixed the moment
    // the timer starts: we resolve the target once, from the start, and
    // subtract the time run since. Resolving it against `at` on every read
    // would make the display jump a whole day forward the second it crossed
    // zero, exactly when the overrun matters most. A stopped timer has no
    // start yet, so it previews the gap from now.
    const target = t.targetTime ?? '00:00'
    if (t.state === 'stopped' || t.anchoredAt === undefined) {
      // A stopped timer previews the gap from now. The subtlety is which
      // occurrence to aim at: a countdown set up on Saturday night must roll
      // to Sunday morning, but one sitting on the projector as the clock
      // ticks through 10:30 must slide into overrun rather than snapping to
      // '24:00:00' in front of the congregation.
      //
      // The split is a grace window. Within GRACE_MS after today's target we
      // are still "at" that target and count negative; beyond it the service
      // is long over and the operator meant the next one.
      const todayTarget = nextOccurrence(target, startOfDay(at))
      remainingMs =
        at - todayTarget < STOPPED_ROLLOVER_GRACE_MS
          ? todayTarget - at
          : nextOccurrence(target, at) - at
    } else {
      // Resolved once against the instant of the first start (anchoredAt),
      // then drained by however long the timer has actually RUN. Using run
      // time rather than wall-clock elapsed is what makes a pause freeze the
      // display: a paused timer banks nothing, so the number holds while the
      // clock outside keeps moving.
      remainingMs = nextOccurrence(target, t.anchoredAt) - t.anchoredAt - runMs(t, at)
    }
  }

  // Without overrun a countdown parks on zero; a stopwatch has no floor.
  const past = t.kind !== 'elapsed' && remainingMs < 0
  if (past && !t.overrun) remainingMs = 0

  return {
    id: t.id,
    name: t.name,
    kind: t.kind,
    state: t.state,
    remainingMs,
    overrunning: past && t.overrun,
    display: formatTimerDisplay(remainingMs),
    durationSec: t.durationSec,
    extraSec: t.extraSec
  }
}

export const TIMER_UNITS = { HOUR_MS, MINUTE_MS, SECOND_MS }
