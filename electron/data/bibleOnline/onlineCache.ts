/**
 * Where chapters fetched from YouVersion are kept: userData/bibles/online-cache.db.
 *
 * Its `bible` table has bible.db's exact shape (Book, Chapter, Versecount,
 * verse, Version), so every existing read — readVersePreview, get-chapter,
 * get-verse-range — runs unchanged against it; main.ts only picks which
 * database a version lives in. The bundled bible.db is never written to.
 *
 * It is a cache, not a copy of anyone's Bible:
 * - a chapter is kept 30 days from when it was fetched, then dropped (or
 *   fetched again when it is next needed);
 * - at most 120 chapters per version — about a tenth of a Bible, far more
 *   than a month of services — the least recently used going first;
 * - a version the key stops being licensed for loses its chapters at once.
 * The Platform's own terms set no figure; these follow the strictest common
 * rule among Bible APIs (API.Bible: refresh at least every 30 days) and the
 * Platform docs' "cache responses where you can", until the publisher
 * licence the church accepts in the portal says otherwise.
 *
 * Written against the small slice of SQL both better-sqlite3 (the app) and
 * node:sqlite (the tests) share.
 */
import type { ParsedVerse } from './youversionHtml'

export interface SqlStatement {
  all(...params: unknown[]): unknown[]
  get(...params: unknown[]): unknown
  run(...params: unknown[]): unknown
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement
  exec(sql: string): unknown
}

const DAY = 24 * 60 * 60 * 1000
export const CHAPTER_TTL_MS = 30 * DAY
export const MAX_CHAPTERS_PER_VERSION = 120

