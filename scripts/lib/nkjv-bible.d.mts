import type { BibleRow } from './usfm-bible.mjs'
export const NKJV_SOURCE: { id: string; name: string; sourceUrl: string; sourceSha256: string; rights: string; attribution: string }
export function nkjvRows(books: unknown): BibleRow[]
export function downloadNkjvBible(cacheDir?: string | null): Promise<BibleRow[]>
