import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { BiblikaBibles } from './biblikaBibles'
import { BiblikaError } from './biblikaClient'
import { OnlineBibleCache, CHAPTER_TTL_MS } from './onlineCache'
import { OnlineBibleLibrary } from './onlineBibleLibrary'
import { OnlineBibles } from './onlineBibles'
import { versionRowOptions } from '../../../shared/bibleVersions'

const databases: DatabaseSync[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })
const verses = [{ verse: 1, text: 'Invented first verse.' }, { verse: 2, text: 'Invented second verse.' }]

function setup(bundled = ['KJV']) {
  let now = 5_000_000
  let key = ''
  const source = () => {
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    const cache = new OnlineBibleCache(db as never, () => now)
    cache.init()
    return { db, cache }
  }
  const sabda = source(), yv = source()
  const client = { chapter: vi.fn(async () => verses) }
  const onChange = vi.fn()
  const biblika = new BiblikaBibles({ cache: sabda.cache, bundled: () => bundled, client, now: () => now, onChange })
  const yvClient = {
    listBibles: vi.fn(async () => [
      { id: 114, abbreviation: 'NKJV', title: 'Other NKJV', languageTag: 'en', attribution: 'Other credit' },
      { id: 111, abbreviation: 'NIV', title: 'Invented NIV', languageTag: 'en', attribution: 'Invented credit' },
    ]),
    bible: vi.fn(), chapter: vi.fn(async () => [{ verse: 1, text: 'Other source.' }]),
  }
  const youversion = new OnlineBibles({ cache: yv.cache, bundled: () => bundled, appKey: () => key, makeClient: () => yvClient, now: () => now })
  const library = new OnlineBibleLibrary([{ provider: biblika, db: sabda.db }, { provider: youversion, db: yv.db }])
  return { library, biblika, client, yvClient, onChange, sabda, yv, setKey: (next: string) => { key = next }, advance: (ms: number) => { now += ms } }
}

describe('NKJV/NLT in the shared online Bible library', () => {
  it('offers both versions without a YouVersion key and identifies the NLT edition in picker hints', async () => {
    const { library, yvClient } = setup()
    await library.refresh()
    expect(library.codes()).toEqual(['NKJV', 'NLT'])
    expect(library.status()).toMatchObject({ configured: true, state: 'ready' })
    expect(yvClient.listBibles).not.toHaveBeenCalled()
    const options = versionRowOptions(library.versions().map((v) => ({ code: v.code, name: v.title, source: 'online', available: true })))
    expect(options.find((v) => v.value === 'NLT')).toMatchObject({ hint: 'New Living Translation (1996) · online' })
    expect(options.every((v) => !v.disabled)).toBe(true)
    expect(library.version('NLT')?.attribution).toContain('1996')
  })

  it('deduplicates concurrent reads and returns verses from the same database main uses', async () => {
    const { library, client } = setup()
    const result = await Promise.all([library.ensureChapter('NLT', 42, 3), library.ensureChapter('nlt', 42, 3)])
    expect(result).toEqual([{ ok: true }, { ok: true }])
    expect(client.chapter).toHaveBeenCalledTimes(1)
    expect(library.databaseFor('NLT')?.prepare('SELECT Versecount, verse FROM bible WHERE Version = ? AND Book = ? AND Chapter = ? ORDER BY Versecount').all('NLT', 42, 3))
      .toEqual(verses.map((v) => ({ Versecount: v.verse, verse: v.text })))
    await library.ensureChapter('NLT', 42, 3)
    expect(client.chapter).toHaveBeenCalledTimes(1)
    expect(library.status().versions.find((v) => v.code === 'NLT')?.chapters).toBe(1)
  })

  it('preserves source selection and cached chapters when a YouVersion key changes', async () => {
    const { library, sabda, yv, setKey } = setup()
    await library.ensureChapter('NKJV', 0, 1)
    setKey('test-key')
    await library.refresh()
    expect(library.codes()).toEqual(['NKJV', 'NLT', 'NIV'])
    expect(library.databaseFor('NKJV')).toBe(sabda.db)
    expect(library.databaseFor('NIV')).toBe(yv.db)
    setKey('new-key')
    await library.refresh()
    expect(library.isCached('NKJV', 0, 1)).toBe(true)
    expect(library.status().versions.filter((v) => v.code === 'NKJV')).toHaveLength(1)
  })

  it('leaves bundled versions in the bundled database', () => {
    const { library } = setup(['KJV', 'NKJV'])
    expect(library.codes()).toEqual(['NLT'])
    expect(library.databaseFor('NKJV')).toBeUndefined()
  })

  it('keeps cached chapters usable offline, expires old chapters and names the failing provider', async () => {
    const { library, client, advance } = setup()
    await library.ensureChapter('NLT', 0, 1)
    client.chapter.mockRejectedValue(new BiblikaError('offline', 'down'))
    expect(await library.ensureChapter('NLT', 0, 1)).toEqual({ ok: true })
    expect(await library.ensureChapter('NLT', 0, 2)).toEqual({ ok: false, reason: 'offline' })
    expect(library.failureText('NLT', 'offline')).toBe('SABDA is unreachable')
    expect(library.status().state).toBe('offline')
    advance(CHAPTER_TTL_MS)
    expect(library.isCached('NLT', 0, 1)).toBe(false)
    expect(await library.ensureChapter('NLT', 0, 1)).toEqual({ ok: false, reason: 'offline' })
    client.chapter.mockResolvedValue(verses)
    expect(await library.ensureChapter('NLT', 0, 1)).toEqual({ ok: true })
    expect(library.status().state).toBe('ready')
  })

  it('respects rate limits across both versions', async () => {
    const { library, client, advance } = setup()
    client.chapter.mockRejectedValueOnce(new BiblikaError('rate-limited', 'wait', 120_000))
    expect(await library.ensureChapter('NLT', 0, 1)).toEqual({ ok: false, reason: 'rate-limited' })
    expect(await library.ensureChapter('NKJV', 0, 1)).toEqual({ ok: false, reason: 'rate-limited' })
    expect(client.chapter).toHaveBeenCalledTimes(1)
    advance(120_000)
    expect(await library.ensureChapter('NKJV', 0, 1)).toEqual({ ok: true })
  })

  it('bounds the caller wait while allowing a slow chapter to fill the cache', async () => {
    const { library, client } = setup()
    let release!: (value: typeof verses) => void
    client.chapter.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    expect(await library.ensureChapter('NLT', 0, 1, 10)).toEqual({ ok: false, reason: 'timeout' })
    release(verses)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(library.isCached('NLT', 0, 1)).toBe(true)
  })
})
