/**
 * Keyword search over the Bible text (BUILD-MAP 2.12).
 *
 * "Find the verse that says rejoice always" — preachers half-remember
 * wording, not references. Uses an FTS5 table (`bible_fts`) when the DB has
 * one (built by `npm run bible:fts`), and falls back to a LIKE scan over the
 * requested version otherwise, so a stale bible.db still works — just slower.
 *
 * Takes a minimal DB interface so it runs against better-sqlite3 in Electron
 * and node:sqlite in tests.
 */

import { bookNames } from './books'

export interface SearchableDb {
  prepare(sql: string): { all(...params: unknown[]): unknown[]; get(...params: unknown[]): unknown }
}

export interface BibleSearchHit {
  bookId: number
  book: string
  chapter: number
  verse: number
  version: string
  text: string
  /** Text with <b>…</b> around matches (FTS only; plain text otherwise). */
  snippet: string
}

export interface BibleSearchOptions {
  version?: string
  limit?: number
}

export const FTS_TABLE = 'bible_fts'

export function hasFts(db: SearchableDb): boolean {
  try {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(FTS_TABLE) as { name: string } | undefined
    return !!row
  } catch {
    return false
  }
}

/**
 * Build the FTS5 index inside `db` (external-content: rows mirror the
 * `bible` table by rowid). Always rebuilds — COUNT(*) on an external-content
 * table reads the content table, so "is it empty" cannot be asked cheaply.
 */
export function ensureFts(db: SearchableDb & { exec(sql: string): void }): void {
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(
       verse, Version UNINDEXED, Book UNINDEXED, Chapter UNINDEXED, Versecount UNINDEXED,
       content='bible', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2'
     )`
  )
  db.exec(`INSERT INTO ${FTS_TABLE}(${FTS_TABLE}) VALUES('rebuild')`)
}

/** Turn free text into a safe FTS5 MATCH expression: quoted words, AND-ed. */
export function toFtsQuery(input: string): string {
  const words = input
    .toLowerCase()
    .replace(/["'*^:()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
  return words.map((w) => `"${w}"`).join(' ')
}

export function searchBible(db: SearchableDb, query: string, opts: BibleSearchOptions = {}): BibleSearchHit[] {
  const version = opts.version ?? 'KJV'
  const limit = Math.max(1, Math.min(100, opts.limit ?? 25))
  const q = query.trim()
  if (q.length < 2) return []
  return hasFts(db) ? searchFts(db, q, version, limit) : searchLike(db, q, version, limit)
}

function searchFts(db: SearchableDb, q: string, version: string, limit: number): BibleSearchHit[] {
  const match = toFtsQuery(q)
  if (!match) return []
  const rows = db
    .prepare(
      `SELECT Book AS bookId, Chapter AS chapter, Versecount AS verse, Version AS version, verse AS text,
              snippet(${FTS_TABLE}, 0, '<b>', '</b>', '…', 24) AS snippet
       FROM ${FTS_TABLE}
       WHERE ${FTS_TABLE} MATCH ? AND Version = ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(match, version, limit) as Omit<BibleSearchHit, 'book'>[]
  return rows.map(withBookName)
}

function searchLike(db: SearchableDb, q: string, version: string, limit: number): BibleSearchHit[] {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1)
  if (words.length === 0) return []
  const where = words.map(() => 'LOWER(verse) LIKE ?').join(' AND ')
  const rows = db
    .prepare(
      `SELECT Book AS bookId, Chapter AS chapter, Versecount AS verse, Version AS version, verse AS text
       FROM bible WHERE Version = ? AND ${where}
       ORDER BY Book, Chapter, Versecount LIMIT ?`
    )
    .all(version, ...words.map((w) => `%${w}%`), limit) as Omit<BibleSearchHit, 'book' | 'snippet'>[]
  return rows.map((r) => withBookName({ ...r, snippet: r.text }))
}

function withBookName(r: Omit<BibleSearchHit, 'book'>): BibleSearchHit {
  return { ...r, book: bookNames[r.bookId] ?? `Book ${r.bookId}` }
}
