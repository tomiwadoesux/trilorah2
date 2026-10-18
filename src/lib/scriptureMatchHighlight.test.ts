import { describe, expect, it } from 'vitest';
import { scriptureMatchParts, scriptureMatchExcerpt } from './scriptureMatchHighlight';
describe('matching words in a suggested passage', () => {
  it('preserves all displayed text and highlights distinctive shared words', () => {
    const text = 'Yet not I, but the grace of God which was with me.';
    const parts = scriptureMatchParts(text, "He said it is not me, but the grace");
    expect(parts.map(part => part.text).join('')).toBe(text);
    expect(parts.filter(part => part.match).map(part => part.text)).toEqual(['grace']);
  });
  it('does not color an entire semantic result as an exact quotation', () => {
    const parts = scriptureMatchParts('Be strong and of a good courage.', 'do not be afraid');
    expect(parts.some(part => part.match)).toBe(false);
  });
});

it('brings shared wording near the start of a long result without changing it', () => {
  const text = 'For I am the least of the apostles, that am not meet to be called an apostle, because I persecuted the church of God. But by the grace of God I am what I am.';
  const excerpt = scriptureMatchExcerpt(text, 'the grace of God');
  expect(excerpt).toContain('grace of God I am what I am.');
  expect(excerpt.startsWith('… ')).toBe(true);
  expect(text.endsWith(excerpt.slice(2))).toBe(true);
  expect(excerpt.split('grace')[0].trim().split(/\s+/).length).toBeLessThanOrEqual(7);
});
