import { failureText, type OnlineBibles, type OnlineFailure, type OnlineStatus, type EnsureResult } from './onlineBibles'
import type { CachedVersion } from './onlineCache'

export type OnlineBibleProvider = Pick<OnlineBibles, 'providerName' | 'versions' | 'has' | 'isCached' | 'refresh' | 'ensureChapter' | 'purgeStale' | 'status' | 'unavailableNote'>

/** One list for every picker/read path. First provider wins; caches never mix. */
export class OnlineBibleLibrary<TDatabase> {
  constructor(private readonly sources: readonly { provider: OnlineBibleProvider; db: TDatabase }[]) {}

  private source(code: string) { return this.sources.find((s) => s.provider.has(code)) }
  versions(): CachedVersion[] {
    const versions = new Map<string, CachedVersion>()
    for (const { provider } of this.sources) {
      for (const v of provider.versions()) if (!versions.has(v.code)) versions.set(v.code, v)
    }
    return [...versions.values()]
  }
  codes(): string[] { return this.versions().map((v) => v.code) }
  version(code: string): CachedVersion | undefined { return this.versions().find((v) => v.code === String(code).toUpperCase()) }
  has(code: string): boolean { return !!this.source(code) }
  databaseFor(code: string): TDatabase | undefined { return this.source(code)?.db }
  isCached(code: string, book: number, chapter: number): boolean { return this.source(code)?.provider.isCached(code, book, chapter) ?? false }
  async refresh(force = false): Promise<void> { await Promise.all(this.sources.map(({ provider }) => provider.refresh(force))) }
  purgeStale(): number { return this.sources.reduce((n, { provider }) => n + provider.purgeStale(), 0) }
  ensureChapter(code: string, book: number, chapter: number, timeoutMs = 0): Promise<EnsureResult> {
    return this.source(code)?.provider.ensureChapter(code, book, chapter, timeoutMs) ?? Promise.resolve({ ok: false, reason: 'not-online' })
  }
  failureText(code: string, reason: OnlineFailure): string { return failureText(reason, this.source(code)?.provider.providerName ?? 'Online Bible provider') }
  unavailableNote(code: string): string {
    return this.has(code) ? '' : this.sources.find((s) => s.provider.providerName === 'YouVersion')?.provider.unavailableNote(code) ?? 'online Bible unavailable'
  }
  status(): OnlineStatus {
    const statuses = this.sources.map(({ provider }) => provider.status())
    const active = statuses.filter((s) => s.configured)
    const shown = active.length ? active : statuses
    const state = shown.find((s) => s.state !== 'ready')?.state ?? 'ready'
    const versions = this.versions().map((v) => {
      const status = this.source(v.code)!.provider.status().versions.find((s) => s.code === v.code)!
      return { code: v.code, title: v.title, attribution: v.attribution, chapters: status.chapters }
    })
    return { state, configured: active.length > 0, text: shown.map((s) => s.text).join('; '), versions }
  }
}
