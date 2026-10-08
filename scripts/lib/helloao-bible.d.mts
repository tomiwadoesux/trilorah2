import type { BibleRow } from './usfm-bible.mjs'
export interface HelloaoSource {
  id: string
  name: string
  rights: string
  licenseUrl: string
  attribution?: string
  expectedVerses: number | null
}
export const HELLOAO: string
export const HELLOAO_SOURCES: Record<'WEB' | 'BSB' | 'ASV', HelloaoSource>
export function verseText(content: unknown): string
export function hasAcrosticTail(book: number, chapter: number, text: string): boolean
export function cleanVerseText(raw: string, book: number, chapter: number): string
export function chapterRows(chapter: { content?: unknown[] } | null | undefined, book: number, chapterNumber: number): BibleRow[]
export function validateBibleRows(rows: BibleRow[], options?: { version?: string; expectedVerses?: number | null }): BibleRow[]
export function rowsSha256(rows: BibleRow[]): string
