import { describe, expect, it } from 'vitest';
import { createDitherInteraction, dotLightOpacity, type DotLight, type DotPalette } from '../design/screens/ditherInteraction';

const palette: DotPalette = { green: [143, 211, 192], yellow: [228, 216, 122] };

function crest(light: DotLight, angle = 0) {
  let peak = 0, brightness = -1;
  for (let r = 0; r <= 192; r += .25) {
    const value = dotLightOpacity(light, light.x + Math.cos(angle) * r, light.y + Math.sin(angle) * r);
    if (value > brightness) { brightness = value; peak = r; }
  }
  return peak;
}

describe('dither click feedback', () => {
  it('alternates green and yellow on every click, including after a pause', () => {
    const interaction = createDitherInteraction();
    interaction.press(0, 0, 0, palette);
    expect(interaction.sample(0)[0].color).toEqual(palette.green);
    interaction.press(0, 0, 100, palette);
    expect(interaction.sample(100).at(-1)?.color).toEqual(palette.yellow);
    interaction.press(0, 0, 2_000, palette);
    expect(interaction.sample(2_000)[0].color).toEqual(palette.green);
  });

  it('makes successive waves brighter and sends them farther', () => {
    const interaction = createDitherInteraction();
    interaction.press(100, 100, 0, palette);
    const first = interaction.sample(300)[0];
    for (let i = 1; i < 8; i++) interaction.press(100, 100, i * 100, palette);
    const lights = interaction.sample(1_000);
    const latest = lights.at(-1)!;
    expect(lights).toHaveLength(8);
    expect(latest.opacity).toBeGreaterThan(first.opacity);
    expect(latest.radius).toBeGreaterThan(first.radius);
    expect(dotLightOpacity(latest, 100 + crest(latest), 100)).toBeCloseTo(latest.opacity);
    expect(dotLightOpacity(latest, 100, 100)).toBeGreaterThan(0);
  });

  it('keeps responding during continuous clicking with bounded ripple and burst work', () => {
    const interaction = createDitherInteraction();
    for (let i = 0; i < 1_000; i++) {
      interaction.press(i, 100, i * 50, palette);
      const lights = interaction.sample(i * 50);
      expect(lights.length).toBeLessThanOrEqual(8);
      expect(lights.at(-1)).toMatchObject({ x: i, color: i % 2 ? palette.yellow : palette.green });
      expect(lights.every(light => light.radius + light.width <= 192 && light.opacity <= .95)).toBe(true);
      expect(lights.every(light => light.color === palette.green || light.color === palette.yellow || light.shape === 'heart' || light.shape === 'flower')).toBe(true);
    }
  });

  it('returns to a small soft click after a pause', () => {
    const interaction = createDitherInteraction();
    for (let i = 0; i < 8; i++) interaction.press(0, 0, i * 100, palette);
    interaction.press(0, 0, 8_000, palette);
    expect(interaction.sample(8_000)).toHaveLength(1);
    expect(interaction.sample(8_000)[0]).toMatchObject({ opacity: .32, radius: 0 });
  });

  it('leaves each ripple centered on its own click position', () => {
    const interaction = createDitherInteraction();
    interaction.press(50, 60, 0, palette);
    interaction.press(250, 160, 100, palette);
    expect(interaction.sample(100)).toMatchObject([{ x: 50, y: 60 }, { x: 250, y: 160 }]);
    expect(dotLightOpacity(interaction.sample(100)[0], 250, 160)).toBe(0);
  });

  it('moves the leading crest outward while softer waves fill the area behind it', () => {
    const interaction = createDitherInteraction();
    interaction.press(0, 0, 0, palette);
    expect(dotLightOpacity(interaction.sample(0)[0], 0, 0)).toBeGreaterThan(0);
    const early = interaction.sample(300)[0];
    const later = interaction.sample(800)[0];
    expect(later.radius).toBeGreaterThan(early.radius);
    expect(dotLightOpacity(early, crest(early), 0)).toBeCloseTo(early.opacity);
    expect(dotLightOpacity(later, crest(early), 0)).toBeGreaterThan(0);
    expect(dotLightOpacity(later, crest(early), 0)).toBeLessThan(later.opacity);
    expect(dotLightOpacity(later, crest(later), 0)).toBeCloseTo(later.opacity);
    expect(dotLightOpacity(later, later.radius + later.width, 0)).toBe(0);
  });

  it('has an irregular outline, varies between clicks, and retains its shape as it expands', () => {
    const interaction = createDitherInteraction();
    interaction.press(0, 0, 0, palette);
    const first = interaction.sample(500)[0];
    const radii = Array.from({ length: 16 }, (_, i) => crest(first, i * Math.PI / 8));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(10);
    const later = interaction.sample(900)[0];
    expect(crest(later) / crest(first)).toBeCloseTo(900 / 500, 1);
    interaction.press(0, 0, 900, palette);
    const second = interaction.sample(900)[1];
    expect(second.contour).not.toEqual(first.contour);
    expect(later.contour).toBe(first.contour);
    for (const radius of radii) expect(radius).toBeLessThanOrEqual(192);
  });

  it('keeps older waves moving when another click launches a new wave', () => {
    const interaction = createDitherInteraction();
    interaction.press(0, 0, 0, palette);
    const before = interaction.sample(300)[0];
    interaction.press(0, 0, 300, palette);
    const after = interaction.sample(300);
    expect(after[0]).toEqual(before);
    expect(after[1].radius).toBe(0);
    expect(interaction.sample(600)[0].radius).toBeGreaterThan(before.radius);
  });

  it('mixes in an organic shape every fourth click among the three geometric shapes', () => {
    const interaction = createDitherInteraction();
    const shapes = [];
    for (let i = 0; i < 32; i++) {
      interaction.press(0, 0, i * 50, palette);
      const light = interaction.sample(i * 50).at(-1)!;
      shapes.push(light.shape);
      expect([...light.contour].every(radius => radius >= .44 && radius <= 1)).toBe(true);
    }
    expect(shapes).toEqual(Array.from({length: 8}, () => ['triangle', 'square', 'circle', 'organic']).flat());
  });

  it('varies the freeform organic outline between appearances', () => {
    const interaction = createDitherInteraction();
    const outlines: Float32Array[] = [];
    for (let i = 0; i < 8; i++) {
      interaction.press(0, 0, i * 50, palette);
      const light = interaction.sample(i * 50).at(-1)!;
      if (light.shape === 'organic') outlines.push(light.contour);
    }
    expect(outlines).toHaveLength(2);
    expect(outlines[0]).not.toEqual(outlines[1]);
    for (const outline of outlines) {
      expect(Math.max(...outline) - Math.min(...outline)).toBeGreaterThan(.2);
    }
  });

  it('keeps each geometry recognizable with gently irregular edges', () => {
    const interaction = createDitherInteraction();
    const outlines = new Map<string, Float32Array>();
    for (let i = 0; i < 3; i++) {
      interaction.press(0, 0, i * 50, palette);
      const light = interaction.sample(i * 50).at(-1)!;
      outlines.set(light.shape, light.contour);
    }
    const peaks = (values: Float32Array) => [...values].filter((value, i) =>
      value > values[(i + values.length - 1) % values.length]
      && value > values[(i + 1) % values.length]).length;
    expect(peaks(outlines.get('triangle')!)).toBe(3);
    expect(peaks(outlines.get('square')!)).toBe(4);
    const circle = outlines.get('circle')!;
    expect(Math.max(...circle) - Math.min(...circle)).toBeGreaterThan(.04);
    expect(Math.max(...circle) / Math.min(...circle)).toBeLessThan(1.15);
    expect(outlines.get('square')![0]).not.toBe(outlines.get('square')![32]);
  });

  it('lights a broad interior area with multiple moving fronts per click', () => {
    const interaction = createDitherInteraction();
    interaction.press(0, 0, 0, palette);
    const light = interaction.sample(900)[0];
    const front = crest(light);
    expect(dotLightOpacity(light, 0, 0)).toBeGreaterThan(0);
    expect(dotLightOpacity(light, front * .25, 0)).toBeGreaterThan(light.opacity * .35);
    expect(dotLightOpacity(light, front * .6, 0)).toBeGreaterThan(light.opacity * .6);
    expect(dotLightOpacity(light, front, 0)).toBeCloseTo(light.opacity);
    expect(dotLightOpacity(light, light.radius + light.width + 1, 0)).toBe(0);
  });

  it('emits six hearts and four flowers at the faster 400ms spacing', () => {
    const interaction = createDitherInteraction();
    for (let i = 0; i < 5; i++) interaction.press(100, 100, i * 100, palette);
    expect(interaction.sample(400).some(light => light.shape === 'heart')).toBe(false);
    interaction.press(100, 100, 500, palette);
    expect(interaction.sample(500).filter(light => light.shape === 'heart')).toHaveLength(1);
    expect(interaction.sample(899).filter(light => light.shape === 'heart')).toHaveLength(1);
    for (let i = 1; i < 6; i++) {
      const hearts = interaction.sample(500 + i * 400).filter(light => light.shape === 'heart');
      expect(hearts).toHaveLength(Math.min(i + 1, 3));
      expect(hearts.filter(light => light.radius === 0)).toHaveLength(1);
      expect(hearts.every(light => light.color[0] > 200 && light.color[1] < 120)).toBe(true);
      expect(hearts[0].contour[48]).toBeLessThan(hearts[0].contour[40]);
      expect(hearts[0].contour[16]).toBeGreaterThan(hearts[0].contour[48]);
    }
    expect(interaction.sample(3_300).filter(light => light.shape === 'heart')).toHaveLength(1);
    expect(interaction.sample(3_600)).toEqual([]);
    for (let i = 0; i < 6; i++) interaction.press(100, 100, 5_000 + i * 100, palette);
    for (let i = 0; i < 4; i++) {
      const flowers = interaction.sample(5_500 + i * 400).filter(light => light.shape === 'flower');
      expect(flowers).toHaveLength(Math.min(i + 1, 3));
      expect(flowers.filter(light => light.radius === 0)).toHaveLength(1);
      expect(flowers.every(light => light.color[0] > 200 && light.color[1] < 120)).toBe(true);
    }
    expect(interaction.sample(7_500).filter(light => light.shape === 'flower')).toHaveLength(1);
    expect(interaction.sample(7_800)).toEqual([]);
  });

  it('grows each red shape quickly from the click and finishes despite continued clicks', () => {
    const interaction = createDitherInteraction();
    for (let i = 0; i < 6; i++) interaction.press(100, 100, i * 100, palette);
    const first = interaction.sample(500).filter(light => light.shape === 'heart');
    interaction.press(200, 200, 800, palette);
    const later = interaction.sample(800).filter(light => light.shape === 'heart');
    expect(later).toHaveLength(1);
    expect(later[0]).toMatchObject({ x: 100, y: 100 });
    expect(later[0].radius).toBeGreaterThan(first[0].radius);
    expect(later[0].opacity).toBeLessThan(first[0].opacity);
    expect(interaction.sample(1_100).find(light => light.shape === 'heart')!.radius).toBeGreaterThan(80);
    for (let time = 1_200; time < 3_600; time += 100) interaction.press(200, 200, time, palette);
    expect(interaction.sample(3_600).some(light => light.shape === 'heart' || light.shape === 'flower')).toBe(false);
  });

  it('gives blooms distinct uneven petal layers while keeping opacity bounded', () => {
    const interaction = createDitherInteraction();
    for (let i = 0; i < 6; i++) interaction.press(100, 100, i * 100, palette);
    for (let i = 0; i < 6; i++) interaction.press(100, 100, 5_000 + i * 100, palette);
    const flowers = interaction.sample(6_100).filter(light => light.shape === 'flower');
    expect(flowers).toHaveLength(2);
    expect(flowers[0].petalContours).toHaveLength(2);
    expect(flowers[0].contour).not.toEqual(flowers[1].contour);
    expect(flowers[0].petalContours![0]).not.toEqual(flowers[0].petalContours![1]);
    for (const flower of flowers) {
      for (let x = 0; x < 200; x += 4) {
        const opacity = dotLightOpacity(flower, x, 100);
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(flower.opacity);
      }
    }
  });

  it('does not trigger a burst from slow clicks', () => {
    const interaction = createDitherInteraction();
    for (let i = 0; i < 20; i++) {
      interaction.press(0, 0, i * 400, palette);
      expect(interaction.sample(i * 400).some(light => light.shape === 'heart' || light.shape === 'flower')).toBe(false);
    }
  });

  it('fades smoothly and fully expires after clicking stops', () => {
    const interaction = createDitherInteraction();
    interaction.press(0, 0, 0, palette);
    expect(interaction.sample(600)[0].opacity).toBeLessThan(interaction.sample(0)[0].opacity);
    expect(interaction.sample(1_200)).toEqual([]);
  });

  it('clears all pending effects when hidden or motion is reduced', () => {
    const interaction = createDitherInteraction();
    for (let i = 0; i < 8; i++) interaction.press(0, 0, i * 100, palette);
    interaction.clear();
    expect(interaction.sample(800)).toEqual([]);
    interaction.press(0, 0, 900, palette);
    expect(interaction.sample(900)).toHaveLength(1);
    expect(interaction.sample(900)[0]).toMatchObject({ color: palette.green, radius: 0, opacity: .32 });
  });
});
