import { describe, expect, it } from 'vitest';
import { BOOKS } from './books';
import { chapterOrdinal, liveSpan, passingRows, spanReference, travelShape } from './scriptureReel';

describe('liveSpan', () => {
  it('reads a live verse or range off the projector item', () => {
    expect(liveSpan({ source: 'scripture', id: 'Genesis 22:1-3', label: '', reference: 'Genesis 22:1-3' }))
      .toEqual({ bookIndex: 0, book: 'Genesis', chapter: 22, first: 1, last: 3 });
    expect(liveSpan({ source: 'scripture', id: '1 Samuel 17:45', label: '' }))
      .toEqual({ bookIndex: 8, book: '1 Samuel', chapter: 17, first: 45, last: 45 });
  });
  it('reads a range written with an en dash, the way the phone writes it', () => {
    expect(liveSpan({ source: 'scripture', id: 'John 3:16–18@KJV', label: '', reference: 'John 3:16–18' }))
      .toEqual({ bookIndex: 42, book: 'John', chapter: 3, first: 16, last: 18 });
  });
  it('ignores what is not a verse it can find', () => {
    expect(liveSpan({ source: 'song', id: 'Amazing Grace', label: '' })).toBeNull();
    expect(liveSpan({ source: 'scripture', id: 'Genesis 22', label: '' })).toBeNull();
    expect(liveSpan({ source: 'scripture', id: 'Genesis 51:1', label: '' })).toBeNull();
    expect(liveSpan(null)).toBeNull();
  });
  it('writes the span back the way the field takes it', () => {
    expect(spanReference({ bookIndex: 42, book: 'John', chapter: 11, first: 38, last: 44 })).toBe('John 11:38-44');
    expect(spanReference({ bookIndex: 42, book: 'John', chapter: 3, first: 16, last: 16 })).toBe('John 3:16');
  });
});

describe('the reel', () => {
  it('numbers chapters across the whole Bible', () => {
    expect(chapterOrdinal(0, 1)).toBe(0);
    expect(chapterOrdinal(1, 1)).toBe(50);
    expect(chapterOrdinal(65, 22)).toBe(1188);
  });
  it('passes references between the two places, in order, none twice', () => {
    const rows = passingRows({ bookIndex: 0, chapter: 1 }, { bookIndex: 42, chapter: 11 }, 20);
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map((r) => r.ref)).size).toBe(20);
    const books = rows.map((r) => r.ref.replace(/ \d+$/, ''));
    expect(books[0]).toBe('Genesis');
    expect(books).toContain('Psalms');
    /* In Bible order: each row's chapter at or after the one before. */
    const place = rows.map((r) => {
      const m = r.ref.match(/^(.+) (\d+)$/)!;
      return chapterOrdinal(BOOKS.indexOf(m[1]), Number(m[2]));
    });
    expect([...place].sort((x, y) => x - y)).toEqual(place);
  });
  it('passes only real chapters, and none between neighbours', () => {
    expect(passingRows({ bookIndex: 0, chapter: 21 }, { bookIndex: 0, chapter: 22 }, 12)).toEqual([]);
    expect(passingRows({ bookIndex: 0, chapter: 50 }, { bookIndex: 1, chapter: 3 }, 12).map((r) => r.ref))
      .toEqual(['Exodus 1', 'Exodus 2']);
  });
  it('takes longer, within a limit, the further it goes', () => {
    const near = travelShape(0, 1);
    const far = travelShape(0, 1188);
    expect(far.ms).toBeGreaterThan(near.ms);
    expect(far.ms).toBeLessThanOrEqual(900);
    expect(far.passing).toBeLessThanOrEqual(30);
  });
});
