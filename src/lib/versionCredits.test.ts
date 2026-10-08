import { afterEach, describe, expect, it, vi } from 'vitest'
import { setVersionCredits, versionCredit } from '../../shared/bibleVersions'
import { watchVersionCredits } from './versionCredits'

describe("each window's copyright lines follow main's online Bibles", () => {
  afterEach(() => setVersionCredits([]))

  it('reads them at start and again whenever main says the list changed', async () => {
    let changed: ((rows: unknown) => void) | undefined
    const off = vi.fn()
    const api = {
      getBibleVersions: vi.fn().mockResolvedValue({ versions: [
        { code: 'KJV', name: 'King James Version', source: 'bundled', available: true },
        { code: 'NIV', name: 'New International Version', source: 'online', available: true, attribution: 'Invented NIV line' },
      ], online: null }),
      onEngineEvent: vi.fn((channel: string, fn: (rows: unknown) => void) => { if (channel === 'on-bible-versions-changed') changed = fn; return off }),
    } as unknown as Window['api']
    const stop = watchVersionCredits(api)
    await Promise.resolve()
    await Promise.resolve()
    expect(versionCredit('NIV')).toBe('Invented NIV line')
    changed?.({ versions: [{ code: 'NIV', name: 'New International Version', source: 'online', available: false, note: 'key refused' }] })
    expect(versionCredit('NIV')).toBeNull()
    stop()
    expect(off).toHaveBeenCalled()
  })
  it('does nothing without an engine (the design sandbox)', () => {
    expect(watchVersionCredits(undefined)()).toBeUndefined()
  })
})
