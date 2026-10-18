export type ArtMode = 'patterns' | 'flow';
export type ArtPalette = 'aurora' | 'ember' | 'glacier' | 'orchid' | 'pearl';
export type ArtPattern = 'orbit' | 'rays' | 'diamond' | 'waves' | 'weave' | 'contour' | 'grid' | 'arches' | 'bloom' | 'meridian';

export const ART_PATTERNS: { id: ArtPattern; name: string }[] = [
  { id: 'orbit', name: 'Orbit' },
  { id: 'rays', name: 'Rays' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'waves', name: 'Waves' },
  { id: 'weave', name: 'Weave' },
  { id: 'contour', name: 'Contour' },
  { id: 'grid', name: 'Grid' },
  { id: 'arches', name: 'Arches' },
  { id: 'bloom', name: 'Bloom' },
  { id: 'meridian', name: 'Meridian' },
];

export type ArtSettings = {
  seed: string;
  mode: ArtMode;
  palette: ArtPalette;
  tension: number;
  openness: number;
  density: number;
  pattern?: ArtPattern;
  dotted?: boolean;
};

export const ART_PALETTES: { id: ArtPalette; name: string; swatch: string }[] = [
  { id: 'aurora', name: 'Aurora', swatch: '#9bc7b4' },
  { id: 'ember', name: 'Ember', swatch: '#e4a17e' },
  { id: 'glacier', name: 'Glacier', swatch: '#99bdde' },
  { id: 'orchid', name: 'Orchid', swatch: '#c5a0d9' },
  { id: 'pearl', name: 'Pearl', swatch: '#ddd4ba' },
];

type Mark = { points: number[]; stroke?: string; fill?: string; width?: number; opacity?: number; closed?: boolean; dash?: number[] };
type ColorSet = { background: string; shadow: string; body: string; light: string; accent: string; glow: string };
export type ArtScene = { marks: Mark[]; colors: ColorSet; glowX: number; glowY: number };

const COLORS: Record<ArtPalette, ColorSet> = {
  aurora: { background: '#080e0d', shadow: '#0d201c', body: '#62bda0', light: '#e5ead1', accent: '#e3ac8c', glow: '#326354' },
  ember: { background: '#100b0b', shadow: '#2c181a', body: '#e88263', light: '#ffe2ab', accent: '#dfa2c3', glow: '#7e382c' },
  glacier: { background: '#080d13', shadow: '#142435', body: '#69b6e4', light: '#e0f6ef', accent: '#aca0ea', glow: '#284f7b' },
  orchid: { background: '#100b13', shadow: '#2b1b38', body: '#c289df', light: '#f4d3e3', accent: '#b1c9e4', glow: '#60386e' },
  pearl: { background: '#0d0e0d', shadow: '#252723', body: '#a5ab99', light: '#f3e7c9', accent: '#98b1b0', glow: '#57594b' },
};

export const ART_WIDTH = 1200;
export const ART_HEIGHT = 560;
const TAU = Math.PI * 2;
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;

