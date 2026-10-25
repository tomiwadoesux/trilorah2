import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { OnlineBibleCache } from './onlineCache'
import { OnlineBibleLibrary } from './onlineBibleLibrary'
import { OnlineBibles } from './onlineBibles'

const databases: DatabaseSync[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })

function setup() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const cache = new OnlineBibleCache(db as never)
  cache.init()
  const client = {
    listBibles: vi.fn(async () => [
      { id: 114, abbreviation: 'NKJV', title: 'Other NKJV', languageTag: 'en', attribution: 'Other credit' },
      { id: 116, abbreviation: 'NLT', title: 'Other NLT edition', languageTag: 'en', attribution: 'Other credit' },
      { id: 111, abbreviation: 'NIV', title: 'Invented NIV', languageTag: 'en', attribution: 'Invented credit' },
    ]),
    bible: vi.fn(), chapter: vi.fn(async () => [{ verse: 1, text: 'Invented verse.' }]),
  }
  const provider = new OnlineBibles({ cache, bundled: () => ['KJV'], appKey: () => 'test-key', makeClient: () => client })
  return { library: new OnlineBibleLibrary([{ provider, db }]), client, cache, db }
}

describe('online Bible library beside downloaded translations', () => {
  it('never offers or fetches NKJV/NLT online, even when an older bible.db is missing them', async () => {
    const { library, client } = setup()
    await library.refresh()
    expect(library.codes()).toEqual(['NIV'])
    for (const code of ['NKJV', 'NLT']) {
      expect(library.databaseFor(code)).toBeUndefined()
      expect(library.has(code)).toBe(false)
      expect(await library.ensureChapter(code, 0, 1)).toEqual({ ok: false, reason: 'not-online' })
    }
    expect(client.chapter).not.toHaveBeenCalled()
    expect(library.status().versions.map((v) => v.code)).toEqual(['NIV'])
  })

  it('ignores NKJV/NLT entries from an older online listing without waiting for its refresh', async () => {
    const { library, cache } = setup()
    await library.refresh()
    const listing = cache.listing()
    cache.saveListing([...listing.versions,
      { code: 'NKJV', bibleId: 114, title: 'Old NKJV', attribution: null },
      { code: 'NLT', bibleId: 116, title: 'Old NLT', attribution: null },
    ], listing.keyId!)
    expect(library.codes()).toEqual(['NIV'])
    expect(library.databaseFor('NLT')).toBeUndefined()
  })

  it('keeps additional YouVersion translations on their own read path', async () => {
    const { library, client, db } = setup()
    await library.refresh()
    expect(await library.ensureChapter('NIV', 42, 3)).toEqual({ ok: true })
    expect(library.databaseFor('NIV')).toBe(db)
    expect(library.isCached('NIV', 42, 3)).toBe(true)
    expect(client.chapter).toHaveBeenCalledWith(111, 42, 3)
  })
})
