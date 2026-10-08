import { describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { OnlineBibleCache } from './onlineCache'
import { LISTING_TTL_MS, OnlineBibles, codeForBible, onlineVersionsFrom } from './onlineBibles'
import { YouVersionError, type YouVersionBible } from './youversionClient'

const BUNDLED = ['KJV', 'BSB', 'WEB', 'ASV', 'BBE', 'RVR', 'APEE', 'AA', 'CUV']
/* What an invented key "unlocks". Titles and copyright lines are invented too. */
const LISTED: YouVersionBible[] = [
  { id: 1, abbreviation: 'KJV', title: 'Invented KJV', languageTag: 'en', attribution: null },
  { id: 206, abbreviation: 'WEBUS', title: 'Invented WEB variant', languageTag: 'en', attribution: 'x' },
  { id: 111, abbreviation: 'NIV', title: 'Invented NIV title', languageTag: 'en', attribution: 'Invented NIV copyright' },
  { id: 114, abbreviation: 'NKJV', title: 'Invented NKJV title', languageTag: 'en', attribution: null },
  { id: 1588, abbreviation: 'AMP', title: 'Invented AMP title', languageTag: 'en', attribution: 'Invented AMP copyright' },
  { id: 9001, abbreviation: 'A VERY LONG CODE', title: 'Unpickable', languageTag: 'en', attribution: 'x' },
]
const chapter = (n = 3) => Array.from({ length: n }, (_, i) => ({ verse: i + 1, text: `Invented online verse ${i + 1}.` }))

function setup(opts: { key?: string; list?: () => Promise<YouVersionBible[]>; chapter?: () => Promise<{ verse: number; text: string }[]> } = {}) {
  let now = 5_000_000
  let key = opts.key ?? 'test-key'
  const db = new DatabaseSync(':memory:')
  const cache = new OnlineBibleCache(db as never, () => now)
  cache.init()
  const client = {
    listBibles: vi.fn(opts.list ?? (async () => LISTED)),
    chapter: vi.fn(opts.chapter ?? (async () => chapter())),
    bible: vi.fn(async (id: number) => ({ ...LISTED.find((b) => b.id === id)!, attribution: `Invented record copyright ${id}` })),
  }
  const onChange = vi.fn()
  const online = new OnlineBibles({
    cache, appKey: () => key, bundled: () => BUNDLED, makeClient: () => client, now: () => now, onChange, log: () => undefined,
  })
  return { online, cache, db, client, onChange, advance: (ms: number) => { now += ms }, setKey: (k: string) => { key = k } }
}

describe('which listed Bibles become versions', () => {
  it('uses YouVersion ids for NIV and NKJV, a picker-sized code for the rest, and never shadows a bundled Bible', () => {
    expect(codeForBible({ id: 111, abbreviation: 'whatever' })).toBe('NIV')
    expect(codeForBible({ id: 114, abbreviation: '' })).toBe('NKJV')
    expect(codeForBible({ id: 5, abbreviation: 'amp' })).toBe('AMP')
    expect(codeForBible({ id: 5, abbreviation: 'A VERY LONG CODE' })).toBeNull()
    expect(onlineVersionsFrom(LISTED, BUNDLED).map((v) => v.code)).toEqual(['NIV', 'NKJV', 'AMP'])
    expect(onlineVersionsFrom([{ ...LISTED[2], languageTag: 'es' }], BUNDLED)).toEqual([])
  })
})

describe('OnlineBibles', () => {
  it('with no key: nothing listed, nothing sent, and the picker says why', async () => {
    const { online, client } = setup({ key: '' })
    await online.refresh()
    expect(online.codes()).toEqual([])
    expect(online.status()).toMatchObject({ state: 'no-key', configured: false, text: 'no YouVersion key in this build' })
    expect(online.unavailableNote('NIV')).toBe('needs a YouVersion key')
    expect(await online.ensureChapter('NIV', 42, 3)).toEqual({ ok: false, reason: 'no-key' })
    expect(client.listBibles).not.toHaveBeenCalled()
  })

  it('lists what the key unlocks, fills a missing copyright from the version record, and asks again only after a day', async () => {
    const { online, client, advance, onChange } = setup()
    await online.refresh()
    expect(online.codes()).toEqual(['AMP', 'NIV', 'NKJV'])
    expect(online.attribution('NIV')).toBe('Invented NIV copyright')
    expect(online.attribution('NKJV')).toBe('Invented record copyright 114')
    expect(online.status()).toMatchObject({ state: 'ready', configured: true })
    expect(onChange).toHaveBeenCalled()
    await online.refresh()
    expect(client.listBibles).toHaveBeenCalledTimes(1)
    advance(LISTING_TTL_MS)
    await online.refresh()
    expect(client.listBibles).toHaveBeenCalledTimes(2)
  })

  it('is cache-first: one request per chapter however many ask at once, none once it is kept', async () => {
    const { online, client } = setup()
    await online.refresh()
    expect(online.isCached('NIV', 42, 3)).toBe(false)
    const results = await Promise.all([online.ensureChapter('NIV', 42, 3), online.ensureChapter('niv', 42, 3), online.ensureChapter('NIV', 42, 3, 1000)])
    expect(results.every((r) => r.ok)).toBe(true)
    expect(client.chapter).toHaveBeenCalledTimes(1)
    expect(client.chapter).toHaveBeenCalledWith(111, 42, 3)
    expect(online.isCached('NIV', 42, 3)).toBe(true)
    expect(await online.ensureChapter('NIV', 42, 3)).toEqual({ ok: true })
    expect(client.chapter).toHaveBeenCalledTimes(1)
  })

  it('a caller that cannot wait gets "timeout", and the fetch still lands in the cache for the next one', async () => {
    let release!: () => void
    const { online } = setup({ chapter: () => new Promise((resolve) => { release = () => resolve(chapter()) }) })
    await online.refresh()
    expect(await online.ensureChapter('NIV', 0, 1, 10)).toEqual({ ok: false, reason: 'timeout' })
    release()
    await new Promise((r) => setTimeout(r, 0))
    expect(online.isCached('NIV', 0, 1)).toBe(true)
  })

  it('after a 429 sends nothing until Retry-After has passed', async () => {
    const { online, client, advance } = setup({ chapter: async () => { throw new YouVersionError('rate-limited', 'slow down', 429, 120_000) } })
    await online.refresh()
    expect(await online.ensureChapter('NIV', 0, 1)).toEqual({ ok: false, reason: 'rate-limited' })
    expect(await online.ensureChapter('NIV', 0, 2)).toEqual({ ok: false, reason: 'rate-limited' })
    expect(client.chapter).toHaveBeenCalledTimes(1)
    expect(online.status().text).toMatch(/back in 2 min/)
    advance(120_000)
    await online.ensureChapter('NIV', 0, 2)
    expect(client.chapter).toHaveBeenCalledTimes(2)
  })

  it('a 403 withdraws that version and deletes what was kept of it', async () => {
    let denied = false
    const { online, onChange } = setup({ chapter: async () => { if (denied) throw new YouVersionError('forbidden', 'no', 403); return chapter() } })
    await online.refresh()
    await online.ensureChapter('NIV', 0, 1)
    denied = true
    onChange.mockClear()
    expect(await online.ensureChapter('NIV', 0, 2)).toEqual({ ok: false, reason: 'not-licensed' })
    expect(online.has('NIV')).toBe(false)
    expect(online.isCached('NIV', 0, 1)).toBe(false)
    expect(online.codes()).toEqual(['AMP', 'NKJV'])
    expect(onChange).toHaveBeenCalled()
  })

  it('a refused key turns every online Bible off and keeps nothing fetched with it', async () => {
    let refused = false
    const { online, cache } = setup({ chapter: async () => { if (refused) throw new YouVersionError('unauthorized', 'no', 401); return chapter() } })
    await online.refresh()
    await online.ensureChapter('NIV', 0, 1)
    refused = true
    expect(await online.ensureChapter('NKJV', 0, 1)).toEqual({ ok: false, reason: 'key-rejected' })
    expect(online.codes()).toEqual([])
    expect(online.status().state).toBe('key-rejected')
    expect(online.unavailableNote('NIV')).toBe('YouVersion key refused')
    expect(cache.chapterCount()).toBe(0)
  })

  it('offline: the last listing and the kept chapters still work, and a miss says the network is down', async () => {
    let offline = false
    const { online, advance } = setup({
      list: async () => { if (offline) throw new YouVersionError('network', 'down'); return LISTED },
      chapter: async () => { if (offline) throw new YouVersionError('network', 'down'); return chapter() },
    })
    await online.refresh()
    await online.ensureChapter('NIV', 0, 1)
    offline = true
    advance(LISTING_TTL_MS)
    await online.refresh(true)
    expect(online.codes()).toEqual(['AMP', 'NIV', 'NKJV'])
    expect(online.isCached('NIV', 0, 1)).toBe(true)
    expect(await online.ensureChapter('NIV', 0, 2)).toEqual({ ok: false, reason: 'offline' })
    expect(online.status()).toMatchObject({ state: 'offline', text: 'AMP, NIV, NKJV · offline — 1 chapter kept' })
  })

  it('a different key does not inherit what the old one unlocked', async () => {
    const { online, setKey, client } = setup()
    await online.refresh()
    await online.ensureChapter('NIV', 0, 1)
    setKey('another-key')
    expect(online.codes()).toEqual([])
    await online.refresh()
    expect(client.listBibles).toHaveBeenCalledTimes(2)
    expect(online.isCached('NIV', 0, 1)).toBe(false)
  })

  it('refuses a chapter the book does not have without asking', async () => {
    const { online, client } = setup()
    await online.refresh()
    expect(await online.ensureChapter('NIV', 42, 22)).toEqual({ ok: false, reason: 'not-found' })
    expect(await online.ensureChapter('NIV', 66, 1)).toEqual({ ok: false, reason: 'not-found' })
    expect(client.chapter).not.toHaveBeenCalled()
  })
})
