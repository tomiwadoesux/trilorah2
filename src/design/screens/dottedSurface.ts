import type { CSSProperties } from 'react';

type Point = { x: number; y: number };
const between = (min: number, max: number) => min + Math.random() * (max - min);
const point = ({ x, y }: Point) => `${x.toFixed(2)},${y.toFixed(2)}`;

/** A closed, smooth contour through unequal lobes, rather than an ellipse. */
function contour(points: Point[]): string {
  let path = `M${point(points[0])}`;
  for (let i = 0; i < points.length; i++) {
    const previous = points[(i + points.length - 1) % points.length];
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const after = points[(i + 2) % points.length];
    path += `C${point({
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    })} ${point({
      x: next.x - (after.x - current.x) / 6,
      y: next.y - (after.y - current.y) / 6,
    })} ${point(next)}`;
  }
  return `${path}Z`;
}

export function createPatches(vertical: boolean, area = false): CSSProperties {
  const patches = Array.from({ length: Math.floor(between(3, 6)) }, () => ({
    width: between(100, 240),
    gap: between(35, 110),
  }));
  const scale = 900 / patches.reduce((sum, patch) => sum + patch.width + patch.gap, 0);
  let cursor = 50;
  const paths = patches.map(({ width, gap }) => {
    const span = width * scale;
    const along = cursor + span / 2;
    const across = area ? between(60, 140) : between(80, 120);
    const radius = area ? between(24, 40) : between(42, 60);
    const phase = between(0, Math.PI * 2);
    const count = Math.floor(between(8, 13));
    const points = Array.from({ length: count }, (_, i) => {
      const angle = phase + ((i + between(-0.2, 0.2)) / count) * Math.PI * 2;
      const lobe = between(0.5, 1);
      const a = along + Math.cos(angle) * span * 0.48 * lobe;
      const b = across + Math.sin(angle) * radius * lobe;
      return vertical ? { x: b, y: a } : { x: a, y: b };
    });
    cursor += span + gap * scale;
    return `<path d="${contour(points)}" opacity="${between(0.8, 1).toFixed(2)}"/>`;
  });
  // Feather the entire irregular outline, so every edge fades away. The
  // SVG stays static; CSS gently drifts its position without regenerating it.
  const box = vertical ? '200 1000' : '1000 200';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box}" preserveAspectRatio="none"><defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs><g fill="white" filter="url(#soft)">${paths.join('')}</g></svg>`;
  return {
    '--tri-dot-patches': `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    '--tri-dot-duration': `${between(42, 62).toFixed(2)}s`,
    '--tri-dot-delay': `-${between(0, 42).toFixed(2)}s`,
  } as CSSProperties;
}

// Generated once per app load: ordinary renders and view changes keep the
// pattern and motion timing consistent; reloading makes a fresh arrangement.
export const dottedSurfaceStyles = {
  library: createPatches(true),
  transcript: createPatches(false),
};
