export type DotColor = readonly [number, number, number];
export type DotPalette = { green: DotColor; yellow: DotColor };
export type DotShape = 'triangle' | 'square' | 'circle' | 'organic' | 'heart' | 'flower';
type DotPulse = {
  x: number;
  y: number;
  at: number;
  color: DotColor;
  strength: number;
  radius: number;
  contour: Float32Array;
  shape: DotShape;
};
export type DotLight = {
  x: number;
  y: number;
  color: DotColor;
  opacity: number;
  radius: number;
  width: number;
  contour: Float32Array;
  shape: DotShape;
  petalContours?: readonly Float32Array[];
};

const CLICK_WINDOW_MS = 1_400;
const QUIET_MS = 650;
const ACCENT_MS = 1_200;
const MAX_PULSES = 8;
const MAX_RADIUS = 192;
const CONTOUR_SAMPLES = 64;
const TAU = Math.PI * 2;
const BURST_SHAPE_MS = 1_100;
const BURST_INTERVAL_MS = 400;
const BURST_RED: DotColor = [244, 92, 111];
type Burst = { x: number; y: number; at: number; shape: 'heart' | 'flower' };
const burstCount = (burst: Burst) => burst.shape === 'heart' ? 6 : 4;
const burstDuration = (burst: Burst) => (burstCount(burst) - 1) * BURST_INTERVAL_MS + BURST_SHAPE_MS;

