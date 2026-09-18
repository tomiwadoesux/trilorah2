import { describe, it, expect } from 'vitest'
import { formatParsed, isReferenceSeparator, parseReference } from './parseReference'
import type { ParsedReference } from './parseReference'

/** Compact assertion helper — the shape is the same in nearly every case. */
function expectRef(
  input: string,
  expected: Partial<ParsedReference>
): ParsedReference {
  const p = parseReference(input)
  expect(p, `expected ${JSON.stringify(input)} to parse`).not.toBeNull()
  expect({ ...p }).toMatchObject(expected)
  return p as ParsedReference
}

describe('parseReference — the accepted forms', () => {
  it('book and chapter only', () => {
    expectRef('john 3', { bookQuery: 'john', chapter: 3, verse: null, endVerse: null })
  })

  it('colon between chapter and verse', () => {
    expectRef('john 3:16', { bookQuery: 'john', chapter: 3, verse: 16, endVerse: null })
  })

  it('space as the separator (ProPresenter habit)', () => {
    expectRef('john 3 16', { bookQuery: 'john', chapter: 3, verse: 16, endVerse: null })
  })

  it('dot as the separator', () => {
    expectRef('john 3.16', { bookQuery: 'john', chapter: 3, verse: 16, endVerse: null })
  })

  it('hyphen range', () => {
    expectRef('john 3:16-18', { chapter: 3, verse: 16, endVerse: 18 })
  })

  it('en dash and em dash ranges', () => {
    expectRef('john 3:16–18', { chapter: 3, verse: 16, endVerse: 18 })
    expectRef('john 3:16—18', { chapter: 3, verse: 16, endVerse: 18 })
  })

  it("three bare numbers — ProPresenter's 'Matt 1 2 3'", () => {
    expectRef('john 3 16 18', { bookQuery: 'john', chapter: 3, verse: 16, endVerse: 18 })
    expectRef('Matt 1 2 3', { bookQuery: 'Matt', chapter: 1, verse: 2, endVerse: 3 })
  })

  it('spaces around the dash', () => {
    expectRef('john 3:16 - 18', { chapter: 3, verse: 16, endVerse: 18 })
  })

  it('multi-word book names', () => {
    expectRef('song of solomon 2:1', { bookQuery: 'song of solomon', chapter: 2, verse: 1 })
    expectRef('psalm 23', { bookQuery: 'psalm', chapter: 23, verse: null })
  })

  it('is case-insensitive and keeps the typed casing in bookQuery', () => {
    expectRef('JOHN 3:16', { bookQuery: 'JOHN', chapter: 3, verse: 16 })
    expectRef('Song Of Solomon 2', { bookQuery: 'Song Of Solomon', chapter: 2 })
  })

  it('collapses any run of whitespace', () => {
    expectRef('  john    3   :   16  ', { bookQuery: 'john', chapter: 3, verse: 16 })
    expectRef('1    cor 13', { bookQuery: '1 cor', chapter: 13 })
  })

  it('book alone leaves chapter null so the caller can complete it', () => {
    expectRef('john', { bookQuery: 'john', chapter: null, verse: null, endVerse: null, partial: false })
    expectRef('song of', { bookQuery: 'song of', chapter: null })
  })
})

