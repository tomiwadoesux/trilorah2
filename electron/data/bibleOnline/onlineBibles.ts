/**
 * NKJV, NIV and whatever else the build's YouVersion key unlocks, read
 * through a local cache so that a service never waits on the network twice
 * for the same chapter.
 *
 * Reads stay synchronous (main.ts asks `isCached` and then reads the cache
 * database with the same SQL as bible.db). Only a chapter not kept yet goes
 * to the network, once, however many callers ask at the same moment, and
 * never more than YouVersion allows: after a 429 nothing is sent until its
 * Retry-After has passed.
 *
 * The key is the church-free part of the Platform's terms: the app is
 * registered once by the owner, its key is compiled into the build
 * (scripts/write-service-defaults.mjs) and there is no field for it. With no
 * key, NKJV and NIV are still listed — greyed, with the reason.
 *
 * Pure apart from the cache handle and an injectable client, so the rules
 * are tested with invented text (onlineBibles.test.ts).
 */
import { createHash } from 'node:crypto'
import { CHAPTER_COUNTS } from '../../../shared/chapterCounts'
import { VERSION_CODE_RE, versionName } from '../../../shared/bibleVersions'
import { YouVersionClient, YouVersionError, type YouVersionBible } from './youversionClient'
import type { CachedVersion, OnlineBibleCache } from './onlineCache'

/** The two a church asks for by name. Every picker lists them, unlocked or not. */
export const WANTED_ONLINE: readonly string[] = ['NKJV', 'NIV']

/** YouVersion's own ids, so these are recognised whatever their abbreviation field says. */
const KNOWN_IDS: Readonly<Record<number, string>> = { 111: 'NIV', 114: 'NKJV' }

/** How long the list of unlocked Bibles is trusted before asking again. */
export const LISTING_TTL_MS = 24 * 60 * 60 * 1000

export type OnlineState = 'no-key' | 'checking' | 'ready' | 'offline' | 'key-rejected' | 'rate-limited'
export type OnlineFailure = 'not-online' | 'no-key' | 'key-rejected' | 'not-licensed' | 'not-found' | 'rate-limited' | 'offline' | 'timeout'
export type EnsureResult = { ok: true } | { ok: false; reason: OnlineFailure }

export interface OnlineVersionStatus {
  code: string
  title: string
  attribution: string | null
  /** Chapters kept on this computer right now. */
  chapters: number
}

export interface OnlineStatus {
  state: OnlineState
  /** A key is compiled in (or set by a developer). */
  configured: boolean
  /** One line for Settings. */
  text: string
  versions: OnlineVersionStatus[]
}

/** Why a chapter could not come, in the words the service log uses. */
export function failureText(reason: OnlineFailure): string {
  switch (reason) {
    case 'no-key': return 'no YouVersion key in this build'
    case 'key-rejected': return 'YouVersion refused the key'
    case 'not-licensed': return 'not licensed for this app'
    case 'not-found': return 'YouVersion has no such chapter'
    case 'rate-limited': return 'YouVersion asked us to wait'
    case 'timeout': return 'YouVersion was too slow'
    case 'offline': return 'YouVersion is unreachable'
    default: return 'not an online Bible'
  }
}

/** The app's code for a Bible on the list: NIV, NKJV, AMP… or null when it has none that fits a picker. */
export function codeForBible(bible: Pick<YouVersionBible, 'id' | 'abbreviation'>): string | null {
  const known = KNOWN_IDS[bible.id]
  if (known) return known
  const code = bible.abbreviation.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return VERSION_CODE_RE.test(code) ? code : null
}

/**
 * The online versions worth offering: English, with a code a picker can
 * show, and not one the app already ships — a bundled Bible always wins,
 * and its variants (WEBUS, WEBBE beside WEB) would only list it twice.
 */
export function onlineVersionsFrom(bibles: readonly YouVersionBible[], bundled: readonly string[]): CachedVersion[] {
  const out = new Map<string, CachedVersion>()
  const ordered = [...bibles].sort((a, b) =>
    Number(!(a.id in KNOWN_IDS)) - Number(!(b.id in KNOWN_IDS)) || a.id - b.id)
  for (const bible of ordered) {
    if (bible.languageTag && !/^en(\b|-|_)/i.test(bible.languageTag)) continue
    const code = codeForBible(bible)
    if (!code || out.has(code) || bundled.some((b) => code.startsWith(b))) continue
    out.set(code, { code, bibleId: bible.id, title: bible.title || versionName(code), attribution: bible.attribution })
  }
  return [...out.values()]
}

type Client = Pick<YouVersionClient, 'listBibles' | 'chapter' | 'bible'>

