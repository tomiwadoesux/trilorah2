/** Fractions of the space shared by the transcript and running order. */
export const RAIL_LIMITS = { min: .25, max: .75, hardMin: .2, hardMax: .8, retainedPull: .25 } as const;
export interface RailBounds { min: number; max: number }
export interface RailSample { value: number; time: number }

export function clampRailShare(value: number): number {
  return Math.max(RAIL_LIMITS.hardMin, Math.min(RAIL_LIMITS.hardMax, value));
}

export function clampRailKeyboard(value: number): number {
  return Math.max(RAIL_LIMITS.min, Math.min(RAIL_LIMITS.max, value));
}

/** Retained room becomes the next gesture's edge, so a new grab never jumps. */
export function railDragBounds(current: number): RailBounds {
  return { min: Math.min(RAIL_LIMITS.min, clampRailShare(current)), max: Math.max(RAIL_LIMITS.max, clampRailShare(current)) };
}

function rubberband(distance: number, room: number): number {
  return room <= 0 ? 0 : (distance * room * .55) / (room + .55 * distance);
}

/** Direct tracking inside the bounds; progressively heavier outside them. */
export function elasticRailShare(raw: number, bounds: RailBounds): number {
  if (raw < bounds.min) return bounds.min - rubberband(bounds.min - raw, bounds.min - RAIL_LIMITS.hardMin);
  if (raw > bounds.max) return bounds.max + rubberband(raw - bounds.max, RAIL_LIMITS.hardMax - bounds.max);
  return raw;
}

/** Keep a quarter of the extra pull while guaranteeing both panes 20%. */
export function settledRailShare(raw: number, bounds: RailBounds): number {
  if (raw < bounds.min) return clampRailShare(bounds.min + (raw - bounds.min) * RAIL_LIMITS.retainedPull);
  if (raw > bounds.max) return clampRailShare(bounds.max + (raw - bounds.max) * RAIL_LIMITS.retainedPull);
  return clampRailShare(raw);
}

/** A held-still release carries no stale momentum. Units are share / second. */
export function railReleaseVelocity(samples: readonly RailSample[], releasedAt: number): number {
  const last = samples.at(-1);
  if (!last || releasedAt - last.time > 80) return 0;
  const first = samples.find(sample => last.time - sample.time <= 80);
  if (!first || last.time <= first.time) return 0;
  return Math.max(-.6, Math.min(.6, (last.value - first.value) * 1000 / (last.time - first.time)));
}
