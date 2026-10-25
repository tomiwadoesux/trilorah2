import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { CHAPTER_COUNTS } from './usfm-bible.mjs'
import { cleanVerseText, validateBibleRows } from './helloao-bible.mjs'

export const NKJV_SOURCE = {
  id: 'thiagobodruk-en_nkjv-98a52a5439c1cfe566676e8508795834424a5f3a',
  name: 'New King James Version',
  sourceUrl: 'https://raw.githubusercontent.com/thiagobodruk/bible/98a52a5439c1cfe566676e8508795834424a5f3a/json/en_nkjv.json',
  sourceSha256: '0ebf88a5b6b93b92d6402a252f1a7d2349278d3916e9a1e31374ddbf53085ac1',
  rights: 'Copyright retained by Thomas Nelson. All rights reserved; source availability does not grant redistribution rights.',
  attribution: 'New King James Version © 1982 Thomas Nelson. All rights reserved.',
}

export function nkjvRows(books) {
  if (!Array.isArray(books) || books.length !== 66) throw new Error('NKJV: expected 66 books')
  const rows = []
  books.forEach((book, b) => {
    if (!Array.isArray(book.chapters) || book.chapters.length !== CHAPTER_COUNTS[b]) throw new Error(`NKJV: incorrect chapter count in book ${b + 1}`)
    book.chapters.forEach((verses, c) => {
      if (!Array.isArray(verses) || !verses.length) throw new Error(`NKJV: empty chapter ${b + 1}:${c + 1}`)
      verses.forEach((text, v) => {
        if (typeof text !== 'string' || /[<>]/.test(text)) throw new Error('NKJV: invalid verse text')
        rows.push([b, c + 1, v + 1, cleanVerseText(text, b, c + 1)])
      })
    })
  })
  return validateBibleRows(rows, { version: 'NKJV', expectedVerses: 31102 })
}

/** One pinned full-file download, using the same repository as the other JSON Bibles. */
export async function downloadNkjvBible(cacheDir) {
  const file = cacheDir && path.join(cacheDir, 'nkjv', `${NKJV_SOURCE.sourceSha256}.json`)
  const matches = (raw) => createHash('sha256').update(raw).digest('hex') === NKJV_SOURCE.sourceSha256
  let raw
  if (file) {
    try { const saved = await fs.readFile(file); if (matches(saved)) raw = saved } catch { /* Download a missing or corrupt cache again. */ }
  }
  if (!raw) {
    const response = await fetch(NKJV_SOURCE.sourceUrl, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`NKJV download failed: ${response.status}`)
    raw = Buffer.from(await response.arrayBuffer())
    if (!matches(raw)) throw new Error('NKJV source checksum mismatch')
    if (file) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, raw) }
  }
  return nkjvRows(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')))
}
