import { describe, expect, it } from 'vitest';
import { bookAllowance, referenceColumnWidth, splitReference } from './referenceColumn';

describe('splitReference', () => {
  it('splits the book from the chapter and verse', () => {
    expect(splitReference('Song of Solomon 8:14')).toEqual({ book: 'Song of Solomon', place: '8:14' });
    expect(splitReference('1 Thessalonians 5:28')).toEqual({ book: '1 Thessalonians', place: '5:28' });
    expect(splitReference('John 11:38-44')).toEqual({ book: 'John', place: '11:38-44' });
    expect(splitReference('Exodus 2')).toEqual({ book: 'Exodus', place: '2' });
  });
  it('leaves what it cannot read whole', () => {
    expect(splitReference('Psalms')).toEqual({ book: 'Psalms', place: '' });
  });
});

describe('referenceColumnWidth', () => {
  it('fits the widest reference', () => {
    expect(referenceColumnWidth([52, 61.2, 58], 40, 99)).toBe(62);
  });
  it('stops at the cap, so a long book name gives way', () => {
    expect(referenceColumnWidth([103, 109], 40, 99)).toBe(99);
  });
  it('is never narrower than its header', () => {
    expect(referenceColumnWidth([45], 70, 99)).toBe(70);
    expect(referenceColumnWidth([], 70, 99)).toBe(70);
    expect(referenceColumnWidth([120], 110, 99)).toBe(110);
  });
});

describe('bookAllowance', () => {
  it('cuts every book name at the same point once the column is full', () => {
    /* 1 Thessalonians 5: 5:1 would fit at 99, 5:28 would not. */
    expect(bookAllowance(99, [97, 103], [16, 22])).toBe(77);
  });
  it('cuts nothing when everything fits', () => {
    expect(bookAllowance(82, [70, 82], [20, 26])).toBeNull();
  });
});
