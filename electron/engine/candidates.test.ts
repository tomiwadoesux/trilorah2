import { describe, it, expect } from 'vitest'
import {
  buildCandidates,
  candidatesFromQuotes,
  isClash,
  rank,
  type Candidate
} from './candidates'

// Fake Bible: every verse ≤ 50 exists, except Jonah has only 4 chapters.
const verseExists = (book: string, chapter: number, verse: number) => {
  if (book === 'Jonah' && chapter > 4) return false
  return verse <= 50 && chapter <= 150
}

const john316 = { book: 'John', chapter: 3, verse: 16, confidence: 0.8 }

describe('buildCandidates', () => {
  it('puts the primary first at confidence*100', () => {
    const list = buildCandidates(john316, { verseExists })
    expect(list[0]).toMatchObject({ book: 'John', chapter: 3, verse: 16, score: 80, source: 'primary' })
  })

  it('adds number confusions (16↔60) only when the verse exists', () => {
    const list = buildCandidates(john316, { verseExists })
    // John 3:60 does not exist in the fake Bible (verse > 50) → no verse alternate
    expect(list.find((c) => c.verse === 60)).toBeUndefined()
    const exists = () => true
    const wide = buildCandidates(john316, { verseExists: exists })
    const alt = wide.find((c) => c.verse === 60)
    expect(alt).toMatchObject({ book: 'John', chapter: 3, score: 55, source: 'confusion' })
  })

  it('adds chapter confusions and book homophones with the right penalties', () => {
    const list = buildCandidates(
      { book: 'John', chapter: 13, verse: 1, confidence: 0.9 },
      { verseExists: () => true, quoteCandidates: [] }
    )
    const scores = Object.fromEntries(list.map((c) => [`${c.book} ${c.chapter}:${c.verse}`, c.score]))
    expect(scores['John 13:1']).toBe(90)
    expect(scores['John 30:1']).toBe(65)
    // book alternates are −30 → 60; cap 4 keeps only the best ones
    expect(list.length).toBeLessThanOrEqual(4)
    expect(list.every((c) => c.score <= 90)).toBe(true)
    expect(list.filter((c) => c.source === 'confusion').every((c) => c.score === 65 || c.score === 60)).toBe(true)
  })

  it('does not offer a book alternate whose chapter does not exist', () => {
    const list = buildCandidates(
      { book: 'John', chapter: 10, verse: 1, confidence: 0.9 },
      { verseExists }
    )
    expect(list.find((c) => c.book === 'Jonah')).toBeUndefined()
    expect(list.find((c) => c.book === 'Joel')).toBeDefined()
  })

  it('boosts an alternate that lands in a recently shown chapter', () => {
    const list = buildCandidates(
      { book: 'John', chapter: 3, verse: 16, confidence: 0.7 },
      { verseExists: () => true, recentRefs: [{ book: 'Jonah', chapter: 3 }] }
    )
    const jonah = list.find((c) => c.book === 'Jonah')!
    expect(jonah.score).toBe(70 - 30 + 10)
    expect(jonah.reasons).toContain('recent chapter')
  })

  it('applies seasonal and heard-verbatim bonuses', () => {
    const list = buildCandidates(
      { book: 'Luke', chapter: 2, verse: 14, confidence: 0.7 },
      {
        verseExists: () => true,
        seasonalBoost: (b) => (b === 'Luke' ? 8 : 0),
        heardText: 'luke chapter two verse forty'
      }
    )
    const v40 = list.find((c) => c.verse === 40)!
    expect(v40.score).toBe(70 - 25 + 8 + 5)
  })

  it('merges quote candidates, dedups and caps at 4', () => {
    const quotes = candidatesFromQuotes([
      { ref: 'John 3:16', chapter: 3, verse: 16, confidence: 0.95, matchedWords: 9 },
      { ref: '1 John 3:16', chapter: 3, verse: 16, confidence: 0.5 }
    ])
    const list = buildCandidates(john316, { verseExists: () => true, quoteCandidates: quotes })
    expect(list.length).toBeLessThanOrEqual(4)
    // dup of John 3:16 collapses to the higher score, reasons merged
    const j = list.filter((c) => c.book === 'John' && c.chapter === 3 && c.verse === 16)
    expect(j).toHaveLength(1)
    expect(j[0].score).toBe(95)
    expect(j[0].reasons).toContain('quoted text')
    expect(list[0]).toBe(j[0])
    // sorted desc
    for (let i = 1; i < list.length; i++) expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score)
  })

  it('drops a range when the verse itself is swapped', () => {
    const list = buildCandidates(
      { book: 'John', chapter: 3, verse: 16, endVerse: 18, confidence: 0.8 },
      { verseExists: () => true }
    )
    expect(list[0].endVerse).toBe(18)
    expect(list.find((c) => c.verse === 60)!.endVerse).toBeUndefined()
  })
})

describe('candidatesFromQuotes', () => {
  it('parses the book off the ref and keeps confidence*100', () => {
    const [c] = candidatesFromQuotes([{ ref: '1 Corinthians 13:4', chapter: 13, verse: 4, confidence: 0.83 }])
    expect(c).toMatchObject({ book: '1 Corinthians', chapter: 13, verse: 4, score: 83, source: 'quote' })
  })
})

describe('isClash', () => {
  const mk = (score: number): Candidate => ({
    book: 'X',
    chapter: 1,
    verse: score,
    score,
    reasons: [],
    source: 'primary'
  })
  it('is a clash when the top two are within the margin', () => {
    expect(isClash([mk(70), mk(60)])).toBe(true)
    expect(isClash([mk(70), mk(55)])).toBe(true)
    expect(isClash([mk(70), mk(54)])).toBe(false)
  })
  it('is never a clash when the leader is ≥92', () => {
    expect(isClash([mk(95), mk(90)])).toBe(false)
  })
  it('is never a clash with fewer than two candidates', () => {
    expect(isClash([mk(50)])).toBe(false)
    expect(isClash([])).toBe(false)
  })
  it('honours a custom margin', () => {
    expect(isClash([mk(70), mk(55)], 10)).toBe(false)
  })
  it('rank keeps order stable for equal scores', () => {
    const r = rank([mk(50), mk(50)])
    expect(r).toHaveLength(1) // same key → dedup
  })
})
