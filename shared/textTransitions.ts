/**
 * How words arrive on the projector.
 *
 * A short list on purpose. The operator is choosing mid-week for a room that
 * will see it a hundred times on Sunday, so every entry has to be something
 * nobody notices by the third verse: no spins, no slides across the wall, no
 * letter-by-letter. Each is opacity plus at most one transform or filter, so
 * the compositor does the work and a ten-year-old booth laptop driving a
 * 1080p projector does not drop a frame — and none of them needs a library
 * in the output window, which loads nothing but its own stylesheet.
 *
 * The motion itself is CSS (src/output.css, `.tx-*`). This file is only the
 * vocabulary, shared so Settings, the Live screen and the projector cannot
 * disagree about what the choices are. No imports.
 */

export const TEXT_TRANSITIONS = [
  { id: 'cut', label: 'cut', blurb: 'instant — nothing moves' },
  { id: 'fade', label: 'fade', blurb: 'words fade in' },
  { id: 'rise', label: 'rise', blurb: 'fade in, lifting slightly' },
  { id: 'blur', label: 'focus', blurb: 'comes into focus' },
  { id: 'zoom', label: 'settle', blurb: 'fades in as it settles to size' },
] as const

export type TextTransition = (typeof TEXT_TRANSITIONS)[number]['id']

export function isTextTransition(v: unknown): v is TextTransition {
  return typeof v === 'string' && TEXT_TRANSITIONS.some((t) => t.id === v)
}

/** Fast enough to keep up with a preacher stepping through a reading, slow
 *  enough to read as intended rather than as a glitch. */
export const TRANSITION_MS = { min: 150, default: 450, max: 1200 } as const

export function clampTransitionMs(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : TRANSITION_MS.default
  return Math.min(TRANSITION_MS.max, Math.max(TRANSITION_MS.min, Math.round(n)))
}
