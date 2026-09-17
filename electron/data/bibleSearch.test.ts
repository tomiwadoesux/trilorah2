import { describe, it, expect, beforeAll } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { searchBible, ensureFts, hasFts, toFtsQuery } from './bibleSearch'

const ROWS: Array<[number, number, number, string, string]> = [
  [52, 5, 16, 'Rejoice evermore.', 'KJV'],
  [49, 4, 4, 'Rejoice in the Lord alway: and again I say, Rejoice.', 'KJV'],
  [42, 3, 16, 'For God so loved the world, that he gave his only begotten Son', 'KJV'],
  [18, 22, 1, 'The LORD is my shepherd; I shall not want.', 'KJV'],
  [49, 4, 4, 'Regocijaos en el Señor siempre. Otra vez digo: ¡Regocijaos!', 'RVR']
]

function makeDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE bible (Book INTEGER, Chapter INTEGER, Versecount INTEGER, verse TEXT, Version TEXT)`)
  const ins = db.prepare('INSERT INTO bible VALUES (?, ?, ?, ?, ?)')
  for (const r of ROWS) ins.run(...r)
  return db
}

describe('toFtsQuery', () => {
  it('quotes words and drops FTS syntax', () => {
    expect(toFtsQuery('rejoice always')).toBe('"rejoice" "always"')
    expect(toFtsQuery('a "so" loved*')).toBe('"so" "loved"')
  })
})

describe('searchBible without FTS (LIKE fallback)', () => {
  const db = makeDb()
  it('matches every word, scoped to version', () => {
    expect(hasFts(db as any)).toBe(false)
    const hits = searchBible(db as any, 'rejoice lord')
    expect(hits.map((h) => `${h.book} ${h.chapter}:${h.verse}`)).toEqual(['Philippians 4:4'])
    expect(searchBible(db as any, 'regocijaos', { version: 'RVR' })).toHaveLength(1)
    expect(searchBible(db as any, 'regocijaos')).toHaveLength(0)
  })
  it('ignores tiny queries', () => {
    expect(searchBible(db as any, 'a')).toEqual([])
  })
})

describe('searchBible with FTS5', () => {
  let db: DatabaseSync
  beforeAll(() => {
    db = makeDb()
    ensureFts(db as any)
  })
  it('builds the index and ranks matches', () => {
    expect(hasFts(db as any)).toBe(true)
    const hits = searchBible(db as any, 'rejoice')
    expect(hits).toHaveLength(2)
    expect(hits[0].snippet).toContain('<b>')
    expect(hits.every((h) => h.version === 'KJV')).toBe(true)
  })
  it('is diacritic-insensitive', () => {
    expect(searchBible(db as any, 'senor', { version: 'RVR' })).toHaveLength(1)
  })
  it('honours the limit', () => {
    expect(searchBible(db as any, 'rejoice', { limit: 1 })).toHaveLength(1)
  })
})
