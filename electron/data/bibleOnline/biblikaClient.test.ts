import { describe, expect, it, vi } from 'vitest'
import { BiblikaClient, SABDA_BOOKS, SABDA_PASSAGE_API, versesFromSabdaXml } from './biblikaClient'

// Invented text only; no publisher's chapter is stored in test fixtures.
const xml = (content = '<verse><number>1</number><text>Invented verse.</text></verse>', book = 1, chapter = 1) =>
  `<?xml version="1.0"?><bible><book><book_id>${book}</book_id><chapter><chap>${chapter}</chap><verses>${content}</verses></chapter></book></bible>`

describe('SABDA chapter parsing', () => {
  it('keeps verse numbers, decodes entities and removes headings, notes and inline emphasis', () => {
    const body = xml('<verse><number>2</number><title>Not scripture</title><text>Invented \\i1words\\i0 here &amp; there&#x2014;yes.<sup>note</sup></text></verse><verse><number>1</number><text><![CDATA[Another <i>invented</i> line.]]></text></verse>')
    expect(versesFromSabdaXml(body, 0, 1)).toEqual([
      { verse: 1, text: 'Another invented line.' },
      { verse: 2, text: 'Invented words here & there—yes.' },
    ])
  })

  it.each([
    '<html>Service unavailable</html>',
    xml('', 1, 1),
    xml(undefined, 2, 1),
    xml(undefined, 1, 2),
    xml('<verse><number>0</number><text>No verse</text></verse>'),
    xml('<verse><number>1</number><text></text></verse>'),
    xml('<verse><number>1</number><text>Invented.</text></verse>'.repeat(2)),
    xml().replace('</verse>', ''),
    '<!DOCTYPE bible [<!ENTITY secret SYSTEM "file:///etc/passwd">]>' + xml(),
  ])('refuses empty, malformed or mismatched chapters', (body) => {
    expect(() => versesFromSabdaXml(body, 0, 1)).toThrow()
  })
})

describe('Biblika upstream client', () => {
  it('uses the upstream, the exact translation and an encoded numbered book without an app key', async () => {
    const fetcher = vi.fn(async () => new Response(xml(undefined, 46, 13)))
    const client = new BiblikaClient({ fetch: fetcher as typeof fetch })
    expect(await client.chapter('nlt', 45, 13)).toHaveLength(1)
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${SABDA_PASSAGE_API}?passage=1+Cor+13&ver=nlt`)
    expect(options.headers).toEqual({ Accept: 'application/xml' })
    expect(SABDA_BOOKS).toHaveLength(66)
    expect(SABDA_BOOKS[65]).toBe('Rev')
  })

  it('rejects unsupported versions and invalid chapters before requesting', async () => {
    const fetcher = vi.fn()
    const client = new BiblikaClient({ fetch: fetcher })
    for (const [code, book, chapter] of [['KJV', 0, 1], ['NLT', -1, 1], ['NKJV', 0, 51], ['NLT', 66, 1]] as const) {
      await expect(client.chapter(code, book, chapter)).rejects.toMatchObject({ kind: 'not-found' })
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('downloads a complete chapter range with each chapter identity validated', async () => {
    const body = '<bible><book><book_id>1</book_id><chapter><chap>1</chap><verses><verse><number>1</number><text>Invented first.</text></verse></verses></chapter><chapter><chap>2</chap><verses><verse><number>1</number><text>Invented second.</text></verse></verses></chapter></book></bible>'
    const fetcher = vi.fn(async () => new Response(body))
    const client = new BiblikaClient({ fetch: fetcher as typeof fetch })
    expect(await client.chapters('NLT', 0, 1, 2)).toEqual([
      { chapter: 1, verses: [{ verse: 1, text: 'Invented first.' }] },
      { chapter: 2, verses: [{ verse: 1, text: 'Invented second.' }] },
    ])
    const [url] = fetcher.mock.calls[0] as unknown as [string]
    expect(url).toBe(`${SABDA_PASSAGE_API}?passage=Gen+1-2&ver=nlt`)
    // The live API repeats the book wrapper for each chapter in a range.
    const repeatedBook = body.replace('</verses></chapter><chapter>', '</verses></chapter></book><book><book_id>1</book_id><chapter>')
    await expect(new BiblikaClient({ fetch: vi.fn(async () => new Response(repeatedBook)) as typeof fetch }).chapters('NLT', 0, 1, 2)).resolves.toHaveLength(2)
    for (const broken of [body.replace('<chap>2</chap>', '<chap>1</chap>'), body.replace('<book_id>1</book_id>', '<book_id>2</book_id>'), xml()]) {
      await expect(new BiblikaClient({ fetch: vi.fn(async () => new Response(broken)) as typeof fetch }).chapters('NLT', 0, 1, 2)).rejects.toMatchObject({ kind: 'bad-response' })
    }
  })

  it.each([[429, 'rate-limited'], [404, 'not-found'], [503, 'offline']] as const)('handles HTTP %s before parsing a body', async (status, kind) => {
    const client = new BiblikaClient({ fetch: vi.fn(async () => new Response('Unavailable', { status, headers: { 'Retry-After': '120' } })) as typeof fetch })
    await expect(client.chapter('NKJV', 0, 1)).rejects.toMatchObject({ kind, ...(status === 429 ? { retryAfterMs: 120_000 } : {}) })
  })

  it('times out even if headers arrive but the body stalls', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => ({
      status: 200, ok: true,
      text: () => new Promise<string>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    } as Response))
    await expect(new BiblikaClient({ fetch: fetcher, timeoutMs: 10 }).chapter('NLT', 0, 1)).rejects.toMatchObject({ kind: 'timeout' })
  })
})
