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
    expect(delivered?.text).toBe('scripture')
    expect(delivered?.reference).toBe('Psalm 104:12')
  })
  it('rejects a failed engine delivery so the operator cannot mark it live', async () => {
    const mobileVerse = vi.fn().mockRejectedValue(new Error('Verse unavailable'))
    await expect(publishLiveItem({ source: 'scripture', id: 'verse', label: 'Titus 1:99' }, { mobileVerse } as unknown as Window['api'])).rejects.toThrow('Verse unavailable')
  })
  it('returns a run of service reference the way the engine names it, sliced, with its own id', async () => {
    const mobileVerse = vi.fn().mockResolvedValue({ book: 'Psalms', chapter: 104, verse: 12, text: 'invented words', version: 'KJV', verses: [{ verse: 12, text: 'invented words' }] })
    const delivered = await publishLiveItem({ source: 'scripture', id: 'Psalm 104:12', label: 'Psalm 104:12' }, { mobileVerse } as unknown as Window['api'])
    expect(delivered?.id).toBe('Psalm 104:12')
    expect(delivered?.reference).toBe('Psalms 104:12')
    expect(delivered?.version).toBe('KJV')
    expect(delivered?.slides).toHaveLength(1)
    expect(delivered?.slides?.[0].lines[0].text).toContain('invented words')
  })
  it("writes the phone's en-dash range with a hyphen", async () => {
    const verses = [{ verse: 16, text: 'one' }, { verse: 17, text: 'two' }, { verse: 18, text: 'three' }]
    const mobileVerse = vi.fn().mockResolvedValue({ book: 'John', chapter: 3, verse: 16, endVerse: 18, text: 'one two three', version: 'KJV', verses })
    const delivered = await publishLiveItem({ source: 'scripture', id: 'John 3:16–18@KJV', label: 'John 3:16–18', reference: 'John 3:16–18', version: 'KJV' }, { mobileVerse } as unknown as Window['api'])
    expect(delivered?.reference).toBe('John 3:16-18')
    expect(delivered?.id).toBe('John 3:16–18@KJV')
  })
  it('pages a run of service range the way the wall will: by the church layout setting', async () => {
    const verses = [{ verse: 1, text: 'one' }, { verse: 2, text: 'two' }, { verse: 3, text: 'three' }]
    const mobileVerse = vi.fn().mockResolvedValue({ book: 'Psalms', chapter: 23, verse: 1, endVerse: 3, text: 'one two three', version: 'KJV', verses })
    const item = { source: 'scripture' as const, id: 'Psalm 23:1-3', label: 'Psalm 23:1-3', reference: 'Psalm 23:1-3', version: 'KJV' }
    const apart = await publishLiveItem(item, { mobileVerse, getSetting: vi.fn().mockResolvedValue(true) } as unknown as Window['api'])
    expect(apart?.slides).toHaveLength(3)
    const together = await publishLiveItem(item, { mobileVerse, getSetting: vi.fn().mockResolvedValue(false) } as unknown as Window['api'])
    expect(together?.slides).toHaveLength(1)
  })
  it('reads every setting before the push, so nothing waits between the wall changing and the LIVE pane', async () => {
    const order: string[] = []
    const verses = [{ verse: 1, text: 'one' }, { verse: 2, text: 'two' }]
    const getSetting = vi.fn(async (key: string) => { order.push(key); return key === 'breakOnVerse' ? true : 'KJV' })
    const mobileVerse = vi.fn(async () => { order.push('push'); return { book: 'Psalms', chapter: 23, verse: 1, endVerse: 2, text: 'one two', version: 'KJV', verses } })
    const delivered = await publishLiveItem({ source: 'scripture', id: 'Psalm 23:1-2', label: 'Psalm 23:1-2' }, { mobileVerse, getSetting } as unknown as Window['api'])
    expect(order.at(-1)).toBe('push')
    expect(order).toContain('breakOnVerse')
    expect(delivered?.slides).toHaveLength(2)
  })
  it("never replaces the slides the operator chose (a range shown apart stays apart)", async () => {
    const verses = [{ verse: 4, text: 'one' }, { verse: 5, text: 'two' }]
    const apart = verses.map((v, i) => ({ lines: [{ version: 'KJV', text: v.text }], reference: `Ruth 1:${v.verse}`, verseStart: v.verse, verseEnd: v.verse, index: i + 1, total: 2 }))
    const mobileVerse = vi.fn().mockResolvedValue({ book: 'Ruth', chapter: 1, verse: 4, endVerse: 5, text: 'one two', version: 'KJV', verses })
    const delivered = await publishLiveItem({ source: 'scripture', id: 'Ruth 1:4-5', label: 'Ruth 1:4-5', reference: 'Ruth 1:4-5', version: 'KJV', slides: apart }, { mobileVerse } as unknown as Window['api'])
    expect(delivered?.slides).toBe(apart)
  })
  it('uses the selected translation for a run item that has no stored translation', async () => {
    const mobileVerse = vi.fn().mockResolvedValue({ text: 'scripture', version: 'NIV', verses: [] })
    const getSetting = vi.fn().mockResolvedValue('NIV')
    await publishLiveItem({ source: 'scripture', id: 'Titus 1:3', label: 'Titus 1:3' }, { mobileVerse, getSetting } as unknown as Window['api'])
    expect(getSetting).toHaveBeenCalledWith('displayVersion')
    expect(mobileVerse).toHaveBeenCalledWith('Titus 1:3', 'NIV', true)
  })
  it("reads a run item in this service's Bible before the church's saved default", async () => {
    const mobileVerse = vi.fn().mockResolvedValue({ text: 'scripture', version: 'BSB', verses: [] })
    const getSessionVersion = vi.fn().mockResolvedValue('BSB')
    const getSetting = vi.fn().mockResolvedValue('KJV')
    await publishLiveItem({ source: 'scripture', id: 'Titus 1:3', label: 'Titus 1:3' }, { mobileVerse, getSessionVersion, getSetting } as unknown as Window['api'])
    expect(mobileVerse).toHaveBeenCalledWith('Titus 1:3', 'BSB', true)
    expect(getSetting).not.toHaveBeenCalledWith('displayVersion')
  })
  it('reports a press main dropped as overtaken, so LIVE keeps the newer thing', async () => {
    const mobileVerse = vi.fn().mockResolvedValue({ book: 'John', chapter: 3, verse: 16, text: 'old', version: 'KJV', verses: [{ verse: 16, text: 'old' }], superseded: true })
    expect(await publishLiveItem({ source: 'scripture', id: 'John 3:16', label: 'John 3:16', version: 'NIV' }, { mobileVerse } as unknown as Window['api'])).toBeNull()
  })
})

