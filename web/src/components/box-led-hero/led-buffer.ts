import { hexToLinear, type HeroLook, type LineStart } from './look';
import {
  EDGE_COUNT,
  HERO_STATE_MODES,
  NOISE_ROTATION_START_SECONDS,
  REFERENCE_LED_COUNT,
  boxEdgeLedLayout,
  boxSdf,
  luminance,
  unitLuminance,
  type BoxGeometry,
  type BrushState,
  type HeroStateMode,
  type HeroStateSettings,
  type HoverRgbTintSettings,
  type Point,
  type RenderSize,
  type Rgb,
  type SceneTunables,
} from './settings';

const LED_FLOATS = 8;
const COLOR_OFFSET = 4;
const MAX_FRAME_DELTA = 0.1;
const INACTIVE_EDGE_BRIGHTNESS_FACTOR = 0.125;

// Line positions, speeds and sizes are in the triangle's LED units (72 LEDs). Scaling them
// by count / 72 keeps its rhythm — same share of the perimeter, same loop time — at any
// LED count.
const LINE_CENTER_START = 6;
const LINE_VELOCITIES = [-3.302, -2.355, -1.636] as const;
const LINE_SIZE_MIN = 24;
const LINE_SIZE_MAX = 24 * 1.7;
const LINE_SIZE_FREQ = [0.41, 0.31, 0.23] as const;
const LINE_SIZE_PHASE = [0, 2.1, 4.2] as const;
const LINE_FADE_FREQ = [0.52, 0.38, 0.28] as const;
const LINE_FADE_PHASE = [Math.PI / 2, 0.4, -0.6] as const;
const HOVER_FADE_SECONDS = 0.3;
/** Width of the opening sweep's soft front, as a share of the half perimeter. */
const OPENING_SOFTNESS = 0.18;
const HOVER_HYSTERESIS = 1.2;

export interface LedGeometryState {
  count: number;
  data: Float32Array;
  currentState: Float32Array;
  targetState: Float32Array;
  deployingState: Float32Array;
  normals: Float32Array;
  /** Each LED's resting colour (linear RGB), refilled every frame from the gradient. */
  colors: Float32Array;
  box: BoxGeometry;
  edges: readonly { start: number; count: number }[];
  deployEdgeCenters: readonly Point[];
  lastMode: HeroStateMode | undefined;
  lastEdgeIndex: number | undefined;
  transitionStart: number;
  transitionDuration: number;
  transitionActive: boolean;
  animationClock: number;
  lastFrameTime: number | undefined;
  lineCenters: Float32Array;
  /** The opening settings it last played with; a change (or '' from replayOpening) replays it. */
  openingKey: string;
  openingStart: number;
  glowState: Float32Array;
  glowDecaying: boolean;
  hoverTransition: number;
  hoverActive: boolean;
}

export interface HoverDeployAnimationState {
  factor: number;
  tint: Pick<
    HoverRgbTintSettings,
    'enabled' | 'amount' | 'radius' | 'power' | 'edgeColorsLinear' | 'edgeOverlap'
  >;
}

