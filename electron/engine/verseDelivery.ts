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

  stage(verse: VersePreview): VersePreview {
    this.preview = { ...verse, isPreview: true }
    return this.preview
  }

  promote(source: VersePushSource): VersePreview | null {
    if (source !== 'operator' && source !== 'remote' && source !== 'operator picked from clash') return null
    if (!this.preview?.text.trim() || /\bverse \d+ not found\b/i.test(this.preview.text)) return null
    this.live = { ...this.preview, isPreview: false }
    return this.live
  }

  clearLive(): void {
    this.live = null
  }
}

export function detectionKey(ref: { book: string; chapter?: number | null; verse?: number | null; rangeEnd?: number | null; endVerse?: number | null }): string {
  return JSON.stringify([ref.book, ref.chapter ?? null, ref.verse ?? null, ref.rangeEnd ?? ref.endVerse ?? null])
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
  const verses = database.prepare(
    'SELECT Versecount AS verse, verse AS text FROM bible WHERE Book = ? AND Chapter = ? AND Versecount BETWEEN ? AND ? AND Version = ? ORDER BY Versecount'
  ).all(bookId, chapter, verse, endVerse, version) as { verse: number; text: string }[]
  if (verses.length !== endVerse - verse + 1 || verses.some((row, i) => row.verse !== verse + i || !row.text.trim())) return null
  return {
    book: bookNames[bookId], chapter, verse,
    endVerse: endVerse !== verse ? endVerse : undefined,
    text: verses.map((row) => row.text).join(' '), verses, version,
    isRange: endVerse !== verse, isPreview: true
  }
}
