/**
 * How far behind the room THIS phone is, remembered per device.
 *
 * The room's clock is the default. Opening a supported video can supply its
 * own clock; otherwise viewers can adjust for the stream they are watching.
 * Merely configuring a church stream does not delay everyone in the room.
 *
 * The nudge is stored as a delta rather than an absolute so that changing the
 * default below still helps everyone who never touched it.
 */

const KEY = "trilorah_sync_nudge_ms";

/**
 * Keep the reading cursor five seconds behind the speech clock, giving the
 * recognizer time to deliver words ahead of the current highlight. Network or
 * recognition latency can exceed this; the UI waits instead of inventing text.
 */
export const DEFAULT_HOLD_MS = 5_000;

export const NUDGE_STEP_MS = 1_000;

/**
 * Clamped hard. A viewer holding the button down should not be able to push the
 * transcript to a place it can never come back from, and a nudge beyond a
 * minute either way means they are on a different service.
 */
export const NUDGE_MIN_MS = -30_000;
export const NUDGE_MAX_MS = 60_000;

export function clampNudge(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(NUDGE_MIN_MS, Math.min(NUDGE_MAX_MS, Math.round(ms)));
}

/** Reads come back 0 in a private window or with site data blocked. */
export function readNudge(): number {
  try {
    const raw = localStorage.getItem(KEY);
    return raw == null ? 0 : clampNudge(Number(raw));
  } catch {
    return 0;
  }
}

export function writeNudge(ms: number): void {
  try {
    localStorage.setItem(KEY, String(clampNudge(ms)));
  } catch {
    /* A phone that will not remember the setting still honours it this session. */
  }
}

/** Shown to the viewer as a plain number of seconds, signed. */
export function formatNudge(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s === 0) return "in sync";
  return s > 0 ? `+${s}s behind` : `${s}s ahead`;
}
