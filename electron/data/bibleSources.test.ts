import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  HELLOAO_SOURCES, chapterRows, cleanVerseText, hasAcrosticTail, rowsSha256, validateBibleRows, verseText,
} from '../../scripts/lib/helloao-bible.mjs'
import { CHAPTER_COUNTS, type BibleRow } from '../../scripts/lib/usfm-bible.mjs'

const PSALMS = 18

/* A whole, valid Bible of invented one-word verses: every chapter has one
   verse, plus the spot references the validator looks for. */
function wholeBible(): BibleRow[] {
  const rows: BibleRow[] = []
  CHAPTER_COUNTS.forEach((chapters, book) => {
    for (let chapter = 1; chapter <= chapters; chapter++) rows.push([book, chapter, 1, 'Invented.'])
  })
  rows.push([42, 3, 16, 'Invented sixteen.'], [65, 22, 21, 'Invented end.'])
  return rows
}

describe('helloao text cleaning', () => {
  it('drops footnotes and formatting, and skips a verse that is only a footnote', () => {
    expect(verseText(['First part', { noteId: 3 }, { text: 'second part.', poem: 1 }, { lineBreak: true }])).toBe('First part second part.')
    const rows = chapterRows({ content: [
      { type: 'heading', content: ['Not scripture'] },
      { type: 'verse', number: 20, content: ['Invented verse twenty.'] },
      { type: 'verse', number: 21, content: [{ noteId: 0 }] },
      { type: 'verse', number: 22, content: ['Invented', { noteId: 1 }, ', verse twenty-two .'] },
    ] }, 39, 17)
    expect(rows).toEqual([[39, 17, 20, 'Invented verse twenty.'], [39, 17, 22, 'Invented, verse twenty-two.']])
  })

  it('takes the Psalm 119 stanza headings off the verse before them, in both spellings', () => {
    expect(cleanVerseText('Invented line. Another line. BETH', PSALMS, 119)).toBe('Invented line. Another line.')
    expect(cleanVerseText('Invented line: other line. ב BETH.', PSALMS, 119)).toBe('Invented line: other line.')
    expect(cleanVerseText('Invented line endures forever. SIN AND SHIN', PSALMS, 119)).toBe('Invented line endures forever.')
    expect(cleanVerseText('Invented line, before you. TAV', PSALMS, 119)).toBe('Invented line, before you.')
    // Only Psalm 119, only the capitalised names: an ordinary "he" stays.
    expect(cleanVerseText('Invented line. BETH', PSALMS, 118)).toBe('Invented line. BETH')
    expect(cleanVerseText('and so did he', PSALMS, 119)).toBe('and so did he')
    expect(hasAcrosticTail(PSALMS, 119, 'Invented. GIMEL')).toBe(true)
    expect(hasAcrosticTail(PSALMS, 119, 'Invented, O LORD.')).toBe(false)
  })

  it('closes up "[Selah" but leaves a bracket that closes', () => {
    expect(cleanVerseText('Invented line. [Selah', PSALMS, 3)).toBe('Invented line. Selah')
    expect(cleanVerseText('Invented line. [Higgaion. Selah', PSALMS, 9)).toBe('Invented line. Higgaion. Selah')
    expect(cleanVerseText('[Invented bracketed passage.]', 42, 8)).toBe('[Invented bracketed passage.]')
  })
})

describe('per-version validation', () => {
  it('accepts a complete Bible and fingerprints it independent of order', () => {
    const rows = wholeBible()
    expect(validateBibleRows(rows, { version: 'TEST', expectedVerses: rows.length })).toBe(rows)
    expect(rowsSha256([...rows].reverse())).toBe(rowsSha256(rows))
  })

  it('refuses a wrong count, a missing chapter, a duplicate, leftover markup or a stanza heading', () => {
    const rows = wholeBible()
    expect(() => validateBibleRows(rows, { version: 'TEST', expectedVerses: 31_086 })).toThrow('expected 31086 verses')
    expect(() => validateBibleRows(rows.filter((r) => !(r[0] === 37 && r[1] === 12)))).toThrow('1,189 chapters')
    expect(() => validateBibleRows([...rows, rows[0]])).toThrow('duplicate')
    expect(() => validateBibleRows([...rows, [0, 1, 2, 'Invented {noteId}']])).toThrow('unclean')
    expect(() => validateBibleRows([...rows, [PSALMS, 119, 8, 'Invented. BETH']])).toThrow('stanza heading')
    expect(() => validateBibleRows(rows.filter((r) => !(r[0] === 42 && r[1] === 3 && r[2] === 16)))).toThrow('John 3:16')
  })
})

/*
 * The generated database, when this checkout has one built by the current
 * script (it holds BSB). An older bible.db is skipped rather than failed: it
 * predates the cleaner and needs `node scripts/build-bible-db.mjs --version WEB`.
 */
describe('the generated bible.db', () => {
  const databasePath = fileURLToPath(new URL('../../bible.db', import.meta.url))
  const sourcesPath = fileURLToPath(new URL('./bible-sources.json', import.meta.url))
  const built = (() => {
    if (!existsSync(databasePath)) return false
    const db = new DatabaseSync(databasePath, { readOnly: true })
    try { return !!db.prepare("SELECT 1 FROM bible WHERE Version='BSB' LIMIT 1").get() } finally { db.close() }
  })()

  it.skipIf(!built)('holds WEB, BSB and ASV exactly as validated and recorded', () => {
    const recorded = JSON.parse(readFileSync(sourcesPath, 'utf8')).versions
    const db = new DatabaseSync(databasePath, { readOnly: true })
    try {
      expect(String((db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode).toLowerCase()).toBe('delete')
      for (const version of ['WEB', 'BSB', 'ASV'] as const) {
        const rows = db.prepare('SELECT Book,Chapter,Versecount,verse FROM bible WHERE Version=? ORDER BY Book,Chapter,Versecount').all(version)
          .map((row) => [Number(row.Book), Number(row.Chapter), Number(row.Versecount), String(row.verse)] as BibleRow)
        validateBibleRows(rows, { version, expectedVerses: HELLOAO_SOURCES[version].expectedVerses })
        expect(rowsSha256(rows), version).toBe(recorded[version].rowsSha256)
      }
      // The verses a modern Bible leaves out are absent rows, never empty text.
      const markOmits = db.prepare("SELECT Versecount FROM bible WHERE Version='BSB' AND Book=40 AND Chapter=9 AND Versecount BETWEEN 43 AND 48").all()
      expect(markOmits.map((row) => row.Versecount)).toEqual([43, 45, 47, 48])
    } finally { db.close() }
  /* Three whole Bibles read, validated and hashed: about two seconds on a
     quiet machine, so the default five is too tight on a busy one. */
  }, 30_000)
})