export interface OnlineBiblesOptions {
  cache: OnlineBibleCache
  /** Read on every use: a developer's .env.local, else the compiled key. */
  appKey: () => string
  /** Codes bible.db holds. */
  bundled: () => readonly string[]
  makeClient?: (key: string) => Client
  now?: () => number
  /** The list of usable versions, or the state, changed: pickers refresh. */
  onChange?: () => void
  log?: (line: string) => void
}

const OK: EnsureResult = { ok: true }
const fail = (reason: OnlineFailure): EnsureResult => ({ ok: false, reason })

export class OnlineBibles {
  private state: OnlineState = 'checking'
  private blockedUntil = 0
  private readonly inflight = new Map<string, Promise<EnsureResult>>()
  private refreshing: Promise<void> | null = null
  private readonly now: () => number

  constructor(private readonly opts: OnlineBiblesOptions) {
    this.now = opts.now ?? Date.now
  }

  private key(): string {
    return (this.opts.appKey() ?? '').trim()
  }

  private keyId(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 16)
  }

  private client(key: string): Client {
    return this.opts.makeClient ? this.opts.makeClient(key) : new YouVersionClient({ appKey: key })
  }

  private setState(next: OnlineState): void {
    if (this.state === next) return
    this.state = next
    this.opts.onChange?.()
  }

  currentState(): OnlineState {
    if (!this.key()) return 'no-key'
    if (this.state === 'rate-limited' && this.now() >= this.blockedUntil) return 'ready'
    return this.state
  }

  /** What the key unlocks, as last heard — usable offline, for as long as the cache is. */
  versions(): CachedVersion[] {
    const key = this.key()
    if (!key || this.state === 'key-rejected') return []
    const listing = this.opts.cache.listing()
    if (listing.keyId !== this.keyId(key)) return []
    const bundled = this.opts.bundled()
    return listing.versions.filter((v) => !bundled.includes(v.code))
  }

  codes(): string[] {
    return this.versions().map((v) => v.code)
  }

  version(code: string): CachedVersion | undefined {
    const want = String(code ?? '').toUpperCase()
    return this.versions().find((v) => v.code === want)
  }

  has(code: string): boolean {
    return !!this.version(code)
  }

  attribution(code: string): string | null {
    return this.version(code)?.attribution ?? null
  }

  isCached(code: string, book: number, chapter: number): boolean {
    const v = this.version(code)
    return !!v && this.opts.cache.hasChapter(v.code, book, chapter)
  }

  /**
   * Ask YouVersion which Bibles this key unlocks — at most once a day unless
   * forced. The answer is kept, so a laptop that starts offline on Sunday
   * still lists what it had on Saturday.
   */
  refresh(force = false): Promise<void> {
    if (this.refreshing) return this.refreshing
    const key = this.key()
    if (!key) {
      this.setState('no-key')
      return Promise.resolve()
    }
    const id = this.keyId(key)
    const listing = this.opts.cache.listing()
    // Another key (a new build): what the old one unlocked is not this one's.
    if (listing.keyId && listing.keyId !== id) this.opts.cache.clearListing()
    const fresh = listing.keyId === id && listing.listedAt !== null && this.now() - listing.listedAt < LISTING_TTL_MS
    if ((fresh && !force) || this.now() < this.blockedUntil) {
      if (this.state === 'checking' || this.state === 'no-key') this.setState(fresh ? 'ready' : 'checking')
      return Promise.resolve()
    }
    if (!fresh) this.setState('checking')
    this.refreshing = (async () => {
      try {
        const client = this.client(key)
        const versions = onlineVersionsFrom(await client.listBibles('en'), this.opts.bundled())
        /* A listing without a copyright line: the version's own record has
           it ("always display a Bible Version's copyright attribution"). */
        for (const v of versions) {
          if (v.attribution) continue
          try { v.attribution = (await client.bible(v.bibleId)).attribution } catch { /* shown without; see Settings */ }
        }
        this.opts.cache.saveListing(versions, id)
        this.opts.log?.(`📖 YouVersion unlocks ${versions.length ? versions.map((v) => v.code).join(', ') : 'no extra Bibles'} for this app`)
        this.state = 'ready'
      } catch (error) {
        this.noteFailure(error)
      } finally {
        this.refreshing = null
        this.opts.onChange?.()
      }
    })()
    return this.refreshing
  }

  /**
   * Make one chapter readable. Cache-first; a miss is fetched once however
   * many callers ask, and a caller that cannot wait (`timeoutMs`) gets
   * 'timeout' while the fetch carries on and fills the cache for next time.
   */
  async ensureChapter(code: string, book: number, chapter: number, timeoutMs = 0): Promise<EnsureResult> {
    const v = this.version(code)
    if (!v) {
      if (!this.key()) return fail('no-key')
      return fail(this.state === 'key-rejected' ? 'key-rejected' : 'not-licensed')
    }
    if (!Number.isSafeInteger(book) || book < 0 || book >= CHAPTER_COUNTS.length ||
        !Number.isSafeInteger(chapter) || chapter < 1 || chapter > CHAPTER_COUNTS[book]) return fail('not-found')
    if (this.opts.cache.hasChapter(v.code, book, chapter)) {
      this.opts.cache.touch(v.code, book, chapter)
      return OK
    }
    const id = `${v.code}:${book}:${chapter}`
    let job = this.inflight.get(id)
    if (!job) {
      if (this.now() < this.blockedUntil) return fail('rate-limited')
      job = this.fetchChapter(v, book, chapter).finally(() => this.inflight.delete(id))
      this.inflight.set(id, job)
    }
    if (!(timeoutMs > 0)) return job
    let timer: ReturnType<typeof setTimeout> | undefined
    const late = new Promise<EnsureResult>((resolve) => { timer = setTimeout(() => resolve(fail('timeout')), timeoutMs) })
    try {
      return await Promise.race([job, late])
    } finally {
      clearTimeout(timer)
    }
  }

  private async fetchChapter(v: CachedVersion, book: number, chapter: number): Promise<EnsureResult> {
    const key = this.key()
    if (!key) return fail('no-key')
    try {
      const verses = await this.client(key).chapter(v.bibleId, book, chapter)
      // Withdrawn while the request was out: keep nothing.
      if (!this.has(v.code)) return fail('not-licensed')
      this.opts.cache.putChapter(v.code, book, chapter, verses)
      if (this.state !== 'ready') this.setState('ready')
      return OK
    } catch (error) {
      return fail(this.noteFailure(error, v.code))
    }
  }

  /** What an error means for the whole provider, and the reason to give the caller. */
  private noteFailure(error: unknown, code?: string): OnlineFailure {
    const kind = error instanceof YouVersionError ? error.kind : 'network'
    switch (kind) {
      case 'unauthorized':
        // Nothing fetched with a refused key may stay on screen.
        this.opts.cache.clearListing()
        this.opts.log?.('📖 YouVersion refused this build\'s key — NKJV and NIV are off until a new key is built in')
        this.setState('key-rejected')
        return 'key-rejected'
      case 'forbidden':
        if (!code) {
          // The Bible list itself refused: the key is not enabled for it.
          this.setState('key-rejected')
          return 'key-rejected'
        }
        this.opts.cache.dropVersion(code)
        this.opts.log?.(`📖 YouVersion no longer licenses ${code} to this app — its kept chapters are deleted`)
        this.opts.onChange?.()
        return 'not-licensed'
      case 'rate-limited': {
        const wait = error instanceof YouVersionError && error.retryAfterMs !== undefined ? error.retryAfterMs : 60_000
        this.blockedUntil = this.now() + wait
        this.opts.log?.(`📖 YouVersion asked us to wait ${Math.ceil(wait / 60_000)} min`)
        this.setState('rate-limited')
        return 'rate-limited'
      }
      case 'not-found':
        return 'not-found'
      case 'timeout':
        this.setState('offline')
        return 'timeout'
      default:
        this.setState('offline')
        return 'offline'
    }
  }

  /** Drop chapters past their 30 days (main.ts runs this hourly). */
  purgeStale(): number {
    return this.opts.cache.purgeStale()
  }

  status(): OnlineStatus {
    const state = this.currentState()
    const versions = this.versions().map((v) => ({
      code: v.code, title: v.title, attribution: v.attribution, chapters: this.opts.cache.chapterCount(v.code),
    }))
    const codes = versions.map((v) => v.code).join(', ')
    const kept = versions.reduce((n, v) => n + v.chapters, 0)
    const keptText = `${kept} ${kept === 1 ? 'chapter' : 'chapters'} kept`
    let text: string
    switch (state) {
      case 'no-key': text = 'no YouVersion key in this build'; break
      case 'key-rejected': text = 'YouVersion refused this build’s key'; break
      case 'checking': text = 'checking YouVersion…'; break
      case 'rate-limited': text = `${codes || 'YouVersion'} · asked to wait — back in ${Math.max(1, Math.ceil((this.blockedUntil - this.now()) / 60_000))} min`; break
      case 'offline': text = versions.length ? `${codes} · offline — ${keptText}` : 'can’t reach YouVersion'; break
      default: text = versions.length ? `${codes} from YouVersion · ${keptText}` : 'key works · no extra Bibles unlocked yet'
    }
    return { state, configured: !!this.key(), text, versions }
  }

  /** Why a version a church asks for cannot be picked yet — the picker's grey hint. */
  unavailableNote(code: string): string {
    switch (this.currentState()) {
      case 'no-key': return 'needs a YouVersion key'
      case 'key-rejected': return 'YouVersion key refused'
      case 'checking': return 'checking YouVersion…'
      case 'offline': return 'YouVersion unreachable'
      default: return this.has(code) ? '' : 'not unlocked for this app'
    }
  }
}
