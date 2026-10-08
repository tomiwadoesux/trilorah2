/**
 * Rebuild bible.db from public-domain translations.
 *
 * Schema matches what the engine queries (recovered from the bundle):
 *   bible(Book INTEGER, Chapter INTEGER, Versecount INTEGER, verse TEXT, Version TEXT)
 * Book ids are 0-based in canonical order (Genesis = 0 … Revelation = 65).
 *
 * Sources, all public domain and safe to redistribute:
 *   eBible / CrossWire explicitly numbered USFM — KJV (1769, 66 books)
 *   thiagobodruk/bible (JSON) — BBE and the multilingual set
 *   bible.helloao.org (eBible's own API) — WEB, BSB and ASV
 *     (scripts/lib/helloao-bible.mjs; provenance in electron/data/bible-sources.json)
 * Licensed translations (NIV, ESV, NLT, NKJV, NASB) are NOT here and cannot
 * be: displaying a chapter to a congregation is past every publisher's free
 * quotation limit, and building the text into software needs a negotiated
 * data licence per publisher. A church that holds one imports it itself.
 *
 * WEB is the modern-English answer to "the KJV is hard to follow". eBible
 * states it plainly: "The World English Bible (WEB) is a Public Domain (no
 * copyright) Modern English translation of the Holy Bible… you may freely
 * copy it in any form, including electronic and print formats."
 * (https://worldenglish.bible/ — verified 2026-09-20)
 *
 * BSB is the modern-English Bible a church already reads aloud: the Berean
 * Standard Bible was dedicated to the public domain on 30 April 2023 and "all
 * uses are freely permitted" (https://berean.bible/terms.htm). ASV (1901) is
 * the public-domain Bible EasyWorship ships free, and the voice phrase
 * "american standard version" already asked for it.
 *
 * Every helloao version is checked before it replaces anything
 * (validateBibleRows): 66 books, all 1,189 chapters, unique clean rows, the
 * exact expected verse count, and spot references. Run one at a time:
 *   node scripts/build-bible-db.mjs --version BSB
 * --cache <dir> keeps each fetched chapter, so a rebuild is offline and exact.
 *
 * Uses node:sqlite so the script runs on plain Node regardless of which ABI
 * better-sqlite3 was last compiled for (electron vs node).
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { KJV_USFM_URL, parseKjvArchive } from './lib/usfm-bible.mjs'
import { replaceBibleVersion } from './lib/replace-bible-version.mjs'
import { HELLOAO, HELLOAO_SOURCES, chapterRows, validateBibleRows, rowsSha256 } from './lib/helloao-bible.mjs'

const ROOT = path.join(import.meta.dirname, '..')
const args = process.argv.slice(2)
const valueOf = (flag) => {
  const index = args.indexOf(flag)
  if (index < 0) return undefined
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${flag}`)
  return args[index + 1]
}
const DB_PATH = path.resolve(valueOf('--database') ?? path.join(ROOT, 'bible.db'))
const ONLY_VERSION = valueOf('--version')?.toUpperCase()
if (ONLY_VERSION && !['KJV', 'BBE', 'RVR', 'APEE', 'AA', 'CUV', 'WEB', 'BSB', 'ASV'].includes(ONLY_VERSION)) throw new Error(`Unknown version ${ONLY_VERSION}`)
const CACHE_DIR = valueOf('--cache') ? path.resolve(valueOf('--cache')) : null
const SOURCES_JSON = path.join(ROOT, 'electron', 'data', 'bible-sources.json')

/**
 * Pinned to a commit, not `master`. On 2026-09-23 upstream "refreshed" its
 * files: es_rvr and zh_cuv were deleted and replaced by RVR 1960 and the CUNP
 * — both still under copyright — and the KJV file was rewritten. Following
 * `master` broke the release build with a 404, and swapping in the new names
 * would have quietly shipped licensed text. This commit is the last one with
 * the public-domain files every installer up to 0.3.9 was built from.
 */
