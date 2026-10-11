// Everything about the box and its glow, in one place. The values the site uses live in
// look.json; the dev panel (LookPanel) edits them live and its Save button rewrites that
// file. `factory` below is the original vgpu example's look, for the panel's reset.
import saved from './look.json';

export type LedMotion = 'lines' | 'steady' | 'top' | 'right' | 'bottom' | 'left';
export type ColourMode = 'off' | 'click' | 'always';
export type HoverZone = 'inside' | 'outside' | 'both';
export type LineStart = 'top-left' | 'left' | 'bottom-left' | 'bottom' | 'right' | 'top';

export interface HeroLook {
  box: {
    maxWidth: number;
    maxHeight: number;
    sideMargin: number;
    spaceAbove: number;
    spaceBelow: number;
    fill: string;
  };
  leds: {
    spacing: number;
    colorFrom: string;
    colorTo: string;
    gradientAngle: number;
    gradientSpin: number;
    evenBrightness: number;
    idleBrightness: number;
    litBrightness: number;
    peakBrightness: number;
    intensity: number;
  };
  motion: {
    mode: LedMotion;
    startAt: LineStart;
    introSweep: number;
    introHold: number;
    introSettle: number;
    introBrightness: number;
    speed: number;
    lineLength: number;
    clickSpeedBoost: number;
  };
  colours: {
    mode: ColourMode;
    left: string;
    bottom: string;
    right: string;
    top: string;
    strength: number;
    blend: number;
  };
  light: {
    background: string;
    tint: number;
    tintLightness: number;
    strength: number;
    haze: number;
    falloff: number;
    edgeLine: number;
    edgeLineWidth: number;
    bloom: number;
    exposure: number;
    contrast: number;
    grain: number;
    screenFade: number;
  };
  hover: {
    enabled: boolean;
    zone: HoverZone;
    glowRadius: number;
    glowStrength: number;
    dimLines: number;
    fadeLinesNear: number;
    insideBoost: number;
  };
}

interface NumberControl { kind: 'number'; label: string; min: number; max: number; step: number; factory: number }
interface ColourControl { kind: 'colour'; label: string; factory: string }
interface ToggleControl { kind: 'toggle'; label: string; factory: boolean }
interface ChoiceControl<T extends string> { kind: 'choice'; label: string; options: Record<string, T>; factory: T }
export type LookControl = NumberControl | ColourControl | ToggleControl | ChoiceControl<string>;

type ChoiceValue = LedMotion | ColourMode | HoverZone | LineStart;

// Wrapped in [] so a union like LedMotion maps to one ChoiceControl, not one per member.
type ControlFor<V> = [V] extends [number]
  ? NumberControl
  : [V] extends [boolean]
    ? ToggleControl
    : [V] extends [ChoiceValue]
      ? ChoiceControl<V & string>
      : ColourControl;

type LookControls = {
  [G in keyof HeroLook]: {
    title: string;
    fields: { [K in keyof HeroLook[G]]: ControlFor<HeroLook[G][K]> };
  };
};

const num = (label: string, min: number, max: number, step: number, factory: number): NumberControl =>
  ({ kind: 'number', label, min, max, step, factory });
const colour = (label: string, factory: string): ColourControl => ({ kind: 'colour', label, factory });

