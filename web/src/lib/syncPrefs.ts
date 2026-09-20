/**
 * How far behind the room THIS phone is, remembered per device.
 *
 * Stream latency is not a property of the church, it is a property of the
 * viewer's platform and network: the same service is ~20s behind on YouTube,
 * ~10s on Facebook, and a congregant sitting in the room with no stream at all
 * is behind by nothing. There is no server-side answer to that, so the viewer
 * gets a nudge control and the device remembers what they chose.
 *
 * The nudge is stored as a delta rather than an absolute so that changing the
 * default below still helps everyone who never touched it.
 */

const KEY = "trilorah_sync_nudge_ms";

/** Typical YouTube live latency for a church encoder. The starting guess. */
export const DEFAULT_STREAM_DELAY_MS = 20_000;

/**
 * The deliberate hold on top of the stream delay. Four seconds does two jobs:
 * a word lights as it is heard rather than a beat early, and Deepgram's habit
 * of revising the tail of a sentence happens before the phone has drawn it.
 */
export const DEFAULT_HOLD_MS = 4_000;

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