describe('LIVE shows the words the wall got', () => {
  const rules = (verses: { text: string }[], together?: boolean) => {
    const keep = together ?? verses.length > 1
    return { breakOnVerse: !keep, showVerseNumbers: keep && verses.length > 1, referenceMode: 'each' as const, showTranslation: false }
  }
  const staged = {
    source: 'scripture' as const, id: 'Gen 1:1-2@NIV', label: 'Genesis 1:1-2', reference: 'Genesis 1:1-2', version: 'NIV',
    verses: [{ verse: 1, text: 'invented one' }, { verse: 2, text: 'invented two' }],
    slides: [{ lines: [{ version: 'NIV', text: 'staged slide' }], reference: 'Genesis 1:1-2 · NIV', verseStart: 1, verseEnd: 2, index: 1, total: 1 }],
  }
  it('keeps the operator\'s slides when main read exactly what was staged', async () => {
    const mobileVerse = vi.fn().mockResolvedValue({ book: 'Genesis', chapter: 1, verse: 1, endVerse: 2, text: 'invented one invented two', version: 'NIV', verses: staged.verses })
    const delivered = await publishLiveItem(staged, { mobileVerse } as unknown as Window['api'], rules)
    expect(delivered?.slides).toBe(staged.slides)
  })
  it('cuts the fallback\'s words again, the same way, when main could not read the online Bible', async () => {
    const fallback = [{ verse: 1, text: 'fallback one' }, { verse: 2, text: 'fallback two' }]
    const mobileVerse = vi.fn().mockResolvedValue({ book: 'Genesis', chapter: 1, verse: 1, endVerse: 2, text: 'fallback one fallback two', version: 'KJV', verses: fallback })
    const delivered = await publishLiveItem(staged, { mobileVerse } as unknown as Window['api'], rules)
    expect(delivered?.version).toBe('KJV')
    // Together, as the operator had it: one slide, numbered, in the fallback's own name and words.
    expect(delivered?.slides).toHaveLength(1)
    expect(delivered?.slides?.[0].lines[0]).toEqual({ version: 'KJV', text: '1\u2009fallback one 2\u2009fallback two' })
    expect(delivered?.slides?.[0].reference).toBe('Genesis 1:1-2')
  })
  it('never shows stale slides under another Bible\'s name: with the default rules they are cut again in the Bible the wall got', async () => {
    const mobileVerse = vi.fn().mockResolvedValue({ book: 'Genesis', chapter: 1, verse: 1, endVerse: 2, text: 'x', version: 'KJV', verses: [{ verse: 1, text: 'x' }] })
    const slides = (await publishLiveItem(staged, { mobileVerse } as unknown as Window['api']))?.slides
    expect(slides?.every((slide) => slide.lines.every((line) => line.version === 'KJV'))).toBe(true)
    expect(slides?.[0].lines[0].text).toContain('x')
  })
})


describe('presentation delivery', () => {
  it('retains the current slide in output state so newly opened displays restore it', async () => {
    const pushLiveContent = vi.fn().mockResolvedValue({ success: true });
    const item = { source: 'presentation' as const, id: 'deck:1', label: 'Sunday — slide 2', title: 'Sunday', path: '/slides/slide 2.png', deckPaths: ['/slides/slide 1.png', '/slides/slide 2.png'], deckIndex: 1, deckId: 'deck' };
    expect(await publishLiveItem(item, { pushLiveContent } as unknown as Window['api'])).toEqual(item);
    expect(pushLiveContent).toHaveBeenCalledWith(expect.objectContaining({ id: 'deck:1', kind: 'slide', path: '/slides/slide 2.png' }));
  });
  it('does not mark failed presentation delivery as live', async () => {
    const pushLiveContent = vi.fn().mockResolvedValue({ success: false });
    await expect(publishLiveItem({ source: 'presentation', id: 'deck:0', label: 'Sunday', path: '/slide.png' }, { pushLiveContent } as unknown as Window['api'])).rejects.toThrow('could not be sent');
  });
});
