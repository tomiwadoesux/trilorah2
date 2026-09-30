import { describe, expect, it } from 'vitest'
import { parts } from './referenceParts'

/*
 * The typed reference, split.
 *
 * These exist because of one field bug: the pattern had no case for a dash,
 * so "Psalm 91:5-9" — any range at all — failed the match and fell through to
 * `chapter: null`. The field then reported "no reference", the caller had
 * nothing to look up, and the words went off the screen mid-service.
 */
describe('parts', () => {
  it('reads a plain verse', () => {
    expect(parts('Psalm 91:7')).toEqual({
      book: 'Psalm ',
      chapter: '91',
      verse: '7',
      rangeEnd: null
    })
  })

  it('reads a range — the bug that blanked the screen', () => {
    expect(parts('Psalm 91:5-9')).toEqual({
      book: 'Psalm ',
      chapter: '91',
      verse: '5',
      rangeEnd: '9'
    })
  })

  it('keeps the reference alive while the range is half typed', () => {
    /* The dash has landed, the second number has not. The verse must still
       be there, or the screen blanks between two keystrokes. */
    const p = parts('Psalm 91:5-')
    expect(p.chapter).toBe('91')
    expect(p.verse).toBe('5')
    expect(p.rangeEnd).toBe('')
  })

  it('accepts the dashes a real keyboard and a paste produce', () => {
    for (const dash of ['-', '–', '—']) {
      expect(parts(`John 3:16${dash}18`).rangeEnd).toBe('18')
    }
    expect(parts('John 3:16 - 18').rangeEnd).toBe('18')
  })

  it('handles a numbered book with a range', () => {
    expect(parts('1 John 2:3-5')).toEqual({
      book: '1 John ',
      chapter: '2',
      verse: '3',
      rangeEnd: '5'
    })
  })

  it('is not a range when no dash was typed', () => {
    expect(parts('Psalm 91').rangeEnd).toBeNull()
    expect(parts('Psalm 91:7').rangeEnd).toBeNull()
  })

  it('still reads a book on its own, and a chapter on its own', () => {
    expect(parts('Genesis')).toEqual({ book: 'Genesis', chapter: null, verse: null, rangeEnd: null })
    expect(parts('Genesis 3')).toEqual({ book: 'Genesis ', chapter: '3', verse: null, rangeEnd: null })
  })
})

it('preserves a reference and range after trailing whitespace', () => {
  expect(parts('Titus 1:3 ')).toEqual(parts('Titus 1:3'));
  expect(parts('Psalm 104:12   ')).toEqual(parts('Psalm 104:12'));
  expect(parts('John 3:16-18 ')).toEqual(parts('John 3:16-18'));
});
