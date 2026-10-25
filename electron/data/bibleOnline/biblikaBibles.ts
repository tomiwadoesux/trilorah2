import { CHAPTER_COUNTS } from '../../../shared/chapterCounts'
import { BiblikaClient, BiblikaError } from './biblikaClient'
import type { CachedVersion, OnlineBibleCache } from './onlineCache'
import type { EnsureResult, OnlineState, OnlineStatus } from './onlineBibles'

/** Numeric ids are local to this provider's separate cache, not YouVersion ids. */
export const BIBLIKA_VERSIONS: readonly CachedVersion[] = [
  { code: 'NKJV', bibleId: 1, title: 'New King James Version', attribution: 'New King James Version © 1982 Thomas Nelson. All rights reserved. Text from SABDA.' },
  { code: 'NLT', bibleId: 2, title: 'New Living Translation (1996)', attribution: 'Holy Bible, New Living Translation © 1996 Tyndale Charitable Trust. All rights reserved. Text from SABDA.' },
]
const SOURCE_ID = 'biblika-sabda-v1'

/** No key is needed. Keep this cache separate from YouVersion's licensed listing. */
export class BiblikaBibles {
  readonly providerName = 'SABDA'
  private state: OnlineState = 'ready'
  private blockedUntil = 0
  private readonly inflight = new Map<string, Promise<EnsureResult>>()
  private readonly client: Pick<BiblikaClient, 'chapter'>
  private readonly now: () => number

  constructor(private readonly opts: {
    cache: OnlineBibleCache
    bundled: () => readonly string[]
    client?: Pick<BiblikaClient, 'chapter'>
    now?: () => number
    onChange?: () => void
  }) {
    this.client = opts.client ?? new BiblikaClient()
    this.now = opts.now ?? Date.now
    if (opts.cache.listing().keyId !== SOURCE_ID) opts.cache.clearListing()
    opts.cache.saveListing(BIBLIKA_VERSIONS, SOURCE_ID)
  }

  versions(): CachedVersion[] { return BIBLIKA_VERSIONS.filter((v) => !this.opts.bundled().includes(v.code)) }
  codes(): string[] { return this.versions().map((v) => v.code) }
  version(code: string): CachedVersion | undefined { return this.versions().find((v) => v.code === String(code).toUpperCase()) }
  has(code: string): boolean { return !!this.version(code) }
  attribution(code: string): string | null { return this.version(code)?.attribution ?? null }
  isCached(code: string, book: number, chapter: number): boolean {
    const version = this.version(code)
    return !!version && this.opts.cache.hasChapter(version.code, book, chapter)
  }
  async refresh(): Promise<void> { /* Fixed catalogue; availability is checked when a chapter is read. */ }
  purgeStale(): number { return this.opts.cache.purgeStale() }
  unavailableNote(): string { return 'SABDA unavailable' }

  private setState(state: OnlineState): void {
    if (state === this.state) return
    this.state = state
    this.opts.onChange?.()
  }

  async ensureChapter(code: string, book: number, chapter: number, timeoutMs = 0): Promise<EnsureResult> {
    const v = this.version(code)
    if (!v) return { ok: false, reason: 'not-online' }
    if (!Number.isSafeInteger(book) || book < 0 || book >= CHAPTER_COUNTS.length ||
        !Number.isSafeInteger(chapter) || chapter < 1 || chapter > CHAPTER_COUNTS[book]) return { ok: false, reason: 'not-found' }
    if (this.opts.cache.hasChapter(v.code, book, chapter)) {
      this.opts.cache.touch(v.code, book, chapter)
      return { ok: true }
    }
    const id = `${v.code}:${book}:${chapter}`
    let job = this.inflight.get(id)
    if (!job) {
      if (this.now() < this.blockedUntil) return { ok: false, reason: 'rate-limited' }
      job = this.fetchChapter(v.code, book, chapter).finally(() => this.inflight.delete(id))
      this.inflight.set(id, job)
    }
    if (!(timeoutMs > 0)) return job
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<EnsureResult>((resolve) => { timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), timeoutMs) })
    try { return await Promise.race([job, timeout]) } finally { clearTimeout(timer) }
  }

  private async fetchChapter(code: string, book: number, chapter: number): Promise<EnsureResult> {
    try {
      const verses = await this.client.chapter(code, book, chapter)
      this.opts.cache.putChapter(code, book, chapter, verses)
      this.setState('ready')
      return { ok: true }
    } catch (error) {
      if (error instanceof BiblikaError && error.kind === 'rate-limited') {
        this.blockedUntil = this.now() + error.retryAfterMs
        this.setState('rate-limited')
        return { ok: false, reason: 'rate-limited' }
      }
      if (error instanceof BiblikaError && error.kind === 'not-found') return { ok: false, reason: 'not-found' }
      this.setState('offline')
      return { ok: false, reason: error instanceof BiblikaError && error.kind === 'timeout' ? 'timeout' : 'offline' }
    }
  }

  status(): OnlineStatus {
    const state = this.state === 'rate-limited' && this.now() >= this.blockedUntil ? 'ready' : this.state
    const versions = this.versions().map((v) => ({ ...v, chapters: this.opts.cache.chapterCount(v.code) }))
    const kept = versions.reduce((n, v) => n + v.chapters, 0)
    const suffix = state === 'offline' ? ' · offline' : state === 'rate-limited' ? ' · asked to wait' : ''
    return { state, configured: true, versions,
      text: `${versions.map((v) => v.code).join(', ') || 'Bibles'} from SABDA${suffix} · ${kept} ${kept === 1 ? 'chapter' : 'chapters'} kept` }
  }
}
