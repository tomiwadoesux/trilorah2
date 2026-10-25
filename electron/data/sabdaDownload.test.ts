import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { downloadSabdaBible } from '../../scripts/lib/sabda-bible'
import { replaceBibleVersion } from '../../scripts/lib/replace-bible-version.mjs'
import { rowsSha256, validateBibleRows } from '../../scripts/lib/helloao-bible.mjs'
import { type BibleRow } from '../../scripts/lib/usfm-bible.mjs'
import { CHAPTER_COUNTS } from '../../shared/chapterCounts'
import { BiblikaError } from './bibleOnline/biblikaClient'

const folders: string[] = []
afterEach(async () => { for (const folder of folders.splice(0)) await fs.rm(folder, { recursive: true, force: true }) })
// Invented text and numbering only: a full 1,189-chapter test corpus.
const verses = () => Array.from({ length: 26 }, (_, i) => ({ verse: i + 1, text: `Invented verse ${i + 1}.` }))

describe('complete offline Bible downloads', () => {
  it.each(['NKJV', 'NLT'] as const)('stores all of %s in bible.db while preserving other translations', async (code) => {
    const client = { chapter: vi.fn(async () => verses()) }
    const rows = await downloadSabdaBible(code, { client })
    expect(client.chapter).toHaveBeenCalledTimes(1189)
    const db = new DatabaseSync(':memory:')
    try {
      db.exec("CREATE TABLE bible (Book INTEGER, Chapter INTEGER, Versecount INTEGER, verse TEXT, Version TEXT); INSERT INTO bible VALUES (0,1,1,'Keep this existing verse.','KJV')")
      replaceBibleVersion(db, code, rows)
      expect(db.prepare('SELECT COUNT(*) AS n FROM (SELECT DISTINCT Book,Chapter FROM bible WHERE Version=?)').get(code)?.n).toBe(1189)
      expect(db.prepare("SELECT verse FROM bible WHERE Version='KJV'").get()?.verse).toBe('Keep this existing verse.')
      expect(db.prepare('SELECT verse FROM bible WHERE Version=? AND Book=42 AND Chapter=3 AND Versecount=16').get(code)?.verse).toBe('Invented verse 16.')
    } finally { db.close() }
  })

  it('resumes an interrupted download and can rebuild the whole translation without network', async () => {
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trilorah-bible-download-'))
    folders.push(cacheDir)
    let failed = false
    const client = { chapter: vi.fn(async (_code: string, book: number, chapter: number) => {
      if (!failed && book === 0 && chapter === 4) { failed = true; throw new BiblikaError('bad-response', 'Interrupted test download') }
      return verses()
    }) }
    await expect(downloadSabdaBible('NLT', { cacheDir, client, concurrency: 1 })).rejects.toThrow('Interrupted')
    client.chapter.mockClear()
    const rows = await downloadSabdaBible('NLT', { cacheDir, client })
    expect(client.chapter).toHaveBeenCalledTimes(1186)
    const offline = { chapter: vi.fn(async () => { throw new Error('Offline') }) }
    expect(await downloadSabdaBible('NLT', { cacheDir, client: offline })).toEqual(rows)
    expect(offline.chapter).not.toHaveBeenCalled()
  }, 30_000)

  it('refuses a partial corpus instead of installing it', async () => {
    const client = { chapter: vi.fn(async () => [{ verse: 1, text: 'Invented single verse.' }]) }
    await expect(downloadSabdaBible('NKJV', { client })).rejects.toThrow('John 3:16')
  })

  it('downloads chapter batches while keeping every chapter and verse number', async () => {
    const client = {
      chapter: vi.fn(async () => verses()),
      chapters: vi.fn(async (_code: string, _book: number, first: number, last: number) =>
        Array.from({ length: last - first + 1 }, (_, i) => ({ chapter: first + i, verses: verses() }))),
    }
    const rows = await downloadSabdaBible('NLT', { client })
    expect(client.chapters).toHaveBeenCalledTimes(CHAPTER_COUNTS.reduce((sum, count) => sum + Math.ceil(count / 10), 0))
    expect(client.chapter).not.toHaveBeenCalled()
    expect(rows).toContainEqual([18, 150, 26, 'Invented verse 26.'])
    expect(rows).toContainEqual([65, 22, 21, 'Invented verse 21.'])
  })

  it('recovers a stalled batch with individual chapter downloads', async () => {
    const client = {
      chapter: vi.fn(async () => verses()),
      chapters: vi.fn(async (_code: string, book: number, first: number, last: number) => {
        if (book === 0 && first === 1) throw new BiblikaError('timeout', 'Stalled range')
        return Array.from({ length: last - first + 1 }, (_, i) => ({ chapter: first + i, verses: verses() }))
      }),
    }
    const rows = await downloadSabdaBible('NKJV', { client })
    expect(rows).toHaveLength(1189 * 26)
    expect(client.chapter).toHaveBeenCalledTimes(10)
  })

  it('refuses malformed verses and does not continue starting requests after failure', async () => {
    const client = { chapter: vi.fn(async () => [{ verse: 1, text: '<html>Unavailable</html>' }]) }
    await expect(downloadSabdaBible('NLT', { client, concurrency: 1 })).rejects.toThrow('Invalid SABDA verse')
    expect(client.chapter).toHaveBeenCalledTimes(1)
  })
})

describe('downloaded translations in the actual local database', () => {
  const databasePath = fileURLToPath(new URL('../../bible.db', import.meta.url))
  const sourcePath = fileURLToPath(new URL('./bible-sources.json', import.meta.url))
  const installed = (() => {
    if (!existsSync(databasePath)) return []
    const db = new DatabaseSync(databasePath, { readOnly: true })
    try { return db.prepare("SELECT DISTINCT Version FROM bible WHERE Version IN ('NKJV','NLT')").all().map((r) => String(r.Version)) }
    finally { db.close() }
  })()
  for (const code of ['NKJV', 'NLT']) it.skipIf(!installed.includes(code))(`validates ${code} against its recorded full-corpus fingerprint`, () => {
    const db = new DatabaseSync(databasePath, { readOnly: true })
    try {
      const source = JSON.parse(readFileSync(sourcePath, 'utf8')).versions[code]
      const rows = db.prepare('SELECT Book,Chapter,Versecount,verse FROM bible WHERE Version=? ORDER BY Book,Chapter,Versecount').all(code)
        .map((r) => [Number(r.Book), Number(r.Chapter), Number(r.Versecount), String(r.verse)] as BibleRow)
      validateBibleRows(rows, { version: code, expectedVerses: source.verses })
      expect(source.books).toBe(66)
      expect(source.chapters).toBe(1189)
      expect(rowsSha256(rows)).toBe(source.rowsSha256)
    } finally { db.close() }
  })
})
