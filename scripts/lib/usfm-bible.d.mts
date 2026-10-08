export type BibleRow = [book: number, chapter: number, verse: number, text: string]
export const KJV_USFM_URL: string
export const CANON: string[]
export const CHAPTER_COUNTS: number[]
export function readZipEntries(input: Uint8Array): Map<string, string>
export function parseUsfmBook(input: string): BibleRow[]
export function validateKjvRows(rows: BibleRow[]): BibleRow[]
export function parseKjvArchive(bytes: Uint8Array): BibleRow[]
