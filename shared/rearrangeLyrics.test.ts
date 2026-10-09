import { describe, expect, it } from 'vitest';
import { rearrangeLyrics } from './rearrangeLyrics';

describe('rearranging imported lyric cards', () => {
  it('balances uneven pages without dropping or reordering words', () => {
    const sections = [1, 2, 4].map((n, i) => ({ label: `Slide ${i + 1}`, lines: Array.from({ length: n }, (_, j) => `Sing line ${i}-${j}`) }));
    const result = rearrangeLyrics(sections);
    expect(result.map(s => s.lines.length).sort()).toEqual([3, 4]);
    expect(result.flatMap(s => s.lines)).toEqual(sections.flatMap(s => s.lines));
    expect(sections.map(s => s.lines.length)).toEqual([1, 2, 4]);
    expect(rearrangeLyrics(result)).toEqual(result);
  });
  it('keeps meaningful section boundaries and repeated choruses', () => {
    const sections = [
      { label: 'Verse 1', lines: ['One line'] },
      { label: 'Chorus', lines: ['Sing together', 'Sing again'], repeat: 2 },
      { label: 'Chorus', lines: ['Sing together', 'Sing again'] },
      { label: 'Verse 2', lines: ['Another line'] },
    ];
    expect(rearrangeLyrics(sections)).toEqual(sections);
  });
  it('rejoins numbered continuations but keeps the repeat at the end', () => {
    const result = rearrangeLyrics([
      { label: 'Verse 1', lines: ['A'] },
      { label: 'Verse 1 (2)', lines: ['B', 'C', 'D', 'E'], repeat: 2 },
      { label: 'Bridge', lines: ['F'] },
    ]);
    expect(result.slice(0, 2).map(s => s.lines.length).sort()).toEqual([2, 3]);
    expect(result.flatMap(s => s.lines)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(result[1].repeat).toBe(2);
    expect(result[2].label).toBe('Bridge');
  });
});