describe('parseReference — the numbered-book ambiguity', () => {
  it('a leading digit belongs to the book', () => {
    expectRef('1 cor 13:4-7', { bookQuery: '1 cor', chapter: 13, verse: 4, endVerse: 7 })
    expectRef('2 samuel 7 12 14', { bookQuery: '2 samuel', chapter: 7, verse: 12, endVerse: 14 })
    expectRef('3 john 1:4', { bookQuery: '3 john', chapter: 1, verse: 4 })
  })

  it('keeps an unspaced ordinal unspaced', () => {
    expectRef('1john 1:9', { bookQuery: '1john', chapter: 1, verse: 9 })
    expectRef('2tim 2', { bookQuery: '2tim', chapter: 2 })
  })

  it('accepts roman-numeral-ish and word prefixes', () => {
    expectRef('ii tim 2:2', { bookQuery: 'ii tim', chapter: 2, verse: 2 })
    expectRef('i john 4:8', { bookQuery: 'i john', chapter: 4, verse: 8 })
    expectRef('iii john 2', { bookQuery: 'iii john', chapter: 2 })
    expectRef('first corinthians 13', { bookQuery: 'first corinthians', chapter: 13 })
    expectRef('Second Kings 2:11', { bookQuery: 'Second Kings', chapter: 2, verse: 11 })
  })

  it('the other direction: trailing digits are never book words', () => {
    // '1 cor 13' — the 13 is a chapter even though a digit also opened the input.
    const a = expectRef('1 cor 13', { bookQuery: '1 cor', chapter: 13 })
    expect(a.verse).toBeNull()
    // A book with no ordinal never absorbs its first number.
    expectRef('cor 13', { bookQuery: 'cor', chapter: 13 })
    // Only ONE ordinal is consumed, and only when letters follow it, so a run
    // of bare digits never becomes a book.
    expect(parseReference('1 2 3')).toBeNull()
  })

  it('an ordinal with no book after it is not a reference', () => {
    expect(parseReference('1 2 3')).toBeNull()
    expect(parseReference('2')).toBeNull()
    expect(parseReference('ii')).not.toBeNull() // 'ii' alone is still letters — a book fragment
  })
})

describe('parseReference — overflow, reversal and zeroes', () => {
  it('takes the first three numbers and ignores the rest', () => {
    expectRef('john 3 16 18 20', { chapter: 3, verse: 16, endVerse: 18 })
    expectRef('john 3:16-18 22 99 4', { chapter: 3, verse: 16, endVerse: 18 })
  })

  it('normalises a reversed range by swapping', () => {
    expectRef('john 3:18-16', { chapter: 3, verse: 16, endVerse: 18 })
    expectRef('john 3 18 16', { chapter: 3, verse: 16, endVerse: 18 })
  })

  it('collapses a single-verse range', () => {
    expectRef('john 3:16-16', { chapter: 3, verse: 16, endVerse: null })
  })

  it('drops zero chapters and verses instead of resolving nowhere', () => {
    expectRef('john 0', { chapter: null, verse: null, endVerse: null })
    expectRef('john 3:0', { chapter: 3, verse: null, endVerse: null })
    expectRef('john 3:16-0', { chapter: 3, verse: 16, endVerse: null })
  })

  it('handles large and multi-digit numbers', () => {
    expectRef('psalm 119:105-112', { chapter: 119, verse: 105, endVerse: 112 })
  })

  it('stops at letters that follow the numbers', () => {
    expectRef('john 3 16 kjv', { bookQuery: 'john', chapter: 3, verse: 16, endVerse: null })
  })
})

describe('parseReference — partial detection', () => {
  it('is partial while the operator is mid-separator', () => {
    expect(parseReference('john 3:')!.partial).toBe(true)
    expect(parseReference('john 3.')!.partial).toBe(true)
    expect(parseReference('john 3:16-')!.partial).toBe(true)
    expect(parseReference('john 3:16 - ')!.partial).toBe(true)
    expect(parseReference('john 3–')!.partial).toBe(true)
  })

  it('a trailing space after a number is partial (verse incoming)', () => {
    expect(parseReference('john 3 ')!.partial).toBe(true)
    expect(parseReference('john 3 16 ')!.partial).toBe(true)
  })

  it('a trailing space after the book alone is NOT partial', () => {
    expect(parseReference('john ')!.partial).toBe(false)
    expect(parseReference('song of solomon ')!.partial).toBe(false)
  })

  it('a complete reference is never partial', () => {
    expect(parseReference('john 3')!.partial).toBe(false)
    expect(parseReference('john 3:16')!.partial).toBe(false)
    expect(parseReference('john 3:16-18')!.partial).toBe(false)
  })

  it('still returns the numbers it already has while partial', () => {
    expectRef('john 3:16-', { chapter: 3, verse: 16, endVerse: null, partial: true })
  })
})

