import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { CHAPTER_TTL_MS, MAX_CHAPTERS_PER_VERSION, OnlineBibleCache } from './onlineCache'
import { readVersePreview, readVerseRange } from '../../engine/verseDelivery'

const DAY = 24 * 60 * 60 * 1000

function cache(start = 1_000_000) {
  let now = start
  const db = new DatabaseSync(':memory:')
  const c = new OnlineBibleCache(db as never, () => now)
  c.init()
  return { c, db, advance: (ms: number) => { now += ms } }
}

/* Invented words, never a real translation's text. */
const chapterOf = (n: number) => Array.from({ length: n }, (_, i) => ({ verse: i + 1, text: `Invented verse ${i + 1}.` }))
const NIV = { code: 'NIV', bibleId: 111, title: 'Invented title', attribution: 'Invented copyright' }

describe('OnlineBibleCache', () => {
  it('is read by the same SQL as bible.db, so previews and ranges need no second code path', () => {
    const { c, db } = cache()
    c.saveListing([NIV], 'key-a')
    c.putChapter('NIV', 42, 3, chapterOf(20))
    expect(c.hasChapter('NIV', 42, 3)).toBe(true)
    const preview = readVersePreview(db as never, 'John 3:16-17', 'NIV')
    expect(preview?.text).toBe('Invented verse 16. Invented verse 17.')
    expect(preview?.version).toBe('NIV')
    expect(readVerseRange(db as never, 42, 3, 19, 25, 'NIV').map((r) => r.verse)).toEqual([19, 20])
  })

  it('keeps the listing with the key it came from, and a new listing drops versions no longer on it', () => {
    const { c } = cache()
    c.saveListing([NIV, { ...NIV, code: 'NKJV', bibleId: 114 }], 'key-a')
    c.putChapter('NKJV', 0, 1, chapterOf(3))
    expect(c.listing().versions.map((v) => v.code)).toEqual(['NIV', 'NKJV'])
    expect(c.listing().keyId).toBe('key-a')
    c.saveListing([NIV], 'key-a')
    expect(c.listing().versions.map((v) => v.code)).toEqual(['NIV'])
    expect(c.hasChapter('NKJV', 0, 1)).toBe(false)
    expect(c.chapterCount()).toBe(0)
  })

  it('forgets a chapter after 30 days, on its next read and in the hourly purge', () => {
    const { c, advance } = cache()
    c.saveListing([NIV], 'key-a')
    c.putChapter('NIV', 0, 1, chapterOf(3))
    c.putChapter('NIV', 0, 2, chapterOf(3))
    advance(CHAPTER_TTL_MS - DAY)
    expect(c.hasChapter('NIV', 0, 1)).toBe(true)
    advance(DAY)
    expect(c.hasChapter('NIV', 0, 1)).toBe(false)
    expect(c.purgeStale()).toBe(1)
    expect(c.chapterCount('NIV')).toBe(0)
  })

  it('holds at most a tenth of a Bible per version, dropping the least recently used', () => {
    const { c, advance } = cache()
    c.saveListing([NIV], 'key-a')
    for (let ch = 1; ch <= MAX_CHAPTERS_PER_VERSION; ch++) {
      c.putChapter('NIV', 18, ch, chapterOf(2))
      advance(1000)
    }
    c.touch('NIV', 18, 1) // read again: no longer the oldest
    advance(1000)
    c.putChapter('NIV', 18, MAX_CHAPTERS_PER_VERSION + 1, chapterOf(2))
    expect(c.chapterCount('NIV')).toBe(MAX_CHAPTERS_PER_VERSION)
    expect(c.hasChapter('NIV', 18, 1)).toBe(true)
    expect(c.hasChapter('NIV', 18, 2)).toBe(false)
  })

  it('a withdrawn version or a refused key leaves nothing behind', () => {
    const { c, db } = cache()
    c.saveListing([NIV, { ...NIV, code: 'NKJV', bibleId: 114 }], 'key-a')
    c.putChapter('NIV', 0, 1, chapterOf(2))
    c.putChapter('NKJV', 0, 1, chapterOf(2))
    c.dropVersion('NIV')
    expect(c.listing().versions.map((v) => v.code)).toEqual(['NKJV'])
    expect(readVerseRange(db as never, 0, 1, 1, 2, 'NIV')).toEqual([])
    c.clearListing()
    expect(c.listing()).toEqual({ versions: [], listedAt: null, keyId: null })
    expect((db.prepare('SELECT COUNT(*) AS n FROM bible').get() as { n: number }).n).toBe(0)
  })

  it('a chapter fetched again replaces the old words rather than adding to them', () => {
    const { c, db } = cache()
    c.saveListing([NIV], 'key-a')
    c.putChapter('NIV', 0, 1, chapterOf(3))
    c.putChapter('NIV', 0, 1, [{ verse: 1, text: 'Invented replacement.' }])
    expect(readVerseRange(db as never, 0, 1, 1, 3, 'NIV')).toEqual([{ verse: 1, text: 'Invented replacement.' }])
  })
})