export const LOOK_CONTROLS: LookControls = {
  box: {
    title: 'Box',
    fields: {
      maxWidth: num('Max width (px)', 120, 2400, 10, 960),
      maxHeight: num('Max height (px)', 80, 1600, 10, 540),
      sideMargin: num('Space left & right (px)', 0, 400, 1, 24),
      spaceAbove: num('Space above, for the title (px)', 0, 500, 1, 150),
      spaceBelow: num('Space below, for the buttons (px)', 0, 500, 1, 140),
      fill: colour('Inside colour', '#000000'),
    },
  },
  leds: {
    title: 'LEDs',
    fields: {
      spacing: num('Spacing (px)', 2, 40, 0.5, 7),
      colorFrom: colour('Gradient from', '#ffffff'),
      colorTo: colour('Gradient to (same = solid)', '#ffffff'),
      gradientAngle: num('Gradient angle (°)', 0, 360, 1, 45),
      gradientSpin: num('Gradient spin (°/s)', -90, 90, 1, 0),
      evenBrightness: num('Even out brightness', 0, 1, 0.01, 1),
      idleBrightness: num('Dim level', 0, 1, 0.01, 0.05),
      litBrightness: num('Lit level (steady & edge modes)', 0, 1, 0.01, 0.4),
      peakBrightness: num('Peak level (lines)', 0, 3, 0.05, 1),
      intensity: num('Overall power', 0, 5, 0.05, 1),
    },
  },
  motion: {
    title: 'Motion',
    fields: {
      mode: {
        kind: 'choice',
        label: 'Pattern',
        options: {
          'Travelling lines': 'lines',
          'Steady glow': 'steady',
          'Top edge': 'top',
          'Right edge': 'right',
          'Bottom edge': 'bottom',
          'Left edge': 'left',
        },
        factory: 'lines',
      },
      startAt: {
        kind: 'choice',
        label: 'Opening & lines start at',
        options: {
          'Top-left (original)': 'top-left',
          'Left side': 'left',
          'Bottom-left corner': 'bottom-left',
          Bottom: 'bottom',
          'Right side': 'right',
          Top: 'top',
        },
        factory: 'top-left',
      },
      introSweep: num('Opening sweep (s, 0 = none)', 0, 8, 0.05, 0),
      introHold: num('Opening hold (s)', 0, 5, 0.05, 0.5),
      introSettle: num('Opening settle into lines (s)', 0, 8, 0.05, 1.4),
      introBrightness: num('Opening brightness', 0, 1, 0.01, 0.8),
      speed: num('Speed', 0, 5, 0.05, 1),
      lineLength: num('Line length', 0.2, 3, 0.05, 1),
      clickSpeedBoost: num('Burst on click', 1, 30, 0.5, 10),
    },
  },
  colours: {
    title: 'Click colours',
    fields: {
      mode: {
        kind: 'choice',
        label: 'Four edge colours',
        options: { Off: 'off', 'On click': 'click', Always: 'always' },
        factory: 'click',
      },
      left: colour('Left', '#f32e40'),
      bottom: colour('Bottom', '#00ab3e'),
      right: colour('Right', '#0090ff'),
      top: colour('Top', '#ffb000'),
      strength: num('Strength', 0, 1, 0.01, 1),
      blend: num('Blend distance (px)', 20, 800, 1, 173),
    },
  },
  light: {
    title: 'Light',
    fields: {
      background: colour('Background', '#000000'),
      tint: num('Glow colour on a light background', 0, 3, 0.05, 1),
      tintLightness: num('…and how light that colour is', 0.05, 1, 0.01, 1),
      strength: num('Glow strength', 0, 200, 1, 50),
      haze: num('Haze (higher = shorter reach)', 0, 20, 0.1, 2),
      falloff: num('Falloff', 0, 4, 0.05, 1),
      edgeLine: num('Edge line brightness', 0, 6, 0.05, 1.2),
      edgeLineWidth: num('Edge line width (px)', 0, 120, 0.5, 4),
      bloom: num('Bloom', 0, 4, 0.05, 0.65),
      exposure: num('Exposure', 0.02, 2, 0.01, 0.25),
      contrast: num('Contrast', 0.5, 2, 0.01, 1.05),
      grain: num('Floor grain', 0, 4, 0.05, 1),
      screenFade: num('Fade at top & bottom', 0, 0.5, 0.01, 0.2),
    },
  },
  hover: {
    title: 'Cursor',
    fields: {
      enabled: { kind: 'toggle', label: 'Cursor effects', factory: true },
      zone: {
        kind: 'choice',
        label: 'LEDs follow the cursor',
        options: { 'Inside the box': 'inside', 'Outside the box': 'outside', 'Both': 'both' },
        factory: 'outside',
      },
      glowRadius: num('Glow radius (px)', 0, 800, 1, 165),
      glowStrength: num('Glow strength', 0, 2, 0.05, 1),
      dimLines: num('Dim the lines while following', 0, 1, 0.01, 1),
      fadeLinesNear: num('Outside reach', 0, 3, 0.05, 0.6),
      insideBoost: num('Brighten everything when inside', 1, 12, 0.25, 4),
    },
  },
};

const GROUPS = Object.keys(LOOK_CONTROLS) as (keyof HeroLook)[];
const HEX = /^#[0-9a-f]{6}$/i;

/** Any input → a complete, in-range look. Unknown keys are dropped; bad values fall back to factory. */
export function sanitizeLook(input: unknown): HeroLook {
  const source = isRecord(input) ? input : {};
  const look: Record<string, Record<string, unknown>> = {};
  for (const group of GROUPS) {
    const values = isRecord(source[group]) ? source[group] : {};
    const fields = LOOK_CONTROLS[group].fields as Record<string, LookControl>;
    look[group] = {};
    for (const [key, control] of Object.entries(fields)) {
      look[group][key] = sanitizeValue(control, values[key]);
    }
  }
  return look as unknown as HeroLook;
}

export function factoryLook(): HeroLook {
  return sanitizeLook({});
}

export const SAVED_LOOK: HeroLook = sanitizeLook(saved);

function sanitizeValue(control: LookControl, value: unknown) {
  switch (control.kind) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(control.max, Math.max(control.min, value))
        : control.factory;
    case 'colour':
      return typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : control.factory;
    case 'toggle':
      return typeof value === 'boolean' ? value : control.factory;
    case 'choice':
      return typeof value === 'string' && Object.values(control.options).includes(value)
        ? value
        : control.factory;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** '#rrggbb' (sRGB) → linear RGB, the space the LEDs are lit in. */
export function hexToLinear(hex: string) {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return { r: channel(1), g: channel(3), b: channel(5) };
}
