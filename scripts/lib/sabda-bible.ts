import fs from 'node:fs/promises'
import path from 'node:path'
import { BiblikaClient, BiblikaError, SABDA_PASSAGE_API } from '../../electron/data/bibleOnline/biblikaClient'
import type { ParsedVerse } from '../../electron/data/bibleOnline/youversionHtml'
import { DOWNLOADED_BIBLES, type DownloadedBibleCode } from '../../shared/downloadedBibles'
import { CHAPTER_COUNTS, type BibleRow } from './usfm-bible.mjs'
import { validateBibleRows } from './helloao-bible.mjs'

export const SABDA_SOURCES = Object.fromEntries(Object.entries(DOWNLOADED_BIBLES).filter(([code]) => code === 'NLT').map(([code, source]) => [code, {
  ...source,
  id: `sabda-${code.toLowerCase()}`,
  sourceUrl: SABDA_PASSAGE_API,
  rights: 'Copyright retained by the translation owner. All rights reserved; source availability does not grant redistribution rights.',
}]))

function chapterRows(value: unknown, book: number, chapter: number): BibleRow[] {
  if (!Array.isArray(value) || !value.length) throw new Error(`Empty SABDA chapter ${book + 1}:${chapter}`)
  const seen = new Set<number>()
  return value.map((item: ParsedVerse) => {
    if (!item || !Number.isSafeInteger(item.verse) || item.verse < 1 || item.verse > 176 || seen.has(item.verse) ||
        typeof item.text !== 'string' || !item.text.trim() || /[<>\\{}|]/.test(item.text)) {
      throw new Error(`Invalid SABDA verse at ${book + 1}:${chapter}`)
    }
    seen.add(item.verse)
    return [book, chapter, item.verse, item.text] as BibleRow
  })
}

/** Download every chapter before allowing the builder to replace a translation. */
export async function downloadSabdaBible(code: DownloadedBibleCode, options: {
  cacheDir?: string | null
  client?: Pick<BiblikaClient, 'chapter'> & Partial<Pick<BiblikaClient, 'chapters'>>
  concurrency?: number
  onProgress?: (done: number, total: number) => void
} = {}): Promise<BibleRow[]> {
  if (!Object.hasOwn(DOWNLOADED_BIBLES, code)) throw new Error(`Unknown SABDA version ${code}`)
  const concurrency = options.concurrency ?? 4
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error('SABDA concurrency must be between 1 and 12')
  const client = options.client ?? new BiblikaClient({ timeoutMs: 30_000, userAgent: 'Trilorah Bible builder (+https://trilorah.com)' })
  // Small responses finish reliably; large whole-book responses can stall upstream.
  const batchSize = client.chapters ? 10 : 1
  const jobs = CHAPTER_COUNTS.flatMap((count, book) => Array.from({ length: Math.ceil(count / batchSize) }, (_, i) =>
    ({ book, first: i * batchSize + 1, last: Math.min(count, (i + 1) * batchSize) })))
  const total = CHAPTER_COUNTS.reduce((sum, count) => sum + count, 0)
  const results: BibleRow[][] = new Array(jobs.length)
  let next = 0, done = 0, blockedUntil = 0
  let failed = false
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const worker = async () => {
    while (!failed && next < jobs.length) {
      const index = next++
      const { book, first, last } = jobs[index]
      const kept = new Map<number, BibleRow[]>()
      const fileFor = (chapter: number) => options.cacheDir && path.join(options.cacheDir, 'sabda-v1', code, `${book}-${chapter}.json`)
      for (let chapter = first; chapter <= last; chapter++) {
        const file = fileFor(chapter)
        if (file) {
          try {
            const cached = JSON.parse(await fs.readFile(file, 'utf8'))
            if (cached.code === code && cached.book === book && cached.chapter === chapter) kept.set(chapter, chapterRows(cached.verses, book, chapter))
          } catch { /* Missing or invalid cache: download this chapter again. */ }
        }
      }
      if (kept.size !== last - first + 1) {
        const save = async (chapter: number, verses: ParsedVerse[]) => {
          kept.set(chapter, chapterRows(verses, book, chapter))
          const file = fileFor(chapter)
          if (file) {
            await fs.mkdir(path.dirname(file), { recursive: true })
            await fs.writeFile(file, JSON.stringify({ code, book, chapter, verses }))
          }
        }
        for (let attempt = 0; ; attempt++) {
          if (failed) return
          while (Date.now() < blockedUntil) await sleep(blockedUntil - Date.now())
          try {
            // A stalled range must not hold up an otherwise complete download.
            // Retry its missing chapters individually and keep each successful one.
            if (attempt > 0 && last > first) {
              for (let chapter = first; chapter <= last; chapter++) {
                if (failed) return
                while (Date.now() < blockedUntil) await sleep(blockedUntil - Date.now())
                if (!kept.has(chapter)) await save(chapter, await client.chapter(code, book, chapter))
              }
              break
            }
            const loaded = client.chapters ? await client.chapters(code, book, first, last)
              : [{ chapter: first, verses: await client.chapter(code, book, first) }]
            if (loaded.length !== last - first + 1 || loaded.some((v, i) => v.chapter !== first + i)) throw new Error('Incomplete SABDA chapter range')
            for (const { chapter, verses } of loaded) {
              await save(chapter, verses)
            }
            break
          } catch (error) {
            if (attempt >= 9 || !(error instanceof BiblikaError) || !['offline', 'timeout', 'rate-limited'].includes(error.kind)) {
              throw new Error(`${code} book ${book + 1}, chapters ${first}-${last}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
            }
            if (error.kind === 'rate-limited') blockedUntil = Math.max(blockedUntil, Date.now() + error.retryAfterMs)
            else await sleep(Math.min(15_000, 1000 * 2 ** attempt))
          }
        }
      }
      results[index] = [...kept.entries()].sort(([a], [b]) => a - b).flatMap(([, rows]) => rows)
      done += kept.size
      options.onProgress?.(done, total)
    }
  }
  // Let active requests settle before reporting failure; no writes continue afterwards.
  const workers = await Promise.allSettled(Array.from({ length: concurrency }, async () => {
    try { await worker() } catch (error) { failed = true; throw error }
  }))
  const failure = workers.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason
  const rows = results.flat()
  validateBibleRows(rows, { version: code })
  if (rows.length < 30_000 || rows.length > 32_000) throw new Error(`${code}: unexpected verse count ${rows.length}`)
  return rows
}
