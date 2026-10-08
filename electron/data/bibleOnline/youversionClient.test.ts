import { describe, expect, it, vi } from 'vitest'
import { USFM_BOOKS, YOUVERSION_API, YouVersionClient, YouVersionError, retryAfterMs, safeBaseUrl } from './youversionClient'

type Call = { url: string; headers: Record<string, string> }

/** A fetch that answers from a script and records what was asked. Invented text only. */
function mockFetch(answer: (url: URL) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url: url.toString(), headers: Object.fromEntries(Object.entries(init?.headers ?? {})) })
    return answer(url)
  }) as unknown as typeof globalThis.fetch
  return { fetch, calls }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('YouVersionClient', () => {
  it('lists the Bibles this key is licensed for, following pages, with the key in the header', async () => {
    const { fetch, calls } = mockFetch((url) => url.searchParams.get('page_token')
      ? json({ data: [{ id: 114, abbreviation: 'NKJV', title: 'Invented King Title', language_tag: 'en', promotional_content: 'Invented promo line' }], next_page_token: null })
      : json({ data: [{ id: 111, abbreviation: 'NIV', title: 'Invented International Title', language_tag: 'en', copyright: 'Invented copyright line' }], next_page_token: 'p2' }))
    const client = new YouVersionClient({ appKey: 'test-key', fetch, userAgent: 'Trilorah/test' })
    const bibles = await client.listBibles('en')
    expect(bibles).toEqual([
      { id: 111, abbreviation: 'NIV', title: 'Invented International Title', languageTag: 'en', attribution: 'Invented copyright line' },
      { id: 114, abbreviation: 'NKJV', title: 'Invented King Title', languageTag: 'en', attribution: 'Invented promo line' },
    ])
    expect(calls).toHaveLength(2)
    const first = new URL(calls[0].url)
    expect(`${first.origin}${first.pathname}`).toBe(`${YOUVERSION_API}/bibles`)
    expect(first.searchParams.getAll('language_ranges[]')).toEqual(['en'])
    // App-scoped list only: never the whole platform catalogue.
    expect(first.searchParams.has('all_available')).toBe(false)
    expect(calls[0].headers['X-YVP-App-Key']).toBe('test-key')
    expect(calls[0].headers['User-Agent']).toBe('Trilorah/test')
    expect(new URL(calls[1].url).searchParams.get('page_token')).toBe('p2')
  })

  it('fetches a chapter as HTML without headings or notes and returns its verses', async () => {
    const { fetch, calls } = mockFetch(() => json({
      id: 'JHN.3', reference: 'Invented 3',
      content: '<div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Invented one. <span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>Invented two.</div>',
    }))
    const verses = await new YouVersionClient({ appKey: 'k', fetch }).chapter(111, 42, 3)
    expect(verses).toEqual([{ verse: 1, text: 'Invented one.' }, { verse: 2, text: 'Invented two.' }])
    const url = new URL(calls[0].url)
    expect(url.pathname).toBe('/v1/bibles/111/passages/JHN.3')
    expect(url.searchParams.get('format')).toBe('html')
    expect(url.searchParams.get('include_headings')).toBe('false')
    expect(url.searchParams.get('include_notes')).toBe('false')
  })

  it('names each refusal the way the docs describe it', async () => {
    const cases: [Response, string][] = [
      [new Response('', { status: 401 }), 'unauthorized'],
      [json({ message: 'Access denied for 111' }, 403), 'forbidden'],
      [new Response('', { status: 404 }), 'not-found'],
      [new Response('Rate limit exceeded.', { status: 429, headers: { 'retry-after': '120', 'content-type': 'text/plain' } }), 'rate-limited'],
      [new Response('oops', { status: 503 }), 'server'],
      [new Response('not json', { status: 200 }), 'bad-response'],
    ]
    for (const [response, kind] of cases) {
      const { fetch } = mockFetch(() => response)
      const error = await new YouVersionClient({ appKey: 'k', fetch }).chapter(111, 0, 1).catch((e) => e)
      expect(error).toBeInstanceOf(YouVersionError)
      expect((error as YouVersionError).kind).toBe(kind)
      if (kind === 'rate-limited') expect((error as YouVersionError).retryAfterMs).toBe(120_000)
    }
  })

  it('times out a request that never answers, and reports a dead network as such', async () => {
    // A fetch that never answers on its own — it rejects only when its signal fires, as a real one does.
    const fetch = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })) as unknown as typeof globalThis.fetch
    const slow = await new YouVersionClient({ appKey: 'k', fetch, timeoutMs: 20 }).chapter(111, 0, 1).catch((e) => e)
    expect((slow as YouVersionError).kind).toBe('timeout')
    const dead = mockFetch(() => { throw new TypeError('fetch failed') })
    const offline = await new YouVersionClient({ appKey: 'k', fetch: dead.fetch }).listBibles().catch((e) => e)
    expect((offline as YouVersionError).kind).toBe('network')
  })

  it('sends nothing without a key', async () => {
    const { fetch, calls } = mockFetch(() => json({}))
    const error = await new YouVersionClient({ appKey: '', fetch }).listBibles().catch((e) => e)
    expect((error as YouVersionError).kind).toBe('no-key')
    expect(calls).toHaveLength(0)
  })

  it('rejects a chapter whose content has no verses, and an impossible request without asking', async () => {
    const empty = mockFetch(() => json({ id: 'GEN.1', content: '<div class="p">nothing marked</div>', reference: 'x' }))
    expect(((await new YouVersionClient({ appKey: 'k', fetch: empty.fetch }).chapter(111, 0, 1).catch((e) => e)) as YouVersionError).kind).toBe('bad-response')
    const never = mockFetch(() => json({}))
    expect(((await new YouVersionClient({ appKey: 'k', fetch: never.fetch }).chapter(111, 66, 1).catch((e) => e)) as YouVersionError).kind).toBe('not-found')
    expect(never.calls).toHaveLength(0)
  })
})

describe('client helpers', () => {
  it('maps the 66 books to USFM codes in bible.db order', () => {
    expect(USFM_BOOKS).toHaveLength(66)
    expect([USFM_BOOKS[0], USFM_BOOKS[18], USFM_BOOKS[42], USFM_BOOKS[65]]).toEqual(['GEN', 'PSA', 'JHN', 'REV'])
  })

  it('only lets a loopback mock replace the real API, so the key cannot be sent elsewhere', () => {
    expect(safeBaseUrl(undefined)).toBe(YOUVERSION_API)
    expect(safeBaseUrl('http://127.0.0.1:9911/v1/')).toBe('http://127.0.0.1:9911/v1')
    expect(safeBaseUrl('http://localhost:3000/v1')).toBe('http://localhost:3000/v1')
    expect(safeBaseUrl('https://evil.example/v1')).toBe(YOUVERSION_API)
    expect(safeBaseUrl('http://10.0.0.5/v1')).toBe(YOUVERSION_API)
    expect(safeBaseUrl('not a url')).toBe(YOUVERSION_API)
  })

  it('reads Retry-After as seconds or a date, defaulting to a minute', () => {
    expect(retryAfterMs('30')).toBe(30_000)
    expect(retryAfterMs(new Date(10_000 + 90_000).toUTCString(), 10_000)).toBe(90_000)
    expect(retryAfterMs(null)).toBe(60_000)
    expect(retryAfterMs('soon')).toBe(60_000)
  })
})
