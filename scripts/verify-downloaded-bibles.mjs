import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { rowsSha256, validateBibleRows } from './lib/helloao-bible.mjs'

const root = path.resolve(import.meta.dirname, '..')
const database = path.resolve(process.argv[2] ?? path.join(root, 'bible.db'))
const sources = JSON.parse(fs.readFileSync(path.join(root, 'electron/data/bible-sources.json'), 'utf8')).versions
const db = new DatabaseSync(database, { readOnly: true })
try {
  for (const code of ['NKJV', 'NLT']) {
    const rows = db.prepare('SELECT Book,Chapter,Versecount,verse FROM bible WHERE Version=? ORDER BY Book,Chapter,Versecount').all(code)
      .map((r) => [Number(r.Book), Number(r.Chapter), Number(r.Versecount), String(r.verse)])
    const source = sources[code]
    if (!source?.attribution || source.books !== 66 || source.chapters !== 1189) throw new Error(`${code}: missing complete download provenance`)
    validateBibleRows(rows, { version: code, expectedVerses: source.verses })
    if (rows.length < 30_000 || rows.length > 32_000 || rowsSha256(rows) !== source.rowsSha256) throw new Error(`${code}: downloaded corpus does not match provenance`)
    console.log(`${code}: verified 66 books, 1,189 chapters, ${rows.length.toLocaleString('en-US')} verses in ${database}`)
  }
} finally { db.close() }
