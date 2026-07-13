/**
 * Rebuild bible.db from public-domain translations.
 *
 * Schema matches what the engine queries (recovered from the bundle):
 *   bible(Book INTEGER, Chapter INTEGER, Versecount INTEGER, verse TEXT, Version TEXT)
 * Book ids are 0-based in canonical order (Genesis = 0 … Revelation = 65).
 *
 * Sources: thiagobodruk/bible (JSON, public domain texts):
 *   KJV — King James Version
 *   BBE — Bible in Basic English
 * Both are safe to redistribute; licensed translations (NIV/ESV/…) must be
 * imported by the user via their own licensed source.
 *
 * Uses node:sqlite so the script runs on plain Node regardless of which ABI
 * better-sqlite3 was last compiled for (electron vs node).
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'

const ROOT = path.join(import.meta.dirname, '..')
const DB_PATH = path.join(ROOT, 'bible.db')

const SOURCES = [
  { version: 'KJV', url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json' },
  { version: 'BBE', url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json' }
]

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  let text = await res.text()
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // strip BOM
  return JSON.parse(text)
}

const db = new DatabaseSync(DB_PATH)
db.exec(`
  CREATE TABLE IF NOT EXISTS bible (
    Book INTEGER NOT NULL,
    Chapter INTEGER NOT NULL,
    Versecount INTEGER NOT NULL,
    verse TEXT NOT NULL,
    Version TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bible_lookup ON bible (Version, Book, Chapter, Versecount);
`)

const insert = db.prepare(
  'INSERT INTO bible (Book, Chapter, Versecount, verse, Version) VALUES (?, ?, ?, ?, ?)'
)
const wipe = db.prepare('DELETE FROM bible WHERE Version = ?')

for (const { version, url } of SOURCES) {
  console.log(`⬇️  Downloading ${version}…`)
  const books = await fetchJson(url)
  if (!Array.isArray(books) || books.length !== 66) {
    throw new Error(`${version}: expected 66 books, got ${Array.isArray(books) ? books.length : typeof books}`)
  }
  wipe.run(version)
  db.exec('BEGIN')
  let count = 0
  books.forEach((book, bookId) => {
    book.chapters.forEach((verses, chapterIdx) => {
      verses.forEach((text, verseIdx) => {
        insert.run(bookId, chapterIdx + 1, verseIdx + 1, String(text), version)
        count++
      })
    })
  })
  db.exec('COMMIT')
  console.log(`✅ ${version}: ${count} verses imported`)
}

const total = db.prepare('SELECT COUNT(*) AS n FROM bible').get()
console.log(`📖 bible.db ready at ${DB_PATH} (${total.n} rows)`)
db.close()