export interface CachedVersion {
  /** The code the app knows it by: 'NIV'. */
  code: string
  /** YouVersion's id for it: 111. */
  bibleId: number
  title: string
  attribution: string | null
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bible (
  Book INTEGER NOT NULL, Chapter INTEGER NOT NULL, Versecount INTEGER NOT NULL,
  verse TEXT NOT NULL, Version TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bible_lookup ON bible (Version, Book, Chapter, Versecount);
CREATE TABLE IF NOT EXISTS chapters (
  Version TEXT NOT NULL, Book INTEGER NOT NULL, Chapter INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL, used_at INTEGER NOT NULL,
  PRIMARY KEY (Version, Book, Chapter)
);
CREATE TABLE IF NOT EXISTS versions (
  code TEXT PRIMARY KEY, bible_id INTEGER NOT NULL, title TEXT NOT NULL, attribution TEXT
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`

export class OnlineBibleCache {
  constructor(readonly db: SqlDatabase, private readonly now: () => number = Date.now) {}

  init(): void {
    this.db.exec(SCHEMA)
    this.purgeStale()
  }

  private transaction(fn: () => void): void {
    this.db.exec('BEGIN')
    try {
      fn()
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private meta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string | null } | undefined
    return row?.value ?? null
  }

  private setMeta(key: string, value: string | null): void {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  /** The Bibles the key was last known to unlock, when that was, and for which key. */
  listing(): { versions: CachedVersion[]; listedAt: number | null; keyId: string | null } {
    const versions = (this.db.prepare('SELECT code, bible_id AS bibleId, title, attribution FROM versions ORDER BY code').all() as CachedVersion[])
      .map((v) => ({ code: String(v.code), bibleId: Number(v.bibleId), title: String(v.title), attribution: v.attribution ?? null }))
    const at = Number(this.meta('listed_at'))
    return { versions, listedAt: Number.isFinite(at) && at > 0 ? at : null, keyId: this.meta('key_id') }
  }

  /** A fresh answer from YouVersion. A version no longer on it loses its chapters. */
  saveListing(versions: readonly CachedVersion[], keyId: string): void {
    this.transaction(() => {
      this.db.prepare('DELETE FROM versions').run()
      const insert = this.db.prepare('INSERT OR REPLACE INTO versions (code, bible_id, title, attribution) VALUES (?, ?, ?, ?)')
      for (const v of versions) insert.run(v.code, v.bibleId, v.title, v.attribution)
      this.db.prepare('DELETE FROM bible WHERE Version NOT IN (SELECT code FROM versions)').run()
      this.db.prepare('DELETE FROM chapters WHERE Version NOT IN (SELECT code FROM versions)').run()
      this.setMeta('listed_at', String(this.now()))
      this.setMeta('key_id', keyId)
    })
  }

  /** Forget what the key unlocks (a refused key, or another key) — and everything fetched with it. */
  clearListing(): void {
    this.transaction(() => {
      for (const table of ['versions', 'bible', 'chapters']) this.db.prepare(`DELETE FROM ${table}`).run()
      this.setMeta('listed_at', null)
      this.setMeta('key_id', null)
    })
  }

  /** Withdrawn: the key is no longer licensed for this one. */
  dropVersion(code: string): void {
    this.transaction(() => {
      this.db.prepare('DELETE FROM versions WHERE code = ?').run(code)
      this.db.prepare('DELETE FROM bible WHERE Version = ?').run(code)
      this.db.prepare('DELETE FROM chapters WHERE Version = ?').run(code)
    })
  }

  private dropChapter(code: string, book: number, chapter: number): void {
    this.db.prepare('DELETE FROM bible WHERE Version = ? AND Book = ? AND Chapter = ?').run(code, book, chapter)
    this.db.prepare('DELETE FROM chapters WHERE Version = ? AND Book = ? AND Chapter = ?').run(code, book, chapter)
  }

  /** Kept and still inside its 30 days. A stale one is dropped on the spot. */
  hasChapter(code: string, book: number, chapter: number): boolean {
    const row = this.db.prepare('SELECT fetched_at AS fetchedAt FROM chapters WHERE Version = ? AND Book = ? AND Chapter = ?')
      .get(code, book, chapter) as { fetchedAt: number } | undefined
    if (!row) return false
    if (this.now() - Number(row.fetchedAt) < CHAPTER_TTL_MS) return true
    this.transaction(() => this.dropChapter(code, book, chapter))
    return false
  }

  /** Read again: it moves to the back of the eviction queue. */
  touch(code: string, book: number, chapter: number): void {
    this.db.prepare('UPDATE chapters SET used_at = ? WHERE Version = ? AND Book = ? AND Chapter = ?').run(this.now(), code, book, chapter)
  }

  putChapter(code: string, book: number, chapter: number, verses: readonly ParsedVerse[]): void {
    const at = this.now()
    this.transaction(() => {
      this.dropChapter(code, book, chapter)
      const insert = this.db.prepare('INSERT OR REPLACE INTO bible (Book, Chapter, Versecount, verse, Version) VALUES (?, ?, ?, ?, ?)')
      for (const v of verses) insert.run(book, chapter, v.verse, v.text, code)
      this.db.prepare('INSERT INTO chapters (Version, Book, Chapter, fetched_at, used_at) VALUES (?, ?, ?, ?, ?)').run(code, book, chapter, at, at)
      const over = this.chapterCount(code) - MAX_CHAPTERS_PER_VERSION
      if (over > 0) {
        const oldest = this.db.prepare('SELECT Book AS book, Chapter AS chapter FROM chapters WHERE Version = ? ORDER BY used_at, fetched_at LIMIT ?')
          .all(code, over) as { book: number; chapter: number }[]
        for (const old of oldest) this.dropChapter(code, Number(old.book), Number(old.chapter))
      }
    })
  }

  /** Drop every chapter past its 30 days. Returns how many went. */
  purgeStale(): number {
    const cutoff = this.now() - CHAPTER_TTL_MS
    const stale = this.db.prepare('SELECT Version AS code, Book AS book, Chapter AS chapter FROM chapters WHERE fetched_at <= ?')
      .all(cutoff) as { code: string; book: number; chapter: number }[]
    if (stale.length) this.transaction(() => { for (const s of stale) this.dropChapter(String(s.code), Number(s.book), Number(s.chapter)) })
    return stale.length
  }

  chapterCount(code?: string): number {
    const row = (code
      ? this.db.prepare('SELECT COUNT(*) AS n FROM chapters WHERE Version = ?').get(code)
      : this.db.prepare('SELECT COUNT(*) AS n FROM chapters').get()) as { n: number } | undefined
    return Number(row?.n ?? 0)
  }
}
