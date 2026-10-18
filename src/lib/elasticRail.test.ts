import { describe, expect, it } from 'vitest';
import { clampRailKeyboard, elasticRailShare, railDragBounds, railReleaseVelocity, settledRailShare } from './elasticRail';

describe('elastic left-panel split', () => {
  const bounds = railDragBounds(.5);
  it('tracks directly inside the soft bounds and resists increasingly outside them', () => {
    for (const value of [.25, .4, .5, .7, .75]) expect(elasticRailShare(value, bounds)).toBe(value);
    const firstPull = elasticRailShare(.8, bounds) - .75;
    const secondPull = elasticRailShare(.85, bounds) - elasticRailShare(.8, bounds);
    expect(firstPull).toBeGreaterThan(0);
    expect(firstPull).toBeLessThan(.05);
    expect(secondPull).toBeLessThan(firstPull);
    expect(elasticRailShare(.15, bounds)).toBeCloseTo(1 - elasticRailShare(.85, bounds));
    expect(elasticRailShare(-100, bounds)).toBeGreaterThan(.2);
    expect(elasticRailShare(100, bounds)).toBeLessThan(.8);
  });
  it('retains exactly a quarter of extra pull and never collapses either pane', () => {
    expect(settledRailShare(.85, bounds)).toBeCloseTo(.775);
    expect(settledRailShare(.15, bounds)).toBeCloseTo(.225);
    expect(settledRailShare(.6, bounds)).toBe(.6);
    expect(settledRailShare(5, bounds)).toBe(.8);
    expect(settledRailShare(-5, bounds)).toBe(.2);
  });
  it('can regrab retained or animated positions without jumping or ratcheting beyond hard limits', () => {
    for (const value of [.2, .225, .775, .8]) expect(elasticRailShare(value, railDragBounds(value))).toBe(value);
    let value = .75;
    for (let index = 0; index < 30; index++) value = settledRailShare(value + .1, railDragBounds(value));
    expect(value).toBe(.8);
    expect(elasticRailShare(5, railDragBounds(value))).toBe(.8);
  });
  it('keeps keyboard changes inside the normal bounds', () => {
    expect(clampRailKeyboard(.1)).toBe(.25);
    expect(clampRailKeyboard(.9)).toBe(.75);
    expect(clampRailKeyboard(.55)).toBe(.55);
  });
  it('hands off recent visual velocity but ignores held or missing samples', () => {
    const samples = [{ value: .5, time: 100 }, { value: .51, time: 120 }, { value: .52, time: 140 }];
    expect(railReleaseVelocity(samples, 150)).toBeCloseTo(.5);
    expect(railReleaseVelocity(samples, 221)).toBe(0);
    expect(railReleaseVelocity([], 100)).toBe(0);
    expect(railReleaseVelocity([{ value: .5, time: 100 }], 110)).toBe(0);
    expect(railReleaseVelocity([{ value: .2, time: 100 }, { value: .8, time: 110 }], 111)).toBe(.6);
  });
});
