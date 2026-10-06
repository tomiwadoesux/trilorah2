import { describe, it, expect } from 'vitest';
import { popupPlacement } from './popupPlacement';
describe('popup placement', () => {
  it('opens above a low trigger when there is room', () => {
    expect(popupPlacement({ left: 100, right: 130, top: 500, bottom: 530 }, { width: 190, height: 350 }, { width: 800, height: 600 })).toEqual({ left: 12, top: 144 });
  });
  it('keeps a tall submenu inside a short viewport and leaves room to scroll', () => {
    const position = popupPlacement({ left: 90, right: 120, top: 70, bottom: 100 }, { width: 190, height: 700 }, { width: 320, height: 360 });
    expect(position).toEqual({ left: 12, top: 12 });
  });
  it('clamps both edges after a window resize', () => {
    const position = popupPlacement({ left: 900, right: 930, top: 700, bottom: 730 }, { width: 200, height: 150 }, { width: 400, height: 300 });
    expect(position.left).toBe(188);
    expect(position.top).toBeLessThanOrEqual(138);
  });
});
