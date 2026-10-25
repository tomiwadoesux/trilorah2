import { afterEach, describe, expect, it, vi } from 'vitest'
import { nkjvRows, downloadNkjvBible } from '../../scripts/lib/nkjv-bible.mjs'
import { CHAPTER_COUNTS } from '../../shared/chapterCounts'

// Invented text; exactly 31,102 numbered verses across the complete canon.
function wholeBible() {
  let extra = 188
  return CHAPTER_COUNTS.map((count) => ({ chapters: Array.from({ length: count }, () =>
    Array.from({ length: 26 + (extra-- > 0 ? 1 : 0) }, (_, i) => `Invented verse ${i + 1}.`)) }))
}

afterEach(() => vi.unstubAllGlobals())
describe('the pinned full-file NKJV download', () => {
  it('preserves all chapter and verse positions in a complete corpus', () => {
    const rows = nkjvRows(wholeBible())
    expect(rows).toHaveLength(31102)
    expect(rows).toContainEqual([42, 3, 16, 'Invented verse 16.'])
    expect(rows).toContainEqual([65, 22, 21, 'Invented verse 21.'])
  })
  it('refuses missing chapters and blank verses before installation', () => {
    const missing = wholeBible()
    missing[0].chapters.pop()
    expect(() => nkjvRows(missing)).toThrow('chapter count')
    const empty = wholeBible()
    empty[0].chapters[0][0] = ''
    expect(() => nkjvRows(empty)).toThrow('invalid row')
  })
  it('rejects a changed source file instead of silently accepting it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
    await expect(downloadNkjvBible()).rejects.toThrow('checksum mismatch')
  })
})
