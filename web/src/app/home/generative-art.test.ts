import { describe, expect, it } from 'vitest';
import { ART_HEIGHT, ART_PATTERNS, ART_WIDTH, artSceneToSVG, createArtScene, type ArtScene, type ArtSettings } from './generative-art';

const settings: ArtSettings = { seed: '842719', mode: 'patterns', pattern: 'orbit', dotted: true, palette: 'aurora', tension: 54, openness: 52, density: 58 };
const flow: ArtSettings = { ...settings, mode: 'flow' };
const seeds = ['0', '1', '7', '842719', '842718', '990714', 'Psalm 46:10', 'John 3:16'];
const finite = (scene: ArtScene) => scene.marks.every((mark) => mark.points.every(Number.isFinite));
const insideCount = (scene: ArtScene) => scene.marks.reduce((total, mark) => {
  let inside = 0;
  for (let index = 0; index < mark.points.length; index += 2) {
    if (mark.points[index] >= 0 && mark.points[index] <= ART_WIDTH && mark.points[index + 1] >= 0 && mark.points[index + 1] <= ART_HEIGHT) inside++;
  }
  return total + inside;
}, 0);

describe('generative artwork', () => {
  it('reproduces a seed and frozen time exactly, and gives a different seed a new structure', () => {
    for (const base of [settings, flow]) {
      const first = createArtScene(base, 3.25);
      expect(createArtScene(base, 3.25)).toEqual(first);
      expect(createArtScene({ ...base, seed: '842718' }, 3.25).marks[0].points, base.mode).not.toEqual(first.marks[0].points);
      expect(createArtScene(base, 8).marks[0].points, base.mode).not.toEqual(first.marks[0].points);
    }
  });

  it('lets the seed compose the piece: where it sits and how many lines it has, in every family', () => {
    for (const { id: pattern } of ART_PATTERNS) {
      const anchors = new Set<string>();
      const counts = new Set<number>();
      for (const seed of seeds) {
        const scene = createArtScene({ ...settings, pattern, seed });
        anchors.add(`${scene.glowX},${scene.glowY}`);
        counts.add(scene.marks.length);
      }
      expect(anchors.size, pattern).toBeGreaterThanOrEqual(3);
      expect(counts.size, pattern).toBeGreaterThanOrEqual(3);
    }
    const flowAnchors = new Set(seeds.map((seed) => { const scene = createArtScene({ ...flow, seed }); return `${scene.glowX},${scene.glowY}`; }));
    expect(flowAnchors.size).toBeGreaterThanOrEqual(6);
  });

  it('keeps extreme settings finite and always leaves something inside the frame', () => {
    for (const seed of ['0', '1', '842719', 'infinity']) {
      for (const control of [0, 100]) {
        for (const { id: pattern } of ART_PATTERNS) {
          const scene = createArtScene({ ...settings, pattern, seed, tension: control, openness: control, density: control }, 13);
          expect(finite(scene), `${pattern}, seed ${seed}, controls ${control}`).toBe(true);
          expect(insideCount(scene), `${pattern}, seed ${seed}, controls ${control}`).toBeGreaterThan(200);
        }
        const scene = createArtScene({ ...flow, seed, tension: control, openness: control, density: control }, 13);
        expect(finite(scene), `flow, seed ${seed}, controls ${control}`).toBe(true);
        expect(scene.marks.every((mark) => mark.points.every((coordinate, index) =>
          coordinate >= -8 && coordinate <= (index % 2 === 0 ? ART_WIDTH : ART_HEIGHT) + 8)), `flow bleed, seed ${seed}`).toBe(true);
        expect(insideCount(scene), `flow, seed ${seed}, controls ${control}`).toBeGreaterThan(200);
      }
    }
  });

  it('exports the frozen geometry as a standalone SVG and escapes seed metadata', () => {
    const custom = { ...flow, seed: '<hello&"world>' };
    const scene = createArtScene(custom, 7.5);
    const svg = artSceneToSVG(scene, custom, 7.5);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('Weather of light');
    expect(svg).toContain('Frozen at 7.5 seconds');
    expect(svg).toContain('&lt;hello&amp;&quot;world&gt;');
    expect(svg).not.toContain('<hello');
    expect(svg.match(/<path /g)?.length).toBe(scene.marks.length + 2);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });

  it('reproduces all ten pattern families and gives each seed a distinct, recognizable composition', () => {
    const familyShapes = new Set<string>();
    expect(ART_PATTERNS).toHaveLength(10);
    for (const { id: pattern } of ART_PATTERNS) {
      const custom = { ...settings, pattern };
      const first = createArtScene(custom, 2.5);
      expect(createArtScene(custom, 2.5), pattern).toEqual(first);
      expect(createArtScene({ ...custom, seed: '842718' }, 2.5).marks, pattern).not.toEqual(first.marks);
      familyShapes.add(JSON.stringify(first.marks));
    }
    expect(familyShapes.size).toBe(10);
    expect(createArtScene({ ...settings, pattern: undefined })).toEqual(createArtScene({ ...settings, pattern: 'orbit' }));
  });

  it('evolves pattern paths continuously without changing their identity or adding random flicker', () => {
    for (const { id: pattern } of ART_PATTERNS) {
      const custom = { ...settings, pattern };
      const before = createArtScene(custom, 3);
      const after = createArtScene(custom, 3 + 1 / 30);
      expect(after.marks).toHaveLength(before.marks.length);
      let maximumChange = 0;
      after.marks.forEach((mark, index) => mark.points.forEach((coordinate, point) => {
        maximumChange = Math.max(maximumChange, Math.abs(coordinate - before.marks[index].points[point]));
      }));
      expect(maximumChange, pattern).toBeGreaterThan(0);
      expect(maximumChange, pattern).toBeLessThan(2.5);
    }
  });

  it('moves flow trails along a field that the seed holds still, and draws more of them with more detail', () => {
    const before = createArtScene(flow, 2);
    const later = createArtScene(flow, 6);
    expect(later.glowX).toBe(before.glowX);
    expect(later.glowY).toBe(before.glowY);
    expect(before.marks.length).toBeGreaterThan(100);
    expect(later.marks.map((mark) => mark.points.length)).not.toEqual(before.marks.map((mark) => mark.points.length));
    expect(createArtScene({ ...flow, density: 100 }).marks.length).toBeGreaterThan(createArtScene({ ...flow, density: 0 }).marks.length);
  });

  it('exports dotted pattern studies with the same stroke treatment as the canvas', () => {
    const custom = { ...settings, pattern: 'contour' as const, dotted: true };
    const scene = createArtScene(custom, 4);
    const svg = artSceneToSVG(scene, custom, 4);
    expect(svg).toContain('Pattern studies');
    expect(svg).toContain('clip-path="url(#art-bounds)"');
    const dotted = scene.marks.filter((mark) => mark.dash).length;
    expect(dotted).toBeGreaterThanOrEqual(scene.marks.length - 1);
    expect(svg.match(/stroke-dasharray=/g)).toHaveLength(dotted);
    expect(svg).toContain('Frozen at 4 seconds');
    const solid = artSceneToSVG(createArtScene({ ...custom, dotted: false }, 4), { ...custom, dotted: false }, 4);
    expect(solid).not.toContain('stroke-dasharray');
  });
});