const THIAGO = 'https://raw.githubusercontent.com/thiagobodruk/bible/13225a15fa5e3e3043495b0c82df56c3fdfeb7f4/json'

const SOURCES = [
  { version: 'BBE', url: `${THIAGO}/en_bbe.json` },
  // Multilingual, public-domain:
  { version: 'RVR', url: `${THIAGO}/es_rvr.json` }, // Reina-Valera (Spanish)
  { version: 'APEE', url: `${THIAGO}/fr_apee.json` }, // Bible de l'Épée (French)
  { version: 'AA', url: `${THIAGO}/pt_aa.json` }, // Almeida Atualizada (Portuguese)
  { version: 'CUV', url: `${THIAGO}/zh_cuv.json` } // Chinese Union Version
  // Hindi: no public-domain JSON in this source yet — add
  // { version: 'XXX', url: '...' } here when a licensed/PD source is chosen.
]

/**
 * WEB, BSB and ASV, from eBible's own API (bible.helloao.org).
 *
 * A call per chapter: 1,189 requests a version, so they run in small
 * batches — polite to a free service, and still a couple of minutes.
 * Text cleaning and validation live in scripts/lib/helloao-bible.mjs.
 */
const BATCH = 12

async function fetchChapter(sourceId, bookId, ch) {
  const file = CACHE_DIR && path.join(CACHE_DIR, sourceId, `${bookId}-${ch}.json`)
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
  const data = await fetchJson(`${HELLOAO}/${sourceId}/${bookId}/${ch}.json`)
  const chapter = data.chapter ?? data
  if (file) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(chapter))
  }
  return chapter
}

async function fetchHelloao(version, onProgress) {
  const source = HELLOAO_SOURCES[version]
  const { books } = await fetchJson(`${HELLOAO}/${source.id}/books.json`)
  if (!Array.isArray(books) || books.length !== 66) {
    throw new Error(`${version}: expected 66 books, got ${books?.length}`)
  }
  // Every chapter of every book, as [bookIndex, sourceBookId, chapterNumber].
  const jobs = books.flatMap((b, i) =>
    Array.from({ length: b.numberOfChapters }, (_, c) => [i, b.id, c + 1])
  )
  const rows = []
  /* Text a source marks as descriptive (a title inside a verse) is kept —
     BSB Zechariah 12:1 opens with one — but listed, so a person sees what
     came in besides the verse itself. */
  const descriptive = []
  for (let at = 0; at < jobs.length; at += BATCH) {
    const slice = jobs.slice(at, at + BATCH)
    const chapters = await Promise.all(slice.map(([, bookId, ch]) => fetchChapter(source.id, bookId, ch)))
    chapters.forEach((chapter, k) => {
      const [bookIndex, bookId, ch] = slice[k]
      rows.push(...chapterRows(chapter, bookIndex, ch))
      for (const item of chapter.content ?? []) {
        if (item?.type === 'verse' && Array.isArray(item.content) && item.content.some((part) => part?.descriptive)) {
          descriptive.push(`${bookId} ${ch}:${item.number}`)
        }
      }
    })
    onProgress?.(Math.min(at + BATCH, jobs.length), jobs.length)
  }
  return { rows: validateBibleRows(rows, { version, expectedVerses: source.expectedVerses }), descriptive }
}

