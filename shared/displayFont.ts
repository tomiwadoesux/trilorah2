export const DISPLAY_FONTS = {
  default: 'Roboto, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
} as const;

export function displayFontFamily(font: string): string {
  return font === 'serif' ? DISPLAY_FONTS.serif : DISPLAY_FONTS.default;
}

/**
 * The curated scripture faces — Google Fonts, loaded with their FULL weight
 * range in design.html and output.html so the boldness slider has real thick
 * and thin to work with, not a synthetic bold smeared over one weight.
 *
 * One list, shared by Settings (the picker), the preview renderer and the
 * projector window, so a face chosen in one place resolves to the same
 * letters everywhere.
 */
export interface ScriptureFace {
  id: string;
  family: string;
  stack: string;
  kind: 'serif' | 'sans';
}

export const SCRIPTURE_FACES: ScriptureFace[] = [
  { id: 'cormorant', family: 'Cormorant Garamond', stack: '"Cormorant Garamond", Georgia, serif', kind: 'serif' },
  { id: 'eb-garamond', family: 'EB Garamond', stack: '"EB Garamond", Georgia, serif', kind: 'serif' },
  { id: 'playfair', family: 'Playfair Display', stack: '"Playfair Display", Georgia, serif', kind: 'serif' },
  { id: 'baskerville', family: 'Libre Baskerville', stack: '"Libre Baskerville", Georgia, serif', kind: 'serif' },
  { id: 'fraunces', family: 'Fraunces', stack: '"Fraunces", Georgia, serif', kind: 'serif' },
  { id: 'newsreader', family: 'Newsreader', stack: '"Newsreader", Georgia, serif', kind: 'serif' },
  { id: 'inter', family: 'Inter', stack: '"Inter", system-ui, sans-serif', kind: 'sans' },
  { id: 'manrope', family: 'Manrope', stack: '"Manrope", system-ui, sans-serif', kind: 'sans' },
  { id: 'dm-sans', family: 'DM Sans', stack: '"DM Sans", system-ui, sans-serif', kind: 'sans' },
  { id: 'outfit', family: 'Outfit', stack: '"Outfit", system-ui, sans-serif', kind: 'sans' },
  { id: 'jakarta', family: 'Plus Jakarta Sans', stack: '"Plus Jakarta Sans", system-ui, sans-serif', kind: 'sans' },
  { id: 'figtree', family: 'Figtree', stack: '"Figtree", system-ui, sans-serif', kind: 'sans' },
];

/** The presets older builds wrote; kept so a saved church file still resolves. */
export const LEGACY_FACES: ScriptureFace[] = [
  { id: 'display-serif', family: 'Georgia', stack: DISPLAY_FONTS.serif, kind: 'serif' },
  { id: 'classic-serif', family: 'Times New Roman', stack: "'Times New Roman', Georgia, serif", kind: 'serif' },
  { id: 'modern-sans', family: 'Roboto', stack: DISPLAY_FONTS.default, kind: 'sans' },
  { id: 'bold-slab', family: 'Alfa Slab One', stack: "'Alfa Slab One', Georgia, serif", kind: 'serif' },
  { id: 'display-rounded', family: 'Paytone One', stack: "'Paytone One', system-ui, sans-serif", kind: 'sans' },
];

const ALL_FACES = [...SCRIPTURE_FACES, ...LEGACY_FACES];

export function scriptureFaceById(id: unknown): ScriptureFace | undefined {
  return typeof id === 'string' ? ALL_FACES.find((f) => f.id === id) : undefined;
}

/**
 * The face a theme's serif/sans choice lands on.
 *
 * The theme picks the KIND (serif or sans); Settings' preset picks WHICH
 * serif and which sans. When the stored preset already is the wanted kind it
 * stands; when the theme switched kinds, the default face of the other kind
 * steps in rather than the preset being ignored or the kind being lost.
 */
export function scriptureFaceForKind(preset: unknown, kind: 'serif' | 'sans'): ScriptureFace {
  const chosen = scriptureFaceById(preset);
  if (chosen && chosen.kind === kind) return chosen;
  return kind === 'serif' ? LEGACY_FACES[0] : LEGACY_FACES[2];
}

/** The editor's shadow-strength slider, 0–100. */
export const TEXT_SHADOW = { min: 0, max: 100, default: 65 } as const;

export function clampTextShadow(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(TEXT_SHADOW.max, Math.max(TEXT_SHADOW.min, value))
    : TEXT_SHADOW.default;
}

/**
 * The dark glow behind the words, from the slider's 0–100.
 *
 * One formula for the preview and the wall, in ems so it scales with the
 * text it sits behind — the reference's shadow is automatically lighter
 * than the body's. Two layers: a soft drop that separates the words from a
 * busy picture, and a tight edge that keeps thin strokes readable. At 100
 * it is genuinely dark, which is what a preacher squinting at a washed-out
 * wall needs; at 0 there is none at all.
 */
export function verseTextShadow(strength: number): string {
  const s = clampTextShadow(strength) / 100;
  if (s === 0) return 'none';
  const soft = (0.06 + s * 0.22).toFixed(3);
  const softAlpha = (0.2 + s * 0.7).toFixed(2);
  const tight = (0.02 + s * 0.06).toFixed(3);
  const tightAlpha = (0.15 + s * 0.55).toFixed(2);
  return `0 0.04em ${soft}em rgba(0, 0, 0, ${softAlpha}), 0 0 ${tight}em rgba(0, 0, 0, ${tightAlpha})`;
}
