export type CutoutCategory = 'Service' | 'Actions' | 'Navigation' | 'Devices' | 'Status' | 'Giving';
export type CutoutMotion = 'lift' | 'turn' | 'pulse' | 'sway' | 'scan' | 'press' | 'slide';

/** A semantic SVG group. Keep its name stable so animations can target it. */
export interface CutoutPart {
  name: string;
  /** Trusted, original SVG geometry. Never insert user-provided markup here. */
  markup: string;
  /** Pivot in the shared 32 × 32 viewBox, not the rendered pixel size. */
  origin?: readonly [number, number];
  motion?: CutoutMotion;
}

export interface CutoutDefinition {
  label: string;
  category: CutoutCategory;
  parts: readonly CutoutPart[];
}
