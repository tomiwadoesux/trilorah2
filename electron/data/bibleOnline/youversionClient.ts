/**
 * The YouVersion Platform REST API, as far as Trilorah uses it.
 *
 * Licensed, official access to NKJV, NIV and the other Bibles a publisher
 * has opted in, free for non-commercial apps (developers.youversion.com):
 *   GET /v1/bibles?language_ranges[]=en       the Bibles THIS app key is licensed for
 *   GET /v1/bibles/{id}/passages/{BOOK.CH}   one chapter (we ask for HTML, see below)
 * Every request carries the app key in `X-YVP-App-Key`.
 *
 * What the docs say to handle, and how:
 * - 401: the key is missing or not recognised.
 * - 403: the key is fine but not licensed for that Bible ("Access denied for
 *   111") — a publisher licence not accepted in the portal, or withdrawn.
 *   Metadata is not gated like text, so only a passage 403 is trusted.
 * - 429: the account's allowance (200 requests an hour, per the Platform
 *   FAQ) is spent. The body is plain text, not JSON, and `Retry-After` says
 *   how long to wait.
 * - Chapters come as HTML because `format=text` drops the verse numbers;
 *   youversionHtml.ts splits them.
 *
 * No Electron imports and an injectable fetch, so it is tested offline with
 * invented text (youversionClient.test.ts).
 */
import { versesFromPassageHtml, type ParsedVerse } from './youversionHtml'

export const YOUVERSION_API = 'https://api.youversion.com/v1'

/** USFM book codes in canonical order: index = the 0-based book id bible.db uses. */
export const USFM_BOOKS: readonly string[] = (
  'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL ' +
  'MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'
).split(' ')

export interface YouVersionBible {
  id: number
  abbreviation: string
  title: string
  languageTag: string
  /** The words the version's licence asks to be shown with its text. */
  attribution: string | null
}

export type YouVersionErrorKind =
  | 'no-key' | 'unauthorized' | 'forbidden' | 'not-found' | 'rate-limited'
  | 'timeout' | 'network' | 'server' | 'bad-response'

export class YouVersionError extends Error {
  constructor(
    readonly kind: YouVersionErrorKind,
    message: string,
    readonly status?: number,
    /** For 'rate-limited': how long the API asked us to wait. */
    readonly retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'YouVersionError'
  }
}

export interface YouVersionClientOptions {
  appKey: string
  /** Only for tests and a developer's local mock; see safeBaseUrl. */
  baseUrl?: string
  fetch?: typeof fetch
  /** Per request. */
  timeoutMs?: number
  userAgent?: string
}

/**
 * The real API, or a loopback address for a developer's mock. Anything else
 * is refused so an environment variable cannot send the build's key to
 * another host.
 */
export function safeBaseUrl(candidate: string | undefined): string {
  if (!candidate) return YOUVERSION_API
  try {
    const url = new URL(candidate)
    const loopback = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    if (loopback || candidate.replace(/\/+$/, '') === YOUVERSION_API) return candidate.replace(/\/+$/, '')
  } catch { /* not a URL */ }
  return YOUVERSION_API
}

/** Seconds, or an HTTP date; a minute when the header is missing or odd. */
export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds, 6 * 3600) * 1000
    const at = Date.parse(header)
    if (Number.isFinite(at)) return Math.max(0, Math.min(at - now, 6 * 3600 * 1000))
  }
  return 60_000
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function bibleFrom(raw: Record<string, unknown> | null | undefined): YouVersionBible | null {
  const id = Number(raw?.id)
  if (!raw || !Number.isSafeInteger(id) || id <= 0) return null
  return {
    id,
    abbreviation: text(raw.abbreviation) || text(raw.localized_abbreviation),
    title: text(raw.title) || text(raw.localized_title),
    languageTag: text(raw.language_tag),
    // The docs' own order: the short copyright, else the promotional text.
    attribution: text(raw.copyright) || text(raw.promotional_content) || null,
  }
}

export class YouVersionClient {
  private readonly base: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(private readonly options: YouVersionClientOptions) {
    this.base = safeBaseUrl(options.baseUrl)
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.timeoutMs = options.timeoutMs ?? 10_000
  }

