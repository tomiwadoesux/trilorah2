import { describe, it, expect } from 'vitest';
import { matchesFollowedReading } from './readAlongGuard';

describe('automatic delivery guard', () => {
  const live = { book: 'John', chapter: 3, verse: 16, version: 'KJV' };
  const guard = { reference: 'John 3:16', version: 'KJV' };
  it('accepts only the original live reference and translation', () => {
    expect(matchesFollowedReading(guard, live)).toBe(true);
    expect(matchesFollowedReading(guard, { ...live, endVerse: 16 })).toBe(true);
    expect(matchesFollowedReading(guard, { ...live, verse: 17 })).toBe(false);
    expect(matchesFollowedReading(guard, { ...live, version: 'BSB' })).toBe(false);
    expect(matchesFollowedReading(guard, { ...live, endVerse: 18 })).toBe(false);
    expect(matchesFollowedReading(guard, null)).toBe(false);
  });
});
