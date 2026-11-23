/**
 * What the stage clock says once it has stopped counting (owner, 2026-11-22).
 *
 * Past zero the face counts up in the red — -0:01, -0:02 — for ten minutes.
 * Then the number stops being the message and the sentence is: the time is
 * up, and here is how far over. Lives in shared/ because both the main app's
 * HDMI timer output and the standalone Stage Timer draw it, and a preacher
 * glancing between two screens must not be told two different things.
 */

import { OVERRUN_CAP_MS } from './timerBounds'

/** "YOUR TIME IS UP" — the line the face shows in place of the number. */
export const OVERRUN_HEADLINE = 'YOUR TIME IS UP'

/** "YOU ARE 10 MIN OVER" — the line under it, from the cap. */
export function overrunSubline(cappedMs: number = OVERRUN_CAP_MS): string {
  const minutes = Math.max(1, Math.round(Math.abs(cappedMs) / 60_000))
  return `YOU ARE ${minutes} MIN OVER`
}