describe('parseReference — the null cases', () => {
  it('rejects empty and whitespace', () => {
    expect(parseReference('')).toBeNull()
    expect(parseReference('   ')).toBeNull()
    expect(parseReference('\t\n ')).toBeNull()
  })

  it('rejects a bare number with no book', () => {
    expect(parseReference('3:16')).toBeNull()
    expect(parseReference('3 16 18')).toBeNull()
    expect(parseReference('23')).toBeNull()
  })

  it('rejects pure punctuation', () => {
    expect(parseReference(':')).toBeNull()
    expect(parseReference('---')).toBeNull()
    expect(parseReference('...:-')).toBeNull()
    expect(parseReference('!!!')).toBeNull()
  })

  it('rejects non-strings defensively', () => {
    expect(parseReference(null as unknown as string)).toBeNull()
    expect(parseReference(undefined as unknown as string)).toBeNull()
  })
})

describe('formatParsed', () => {
  it('renders the canonical string at each level of detail', () => {
    expect(formatParsed(parseReference('john')!, 'John')).toBe('John')
    expect(formatParsed(parseReference('john 3')!, 'John')).toBe('John 3')
    expect(formatParsed(parseReference('john 3 16')!, 'John')).toBe('John 3:16')
    expect(formatParsed(parseReference('john 3 16 18')!, 'John')).toBe('John 3:16-18')
    expect(formatParsed(parseReference('1 cor 13:4-7')!, '1 Corinthians')).toBe('1 Corinthians 13:4-7')
  })

  it('trims the supplied book name', () => {
    expect(formatParsed(parseReference('john 3')!, '  John  ')).toBe('John 3')
  })
})

describe('idempotence', () => {
  const cases: Array<[string, string]> = [
    ['john 3', 'John'],
    ['john 3:16', 'John'],
    ['john 3 16', 'John'],
    ['john 3.16', 'John'],
    ['john 3:16-18', 'John'],
    ['john 3—16', 'John'],
    ['john 3 16 18', 'John'],
    ['john 3:18-16', 'John'],
    ['john 3 16 18 20', 'John'],
    ['1 cor 13:4-7', '1 Corinthians'],
    ['1john 1:9', '1 John'],
    ['ii tim 2:2', '2 Timothy'],
    ['song of solomon 2:1', 'Song of Solomon'],
    ['psalm 23', 'Psalm']
  ]

  it('re-parsing a formatted reference gives the same numbers and format', () => {
    for (const [input, book] of cases) {
      const first = parseReference(input)!
      const rendered = formatParsed(first, book)
      const second = parseReference(rendered)
      expect(second, `${rendered} should re-parse`).not.toBeNull()
      expect({
        chapter: second!.chapter,
        verse: second!.verse,
        endVerse: second!.endVerse
      }).toEqual({ chapter: first.chapter, verse: first.verse, endVerse: first.endVerse })
      expect(formatParsed(second!, book)).toBe(rendered)
    }
  })

  it('the round trip resolves the book fragment back to itself', () => {
    const p = parseReference('1 cor 13:4-7')!
    const again = parseReference(formatParsed(p, '1 Corinthians'))!
    expect(again.bookQuery).toBe('1 Corinthians')
  })
})

describe('isReferenceSeparator', () => {
  it('knows the separators the parser breaks on', () => {
    for (const ch of [' ', '.', ':', '-', '–', '—']) expect(isReferenceSeparator(ch)).toBe(true)
    for (const ch of ['a', '1', ';', '/']) expect(isReferenceSeparator(ch)).toBe(false)
  })
})
