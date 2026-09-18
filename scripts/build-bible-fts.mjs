/**
 * Add / rebuild the FTS5 keyword index inside bible.db (BUILD-MAP 2.12).
 * Run after build-bible-db.mjs. Idempotent. The engine falls back to a LIKE
 * scan if this was never run, so shipping without it only costs speed.
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const DB_PATH = path.join(import.meta.dirname, '..', 'bible.db')
const db = new DatabaseSync(DB_PATH)
db.exec(`DROP TABLE IF EXISTS bible_fts`)
db.exec(`CREATE VIRTUAL TABLE bible_fts USING fts5(
  verse, Version UNINDEXED, Book UNINDEXED, Chapter UNINDEXED, Versecount UNINDEXED,
  content='bible', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2'
)`)
db.exec(`INSERT INTO bible_fts(bible_fts) VALUES('rebuild')`)
const n = db.prepare('SELECT COUNT(*) AS n FROM bible_fts').get()
console.log(`🔎 bible_fts: ${n.n} verses indexed in ${DB_PATH}`)
db.close()
