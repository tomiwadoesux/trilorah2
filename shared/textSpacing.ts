import type { TextCase } from './textCase';

export type TextSpacing = 'normal' | 'tight' | 'airy';

/** Small steps keep scripture readable while changing its overall density. */
export const TEXT_SPACING = {
  normal: { letterSpacing: '0em', lineHeightDelta: 0, sampleShift: 0 },
  tight: { letterSpacing: '-0.035em', lineHeightDelta: -0.15, sampleShift: -0.045 },
  airy: { letterSpacing: '0.055em', lineHeightDelta: 0.2, sampleShift: 0.115 },
} as const;

/**
 * A song is set as lyrics, not as a reading. It is sung from across the room,
 * so it is larger and heavier; a section is one breath, so its lines stack
 * close. The wall and the stage boxes both read these, so they cannot drift.
 */
export const LYRIC_TYPE = {
  scale: 1.2,
  weight: 700,
  lineHeight: 1.16,
  /** Shrinking to keep a line whole stops at a reading's smallest size (FIT_FLOOR), not a share of this larger one. */
  floor: 0.625,
} as const;

/**
 * Big bold letters look loose at their default spacing, so mixed case closes
 * up. Capitals are the opposite: they crowd, and want a little air. The
 * church's tight/airy choice moves that, but no further than "tight" itself:
 * past it, bold letters touch.
 */
export function lyricLetterSpacing(textCase: TextCase, spacing: TextSpacing): string {
  const base = textCase === 'uppercase' ? 0.02 : -0.015;
  const moved = base + parseFloat(TEXT_SPACING[spacing].letterSpacing);
  return `${Math.max(parseFloat(TEXT_SPACING.tight.letterSpacing), Number(moved.toFixed(3)))}em`;
}

export function resolveTextSpacing(value: unknown): TextSpacing {
  return value === 'tight' || value === 'airy' ? value : 'normal';
}

export function nextTextSpacing(value: TextSpacing): TextSpacing {
  return value === 'normal' ? 'tight' : value === 'tight' ? 'airy' : 'normal';
}
