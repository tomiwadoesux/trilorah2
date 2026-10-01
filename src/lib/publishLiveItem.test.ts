import { describe, expect, it, vi } from 'vitest'
import { publishLiveItem } from './publishLiveItem'

describe('scripture Go live delivery', () => {
  it('sends a selected reference to the engine exactly once, including its translation', async () => {
    const mobileVerse = vi.fn().mockResolvedValue({ text: 'scripture' })
    await publishLiveItem({ source: 'scripture', id: 'Titus 1:3', label: 'Titus 1:3', reference: 'Titus 1:3', version: 'NIV' }, { mobileVerse } as unknown as Window['api'])
    expect(mobileVerse.mock.calls).toEqual([['Titus 1:3', 'NIV', true]])
  })
  it('supports a reference saved in the run of service', async () => {
    const mobileVerse = vi.fn().mockResolvedValue({ text: 'scripture', version: 'KJV', verses: [{ verse: 12, text: 'scripture' }] })
    const delivered = await publishLiveItem({ source: 'scripture', id: 'Psalm 104:12', label: 'Psalm 104:12' }, { mobileVerse } as unknown as Window['api'])
    expect(mobileVerse).toHaveBeenCalledWith('Psalm 104:12', 'KJV', true)
    expect(delivered.text).toBe('scripture')
    expect(delivered.reference).toBe('Psalm 104:12')
  })
  it('rejects a failed engine delivery so the operator cannot mark it live', async () => {
    const mobileVerse = vi.fn().mockRejectedValue(new Error('Verse unavailable'))
    await expect(publishLiveItem({ source: 'scripture', id: 'verse', label: 'Titus 1:99' }, { mobileVerse } as unknown as Window['api'])).rejects.toThrow('Verse unavailable')
  })
  it('uses the selected translation for a run item that has no stored translation', async () => {
    const mobileVerse = vi.fn().mockResolvedValue({ text: 'scripture', version: 'NIV', verses: [] })
    const getSetting = vi.fn().mockResolvedValue('NIV')
    await publishLiveItem({ source: 'scripture', id: 'Titus 1:3', label: 'Titus 1:3' }, { mobileVerse, getSetting } as unknown as Window['api'])
    expect(getSetting).toHaveBeenCalledWith('displayVersion')
    expect(mobileVerse).toHaveBeenCalledWith('Titus 1:3', 'NIV', true)
  })
})