/** Record where a version came from, next to the KJV's kjv-source.json. */
function recordProvenance(version, rows) {
  const source = HELLOAO_SOURCES[version]
  let file = { note: 'Where each bundled translation in bible.db came from. Written by scripts/build-bible-db.mjs.', versions: {} }
  try { file = JSON.parse(fs.readFileSync(SOURCES_JSON, 'utf8')) } catch { /* first run */ }
  const chapters = new Set(rows.map((row) => `${row[0]}:${row[1]}`))
  file.versions[version] = {
    translation: source.name,
    sourceId: source.id,
    sourceUrl: `${HELLOAO}/${source.id}/books.json`,
    licenseUrl: source.licenseUrl,
    rights: source.rights,
    ...(source.attribution ? { attribution: source.attribution } : {}),
    retrieved: new Date().toISOString().slice(0, 10),
    rowsSha256: rowsSha256(rows),
    books: new Set(rows.map((row) => row[0])).size,
    chapters: chapters.size,
    verses: rows.length,
  }
  fs.writeFileSync(SOURCES_JSON, JSON.stringify(file, null, 2) + '\n')
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  let text = await res.text()
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // strip BOM
  return JSON.parse(text)
}

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA busy_timeout = 10000')
/* The app opens the shipped file from inside a signed bundle; a WAL file
   beside it could never be created there. Rollback journal only. */
db.exec('PRAGMA journal_mode = DELETE')
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

if (!ONLY_VERSION || ONLY_VERSION === 'KJV') {
  const localArchive = valueOf('--kjv-usfm')
  console.log(`Reading explicitly numbered KJV USFM${localArchive ? ' from local archive' : ' from eBible.org'}…`)
  let archive
  if (localArchive) archive = fs.readFileSync(path.resolve(localArchive))
  else {
    const response = await fetch(KJV_USFM_URL)
    if (!response.ok) throw new Error(`KJV source download failed: ${response.status}`)
    archive = Buffer.from(await response.arrayBuffer())
  }
  // All corpus/reference validation happens before either backup or mutation.
  const rows = parseKjvArchive(archive)
  const archiveSha256 = createHash('sha256').update(archive).digest('hex')
  console.log(`Validated KJV: 66 books, 1,189 chapters, ${rows.length} verses; SHA-256 ${archiveSha256}`)
  const backup = path.join(os.tmpdir(), `trilorah-bible-before-kjv-${Date.now()}.db`)
  db.prepare('VACUUM INTO ?').run(backup)
  console.log(`Full database backup: ${backup}`)
  replaceBibleVersion(db, 'KJV', rows)
  console.log(`KJV repaired transactionally; other translations and database schema preserved.`)
}

for (const { version, url } of SOURCES.filter(source => !ONLY_VERSION || source.version === ONLY_VERSION)) {
  console.log(`⬇️  Downloading ${version}…`)
  const books = await fetchJson(url)
  if (!Array.isArray(books) || books.length !== 66) {
    throw new Error(`${version}: expected 66 books, got ${Array.isArray(books) ? books.length : typeof books}`)
  }
  const rows = []
  books.forEach((book, bookId) => {
    book.chapters.forEach((verses, chapterIdx) => {
      verses.forEach((text, verseIdx) => {
        rows.push([bookId, chapterIdx + 1, verseIdx + 1, String(text)])
      })
    })
  })
  replaceBibleVersion(db, version, rows)
  console.log(`✅ ${version}: ${rows.length} verses imported`)
}

for (const version of Object.keys(HELLOAO_SOURCES).filter(v => !ONLY_VERSION || v === ONLY_VERSION)) {
  console.log(`⬇️  Downloading ${version} (a call per chapter — this one takes a minute)…`)
  const { rows, descriptive } = await fetchHelloao(version, (done, all) => {
    if (done % 120 === 0 || done === all) process.stdout.write(`   ${done}/${all} chapters\r`)
  })
  replaceBibleVersion(db, version, rows)
  recordProvenance(version, rows)
  console.log(`\n✅ ${version}: ${rows.length} verses imported`)
  if (descriptive.length) console.log(`   kept descriptive text inside ${descriptive.length} verses: ${descriptive.slice(0, 12).join(', ')}${descriptive.length > 12 ? ' …' : ''}`)
}

const total = db.prepare('SELECT COUNT(*) AS n FROM bible').get()
console.log(`📖 bible.db ready at ${DB_PATH} (${total.n} rows)`)
db.close()
