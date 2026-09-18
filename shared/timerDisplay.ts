/**
 * Rendering a duration as a clock face (BUILD-MAP 2.16).
 *
 * Split out of electron/engine/timers.ts because both processes need it: the
 * store formats snapshots in main, and the projector, stage monitor and Live
 * panel all re-format between ticks in the renderer. A renderer importing
 * from electron/ would drag main-process code into the browser bundle, so the
 * one function they share lives here instead.
 */

const SECOND_MS = 1000

/**
 * 'M:SS' under an hour, 'H:MM:SS' at an hour or more, with a leading '-' once
 * the value is genuinely negative.
 *
 * Rounding is toward zero so a countdown reads '0:00' for the whole of its
 * final second, the way a stopwatch does, instead of flicking '0:01' →
 * '-0:01' and never showing zero at all. The sign follows the TRUNCATED
 * value for the same reason: the first 900ms past zero still truncate to zero
 * seconds, and '-0:00' would be exactly the flicker this rule exists to stop.
 */
export function formatTimerDisplay(ms: number): string {
  const safe = Number.isFinite(ms) ? ms : 0
  const total = Math.floor(Math.abs(safe) / SECOND_MS)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const sign = safe < 0 && total > 0 ? '-' : ''
  if (hours > 0) return `${sign}${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${sign}${minutes}:${pad(seconds)}`
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
