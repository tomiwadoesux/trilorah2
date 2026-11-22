import { useEffect, useRef, useState } from 'react'
import { STAGE_REFERENCE_HOLD_MS } from '../../shared/stageLink'
import { formatTimerDisplay } from '../../shared/timerDisplay'
import { getTimerColor } from '../../shared/timerColor'
import type { TimerSnapshot } from './types'

/*
 * The clock as both windows watch it. The store only emits on mutation, so
 * between broadcasts the face carries the number forward itself; the
 * extension-boundary subtlety is the same as the dashboard tile's
 * (src/design/screens/dashboard/TimersTile.tsx faceMs).
 */

export function useTimers() {
  const [timers, setTimers] = useState<TimerSnapshot[]>([])
  const [, setTick] = useState(0)
  const takenAt = useRef(Date.now())

  useEffect(() => {
    const api = window.timerApi
    if (!api) return
    let alive = true
    const take = (list: TimerSnapshot[]) => {
      if (!alive) return
      takenAt.current = Date.now()
      setTimers(list || [])
    }
    void api.listTimers().then(take).catch(() => undefined)
    const off = api.onTimers(take)
    return () => {
      alive = false
      off()
    }
  }, [])

  const live = timers.some((t) => t.state === 'running')
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setTick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [live])

  const activeTimer = timers.find((t) => t.state === 'running') ?? timers[0] ?? null
  return { timers, activeTimer, takenAt }
}

/** What the face should read right now, extrapolated between engine ticks. */
export function faceMs(t: TimerSnapshot, takenAt: number): number {
  if (t.state !== 'running') return t.remainingMs
  const drift = Date.now() - takenAt
  if (t.kind === 'elapsed') return t.remainingMs + drift
  const next = t.remainingMs - drift
  const grace = Math.max(0, t.extraSec ?? 0) * 1000
  // Extrapolation stops at the extension boundary and lets the next
  // broadcast do the handover, so the face never dips below zero and snaps up.
  if (!t.inExtension && grace > 0 && next < 0) return 0
  return next
}

/** Everything the Face component needs, from a timer (or the idle default). */
export function faceState(activeTimer: TimerSnapshot | null, takenAtMs: number, idleMs: number) {
  const ms = activeTimer ? faceMs(activeTimer, takenAtMs) : idleMs
  const phaseMs = activeTimer ? activeTimer.phaseTotalMs ?? (activeTimer.durationSec ?? 0) * 1000 : idleMs
  const over = Boolean(
    activeTimer &&
      (activeTimer.overrunning ||
        (activeTimer.kind === 'countdown' && !activeTimer.inExtension && !activeTimer.extraSec && ms < 0)),
  )
  return {
    ms,
    phaseMs,
    over,
    color: activeTimer ? getTimerColor(ms, phaseMs) : '#22c55e',
    display: formatTimerDisplay(ms),
    target: activeTimer && phaseMs > 0 ? formatTimerDisplay(phaseMs) : null,
    extraLabel:
      activeTimer?.extraSec && activeTimer.extraSec > 0
        ? `+${Math.round(activeTimer.extraSec / 60)} min ${activeTimer.inExtension ? 'extra time' : 'extension'}`
        : null,
  }
}

/**
 * The scripture the preacher just named, while it lasts. Null unless the
 * operator's "show verses" option is on. A correction ("no, verse
 * seventeen") arrives as a fresh reference and restarts the clock.
 */
export function useStageReference(): string | null {
  const [reference, setReference] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const leaveTimer = useRef<number | null>(null)

  useEffect(() => {
    const api = window.timerApi
    if (!api) return
    // Unset means ON — the owner's default; only an explicit off hides them.
    void api.getSettings().then((s) => setShow(s.showVerses !== false)).catch(() => undefined)
    const offShow = api.onShowVerses((on) => setShow(Boolean(on)))
    const offRef = api.onStageReference(({ ref }) => {
      setReference(ref)
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
      leaveTimer.current = window.setTimeout(() => setReference(null), STAGE_REFERENCE_HOLD_MS)
    })
    return () => {
      offShow()
      offRef()
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    }
  }, [])

  return show ? reference : null
}
