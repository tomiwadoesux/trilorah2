/**
 * Build electron/data/bible_index.json — the QuoteMatcher's word index.
 *
 * Shape (must match BibleIndexEntry in electron/engine/quoteMatcher.ts):
 *   [{ ref: "John 3:16", bookId: 42, chapter: 3, verse: 16, words: [...], rawWords: [...] }]
 *
 * `rawWords` preserve the word order, including short grammatical words, so
 * distinctive fragments can match before a full quotation has been spoken.
 * `words` keep the older substantive-word representation for compatibility.
 * The stopword list is parsed out of quoteMatcher.ts at build time so the
 * two can never drift apart.
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'

const ROOT = path.join(import.meta.dirname, '..')
const DB_PATH = path.join(ROOT, 'bible.db')
const OUT_DIR = path.join(ROOT, 'electron', 'data')
const OUT_PATH = path.join(OUT_DIR, 'bible_index.json')
const MATCHER_SRC = path.join(ROOT, 'electron', 'engine', 'quoteMatcher.ts')

// Canonical 66-book order — ids match bookIdMap in electron/data/bibleDb.ts.
const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua',
  'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
  '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job',
  'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
  'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai',
  'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
]

// Parse STOPWORDS out of the matcher source (single source of truth).
const matcherSource = fs.readFileSync(MATCHER_SRC, 'utf-8')
const stopBlock = matcherSource.match(/const STOPWORDS = new Set\(\[([\s\S]*?)\]\)/)
if (!stopBlock) throw new Error('Could not locate STOPWORDS in quoteMatcher.ts')
const STOPWORDS = new Set(
  [...stopBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
)
console.log(`🧾 ${STOPWORDS.size} stopwords parsed from quoteMatcher.ts`)

const db = new DatabaseSync(DB_PATH, { readOnly: true })
const rows = db
  .prepare(
    "SELECT Book AS bookId, Chapter AS chapter, Versecount AS verse, verse AS text FROM bible WHERE Version = 'KJV' ORDER BY Book, Chapter, Versecount"
  )
  .all()
if (rows.length === 0) throw new Error('No KJV rows — run build-bible-db.mjs first')

const entries = rows.map((r) => {
  const rawWords = String(r.text)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return {
    ref: `${BOOKS[r.bookId]} ${r.chapter}:${r.verse}`,
    bookId: r.bookId,
    chapter: r.chapter,
    verse: r.verse,
    words: rawWords.filter((word) => !STOPWORDS.has(word)),
    rawWords
  }
})

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT_PATH, JSON.stringify(entries))
const mb = (fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(1)
console.log(`✅ bible_index.json: ${entries.length} verses, ${mb} MB → ${OUT_PATH}`)
db.close()
