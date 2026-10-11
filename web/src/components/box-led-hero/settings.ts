// Ported from vgpu's "Triangle LED Hero" example (triangle-led-front). The shape is an
// axis-aligned box; the tunable values come from the look (look.ts / look.json).
import { hexToLinear, type HeroLook } from './look';

export interface RenderSize {
  width: number;
  height: number;
}

export const EDGE_COUNT = 4;
/** The triangle ran 72 LEDs; line speeds and lengths were tuned in LED units against that. */
export const REFERENCE_LED_COUNT = 72;

// The triangle's height was the yardstick for LED thickness, the glow dither band and the
// hover reach. `scaleRef` reproduces that height so those keep their original size.
const SCALE_REF_RATIO = (180 / 630) * 0.8;
const SCALE_REF_MAX_CANVAS = 560;
export const HERO_CANVAS_MAX_CSS = 720;
const MIN_SIM_HEIGHT = 360;
const LED_RADIUS_TO_SCALE_REF = 0.0236;
const LED_NORMAL_HALF_THICKNESS_TO_RADIUS = 2;
const LED_TANGENT_GAP_PX = 1;
const LED_CORNER_TRIM_EPSILON_PX = 1;
const LED_MESH_INSET_PX = 5;
const MIN_LED_COUNT = 8;

export const LED_SDF_CROP_EXPANSION_PX = 2;
export const LED_EMITTER_MESH_EXPANSION_PX = 1;
export const NOISE_ROTATION_START_SECONDS = 10;
export const BRIGHTNESS_MIN_HOVER_SMOOTHING = 0.2;

export const HERO_STATE_MODES = {
  edge: 'edge',
  lines: 'lines',
  steady: 'steady',
} as const;
export type HeroStateMode =
  (typeof HERO_STATE_MODES)[keyof typeof HERO_STATE_MODES];

export interface HeroStateSettings {
  mode: HeroStateMode;
  transitionDuration: number;
  edgeIndex: number;
  edgeHighlightBrightness: number;
}

// Edges run left, bottom, right, top (see BoxGeometry.corners).
const EDGE_BY_MOTION = { left: 0, bottom: 1, right: 2, top: 3 } as const;

export function heroStateFor(look: HeroLook): HeroStateSettings {
  const { mode } = look.motion;
  const base = {
    transitionDuration: 0.25,
    edgeIndex: 0,
    edgeHighlightBrightness: look.leds.litBrightness,
  };
  if (mode === 'lines') return { ...base, mode: HERO_STATE_MODES.lines };
  if (mode === 'steady') return { ...base, mode: HERO_STATE_MODES.steady };
  return { ...base, mode: HERO_STATE_MODES.edge, edgeIndex: EDGE_BY_MOTION[mode] };
}

export interface BrushSettings {
  glowEnabled?: boolean;
  glowRadius?: number;
  glowStrength?: number;
  glowSmoothing?: number;
  glowFacingEnabled?: boolean;
  glowFacingFullDeg?: number;
  glowFacingZeroDeg?: number;
  linesFadeDistance?: number;
}

export interface BrushState extends BrushSettings {
  x: number;
  y: number;
  active: boolean;
  inside?: boolean;
  isMouse?: boolean;
}

export function brushSettings(look: HeroLook): BrushSettings {
  const { hover } = look;
  return {
    glowEnabled: hover.enabled,
    glowRadius: hover.glowRadius,
    glowStrength: hover.glowStrength,
    glowSmoothing: 0.23,
    glowFacingEnabled: true,
    glowFacingFullDeg: 90,
    glowFacingZeroDeg: 100,
    linesFadeDistance: hover.enabled ? hover.fadeLinesNear : 0,
  };
}

export interface SceneTunables {
  ledIntensity: number;
  brightnessMin: number;
  brightnessMinDark: number;
  brightnessMax: number;
}

