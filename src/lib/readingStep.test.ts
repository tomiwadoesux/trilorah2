import { describe, expect, it } from 'vitest';
import { readingStep } from './readingStep';

describe('readingStep', () => {
  it('walks the pages of a reading before leaving it', () => {
    // Three pages (verses 1, 2, 3): next goes 0 → 1 → 2, then leaves.
    expect(readingStep(0, 3, 1)).toBe(1);
    expect(readingStep(1, 3, 1)).toBe(2);
    expect(readingStep(2, 3, 1)).toBeNull();
  });

  it('walks back to the first page before the verse before', () => {
    expect(readingStep(2, 3, -1)).toBe(1);
    expect(readingStep(0, 3, -1)).toBeNull();
  });

  it('leaves a one-page reading at once', () => {
    expect(readingStep(0, 1, 1)).toBeNull();
    expect(readingStep(0, 0, -1)).toBeNull();
  });
});