export function buildLedGeometry(
  size: RenderSize,
  look: HeroLook,
  previous?: LedGeometryState,
): LedGeometryState {
  const layout = boxEdgeLedLayout(size, look);
  const count = layout.positions.length;
  // A resize or a spacing change can change the count: keep the lines where they were
  // along the perimeter and let the cursor glow restart.
  const sameCount = previous?.count === count;
  const lineCenters = previous
    ? previous.lineCenters.map((c) => (c * count) / previous.count)
    : lineCentersStart(count, layout.edges, look.motion.startAt);
  const data = new Float32Array(layout.positions.length * LED_FLOATS);
  const currentState = new Float32Array(data.length);
  const targetState = new Float32Array(data.length);
  const deployingState = new Float32Array(data.length);
  const normals = new Float32Array(layout.positions.length * 2);
  for (const [i, p] of layout.positions.entries()) {
    const base = i * LED_FLOATS;
    const x = p.x;
    const y = p.y;
    const angle = p.angle ?? 0;
    data[base] = x;
    data[base + 1] = y;
    data[base + 2] = 0;
    data[base + 3] = angle;
    data[base + COLOR_OFFSET] = 1;
    data[base + COLOR_OFFSET + 1] = 1;
    data[base + COLOR_OFFSET + 2] = 1;
    data[base + COLOR_OFFSET + 3] = 0;
    const rx = x - layout.center.x;
    const ry = y - layout.center.y;
    let nx = -Math.sin(angle);
    let ny = Math.cos(angle);
    if (nx * rx + ny * ry < 0) {
      nx = -nx;
      ny = -ny;
    }
    normals[i * 2] = nx;
    normals[i * 2 + 1] = ny;
  }
  currentState.set(data);
  targetState.set(data);
  deployingState.set(data);
  const { corners } = layout.geometry;
  return {
    count,
    data,
    currentState,
    targetState,
    deployingState,
    normals,
    colors: new Float32Array(count * 3),
    box: layout.geometry,
    edges: layout.edges,
    deployEdgeCenters: corners.map((corner, i) =>
      midpoint(corner, corners[(i + 1) % EDGE_COUNT]),
    ),
    lastMode: previous?.lastMode,
    lastEdgeIndex: previous?.lastEdgeIndex,
    transitionStart: 0,
    transitionDuration: 0,
    transitionActive: false,
    animationClock: previous?.animationClock ?? 0,
    lastFrameTime: previous?.lastFrameTime,
    lineCenters,
    openingKey: previous?.openingKey ?? '',
    openingStart: previous?.openingStart ?? 0,
    glowState: sameCount ? previous.glowState : new Float32Array(count),
    glowDecaying: sameCount ? previous.glowDecaying : false,
    hoverTransition: previous?.hoverTransition ?? 0,
    hoverActive: previous?.hoverActive ?? false,
  };
}

