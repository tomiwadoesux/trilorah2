/*
 * The microwave clock: a duration as exactly six digits, HHMMSS, typed by
 * shifting in from the right — press 4, 5, 0, 0 and you have 00:45:00.
 *
 * Copied from the dashboard's TimersTile (src/design/screens/dashboard/
 * TimersTile.tsx), where the full design note lives; the Stage Timer app
 * cannot import from there without dragging the whole dashboard along.
 */

/** Six digits, HHMMSS, from a duration in seconds. */
export function secondsToDigits(totalSec: number): string {
  const capped = Math.max(0, Math.min(99 * 3600 + 59 * 60 + 59, Math.floor(totalSec)))
  const h = Math.floor(capped / 3600)
  const m = Math.floor((capped % 3600) / 60)
  const s = capped % 60
  return `${pad2(h)}${pad2(m)}${pad2(s)}`
}

/**
 * Seconds from six typed digits. 00 75 00 is read as seventy-five minutes
 * (1:15:00), never refused.
 */
export function digitsToSeconds(digits: string): number {
  const h = Number(digits.slice(0, 2))
  const m = Number(digits.slice(2, 4))
  const s = Number(digits.slice(4, 6))
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return 0
  return h * 3600 + m * 60 + s
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Shift one digit in from the right, dropping whatever falls off the left. */
export function pushDigit(digits: string, d: string): string {
  return (digits + d).slice(-6)
}

/** Shift one digit out to the right, feeding a zero in at the left. */
export function popDigit(digits: string): string {
  return `0${digits.slice(0, 5)}`
}
