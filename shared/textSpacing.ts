export type TextSpacing = 'normal' | 'tight' | 'airy';

/** Small steps keep scripture readable while changing its overall density. */
export const TEXT_SPACING = {
  normal: { letterSpacing: '0em', lineHeightDelta: 0, sampleShift: 0 },
  tight: { letterSpacing: '-0.035em', lineHeightDelta: -0.15, sampleShift: -0.045 },
  airy: { letterSpacing: '0.055em', lineHeightDelta: 0.2, sampleShift: 0.115 },
} as const;

export function resolveTextSpacing(value: unknown): TextSpacing {
  return value === 'tight' || value === 'airy' ? value : 'normal';
}

export function nextTextSpacing(value: TextSpacing): TextSpacing {
  return value === 'normal' ? 'tight' : value === 'tight' ? 'airy' : 'normal';
}