export function computeLeds(
  leds: LedGeometryState,
  time: number,
  tunables: SceneTunables,
  settings: HeroStateSettings,
  look: HeroLook,
  hoverDeploy?: HoverDeployAnimationState,
  brush?: BrushState,
) {
  const count = leds.count;
  fillGradient(leds, look, time);
  const color = leds.colors;
  const firstFrame = leds.lastFrameTime === undefined;
  const frameDelta =
    leds.lastFrameTime === undefined
      ? 0
      : Math.max(0, Math.min(time - leds.lastFrameTime, MAX_FRAME_DELTA));
  leds.lastFrameTime = time;
  const clickBoost =
    1 +
    (look.motion.clickSpeedBoost - 1) *
      Math.sin(clamp01(hoverDeploy?.factor ?? 0) * Math.PI);
  if (firstFrame) leds.animationClock = NOISE_ROTATION_START_SECONDS;
  // The opening replays whenever its settings or the start point change, so the panel
  // shows each tweak straight away.
  const key = openingKey(look);
  const replay = key !== leds.openingKey;
  if (replay) {
    leds.openingKey = key;
    leds.openingStart = time;
    leds.animationClock = NOISE_ROTATION_START_SECONDS;
  }
  const opening = openingPhase(leds, look, time);
  // The lines wait at their start point until the opening ring begins to settle.
  const boostedDelta = opening?.holdLines
    ? 0
    : frameDelta * clickBoost * look.motion.speed;
  leds.animationClock += boostedDelta;
  const animTime = leds.animationClock;

  const edgeIndex = sanitizeEdgeIndex(settings.edgeIndex);
  const edgeChanged =
    settings.mode === HERO_STATE_MODES.edge &&
    leds.lastEdgeIndex !== undefined &&
    edgeIndex !== leds.lastEdgeIndex;
  const modeEntry =
    leds.lastMode === undefined || settings.mode !== leds.lastMode;
  if (leds.lastMode === undefined) {
    leds.lastMode = settings.mode;
    leds.lastEdgeIndex = edgeIndex;
    leds.transitionActive = false;
  } else if (settings.mode !== leds.lastMode || edgeChanged) {
    leds.currentState.set(leds.data);
    leds.transitionStart = time;
    leds.transitionDuration = Math.max(0, settings.transitionDuration);
    leds.transitionActive = leds.transitionDuration > 0;
    leds.lastMode = settings.mode;
    leds.lastEdgeIndex = edgeIndex;
  }
  if ((modeEntry || replay) && settings.mode === HERO_STATE_MODES.lines) {
    leds.lineCenters.set(lineCentersStart(count, leds.edges, look.motion.startAt));
  }

  if (settings.mode === HERO_STATE_MODES.edge) {
    updateEdge(
      leds.targetState,
      count,
      leds.edges[edgeIndex],
      tunables.brightnessMin * INACTIVE_EDGE_BRIGHTNESS_FACTOR,
      settings.edgeHighlightBrightness,
      color,
    );
  } else if (settings.mode === HERO_STATE_MODES.steady) {
    updateEdge(
      leds.targetState,
      count,
      { start: 0, count },
      0,
      settings.edgeHighlightBrightness,
      color,
    );
  } else {
    updateLines(leds, leds.targetState, animTime, boostedDelta, look.motion.lineLength, color);
  }

  // Where the cursor effect lives: inside the box, in a band around it, or both. While
  // the cursor is there the lines dim and the LEDs nearest it light up.
  const zone = look.hover.zone;
  const mouseOver = brush?.active === true && brush.isMouse === true;
  const inside = brush?.inside === true;
  let following = false;
  if (mouseOver && inside) {
    leds.hoverActive = false;
    following = zone !== 'outside';
  } else if (mouseOver && zone !== 'inside') {
    const enter = (brush.linesFadeDistance ?? 0) * leds.box.scaleRef;
    const distance = boxSdf(brush.x, brush.y, leds.box);
    if (!leds.hoverActive && distance < enter) leds.hoverActive = true;
    else if (leds.hoverActive && distance > enter * HOVER_HYSTERESIS)
      leds.hoverActive = false;
    following = leds.hoverActive;
  } else {
    leds.hoverActive = false;
  }

  const linesHoverEnabled =
    settings.mode === HERO_STATE_MODES.lines && brush?.glowEnabled === true;
  let hoverTransition = 0;
  if (linesHoverEnabled) {
    const hoverTarget = following ? 1 : 0;
    if (leds.hoverTransition > 0.0001 || hoverTarget > 0) {
      const alpha =
        HOVER_FADE_SECONDS > 0
          ? 1 - Math.exp(-frameDelta / HOVER_FADE_SECONDS)
          : 1;
      leds.hoverTransition += (hoverTarget - leds.hoverTransition) * alpha;
    }
    hoverTransition = clamp01(leds.hoverTransition);
    if (hoverTransition > 0.0001) {
      const linesFade = 1 - hoverTransition * clamp01(look.hover.dimLines);
      for (let i = 0; i < count; i++) {
        leds.targetState[i * LED_FLOATS + 2] *= linesFade;
      }
    }
  } else if (leds.hoverTransition !== 0 || leds.hoverActive) {
    leds.hoverTransition = 0;
    leds.hoverActive = false;
  }

  if (leds.transitionActive) {
    const progress = clamp01(
      (time - leds.transitionStart) / leds.transitionDuration,
    );
    lerpLedState(
      leds.data,
      leds.currentState,
      leds.targetState,
      easeInQuad(progress),
    );
    if (progress >= 1) leds.transitionActive = false;
  } else {
    leds.data.set(leds.targetState);
  }

  // The opening: everything dark, then a ring of light spreads both ways round the box
  // from the start point, holds, and settles into the normal pattern.
  if (opening) {
    const origin = startIndex(count, leds.edges, look.motion.startAt);
    const halfway = count / 2;
    const front = opening.front * (1 + OPENING_SOFTNESS);
    const lit = clamp01(look.motion.introBrightness);
    for (let i = 0; i < count; i++) {
      const along = Math.abs(signedWrappedDistance(i, origin, count)) / halfway;
      const revealed = 1 - smoothstep(front - OPENING_SOFTNESS, front, along);
      const base = i * LED_FLOATS + 2;
      leds.data[base] = mix(leds.data[base], revealed * lit, opening.weight);
    }
  }

  // The click toggle always drives the speed burst above; it recolours only when the
  // four edge colours are on.
  const deployFactor = clamp01(hoverDeploy?.factor ?? 0);
  if (deployFactor > 0 && hoverDeploy?.tint.enabled) {
    updateDeployingRgb(leds, leds.deployingState, color, hoverDeploy?.tint);
    lerpLedState(leds.data, leds.data, leds.deployingState, deployFactor);
  }

  const hoverGate = linesHoverEnabled ? hoverTransition : 1;
  const glowStrength = brush?.glowStrength ?? 0;
  const glowRadius = brush?.glowRadius ?? 0;
  const glowOn =
    mouseOver &&
    brush.glowEnabled === true &&
    (inside ? zone !== 'outside' : zone !== 'inside') &&
    glowStrength > 0 &&
    glowRadius > 0;
  // From inside the box the LEDs that face the cursor are the ones facing inward.
  const facingSign = inside ? -1 : 1;
  if (glowOn || leds.glowDecaying) {
    const smoothing = brush?.glowSmoothing ?? 0;
    const alpha = smoothing > 0 ? 1 - Math.exp(-frameDelta / smoothing) : 1;
    const px = brush?.x ?? 0;
    const py = brush?.y ?? 0;
    const facingOn = brush?.glowFacingEnabled === true;
    const facingCosFull = Math.cos(
      ((brush?.glowFacingFullDeg ?? 90) * Math.PI) / 180,
    );
    const facingCosZero = Math.cos(
      ((brush?.glowFacingZeroDeg ?? 100) * Math.PI) / 180,
    );
    const facingDenom = facingCosFull - facingCosZero;
    let anyActive = false;
    for (let i = 0; i < count; i++) {
      const base = i * LED_FLOATS;
      let target = 0;
      if (glowOn) {
        const dx = (leds.data[base] ?? 0) - px;
        const dy = (leds.data[base + 1] ?? 0) - py;
        const distance = Math.hypot(dx, dy);
        target = glowStrength * (1 - smoothstep(0, glowRadius, distance));
        if (facingOn && target > 0 && distance > 1e-4) {
          const cos =
            facingSign *
            ((leds.normals[i * 2] ?? 0) * (-dx / distance) +
              (leds.normals[i * 2 + 1] ?? 0) * (-dy / distance));
          const facing =
            facingDenom > 1e-6
              ? clamp01((cos - facingCosZero) / facingDenom)
              : cos >= facingCosFull
                ? 1
                : 0;
          target *= facing;
        }
      }
      const eased =
        (leds.glowState[i] ?? 0) +
        (target - (leds.glowState[i] ?? 0)) * alpha;
      leds.glowState[i] = eased;
      if (eased > 0.0001) {
        anyActive = true;
        const lift = eased * hoverGate;
        if (lift > 0.0001)
          leds.data[base + 2] = mix(leds.data[base + 2] ?? 0, 1, lift);
      }
    }
    leds.glowDecaying = glowOn || anyActive;
  }
}