export function sceneTunables(look: HeroLook): SceneTunables {
  return {
    ledIntensity: look.leds.intensity,
    brightnessMin: look.leds.idleBrightness,
    brightnessMinDark: look.leds.idleBrightness,
    brightnessMax: look.leds.peakBrightness,
  };
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface HoverRgbTintSettings {
  enabled: boolean;
  amount: number;
  radius: number;
  power: number;
  responseSmoothing: number;
  /** One colour per edge, in edge order (left, bottom, right, top). */
  edgeColorsLinear: readonly [Rgb, Rgb, Rgb, Rgb];
  edgeOverlap: number;
}

export function rgbTintSettings(look: HeroLook): HoverRgbTintSettings {
  const { colours } = look;
  return {
    enabled: colours.mode !== 'off',
    amount: colours.strength,
    radius: colours.blend,
    power: 3,
    responseSmoothing: 0.2,
    edgeColorsLinear: [
      hexToLinear(colours.left),
      hexToLinear(colours.bottom),
      hexToLinear(colours.right),
      hexToLinear(colours.top),
    ],
    edgeOverlap: 1,
  };
}

const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

export function luminance(c: Rgb) {
  return LUMA_R * c.r + LUMA_G * c.g + LUMA_B * c.b;
}

/** A colour scaled to unit luminance, so picking a hue doesn't change how bright LEDs read. */
export function unitLuminance(c: Rgb): Rgb {
  const l = luminance(c);
  const scale = l <= 1e-4 ? 1 : 1 / l;
  return { r: c.r * scale, g: c.g * scale, b: c.b * scale };
}

export function simulationFloorFactor(cssHeight: number) {
  return Math.max(1, MIN_SIM_HEIGHT / Math.max(1, cssHeight));
}

export interface Point {
  x: number;
  y: number;
}

interface LedPosition extends Point {
  angle?: number;
}

export interface BoxGeometry {
  center: Point;
  /** top-left, bottom-left, bottom-right, top-right. Edge i runs corners[i] → corners[i + 1],
   *  the same winding the triangle used (top → left → right). */
  corners: readonly [Point, Point, Point, Point];
  halfWidth: number;
  halfHeight: number;
  scaleRef: number;
}

export interface BoxEdge {
  start: number;
  count: number;
  angle: number;
  tangentHalfLength: number;
}

interface BoxLedShape {
  normalHalfThickness: number;
  cornerTrim: number;
}

export interface BoxLayout {
  center: Point;
  positions: LedPosition[];
  edges: BoxEdge[];
  geometry: BoxGeometry;
  ledShape: BoxLedShape;
}

/** The box inside a canvas: as wide as the side margins allow, as tall as the space left
 *  between the title above and the buttons below, each capped by its maximum. */
export function canonicalBoxGeometry(size: RenderSize, box: HeroLook['box']): BoxGeometry {
  const width = Math.max(1, Math.min(size.width - box.sideMargin * 2, box.maxWidth));
  const available = Math.max(1, size.height - box.spaceAbove - box.spaceBelow);
  const height = Math.max(1, Math.min(available, box.maxHeight));
  return boxAround(
    { x: size.width * 0.5, y: box.spaceAbove + available * 0.5 },
    width * 0.5,
    height * 0.5,
    SCALE_REF_RATIO * Math.min(size.height, SCALE_REF_MAX_CANVAS),
  );
}

/** The same box as CSS lengths inside the hero section, for the fallback outline and for
 *  laying out the page around it. The hero is never shorter than MIN_SIM_HEIGHT, so css px
 *  and simulation px agree. */
export function boxCss(box: HeroLook['box']) {
  const available = `(100% - ${box.spaceAbove + box.spaceBelow}px)`;
  const height = `min(${available}, ${box.maxHeight}px)`;
  const top = `calc(${box.spaceAbove}px + (${available} - ${height}) / 2)`;
  return {
    top,
    height,
    width: `min(100% - ${box.sideMargin * 2}px, ${box.maxWidth}px)`,
  };
}

function boxAround(
  center: Point,
  halfWidth: number,
  halfHeight: number,
  scaleRef: number,
): BoxGeometry {
  const left = center.x - halfWidth;
  const right = center.x + halfWidth;
  const top = center.y - halfHeight;
  const bottom = center.y + halfHeight;
  return {
    center,
    corners: [
      { x: left, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
      { x: right, y: top },
    ],
    halfWidth,
    halfHeight,
    scaleRef,
  };
}

function boxLedNormalHalfThickness(geometry: BoxGeometry) {
  return (
    geometry.scaleRef *
    LED_RADIUS_TO_SCALE_REF *
    LED_NORMAL_HALF_THICKNESS_TO_RADIUS
  );
}

// At a 90° corner two LED strips of half thickness h overlap for h along each edge
// (the triangle's 60° corners needed h·√3).
function boxLedCornerTrim(geometry: BoxGeometry) {
  const rawTrim =
    boxLedNormalHalfThickness(geometry) + LED_CORNER_TRIM_EPSILON_PX;
  const shortSide = Math.min(geometry.halfWidth, geometry.halfHeight) * 2;
  return Math.min(rawTrim, shortSide * 0.45);
}

function ledMeshInset(base: BoxGeometry) {
  const refScale = HERO_CANVAS_MAX_CSS * SCALE_REF_RATIO;
  const inset =
    (LED_MESH_INSET_PX * Math.min(base.scaleRef, refScale)) / refScale;
  return Math.min(base.halfWidth, base.halfHeight) > inset ? inset : 0;
}

export function ledMeshGeometry(size: RenderSize, box: HeroLook['box']) {
  const base = canonicalBoxGeometry(size, box);
  const inset = ledMeshInset(base);
  return boxAround(
    base.center,
    base.halfWidth - inset,
    base.halfHeight - inset,
    base.scaleRef,
  );
}

/** LEDs laid edge by edge (left, bottom, right, top), as many as `spacing` allows, split
 *  across the edges by length so the spacing stays even at any aspect. */
export function boxEdgeLedLayout(size: RenderSize, look: HeroLook): BoxLayout {
  const geometry = ledMeshGeometry(size, look.box);
  const { corners, center } = geometry;
  const cornerTrim = boxLedCornerTrim(geometry);
  const ledShape = {
    normalHalfThickness: boxLedNormalHalfThickness(geometry),
    cornerTrim,
  };
  const trimmedWidth = Math.max(0, geometry.halfWidth * 2 - cornerTrim * 2);
  const trimmedHeight = Math.max(0, geometry.halfHeight * 2 - cornerTrim * 2);
  const half = Math.max(
    MIN_LED_COUNT / 2,
    Math.round((trimmedWidth + trimmedHeight) / Math.max(look.leds.spacing, 0.5)),
  );
  const across = Math.min(
    half - 1,
    Math.max(
      1,
      Math.round((half * trimmedWidth) / Math.max(trimmedWidth + trimmedHeight, 1)),
    ),
  );
  const down = half - across;
  const counts = [down, across, down, across];

  const positions: LedPosition[] = [];
  const edges: BoxEdge[] = [];
  for (let e = 0; e < EDGE_COUNT; e++) {
    const a = corners[e];
    const b = corners[(e + 1) % EDGE_COUNT];
    const count = counts[e];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLength = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const centerSpacing = Math.max(0, edgeLength - cornerTrim * 2) / count;
    edges.push({
      start: positions.length,
      count,
      angle,
      tangentHalfLength: Math.max(
        0,
        centerSpacing * 0.5 - LED_TANGENT_GAP_PX * 0.5,
      ),
    });
    const trimT = edgeLength > 0 ? cornerTrim / edgeLength : 0;
    const slotT = edgeLength > 0 ? centerSpacing / edgeLength : 0;
    for (let i = 0; i < count; i++) {
      const t = trimT + (i + 0.5) * slotT;
      positions.push({ x: a.x + dx * t, y: a.y + dy * t, angle });
    }
  }
  return { center, positions, edges, geometry, ledShape };
}

/** Signed distance to an axis-aligned box: negative inside. */
export function boxSdf(
  px: number,
  py: number,
  box: Pick<BoxGeometry, 'center' | 'halfWidth' | 'halfHeight'>,
) {
  const qx = Math.abs(px - box.center.x) - box.halfWidth;
  const qy = Math.abs(py - box.center.y) - box.halfHeight;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0);
}
