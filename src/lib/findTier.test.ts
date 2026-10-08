import { describe, expect, it } from 'vitest';
import { findTier, perPageFor } from './findTier';

/* Content boxes measured in an isolated instance (veil width/height less its
   padding), library lowered or raised. */
describe('findTier', () => {
  it('gives the roomy layout to a lowered library', () => {
    expect(findTier(346, 189)).toBe('full'); // 1024x640
    expect(findTier(457, 246)).toBe('full'); // 1280x720
  });

  it('drops the title line on a raised library at a large window', () => {
    expect(findTier(489, 136)).toBe('compact'); // 1366x768
  });

  it('reads the shape, not just the height: a wide, short band is not roomy', () => {
    // 1920 raised: tall enough for the old height-only rule, which cut the text.
    expect(findTier(703, 201)).toBe('compact');
    // A short window with the library lowered, about 3.7 times wider than tall.
    expect(findTier(700, 189)).toBe('compact');
    // Wider still: two to a page.
    expect(findTier(700, 150)).toBe('tight');
  });

  it('pages two at a time on a raised library at a laptop window', () => {
    expect(findTier(457, 127)).toBe('tight'); // 1280x720
  });

  it('slims the cards when the band is under 100px', () => {
    expect(findTier(346, 96)).toBe('micro'); // 1024x640 raised
    expect(findTier(288, 80)).toBe('micro'); // 900 raised
  });

  it('falls back to the roomy layout before anything is measured', () => {
    expect(findTier(0, 0)).toBe('full');
    expect(findTier(Number.NaN, 120)).toBe('full');
  });
});

describe('perPageFor', () => {
  it('shows the finder’s four at once unless the band is tight', () => {
    expect(perPageFor('full')).toBe(4);
    expect(perPageFor('compact')).toBe(4);
    expect(perPageFor('tight')).toBe(2);
    expect(perPageFor('micro')).toBe(2);
  });
});