// A linear gradient across the box, CSS-style: 0° runs bottom → top, 90° left → right.
// Mixed in linear light, then lifted toward unit luminance by `evenBrightness` (1 = every
// LED equally bright; 0 = the brighter end at full and the other end as dark as its colour).
function fillGradient(leds: LedGeometryState, look: HeroLook, time: number) {
  const from = hexToLinear(look.leds.colorFrom);
  const to = hexToLinear(look.leds.colorTo);
  const even = clamp01(look.leds.evenBrightness);
  const uniformScale = 1 / Math.max(luminance(from), luminance(to), 1e-4);
  const angle = ((look.leds.gradientAngle + look.leds.gradientSpin * time) * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const { center, halfWidth, halfHeight } = leds.box;
  const reach = Math.max(Math.abs(halfWidth * dx) + Math.abs(halfHeight * dy), 1e-4);
  for (let i = 0; i < leds.count; i++) {
    const base = i * LED_FLOATS;
    const along =
      ((leds.data[base] - center.x) * dx + (leds.data[base + 1] - center.y) * dy) / reach;
    const t = clamp01(0.5 + 0.5 * along);
    const r = mix(from.r, to.r, t);
    const g = mix(from.g, to.g, t);
    const b = mix(from.b, to.b, t);
    const scale = mix(uniformScale, 1 / Math.max(luminance({ r, g, b }), 1e-4), even);
    leds.colors[i * 3] = r * scale;
    leds.colors[i * 3 + 1] = g * scale;
    leds.colors[i * 3 + 2] = b * scale;
  }
}

function openingKey(look: HeroLook) {
  const { startAt, introSweep, introHold, introSettle, introBrightness } = look.motion;
  return [startAt, introSweep, introHold, introSettle, introBrightness].join();
}

/** Where the opening is: `front` 0→1 is how far the sweep has spread, `weight` 1→0 is how
 *  much it still overrides the normal pattern. Undefined once it's over (or switched off). */
function openingPhase(leds: LedGeometryState, look: HeroLook, time: number) {
  const { introSweep: sweep, introHold: hold, introSettle: settle } = look.motion;
  const t = time - leds.openingStart;
  if (sweep <= 0 || t >= sweep + hold + settle) return undefined;
  const p = clamp01(t / sweep);
  return {
    front: p * p * (3 - 2 * p),
    weight: t < sweep + hold ? 1 : 1 - clamp01((t - sweep - hold) / Math.max(settle, 1e-3)),
    holdLines: t < sweep + hold,
  };
}

/** Releases the opening to play again on the next frame. */
export function replayOpening(leds: LedGeometryState) {
  leds.openingKey = '';
}

// Where the lines and the opening start, as an LED index. Edges run left, bottom, right,
// top; the left edge starts at the top-left corner. 'top-left' is the triangle's original spot.
function startIndex(
  count: number,
  edges: readonly { start: number; count: number }[],
  startAt: LineStart,
) {
  const middle = (e: number) => edges[e].start + edges[e].count / 2;
  return startAt === 'left' ? middle(0)
    : startAt === 'bottom-left' ? edges[1].start
    : startAt === 'bottom' ? middle(1)
    : startAt === 'right' ? middle(2)
    : startAt === 'top' ? middle(3)
    : (LINE_CENTER_START * count) / REFERENCE_LED_COUNT;
}

function lineCentersStart(
  count: number,
  edges: readonly { start: number; count: number }[],
  startAt: LineStart,
) {
  const center = startIndex(count, edges, startAt);
  return Float32Array.from([center, center, center]);
}

function updateLines(
  leds: LedGeometryState,
  target: Float32Array,
  animTime: number,
  boostedDelta: number,
  lineLength: number,
  colors: Float32Array,
) {
  const count = leds.count;
  const scale = count / REFERENCE_LED_COUNT;
  const sizeMin = LINE_SIZE_MIN * scale * lineLength;
  const sizeMax = LINE_SIZE_MAX * scale * lineLength;
  const sizeMid = (sizeMin + sizeMax) / 2;
  const sizeAmp = (sizeMax - sizeMin) / 2;
  for (let k = 0; k < 3; k++) {
    leds.lineCenters[k] = wrapIndex(
      (leds.lineCenters[k] ?? 0) +
        (LINE_VELOCITIES[k] ?? 0) * scale * boostedDelta,
      count,
    );
  }
  const fadeTime = animTime - NOISE_ROTATION_START_SECONDS;
  const halfByBand: number[] = [];
  const plateauByBand: number[] = [];
  const fadeByBand: number[] = [];
  for (let k = 0; k < 3; k++) {
    const size =
      sizeMid +
      sizeAmp *
        Math.sin(
          fadeTime * (LINE_SIZE_FREQ[k] ?? 0) +
            (LINE_SIZE_PHASE[k] ?? 0),
        );
    const half = Math.max(1, size * 0.5);
    halfByBand[k] = half;
    plateauByBand[k] = half * 0.5;
    fadeByBand[k] =
      0.5 +
      0.5 *
        Math.sin(
          fadeTime * (LINE_FADE_FREQ[k] ?? 0) +
            (LINE_FADE_PHASE[k] ?? 0),
        );
  }
  for (let i = 0; i < count; i++) {
    let coverage = 0;
    for (let k = 0; k < 3; k++) {
      const distance = Math.abs(
        signedWrappedDistance(i, leds.lineCenters[k] ?? 0, count),
      );
      const half = halfByBand[k] ?? 1;
      const plateau = plateauByBand[k] ?? 0;
      let profile = 0;
      if (distance <= plateau) {
        profile = 1;
      } else {
        profile = clamp01(1 - (distance - plateau) / (half - plateau));
      }
      coverage = Math.max(coverage, profile * (fadeByBand[k] ?? 0));
    }
    writeLed(target, i, clamp01(coverage), colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
  }
}

function updateEdge(
  target: Float32Array,
  count: number,
  edge: { start: number; count: number },
  baseBrightness: number,
  highlightBrightness: number,
  colors: Float32Array,
) {
  const start = edge.start;
  const end = start + edge.count;
  const base = clamp01(baseBrightness);
  const highlight = clamp01(highlightBrightness);
  for (let i = 0; i < count; i++) {
    const brightness = i >= start && i < end ? highlight : base;
    writeLed(target, i, brightness, colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
  }
}

function updateDeployingRgb(
  leds: LedGeometryState,
  target: Float32Array,
  colors: Float32Array,
  tint: HoverDeployAnimationState['tint'] | undefined,
) {
  target.set(leds.data);
  for (let i = 0; i < leds.count; i++) {
    const baseColor = { r: colors[i * 3], g: colors[i * 3 + 1], b: colors[i * 3 + 2] };
    const color = edgeTintColor(leds, i, baseColor, tint);
    writeLedColor(target, i, color.r, color.g, color.b);
  }
}

// Each LED blends the four edge colours by its distance to each edge's midpoint.
function edgeTintColor(
  leds: LedGeometryState,
  i: number,
  baseColor: Rgb,
  tint: HoverDeployAnimationState['tint'] | undefined,
) {
  if (!tint) return baseColor;
  const amount = clamp01(tint.amount);
  const radius = Math.max(tint.radius, 1);
  const power = Math.max(tint.power, 0.001);
  const colors = tint.edgeColorsLinear;
  const base = i * LED_FLOATS;
  const x = leds.data[base] ?? 0;
  const y = leds.data[base + 1] ?? 0;
  const invOverlap = 1 / Math.max(tint.edgeOverlap, 0.01);
  let r = 0;
  let g = 0;
  let b = 0;
  let sum = 0;
  for (let e = 0; e < EDGE_COUNT; e++) {
    const center = leds.deployEdgeCenters[e];
    const color = colors[e];
    const w =
      edgeWeight(x, y, center.x, center.y, radius, power) ** invOverlap;
    r += color.r * w;
    g += color.g * w;
    b += color.b * w;
    sum += w;
  }
  sum = Math.max(sum, 0.0001);
  const tinted = unitLuminance({ r: r / sum, g: g / sum, b: b / sum });
  return {
    r: mix(baseColor.r, tinted.r, amount),
    g: mix(baseColor.g, tinted.g, amount),
    b: mix(baseColor.b, tinted.b, amount),
  };
}

function edgeWeight(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radius: number,
  power: number,
) {
  return (1 / (1 + Math.hypot(x - cx, y - cy) / radius)) ** power;
}

function midpoint(a: Point, b: Point) {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function lerpLedState(
  target: Float32Array,
  from: Float32Array,
  to: Float32Array,
  t: number,
) {
  for (let i = 0; i < target.length; i++) {
    const a = from[i] ?? 0;
    target[i] = a + ((to[i] ?? 0) - a) * t;
  }
}

function writeLed(
  target: Float32Array,
  i: number,
  brightness: number,
  r: number,
  g: number,
  b: number,
) {
  const base = i * LED_FLOATS;
  target[base + 2] = brightness;
  target[base + COLOR_OFFSET] = r;
  target[base + COLOR_OFFSET + 1] = g;
  target[base + COLOR_OFFSET + 2] = b;
}

function writeLedColor(
  target: Float32Array,
  i: number,
  r: number,
  g: number,
  b: number,
) {
  const base = i * LED_FLOATS;
  target[base + COLOR_OFFSET] = r;
  target[base + COLOR_OFFSET + 1] = g;
  target[base + COLOR_OFFSET + 2] = b;
}

function signedWrappedDistance(a: number, b: number, period: number) {
  return ((((a - b) % period) + period + period / 2) % period) - period / 2;
}

function wrapIndex(value: number, count: number) {
  return ((value % count) + count) % count;
}

function sanitizeEdgeIndex(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(EDGE_COUNT - 1, Math.round(value)));
}

function easeInQuad(t: number) {
  const x = clamp01(t);
  return x * x;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