// A heart polygon is sampled into the same radial mask as the other dot shapes.
// Contours are cached and reused; flowers have offset layers of uneven petals.
const burstContours = new Map<string, Float32Array>();
function burstContour(shape: 'heart' | 'flower', variant = 0) {
  const key = shape === 'heart' ? shape : `${shape}:${variant}`;
  const cached = burstContours.get(key);
  if (cached) return cached;
  const points = shape === 'heart' ? Array.from({ length: 128 }, (_, i) => {
    const t = i / 128 * TAU;
    return { x: 16 * Math.sin(t) ** 3 / 17,
      y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 };
  }) : [];
  const contour = Float32Array.from({ length: CONTOUR_SAMPLES }, (_, i) => {
    const angle = i / CONTOUR_SAMPLES * TAU;
    if (shape === 'flower') {
      const turn = angle - variant * .47;
      return .76 + .105 * Math.sin(3 * turn + .6)
        + .065 * Math.sin(7 * turn - variant * .31)
        + .035 * Math.cos(11 * turn + 1.1);
    }
    const x = Math.cos(angle), y = Math.sin(angle);
    let radius = 0;
    for (let j = 0; j < points.length; j++) {
      const a = points[j], b = points[(j + 1) % points.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const cross = x * dy - y * dx;
      if (Math.abs(cross) < 1e-8) continue;
      const distance = (a.x * dy - a.y * dx) / cross;
      const along = (a.x * y - a.y * x) / cross;
      if (distance >= 0 && along >= 0 && along <= 1) radius = Math.max(radius, distance);
    }
    return Math.min(1, radius);
  });
  burstContours.set(key, contour);
  return contour;
}

const ACCENT_SHAPES: readonly DotShape[] = ['triangle', 'square', 'circle', 'organic'];
function shapeForClick(index: number): DotShape {
  return ACCENT_SHAPES[(index - 1) % ACCENT_SHAPES.length];
}

// Rounded geometry with a gentle, stable irregularity, cached once per click.
function createContour(shape: DotShape, clickIndex: number) {
  const phase = clickIndex * .73;
  return Float32Array.from({ length: CONTOUR_SAMPLES }, (_, index) => {
    const angle = index / CONTOUR_SAMPLES * TAU;
    if (shape === 'organic') {
      return (1 + .18 * Math.sin(angle * 2 + phase)
        + .12 * Math.cos(angle * 3 - phase * .7)
        + .08 * Math.sin(angle * 5 + phase * 1.3)) / 1.38;
    }
    const wobble = .94 + .04 * Math.sin(angle * 2 + phase) + .02 * Math.sin(angle * 3 - phase);
    if (shape === 'circle') return wobble;
    const sides = shape === 'triangle' ? 3 : 4;
    const sector = TAU / sides;
    const normal = shape === 'triangle' ? Math.PI / 2 : 0;
    const offset = ((angle - normal + sector / 2) % sector + sector) % sector - sector / 2;
    return (.14 + .86 * Math.cos(Math.PI / sides) / Math.cos(offset)) * wobble;
  });
}

/** Each press launches an independent outward wave; storage and spread stay bounded. */
export function createDitherInteraction() {
  let pulses: DotPulse[] = [];
  let recent: number[] = [];
  let nextGreen = true;
  let lastPress = -Infinity;
  let shapeIndex = 0;
  let burst: Burst | undefined;
  let nextBurst: Burst['shape'] = 'heart';
  let burstClicks: number[] = [];

  return {
    press(x: number, y: number, time: number, palette: DotPalette) {
      if (time - lastPress > QUIET_MS) { recent = []; burstClicks = []; }
      lastPress = time;
      recent = [...recent.filter(at => time - at <= CLICK_WINDOW_MS), time].slice(-12);
      const buildup = recent.length - 1;
      const shape = shapeForClick(++shapeIndex);
      pulses = [...pulses.filter(pulse => time - pulse.at < ACCENT_MS).slice(-(MAX_PULSES - 1)), {
        x, y, at: time,
        color: nextGreen ? palette.green : palette.yellow,
        strength: .32 + buildup * .025,
        radius: 112 + buildup * 6,
        shape,
        contour: createContour(shape, shapeIndex),
      }];
      nextGreen = !nextGreen;
      if (burst && time - burst.at >= burstDuration(burst)) burst = undefined;
      if (!burst) {
        burstClicks = [...burstClicks.filter(at => time - at <= CLICK_WINDOW_MS), time];
        if (burstClicks.length >= 6) {
          burst = { x, y, at: time, shape: nextBurst };
          nextBurst = nextBurst === 'heart' ? 'flower' : 'heart';
          burstClicks = [];
        }
      }
    },
    sample(time: number): DotLight[] {
      pulses = pulses.filter(pulse => time - pulse.at < ACCENT_MS);
      if (burst && time - burst.at >= burstDuration(burst)) burst = undefined;
      const accents: DotLight[] = [];
      if (burst) {
        for (let i = 0; i < burstCount(burst); i++) {
          const elapsed = time - burst.at - i * BURST_INTERVAL_MS;
          if (elapsed < 0 || elapsed >= BURST_SHAPE_MS) continue;
          const age = elapsed / BURST_SHAPE_MS;
          accents.push({
            x: burst.x, y: burst.y,
            color: BURST_RED, shape: burst.shape, contour: burstContour(burst.shape, i),
            petalContours: burst.shape === 'flower'
              ? [burstContour('flower', i + 4), burstContour('flower', i + 8)] : undefined,
            radius: 168 * age, width: 6,
            opacity: .95 * (1 - age),
          });
        }
      }
      return [...accents, ...pulses.slice(-(MAX_PULSES - accents.length)).map(pulse => {
        const age = (time - pulse.at) / ACCENT_MS;
        return {
          x: pulse.x, y: pulse.y, color: pulse.color,
          radius: Math.min(MAX_RADIUS - 24, pulse.radius) * age,
          width: 18 + age * 6,
          contour: pulse.contour,
          shape: pulse.shape,
          opacity: pulse.strength * (1 - age),
        };
      })];
    },
    clear() {
      pulses = [];
      recent = [];
      lastPress = -Infinity;
      nextGreen = true;
      burst = undefined;
      burstClicks = [];
      nextBurst = 'heart';
    },
  };
}

function wave(distance: number, crest: number, width: number) {
  const falloff = Math.max(0, 1 - Math.abs(distance - crest) / width);
  return falloff * falloff * (3 - 2 * falloff);
}

/** A textured patch with three rolling fronts and a soft wash between them. */
export function dotLightOpacity(light: DotLight, x: number, y: number) {
  const dx = x - light.x, dy = y - light.y;
  const distanceSquared = dx * dx + dy * dy;
  const outer = light.radius + light.width;
  if (distanceSquared >= outer * outer) return 0;
  const angle = (Math.atan2(dy, dx) + TAU) % TAU / TAU * CONTOUR_SAMPLES;
  const index = Math.floor(angle);
  const fraction = angle - index;
  const shape = light.contour[index] * (1 - fraction)
    + light.contour[(index + 1) % CONTOUR_SAMPLES] * fraction;
  const distance = Math.sqrt(distanceSquared);
  const radius = light.radius * shape;
  if (light.shape === 'heart' || light.shape === 'flower') {
    const fill = Math.max(0, Math.min(1, (radius + light.width - distance) / (2 * light.width)));
    if (light.petalContours) {
      let coverage = Math.max(.18 * fill, .9 * wave(distance, radius, light.width * 1.2));
      for (let layer = 0; layer < light.petalContours.length; layer++) {
        const contour = light.petalContours[layer];
        const petal = contour[index] * (1 - fraction) + contour[(index + 1) % CONTOUR_SAMPLES] * fraction;
        const reach = light.radius * petal * (layer === 0 ? .66 : .34);
        coverage = Math.max(coverage, (layer === 0 ? .75 : .6) * wave(distance, reach, light.width));
      }
      return light.opacity * coverage;
    }
    return light.opacity * fill * fill * (3 - 2 * fill);
  }
  const wash = .2 * Math.max(0, 1 - distance / Math.max(1, radius));
  const coverage = Math.max(
    wash,
    wave(distance, radius, light.width),
    .65 * wave(distance, radius * .6, light.width * .7),
    .4 * wave(distance, radius * .25, light.width * .7),
  );
  return light.opacity * coverage;
}
