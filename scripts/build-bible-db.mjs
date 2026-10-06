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
 *   bible.helloao.org (eBible's own API) — WEB
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
if (ONLY_VERSION && !['KJV', 'BBE', 'RVR', 'APEE', 'AA', 'CUV', 'WEB'].includes(ONLY_VERSION)) throw new Error(`Unknown version ${ONLY_VERSION}`)

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
 * WEB, from eBible's own API.
 *
 * Shaped differently from the thiagobodruk files — a call per chapter, and a
 * verse arrives as SEGMENTS rather than a string: several pieces of text with
 * footnote references (`{noteId}`) and formatting objects between them. Join
 * the text, drop everything else; a footnote number is a scholar's apparatus
 * and has no business on a wall in front of a congregation.
 *
 * 1189 chapters means 1189 requests, so they run in small batches — polite to
 * a free service, and still under two minutes.
 */
const HELLOAO = 'https://bible.helloao.org/api'
const WEB_ID = 'ENGWEBP'
const BATCH = 12

function verseText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join(' ')
}

async function fetchWeb(onProgress) {
  const { books } = await fetchJson(`${HELLOAO}/${WEB_ID}/books.json`)
  if (!Array.isArray(books) || books.length !== 66) {
    throw new Error(`WEB: expected 66 books, got ${books?.length}`)
  }
  // Every chapter of every book, as [bookIndex, chapterNumber].
  const jobs = books.flatMap((b, i) =>
    Array.from({ length: b.numberOfChapters }, (_, c) => [i, b.id, c + 1])
  )
  const rows = []
  for (let at = 0; at < jobs.length; at += BATCH) {
    const slice = jobs.slice(at, at + BATCH)
    const chapters = await Promise.all(
      slice.map(([, bookId, ch]) =>
        fetchJson(`${HELLOAO}/${WEB_ID}/${bookId}/${ch}.json`).then((d) => d.chapter ?? d)
      )
    )
    chapters.forEach((chapter, k) => {
      const [bookIndex, , ch] = slice[k]
      for (const item of chapter.content ?? []) {
        if (item?.type !== 'verse' || typeof item.number !== 'number') continue
        const text = verseText(item.content).replace(/\s+/g, ' ').trim()
        if (text) rows.push([bookIndex, ch, item.number, text])
      }
    })
    onProgress?.(Math.min(at + BATCH, jobs.length), jobs.length)
  }
  return rows
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

if (!ONLY_VERSION || ONLY_VERSION === 'WEB') {
console.log('⬇️  Downloading WEB (a call per chapter — this one takes a minute)…')
const webRows = await fetchWeb((done, all) => {
  if (done % 120 === 0 || done === all) process.stdout.write(`   ${done}/${all} chapters\r`)
})
replaceBibleVersion(db, 'WEB', webRows)
console.log(`\n✅ WEB: ${webRows.length} verses imported`)
}

const total = db.prepare('SELECT COUNT(*) AS n FROM bible').get()
console.log(`📖 bible.db ready at ${DB_PATH} (${total.n} rows)`)
db.close()
