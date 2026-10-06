import { describe, expect, it } from 'vitest';
import { clampTextWidth, textWidthFrame } from './textWidth';

describe('text width independent of the safe area', () => {
  it('keeps older themes at their existing safe width', () => {
    expect(textWidthFrame(10, undefined, 'center')).toEqual({ width: 80, left: 10 });
    expect(textWidthFrame(7, undefined, 'center')).toEqual({ width: 86, left: 7 });
  });

  it('keeps valid widths and bounds malformed saved values', () => {
    expect(clampTextWidth(72)).toBe(72);
    expect(clampTextWidth(-5)).toBe(40);
    expect(clampTextWidth(150)).toBe(100);
    expect(clampTextWidth(NaN)).toBe(80);
    expect(clampTextWidth(Infinity)).toBe(80);
  });

  it.each(['left', 'center', 'right'] as const)('reaches both screen edges at full width with %s alignment', (alignment) => {
    expect(textWidthFrame(20, 100, alignment)).toEqual({ width: 100, left: 0 });
  });

  it('extends beyond the guide while keeping a narrow text block aligned', () => {
    expect(textWidthFrame(10, 90, 'center')).toEqual({ width: 90, left: 5 });
    expect(textWidthFrame(10, 40, 'left')).toEqual({ width: 40, left: 10 });
    expect(textWidthFrame(10, 40, 'right')).toEqual({ width: 40, left: 50 });
  });
});
