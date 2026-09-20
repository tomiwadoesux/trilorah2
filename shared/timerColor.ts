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