/** Seed the complete composition, not just its color or individual noise samples. */
export function artRandom(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index++) state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function mixColor(first: string, second: string, amount: number) {
  const a = Number.parseInt(first.slice(1), 16);
  const b = Number.parseInt(second.slice(1), 16);
  const t = clamp(amount);
  const channel = (shift: number) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

type Noise = (x: number, y: number) => number;

/** Seeded gradient noise in roughly [-1, 1]: the organic ingredient a sine-only drawing lacks. */
function makeNoise(random: () => number): Noise {
  const order = Array.from({ length: 256 }, (_, index) => index);
  for (let index = 255; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  const perm = new Uint8Array(512);
  for (let index = 0; index < 512; index++) perm[index] = order[index & 255];
  const gradient = (hash: number, x: number, y: number) => {
    const angle = (hash & 7) * (Math.PI / 4);
    return Math.cos(angle) * x + Math.sin(angle) * y;
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const cellX = Math.floor(x), cellY = Math.floor(y);
    const X = cellX & 255, Y = cellY & 255;
    const fx = x - cellX, fy = y - cellY;
    const u = fade(fx), v = fade(fy);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1], ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return lerp(lerp(gradient(aa, fx, fy), gradient(ba, fx - 1, fy), u), lerp(gradient(ab, fx, fy - 1), gradient(bb, fx - 1, fy - 1), u), v) * 1.4;
  };
}

function fbm(noise: Noise, x: number, y: number, octaves: number) {
  let amplitude = 1, frequency = 1, sum = 0, norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * noise(x * frequency, y * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.05;
  }
  return sum / norm;
}

/** Where a piece may sit: the centre and seven off-centre positions that survive a phone's crop. */
const ANCHORS = [[0.5, 0.5], [0.34, 0.5], [0.66, 0.46], [0.3, 0.64], [0.7, 0.6], [0.5, 0.36], [0.24, 0.42], [0.76, 0.52]] as const;
/** How large the main form is, relative to the canvas height: an object in negative space, or a crop. */
const SCALES = [0.45, 0.7, 1, 1.4];
const RADIAL: ArtPattern[] = ['orbit', 'rays', 'diamond', 'contour', 'bloom', 'meridian'];

/** Line studies composed by the seed: where the form sits, how large, how many lines, which lines lead. */
function patternScene(settings: ArtSettings, seconds: number, colors: ColorSet): ArtScene {
  const random = artRandom(`${settings.seed}:patterns`);
  const noise = makeNoise(random);
  const pattern = settings.pattern ?? 'orbit';
  const tension = clamp(settings.tension / 100);
  const openness = clamp(settings.openness / 100);
  const density = clamp(settings.density / 100);
  const radial = RADIAL.includes(pattern);
  // The composition is drawn first, so the dials tune a piece without reshuffling it.
  const [anchorX, anchorY] = ANCHORS[Math.floor(random() * ANCHORS.length)];
  const cx = anchorX * ART_WIDTH;
  const cy = anchorY * ART_HEIGHT;
  const radius = SCALES[Math.floor(random() * SCALES.length)] * ART_HEIGHT * (0.75 + openness * 0.5);
  const count = Math.round(10 + random() * 14 + density * 36);
  const heavyEvery = 3 + Math.floor(random() * 5);
  const warp = (0.03 + random() * 0.14) * (0.4 + tension * 1.2);
  const frequency = 0.7 + random() * 2;
  const squash = 0.78 + random() * 0.22;
  const lightAngle = random() * TAU;
  const accentRoll = random();
  const phase = random() * TAU;
  const character = random();
  const drift = seconds * 0.025;
  const band = Math.min(radius, ART_HEIGHT * 0.62);
  const dotted = !!settings.dotted;
  const thin: Mark[] = [];
  const heavy: Mark[] = [];
  const wobble = (x: number, y: number, layer: number) => fbm(noise, x * frequency + drift, y * frequency + layer, 3);
  const stroke = (points: number[], index: number, across: number, closed = false) => {
    const near = 1 - clamp(across);
    if (index % heavyEvery === 0) {
      heavy.push({ points, closed, stroke: mixColor(colors.light, colors.accent, random() * 0.3), width: 2.4 + near * 1.4, opacity: 0.85 + near * 0.15, ...(dotted ? { dash: [0.1, 4.4] } : {}) });
    } else {
      thin.push({ points, closed, stroke: mixColor(colors.body, colors.shadow, 0.1 + clamp(across) * 0.5), width: (dotted ? 1.9 : 1) + near * 0.6, opacity: 0.45 + near * 0.35, ...(dotted ? { dash: [0.1, 5.5] } : {}) });
    }
  };
  const ring = (index: number) => lerp(radius * 0.06, radius, Math.pow((index + 1) / count, 0.85));
  const sample = (steps: number, pointAt: (t: number) => [number, number]) => {
    const points: number[] = [];
    for (let step = 0; step <= steps; step++) points.push(...pointAt(step / steps));
    return points;
  };
  const circle = (x: number, y: number, r: number) => sample(64, (t) => [x + Math.cos(t * TAU) * r, y + Math.sin(t * TAU) * r]);
  const signedPower = (value: number, power: number) => Math.sign(value) * Math.pow(Math.abs(value), power);

  if (pattern === 'rays') {
    const rays = count * 2;
    for (let index = 0; index < rays; index++) {
      const start = (index / rays) * TAU + phase * 0.1;
      const bend = wobble(Math.cos(start), Math.sin(start), 0.3) * warp * 9;
      stroke(sample(80, (t) => {
        const distance = lerp(radius * 0.1, radius * 2.1, t * t);
        const angle = start + bend * t;
        return [cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance * squash];
      }), index, 1 - (Math.cos(start - lightAngle) + 1) / 2);
    }
  } else {
    for (let index = 0; index < count; index++) {
      const across = index / Math.max(1, count - 1);
      if (pattern === 'orbit') {
        const r = ring(index);
        stroke(sample(200, (t) => {
          const angle = t * TAU;
          const rr = r * (1 + warp * 2.2 * wobble(Math.cos(angle), Math.sin(angle), across * 1.5));
          return [cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr * squash];
        }), index, across, true);
      } else if (pattern === 'diamond') {
        const r = ring(index);
        const exponent = 1.7 + character * 0.5 - tension * 0.4;
        stroke(sample(200, (t) => {
          const angle = t * TAU;
          const x = signedPower(Math.cos(angle), exponent);
          const y = signedPower(Math.sin(angle), exponent);
          const k = 1 + warp * 1.6 * wobble(x, y, across * 1.5);
          return [cx + x * r * k, cy + y * r * k * squash];
        }), index, across, true);
      } else if (pattern === 'contour') {
        const r = ring(index);
        const power = 0.64 + character * 0.58;
        stroke(sample(200, (t) => {
          const angle = t * TAU;
          const terrain = 1 + (0.08 + tension * 0.2) * fbm(noise, Math.cos(angle) * frequency * 0.6 + drift, Math.sin(angle) * frequency * 0.6 + 7, 2)
            + warp * 1.5 * wobble(Math.cos(angle) * 1.7, Math.sin(angle) * 1.7, across);
          return [cx + signedPower(Math.cos(angle), power) * r * terrain, cy + signedPower(Math.sin(angle), power) * r * terrain * squash];
        }), index, across, true);
      } else if (pattern === 'waves') {
        const y0 = cy - band + across * 2 * band;
        stroke(sample(160, (t) => {
          const x = -40 + t * (ART_WIDTH + 80);
          const window = Math.exp(-Math.pow((x - cx) / (radius * 1.4), 2));
          const n = fbm(noise, (x / ART_WIDTH) * frequency * 2.5 + drift, across * 2.2, 3);
          return [x, y0 + n * band * warp * 3.5 * window + n * 6];
        }), index, Math.abs(across - 0.5) * 2);
      } else if (pattern === 'weave') {
        const offset = (across * 2 - 1) * (0.5 + openness * 0.35) * ART_WIDTH * 0.5;
        for (const direction of [-1, 1]) {
          stroke(sample(120, (t) => {
            const y = -40 + t * (ART_HEIGHT + 80);
            const k = (y - cy) / ART_HEIGHT;
            const bend = Math.sin(k * Math.PI * (0.55 + character * 0.35) + phase) * (0.25 + tension * 0.45) * ART_WIDTH * 0.3;
            const n = wobble(k * 1.3, across * 1.7 + direction, 0.7) * warp * ART_WIDTH * 0.25;
            return [cx + offset + direction * (k * ART_WIDTH * 0.5 + bend) + n, y];
          }), index + (direction < 0 ? 1 : 0), across);
        }
      } else if (pattern === 'grid') {
        // One-point perspective whose vanishing point is the composition's anchor.
        const spread = across * 2 - 1;
        const convergence = 0.02 + openness * 0.12;
        stroke(sample(100, (t) => {
          const y = -40 + t * (ART_HEIGHT + 80);
          const k = Math.min(1, Math.abs((y - cy) / ART_HEIGHT));
          const perspective = convergence + (1 - convergence) * Math.pow(k, 0.75 + character * 0.5);
          const n = fbm(noise, k * frequency + drift, across * 2 + 3, 2) * warp * ART_WIDTH * 0.12 * (1 - k);
          return [cx + spread * ART_WIDTH * 0.8 * perspective + n, y];
        }), index, across);
        const height = Math.pow((index + 1) / count, 1.35 + character * 0.7);
        for (const direction of [-1, 1]) {
          stroke(sample(100, (t) => {
            const x = -40 + t * (ART_WIDTH + 80);
            const n = fbm(noise, (x / ART_WIDTH) * frequency + drift, height * 3 + direction, 2) * warp * ART_HEIGHT * 0.1 * (1 - height);
            return [x, cy + direction * height * ART_HEIGHT * 0.62 + n];
          }), index + 1, 1 - height);
        }
      } else if (pattern === 'arches') {
        const r = ring(index);
        const archHeight = 0.8 + tension * 0.26;
        const arc = sample(100, (t) => {
          const angle = Math.PI + t * Math.PI;
          const rr = r * (1 + warp * 1.5 * wobble(Math.cos(angle), Math.sin(angle), across));
          return [cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr * archHeight * squash];
        });
        // The legs drop from wherever the warped arc lands, so the join never steps.
        stroke([arc[0], ART_HEIGHT + 40, ...arc, arc[arc.length - 2], ART_HEIGHT + 40], index, across);
      } else if (pattern === 'bloom') {
        const turn = (index / count) * Math.PI + phase * 0.14;
        const petalWidth = 0.14 + openness * 0.38 + character * 0.1;
        stroke(sample(140, (t) => {
          const angle = t * TAU;
          const x = Math.cos(angle);
          const y = Math.sin(angle) * petalWidth * (1 + tension * 0.34 * Math.cos(angle * 2 + phase));
          const k = 1 + wobble(x * 1.5, y * 1.5 + index * 0.1, 0) * warp * 1.2;
          return [cx + (x * Math.cos(turn) - y * Math.sin(turn)) * radius * k, cy + (x * Math.sin(turn) + y * Math.cos(turn)) * radius * k * squash];
        }), index, across, true);
      } else if (pattern === 'meridian') {
        const longitude = Math.sin(lerp(0.03 + openness * 0.13, Math.PI / 2, across));
        const tilt = (character - 0.5) * 0.4;
        stroke(sample(140, (t) => {
          const angle = t * TAU;
          const y = Math.sin(angle);
          const k = 1 + wobble(Math.cos(angle), y + across, 0.4) * warp * 1.3;
          return [cx + (Math.cos(angle) * longitude + y * tilt) * radius * k, cy + y * radius * squash * k];
        }), index, across, true);
        if (index % 2 === 0) {
          stroke(sample(140, (t) => {
            const angle = t * TAU;
            const k = 1 + wobble(Math.cos(angle) + across, Math.sin(angle), 0.9) * warp * 1.3;
            return [cx + Math.cos(angle) * radius * k, cy + (Math.sin(angle) * longitude * (0.72 + character * 0.24) + Math.cos(angle) * tilt) * radius * squash * k];
          }), index + 1, across, true);
        }
      }
    }
  }

  const marks = [...thin, ...heavy];
  if (radial && accentRoll < 0.35) marks.push({ points: circle(cx, cy, Math.min(36, radius * 0.08)), fill: colors.light, closed: true, opacity: 0.92 });
  else if (radial && accentRoll < 0.6) marks.push({ points: circle(cx, cy, radius * 0.3), stroke: colors.accent, width: 2.4, opacity: 0.9, closed: true });
  return { marks, colors, glowX: cx, glowY: cy };
}

type FlowParticle = { path: number[]; offset: number; kind: 'haze' | 'thin' | 'heavy'; tone: number; weight: number };
type FlowField = { particles: FlowParticle[]; glowX: number; glowY: number };
const FLOW_FIELDS = new Map<string, FlowField>();

/** The costly half of a flow field, integrated once per seed and dials. Time only slides the trails along it. */
function flowField(settings: ArtSettings): FlowField {
  const key = `${settings.seed}|${settings.tension}|${settings.openness}|${settings.density}`;
  const cached = FLOW_FIELDS.get(key);
  if (cached) return cached;
  const random = artRandom(`${settings.seed}:flow`);
  const noise = makeNoise(random);
  const tension = clamp(settings.tension / 100);
  const openness = clamp(settings.openness / 100);
  const density = clamp(settings.density / 100);
  const fieldScale = 0.0009 + random() * 0.0016;
  const warpAmount = random() * 260 * (0.5 + tension);
  const octaves = 2 + Math.floor(random() * 3);
  const turns = (1.2 + random() * 2.2) * (0.6 + tension * 0.8);
  const bias = random() * TAU;
  const clusterCount = 1 + Math.floor(random() * 2);
  const centers = Array.from({ length: clusterCount }, () => ({
    x: lerp(0.25, 0.75, random()) * ART_WIDTH,
    y: lerp(0.3, 0.7, random()) * ART_HEIGHT,
    spread: (0.15 + random() * 0.25) * ART_WIDTH * (0.6 + openness * 0.8),
  }));
  const life = Math.round(120 + random() * 150);
  const particleCount = Math.round((520 + random() * 260) * (0.5 + density));
  const angleAt = (x: number, y: number) => {
    const wx = x + warpAmount * fbm(noise, x * fieldScale * 1.6 + 5.2, y * fieldScale * 1.6 + 1.3, 2);
    const wy = y + warpAmount * fbm(noise, x * fieldScale * 1.6 + 8.3, y * fieldScale * 1.6 + 2.8, 2);
    return fbm(noise, wx * fieldScale, wy * fieldScale, octaves) * Math.PI * turns + bias;
  };
  const gauss = () => {
    const u = 1 - random(), v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  const particles: FlowParticle[] = [];
  for (let index = 0; index < particleCount; index++) {
    const haze = index % 3 === 2;
    const center = centers[index % clusterCount];
    let x = haze ? random() * ART_WIDTH : center.x + gauss() * center.spread;
    let y = haze ? random() * ART_HEIGHT : center.y + gauss() * center.spread * 0.7;
    const path: number[] = [];
    const span = haze ? Math.round(life * 0.5) : life;
    for (let step = 0; step < span; step++) {
      if (x < -4 || x > ART_WIDTH + 4 || y < -4 || y > ART_HEIGHT + 4) break;
      path.push(x, y);
      const angle = angleAt(x, y);
      x += Math.cos(angle) * 4;
      y += Math.sin(angle) * 4;
    }
    const glint = random(), heavyRoll = random(), offset = random(), weight = random();
    if (path.length < 12) continue;
    const tone = clamp(1 - Math.hypot(path[0] - centers[0].x, path[1] - centers[0].y) / (ART_WIDTH * 0.5)) * (0.5 + glint * 0.5);
    particles.push({ path, offset, kind: haze ? 'haze' : heavyRoll < 0.12 ? 'heavy' : 'thin', tone, weight });
  }
  const field = { particles, glowX: centers[0].x, glowY: centers[0].y };
  if (FLOW_FIELDS.size >= 12) FLOW_FIELDS.delete(FLOW_FIELDS.keys().next().value!);
  FLOW_FIELDS.set(key, field);
  return field;
}

/** Particles drifting through a noise field, seeded in clusters so every piece has a focus and open space. */
function flowScene(settings: ArtSettings, seconds: number, colors: ColorSet): ArtScene {
  const field = flowField(settings);
  const layers: Record<FlowParticle['kind'], Mark[]> = { haze: [], thin: [], heavy: [] };
  for (const particle of field.particles) {
    const steps = particle.path.length / 2;
    const trail = Math.max(8, Math.round(steps * 0.7));
    const life = steps + trail;
    const head = (particle.offset * life + seconds * 11) % life;
    const end = Math.min(steps - 1, Math.floor(head));
    const start = Math.max(0, Math.ceil(head - trail));
    if (end - start < 3) continue;
    const envelope = clamp(Math.min(head, life - head) / (trail * 0.6));
    const points = particle.path.slice(start * 2, end * 2 + 2);
    const tone = particle.tone;
    if (particle.kind === 'haze') layers.haze.push({ points, stroke: mixColor(colors.shadow, colors.body, 0.25 + tone * 0.4), width: 0.5 + particle.weight * 0.5, opacity: (0.14 + tone * 0.2) * envelope });
    else if (particle.kind === 'heavy') layers.heavy.push({ points, stroke: mixColor(colors.body, colors.light, 0.35 + tone * 0.65), width: 1.6 + particle.weight * 1.6, opacity: (0.7 + tone * 0.3) * envelope });
    else layers.thin.push({ points, stroke: mixColor(colors.shadow, colors.body, 0.3 + tone * 0.7), width: 0.5 + particle.weight * 0.8, opacity: (0.32 + tone * 0.55) * envelope });
  }
  return { marks: [...layers.haze, ...layers.thin, ...layers.heavy], colors, glowX: field.glowX, glowY: field.glowY };
}

export function createArtScene(settings: ArtSettings, seconds = 0): ArtScene {
  const colors = COLORS[settings.palette] ?? COLORS.aurora;
  return settings.mode === 'flow' ? flowScene(settings, seconds, colors) : patternScene(settings, seconds, colors);
}

/** Canvas and SVG consume the same paths, colors and frozen time. */
export function paintArtScene(context: CanvasRenderingContext2D, scene: ArtScene) {
  context.fillStyle = scene.colors.background;
  context.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);
  const glow = context.createRadialGradient(scene.glowX, scene.glowY, 0, scene.glowX, scene.glowY, 470);
  glow.addColorStop(0, `${scene.colors.glow}30`);
  glow.addColorStop(0.62, `${scene.colors.glow}10`);
  glow.addColorStop(1, `${scene.colors.glow}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);
  context.lineCap = 'round'; context.lineJoin = 'round';
  context.setLineDash([]);
  let dash: number[] | undefined;
  for (const mark of scene.marks) {
    if (mark.dash !== dash) {
      dash = mark.dash;
      context.setLineDash(dash ?? []);
    }
    context.beginPath();
    context.moveTo(mark.points[0], mark.points[1]);
    for (let index = 2; index < mark.points.length; index += 2) context.lineTo(mark.points[index], mark.points[index + 1]);
    if (mark.closed) context.closePath();
    context.globalAlpha = mark.opacity ?? 1;
    if (mark.fill) { context.fillStyle = mark.fill; context.fill(); }
    if (mark.stroke) { context.strokeStyle = mark.stroke; context.lineWidth = mark.width ?? 1; context.stroke(); }
  }
  context.setLineDash([]);
  context.globalAlpha = 1;
}

const number = (value: number) => String(Number(value.toFixed(3)));
const escapeXML = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));

export function artSceneToSVG(scene: ArtScene, settings: ArtSettings, seconds: number) {
  const paths = scene.marks.map((mark) => {
    const d = mark.points.reduce((path, value, index) => `${path}${index % 2 === 0 ? (index === 0 ? 'M' : 'L') : ','}${number(value)}`, '') + (mark.closed ? 'Z' : '');
    return `<path d="${d}" fill="${mark.fill ?? 'none'}"${mark.stroke ? ` stroke="${mark.stroke}" stroke-width="${number(mark.width ?? 1)}"` : ''}${mark.dash ? ` stroke-dasharray="${mark.dash.map(number).join(' ')}"` : ''}${mark.opacity !== undefined ? ` opacity="${number(mark.opacity)}"` : ''}/>`;
  }).join('');
  const title = settings.mode === 'flow' ? 'Weather of light' : 'Pattern studies';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ART_WIDTH * 2}" height="${ART_HEIGHT * 2}" viewBox="0 0 ${ART_WIDTH} ${ART_HEIGHT}" role="img" aria-labelledby="art-title art-description"><title id="art-title">Trilorah — ${title}</title><desc id="art-description">Seed ${escapeXML(settings.seed)}. ${settings.palette} palette. Frozen at ${number(seconds)} seconds.</desc><metadata>${escapeXML(JSON.stringify({ ...settings, seconds }))}</metadata><defs><clipPath id="art-bounds"><rect width="1200" height="560"/></clipPath><radialGradient id="atmosphere" gradientUnits="userSpaceOnUse" cx="${scene.glowX}" cy="${scene.glowY}" r="470"><stop stop-color="${scene.colors.glow}" stop-opacity="${48 / 255}"/><stop offset=".62" stop-color="${scene.colors.glow}" stop-opacity="${16 / 255}"/><stop offset="1" stop-color="${scene.colors.glow}" stop-opacity="0"/></radialGradient></defs><path fill="${scene.colors.background}" d="M0 0h1200v560H0z"/><path fill="url(#atmosphere)" d="M0 0h1200v560H0z"/><g stroke-linecap="round" stroke-linejoin="round" clip-path="url(#art-bounds)">${paths}</g></svg>`;
}
