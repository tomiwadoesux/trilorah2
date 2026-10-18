/** A fixed dot grid sampled from a slowly changing, smooth noise field. */
export const MAX_DITHER_DOTS = 4_800;
export const DITHER_FRAME_MS = 1_000 / 24;

const smooth = (n: number) => n * n * (3 - 2 * n);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function hash(x: number, y: number, seed: number) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  return mix(mix(hash(ix, iy, seed), hash(ix + 1, iy, seed), fx),
    mix(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), fx), fy);
}

export function createDitherField(width: number, height: number, seed: number) {
  let step = Math.max(7, Math.sqrt(width * height / MAX_DITHER_DOTS));
  // Ceilings can take a large surface over budget. Increase the spacing once.
  while (Math.ceil(width / step) * Math.ceil(height / step) > MAX_DITHER_DOTS) step *= 1.02;
  const cols = Math.ceil(width / step), rows = Math.ceil(height / step);
  const values = new Float32Array(cols * rows * 4);
  // Three related fields let the silhouette evolve without per-frame noise,
  // DOM nodes, filters, or React updates. The fourth value softens the edges.
  const scale = 1 / Math.max(60, Math.min(145, Math.max(width, height) * .22));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + .5) * step, y = (row + .5) * step;
      const offset = (row * cols + col) * 4;
      for (let layer = 0; layer < 3; layer++) {
        const key = seed + layer * 92821;
        values[offset + layer] = noise(x * scale, y * scale, key) * .78
          + noise(x * scale * 2.6, y * scale * 2.6, key + 71) * .22;
      }
      values[offset + 3] = Math.min(1, Math.min(x, y, width - x, height - y) / 22);
    }
  }
  return { cols, rows, step, values };
}

