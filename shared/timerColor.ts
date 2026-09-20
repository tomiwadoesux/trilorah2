/**
 * Color calculations and overtime helpers for church timers.
 *
 * Progresses from Green (start) -> Orange/Amber (midway) -> Red (running out) -> Overrun Red.
 * Used by the Dashboard TimersTile, Top-Bar DigitalClockBento, Stage Monitor, and
 * the Dedicated Full-Screen HDMI Timer display.
 */

export function getTimerColor(remainingMs: number, totalDurationMs: number): string {
  // Overrun / past zero: intense urgent red
  if (remainingMs <= 0) return '#ef4444';
  if (!totalDurationMs || totalDurationMs <= 0) return '#22c55e';

  const ratio = Math.max(0, Math.min(1, remainingMs / totalDurationMs));

  // If plenty of time left (ratio >= 0.4):
  // Interpolates between warm orange (hue 38) and lush green (hue 142)
  if (ratio >= 0.4) {
    const factor = (ratio - 0.4) / 0.6; // 0 (at 0.4) to 1 (at 1.0)
    const hue = Math.round(38 + factor * (142 - 38));
    return `hsl(${hue}, 86%, 52%)`;
  }

  // Running low (ratio < 0.4, down to 0):
  // Interpolates between urgent red (hue 0) and warm orange (hue 38)
  const factor = ratio / 0.4; // 0 (at 0.0) to 1 (at 0.4)
  const hue = Math.round(factor * 38);
  return `hsl(${hue}, 92%, 54%)`;
}

/**
 * Returns a glow shadow matching the timer's current color phase.
 */
export function getTimerGlow(remainingMs: number, totalDurationMs: number): string {
  const color = getTimerColor(remainingMs, totalDurationMs);
  return `0 0 16px ${color}80`;
}

/**
 * The same phase, in the dashboard's own ink.
 *
 * getTimerColor above is for a screen read from across a room — the stage
 * monitor and the full-screen HDMI timer — where saturated green/amber/red IS
 * the message and it has to carry at ten metres. The dashboard tile is read
 * at arm's length inside a bento of otherwise colourless cards, and a lush
 * green countdown there reads as decoration rather than state: everything
 * around it is ink on a 2.2% white surface.
 *
 * So the resting phase is plain ink and colour is spent only where it means
 * something — the last 40% warms, and overrun is the one loud value. Same
 * thresholds as getTimerColor, so the tile and the projected screen change
 * phase on the same tick.
 */
export function getTimerInk(remainingMs: number, totalDurationMs: number): string {
  if (remainingMs <= 0) return '#eac7c6'; /* --tri-ink-danger */
  if (!totalDurationMs || totalDurationMs <= 0) return '#e5f3f2'; /* --tri-ink */

  const ratio = Math.max(0, Math.min(1, remainingMs / totalDurationMs));

  /* Plenty of time: the countdown is just a number, so it is ink. */
  if (ratio >= 0.4) return '#e5f3f2';

  /* Running low: ink → the yellow the rest of the app already uses for
     "watch this", then to danger as it approaches zero. */
  const factor = ratio / 0.4;
  if (factor >= 0.5) return '#e4d87a'; /* --tri-accent-yellow */
  return '#eac7c6'; /* --tri-ink-danger */
}
