import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseUsfmBook, readZipEntries, validateKjvRows } from '../../scripts/lib/usfm-bible.mjs'
import { replaceBibleVersion } from '../../scripts/lib/replace-bible-version.mjs'

describe('Explicitly numbered KJV imports', () => {
  const databasePath = fileURLToPath(new URL('../../bible.db', import.meta.url))
  it.skipIf(!existsSync(databasePath))('validates the generated KJV database, including known numbering regressions', () => {
    const db = new DatabaseSync(databasePath, { readOnly: true })
    try {
      const rows = db.prepare("SELECT Book,Chapter,Versecount,verse FROM bible WHERE Version='KJV' ORDER BY Book,Chapter,Versecount").all()
      const canonical = rows.map(row => [Number(row.Book), Number(row.Chapter), Number(row.Versecount), String(row.verse)] as [number, number, number, string])
      expect(validateKjvRows(canonical)).toHaveLength(31_102)
    } finally { db.close() }
  })

  it('uses verse identifiers, never array offsets, even if a source skips a verse', () => {
    const rows = parseUsfmBook(String.raw`\id MAT
\c 26
\v 39 First source verse.
\v 41 \wj \+w Watch|strong="G1127"\+w* and pray, the flesh \+add is\+add* weak.\wj*
\v 42 Next source verse.\f + \fr 26:42 \ft A note that must not become Scripture.\f*`)
    expect(rows.map(row => row[2])).toEqual([39, 41, 42])
    expect(rows[1]).toEqual([39, 26, 41, 'Watch and pray, the flesh is weak.'])
    expect(rows[2][3]).toBe('Next source verse.')
    expect(() => validateKjvRows(rows)).toThrow('31,102')
  })

  it('drops headings and notes but keeps supplied words and correct chapter boundaries', () => {
    expect(parseUsfmBook(String.raw`\id PSA
\c 23
\d A Psalm of David.
\v 1 The \w LORD|strong="H3068"\w* \add is\add* my shepherd.
\c 24
\v 1 The earth is the LORD’s.\x + \xt Genesis 1:1\x*`)).toEqual([
      [18, 23, 1, 'The LORD is my shepherd.'], [18, 24, 1, 'The earth is the LORD’s.'],
    ])
    expect(parseUsfmBook(String.raw`\id TOB
\c 1
\v 1 A different canon.`)).toEqual([])
  })

  it('keeps the verse under a bare heading marker (BSB Zechariah 12:1)', () => {
    expect(parseUsfmBook(String.raw`\id ZEC
\c 12
\d
\v 1 Invented first verse.
\v 2 Invented second verse.`)).toEqual([[37, 12, 1, 'Invented first verse.'], [37, 12, 2, 'Invented second verse.']])
  })

  it('rejects invalid archives without extracting any files', () => {
    expect(() => readZipEntries(Buffer.from('not a zip'))).toThrow('ZIP directory')
  })

  it('replaces only KJV, preserves other rows/schema, and rebuilds existing FTS', () => {
    const db = new DatabaseSync(':memory:')
    try {
      db.exec(`CREATE TABLE bible(Book INTEGER, Chapter INTEGER, Versecount INTEGER, verse TEXT NOT NULL, Version TEXT);
        CREATE TABLE user_data(note TEXT); INSERT INTO user_data VALUES('keep my data');
        CREATE VIRTUAL TABLE bible_fts USING fts5(verse, Version UNINDEXED, Book UNINDEXED, Chapter UNINDEXED, Versecount UNINDEXED, content='bible', content_rowid='rowid');
        INSERT INTO bible VALUES(39,26,40,'incorrect old text','KJV');
        INSERT INTO bible VALUES(42,3,16,'preserved translation','WEB');
        INSERT INTO bible_fts(bible_fts) VALUES('rebuild');`)
      const preserved = db.prepare("SELECT rowid,* FROM bible WHERE Version='WEB'").all()
      replaceBibleVersion(db, 'KJV', [[39, 26, 41, 'Watch and pray']])
      expect(db.prepare("SELECT rowid,* FROM bible WHERE Version='WEB'").all()).toEqual(preserved)
      expect(db.prepare('SELECT * FROM user_data').get()).toMatchObject({ note: 'keep my data' })
      expect(db.prepare("SELECT Versecount FROM bible_fts WHERE bible_fts MATCH 'Watch'").get()).toMatchObject({ Versecount: 41 })
      expect(db.prepare("SELECT COUNT(*) AS count FROM bible_fts WHERE bible_fts MATCH 'incorrect'").get()).toMatchObject({ count: 0 })
      const beforeFailure = db.prepare('SELECT rowid,* FROM bible').all()
      expect(() => replaceBibleVersion(db, 'KJV', [[39, 26, 42, null as unknown as string]])).toThrow()
      expect(db.prepare('SELECT rowid,* FROM bible').all()).toEqual(beforeFailure)
      expect(db.prepare("SELECT Versecount FROM bible_fts WHERE bible_fts MATCH 'Watch'").get()).toMatchObject({ Versecount: 41 })
      expect(() => replaceBibleVersion(db, 'KJV', [])).toThrow('Refusing to erase')
    } finally { db.close() }
  })
})
