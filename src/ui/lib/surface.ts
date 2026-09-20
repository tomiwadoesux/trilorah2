import type { CSSProperties } from 'react';
import { cx } from './cx';

/*
 * The gradient surface, as one recipe.
 *
 * Trilorah is a single surface wearing different sizes: one gradient whose
 * alpha carries state, one corner shape, one stroke. Every component was
 * spelling that out in its own class list, which is how a design system
 * quietly becomes forty gradients again. Components now describe *what the
 * surface is* and this returns the classes.
 */

/**
 * Which hue set the surface wears. The recipe is identical in every case —
 * same angle, same alpha-carries-state model, same two-phase hover — so these
 * are one material in different colours, not different surfaces.
 *
 *   default  teal, the system's own voice
 *   ash      neutral, for a control that is not about anything in particular
 *   gold     the accent as a surface: now, live, look here first
 *   indigo   a second voice that is not a warning
 *   danger   red, destructive actions only
 *
 * And the two bright ones, where the surface is lit and the ink is dark —
 * see the note on --tri-go-* in tokens.css for why there are exactly two:
 *
 *   go       mint. The act that reaches the room: go live.
 *   caution  gold. The act that takes something back: reset.
 */
export type SurfaceTone = 'default' | 'ash' | 'gold' | 'indigo' | 'danger' | 'go' | 'caution';

/**
 * control = buttons and small controls (tighter radius).
 * panel   = wide surfaces — rows, tracks, cards.
 */
export type SurfaceShape = 'control' | 'panel';

export interface SurfaceOptions {
  tone?: SurfaceTone;
  shape?: SurfaceShape;
  /** Responds to hover and press. Non-interactive surfaces stay at rest. */
  interactive?: boolean;
  /** Draw the outline. `edge` is the solid border, `hairline` the 12% ink. */
  stroke?: 'hairline' | 'edge' | 'none';
  /** Opaque fill, for the slider's filled track. */
  solid?: boolean;
  /**
   * Flatter gradient angle. Wide surfaces band at the control angle, which
   * is why the file had six angles before they were normalised to two.
   */
  wide?: boolean;
}

export function surface({
  tone = 'default',
  shape = 'control',
  interactive = false,
  stroke = 'hairline',
  solid = false,
  wide = false,
}: SurfaceOptions = {}): string {
  return cx(
    'tri-surface',
    tone !== 'default' && `tri-surface--${tone}`,
    wide && 'tri-surface--wide',
    solid && 'tri-surface--solid',
    interactive && 'tri-interactive',
    shape === 'control' ? 'tri-rounded-control' : 'tri-rounded-surface',
    stroke !== 'none' && 'tri-stroke',
  );
}

/** The ink tone that belongs with a surface tone. */
export function toneClass(tone: SurfaceTone = 'default'): string {
  if (tone === 'go' || tone === 'caution') return 'tri-tone-bright';
  return tone === 'danger' ? 'tri-tone-danger' : 'tri-tone';
}

/** Inline custom properties for a surface's stroke colour. */
export function strokeStyle(stroke: SurfaceOptions['stroke']): CSSProperties {
  return stroke === 'edge' ? ({ '--tri-stroke-color': 'var(--tri-edge)' } as CSSProperties) : {};
}
