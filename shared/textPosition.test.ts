import { describe, expect, it } from 'vitest';
import { isTextPosition, resolveTextPosition } from './textPosition';

describe('slide text placement', () => {
  it.each([
    ['top-left', 'flex-start', 'flex-start', 'left', true],
    ['top-right', 'flex-start', 'flex-end', 'right', true],
    ['middle-left', 'center', 'flex-start', 'left', false],
    ['middle-right', 'center', 'flex-end', 'right', false],
    ['bottom-left', 'flex-end', 'flex-start', 'left', false],
    ['bottom-right', 'flex-end', 'flex-end', 'right', false],
  ])('%s places the text and reference on the intended edges', (id, justifyContent, alignItems, textAlign, referenceAbove) => {
    expect(isTextPosition(id)).toBe(true);
    expect(resolveTextPosition(id)).toMatchObject({ justifyContent, alignItems, textAlign, referenceAbove });
  });

  it('keeps the top reference above and distinguishes center from bottom center', () => {
    expect(resolveTextPosition('top')).toMatchObject({ justifyContent: 'flex-start', textAlign: 'center', referenceAbove: true });
    expect(resolveTextPosition('center')).toMatchObject({ justifyContent: 'center', textAlign: 'center', referenceAbove: false });
    expect(resolveTextPosition('bottom-center')).toMatchObject({ justifyContent: 'flex-end', textAlign: 'center', referenceAbove: false });
  });

  it('restores legacy bottom settings and centers an unrecognized value', () => {
    expect(resolveTextPosition('bottom')).toEqual(resolveTextPosition('bottom-center'));
    expect(resolveTextPosition('invalid')).toEqual(resolveTextPosition('center'));
    expect(isTextPosition('invalid')).toBe(false);
  });
});
