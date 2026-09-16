/*
 * Weight tiers, shared by every orb sheet so a "heavy" on one page means
 * the same thing as a "heavy" on the next.
 *
 * Absolute, not relative. A ranking would always call something heavy
 * even if everything were free; the question the sheets answer is whether
 * an orb can sit in the corner of a live service screen while the
 * transcript is scrolling, and that is a question about the frame budget.
 */

export type Tier = 'light' | 'moderate' | 'heavy';

/** `share` is the main-thread fraction of one 60Hz frame. */
export function tierOf(share: number): Tier {
  if (share < 0.015) return 'light';
  if (share < 0.04) return 'moderate';
  return 'heavy';
}

export const TIER_INK: Record<Tier, string> = {
  light: '#7fd6c4',
  moderate: 'var(--tri-accent-yellow)',
  heavy: 'var(--tri-ink-danger-hover)',
};
