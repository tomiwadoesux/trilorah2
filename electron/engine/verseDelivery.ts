import type Database from 'better-sqlite3'
import type { VerseDetection } from '../../shared/types'
import { parseReference } from '../../shared/parseReference'
import { bookNames, resolveBookId } from '../data/books'

export interface VersePreview extends VerseDetection {
  verse: number
  text: string
  verses: { verse: number; text: string }[]
  isRange: boolean
  rangeEnd?: number
  chunkSize?: number
  cloudId?: string
}

export type VersePushSource = 'operator' | 'remote' | 'operator picked from clash' | 'auto mode' | 'auto (reading started)' | 'correction'

/** Speech owns the pending verse; an operator owns the live snapshot. */
export class VerseDelivery {
  preview: VersePreview | null = null
  live: VersePreview | null = null
  /**
   * How many times the wall's verse has changed: one put up, or one taken
   * down (a song, a picture or a clear takes it down first). An operator's
   * press that waits for an online chapter compares this before and after,
   * and is dropped when something else reached the wall meanwhile.
   */
  acts = 0

  stage(verse: VersePreview): VersePreview {
    this.preview = { ...verse, isPreview: true }
    return this.preview
  }

  promote(source: VersePushSource): VersePreview | null {
    if (source !== 'operator' && source !== 'remote' && source !== 'operator picked from clash') return null
    if (!this.preview?.text.trim() || /\bverse \d+ not found\b/i.test(this.preview.text)) return null
    this.live = { ...this.preview, isPreview: false }
    this.acts++
    return this.live
  }

  clearLive(): void {
    this.live = null
    this.acts++
  }
}

export function detectionKey(ref: { book: string; chapter?: number | null; verse?: number | null; rangeEnd?: number | null; endVerse?: number | null }): string {
  return JSON.stringify([ref.book, ref.chapter ?? null, ref.verse ?? null, ref.rangeEnd ?? ref.endVerse ?? null])
}

/**
 * The verses of one chapter from `start` to `end` that this version has.
 *
 * Some modern Bibles do not number a verse at all: BSB has no Mark 9:44 or
 * 9:46, the shipped WEB no Acts 8:37 (both follow older manuscripts). Those
 * numbers are simply absent rows, and a reading goes on across them keeping
 * its real verse numbers — "Mark 9:43-48" in BSB is 43, 45, 47, 48. The wall
 * (get-verse-range), the second-translation line and the preview all read
 * through here, so they agree on which verses a passage holds.
 */
export function readVerseRange(
  database: Pick<Database.Database, 'prepare'>,
  bookId: number, chapter: number, start: number, end: number, version: string
): { verse: number; text: string }[] {
  if (![bookId, chapter, start, end].every(Number.isSafeInteger) || chapter < 1 || start < 1 || end < start) return []
  return database.prepare(
    'SELECT Versecount AS verse, verse AS text FROM bible WHERE Book = ? AND Chapter = ? AND Versecount BETWEEN ? AND ? AND Version = ? ORDER BY Versecount'
  ).all(bookId, chapter, start, end, version) as { verse: number; text: string }[]
}

/** Direct operator selections bypass speech filters and duplicate suppression. */
export function readVersePreview(database: Pick<Database.Database, 'prepare'>, reference: string, version: string): VersePreview | null {
  const parsed = parseReference(reference)
  if (!parsed || parsed.partial || !Number.isSafeInteger(parsed.chapter) || !Number.isSafeInteger(parsed.verse)) return null
  const chapter = parsed.chapter!
  const verse = parsed.verse!
  const endVerse = parsed.endVerse ?? verse
  const bookId = resolveBookId(parsed.bookQuery)
  if (bookId === undefined || chapter < 1 || verse < 1 || !Number.isSafeInteger(endVerse)) return null
  const verses = readVerseRange(database, bookId, chapter, verse, endVerse, version)
  /* Both ends must exist in this version, and every row between them must
     have words. A number the version never had is a gap, not a failure. */
  if (!verses.length || verses[0].verse !== verse || verses[verses.length - 1].verse !== endVerse ||
      verses.some((row) => !row.text.trim())) return null
  return {
    book: bookNames[bookId], chapter, verse,
    endVerse: endVerse !== verse ? endVerse : undefined,
    text: verses.map((row) => row.text).join(' '), verses, version,
    isRange: endVerse !== verse, isPreview: true
  }
}