  private async get(path: string, params: [string, string][]): Promise<unknown> {
    if (!this.options.appKey) throw new YouVersionError('no-key', 'No YouVersion app key in this build')
    const query = new URLSearchParams(params).toString()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let response: Response
    try {
      response = await this.fetchImpl(`${this.base}${path}${query ? `?${query}` : ''}`, {
        headers: {
          'X-YVP-App-Key': this.options.appKey,
          Accept: 'application/json',
          ...(this.options.userAgent ? { 'User-Agent': this.options.userAgent } : {}),
        },
        signal: controller.signal,
      })
    } catch (error) {
      const aborted = controller.signal.aborted || (error as { name?: string })?.name === 'AbortError'
      throw aborted
        ? new YouVersionError('timeout', 'YouVersion took too long to answer')
        : new YouVersionError('network', 'Could not reach YouVersion')
    } finally {
      clearTimeout(timer)
    }
    const status = response.status
    // Status first: a 429 body is plain text and would throw in .json().
    if (status === 401) throw new YouVersionError('unauthorized', 'YouVersion did not accept this app key', status)
    if (status === 403) throw new YouVersionError('forbidden', 'This app is not licensed for that Bible', status)
    if (status === 404) throw new YouVersionError('not-found', 'YouVersion has no such passage', status)
    if (status === 429) {
      throw new YouVersionError('rate-limited', 'YouVersion asked us to slow down', status,
        retryAfterMs(response.headers.get('retry-after')))
    }
    if (status >= 500) throw new YouVersionError('server', `YouVersion had a problem (${status})`, status)
    if (status !== 200) throw new YouVersionError('bad-response', `Unexpected answer from YouVersion (${status})`, status)
    try {
      return await response.json()
    } catch {
      throw new YouVersionError('bad-response', 'YouVersion sent something that is not JSON', status)
    }
  }

  /**
   * The Bibles this app key is licensed for, in one language. Without
   * `all_available` the API answers for this app only — exactly the list
   * Trilorah may read from.
   */
  async listBibles(languageRange = 'en'): Promise<YouVersionBible[]> {
    const bibles: YouVersionBible[] = []
    let pageToken: string | null = null
    for (let page = 0; page < 10; page++) {
      const params: [string, string][] = [['language_ranges[]', languageRange], ['page_size', '100']]
      if (pageToken) params.push(['page_token', pageToken])
      const body = await this.get('/bibles', params) as { data?: unknown; next_page_token?: unknown } | null
      if (!body || !Array.isArray(body.data)) throw new YouVersionError('bad-response', 'YouVersion sent an unexpected Bible list')
      for (const raw of body.data as Record<string, unknown>[]) {
        const bible = bibleFrom(raw)
        if (bible) bibles.push(bible)
      }
      pageToken = typeof body.next_page_token === 'string' && body.next_page_token ? body.next_page_token : null
      if (!pageToken) break
    }
    return bibles
  }

  /** One Bible's details — where its copyright line comes from when a listing leaves it out. */
  async bible(id: number): Promise<YouVersionBible> {
    const bible = bibleFrom(await this.get(`/bibles/${id}`, []) as Record<string, unknown> | null)
    if (!bible) throw new YouVersionError('bad-response', 'YouVersion sent unexpected Bible details')
    return bible
  }

  /** One chapter's verses. `book` is the 0-based canonical id. */
  async chapter(bibleId: number, book: number, chapter: number): Promise<ParsedVerse[]> {
    const usfm = USFM_BOOKS[book]
    if (!usfm || !Number.isSafeInteger(bibleId) || !Number.isSafeInteger(chapter) || chapter < 1) {
      throw new YouVersionError('not-found', 'No such chapter')
    }
    const body = await this.get(`/bibles/${bibleId}/passages/${usfm}.${chapter}`, [
      ['format', 'html'], ['include_headings', 'false'], ['include_notes', 'false'],
    ]) as { content?: unknown } | null
    if (!body || typeof body.content !== 'string') throw new YouVersionError('bad-response', 'YouVersion sent an unexpected passage')
    const verses = versesFromPassageHtml(body.content)
    if (!verses.length) throw new YouVersionError('bad-response', 'YouVersion sent a chapter with no verses in it')
    return verses
  }
}
