import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseVideoId,
  pickTrack,
  decodeEntities,
  cleanCaptionLine,
  removeRollingRepeats,
  eventsToLines,
  extractPlayerResponse
} from './youtubeCaptions'
import {
  toHits,
  hitKey,
  failureFrom,
  pickRecord,
  lyricsPreview,
  getLyrics,
  clearLyricsCache,
  setLyricsClientVersion,
  type LrclibRecord
} from './lyricsSearch'

// Every lyric line in this file is invented. Nothing here is from a real song.

describe('parseVideoId — the URL shapes an operator pastes', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abcDEF12345', 'abcDEF12345'],
    ['https://www.youtube.com/watch?v=abcDEF12345&t=42s&list=PLx', 'abcDEF12345'],
    ['https://youtu.be/abcDEF12345?si=share', 'abcDEF12345'],
    ['https://www.youtube.com/shorts/abcDEF12345', 'abcDEF12345'],
    ['https://www.youtube.com/embed/abcDEF12345', 'abcDEF12345'],
    ['https://m.youtube.com/watch?v=abcDEF12345', 'abcDEF12345'],
    ['abcDEF12345', 'abcDEF12345']
  ])('%s', (input, id) => {
    expect(parseVideoId(input)).toBe(id)
  })

  it('refuses what is not a video', () => {
    expect(parseVideoId('')).toBeNull()
    expect(parseVideoId('https://example.com/watch?v=abcDEF12345')).toBeNull()
    expect(parseVideoId('not a link at all')).toBeNull()
  })
})

describe('pickTrack — uploaded subtitles beat auto-captions', () => {
  const t = (languageCode: string, kind?: string) => ({ baseUrl: `u/${languageCode}/${kind ?? 'm'}`, languageCode, kind })

  it('prefers a manual English track over an auto one', () => {
    expect(pickTrack([t('en', 'asr'), t('en')])).toMatchObject({ kind: 'manual' })
  })
  it('takes a regional English manual track when plain en is absent', () => {
    expect(pickTrack([t('fr'), t('en-GB')])?.track.languageCode).toBe('en-GB')
  })
  it('falls back to auto-captions when nothing was uploaded', () => {
    expect(pickTrack([t('en', 'asr')])).toMatchObject({ kind: 'auto' })
  })
  it('ignores a track with no url, and answers null for none at all', () => {
    expect(pickTrack([{ languageCode: 'en' }])).toBeNull()
    expect(pickTrack([])).toBeNull()
  })
})

describe('cleanCaptionLine — cues out, sung words kept', () => {
  it('resolves the double-encoded apostrophe', () => {
    expect(decodeEntities('you&amp;#39;re near')).toBe("you're near")
  })
  it('drops bracketed cues and music notes', () => {
    expect(cleanCaptionLine('[Music] ♪ morning light is rising ♪')).toBe('morning light is rising')
    expect(cleanCaptionLine('[Applause]')).toBe('')
  })
  it('drops a parenthesised cue but keeps a sung echo', () => {
    expect(cleanCaptionLine('(instrumental break)')).toBe('')
    expect(cleanCaptionLine('lift it higher (higher still)')).toBe('lift it higher (higher still)')
  })
  it('strips markup and speaker arrows', () => {
    expect(cleanCaptionLine('>> <c.yellow>river of mercy</c>')).toBe('river of mercy')
  })
})

describe('removeRollingRepeats — a roll-up is not a chorus', () => {
  it('collapses the two-line scrolling window', () => {
    expect(removeRollingRepeats([['line a'], ['line a', 'line b'], ['line b'], ['line b', 'line c']])).toEqual([
      'line a',
      'line b',
      'line c'
    ])
  })
  it('replaces a line that grows word by word', () => {
    expect(removeRollingRepeats([['you are'], ['you are the dawn']])).toEqual(['you are the dawn'])
  })
  it('keeps a repeat inside one caption', () => {
    expect(removeRollingRepeats([['rise', 'rise', 'rise']])).toEqual(['rise', 'rise', 'rise'])
  })
  it('keeps a chorus that comes back later', () => {
    expect(removeRollingRepeats([['chorus line'], ['verse line'], ['chorus line']])).toEqual([
      'chorus line',
      'verse line',
      'chorus line'
    ])
  })
})

describe('eventsToLines', () => {
  const ev = (text: string) => ({ segs: [{ utf8: text }] })

  it('trusts a manual track line for line', () => {
    expect(eventsToLines([ev('first made-up line'), ev('[Music]'), ev('second made-up line')], 'manual')).toEqual([
      'first made-up line',
      'second made-up line'
    ])
  })
  it('skips window-setup events that carry no text', () => {
    expect(eventsToLines([{ tStartMs: 0 }, ev('only line')], 'manual')).toEqual(['only line'])
  })
  it('de-rolls an auto track', () => {
    const lines = eventsToLines([ev('walking through the valley'), ev('walking through the valley\nnever on my own')], 'auto')
    expect(lines.filter((l) => l === 'walking through the valley')).toHaveLength(1)
  })
})

describe('extractPlayerResponse', () => {
  it('pulls the player JSON out of a watch page', () => {
    const html = `<script>var ytInitialPlayerResponse = {"videoDetails":{"title":"T","author":"A"}};var other = 1;</script>`
    expect(extractPlayerResponse(html)).toMatchObject({ videoDetails: { title: 'T' } })
  })
  it('answers null for a page without one', () => {
    expect(extractPlayerResponse('<html>consent wall</html>')).toBeNull()
  })
})

describe('toHits — what the search list shows', () => {
  const rec = (over: Partial<LrclibRecord>): LrclibRecord =>
    ({ id: 1, trackName: 'Song', artistName: 'Band', albumName: 'Album', duration: 200, instrumental: false, plainLyrics: 'words', ...over }) as LrclibRecord

  it('drops instrumentals and records with no words', () => {
    expect(toHits([rec({ id: 1, instrumental: true }), rec({ id: 2, plainLyrics: '' }), rec({ id: 3 })]).map((h) => h.id)).toEqual([3])
  })
  it('folds the same song by the same artist into one row', () => {
    expect(toHits([rec({ id: 1 }), rec({ id: 2, trackName: 'song ', artistName: 'BAND' })])).toHaveLength(1)
    expect(hitKey('Song', 'Band')).toBe(hitKey(' song', 'BAND '))
  })
  it('keeps the same title by a different artist', () => {
    expect(toHits([rec({ id: 1 }), rec({ id: 2, artistName: 'Other Choir' })])).toHaveLength(2)
  })
  it('caps the list', () => {
    const many = Array.from({ length: 60 }, (_, i) => rec({ id: i, trackName: `Song ${i}` }))
    expect(toHits(many, 25)).toHaveLength(25)
  })
})

describe('failureFrom — never throws across IPC', () => {
  it('names a timeout or a dead network as offline', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    expect(failureFrom(abort)).toMatchObject({ ok: false, reason: 'offline' })
    expect(failureFrom(new TypeError('fetch failed'))).toMatchObject({ ok: false, reason: 'offline' })
  })
  it('names anything else an error, with its message', () => {
    expect(failureFrom(new Error('boom'))).toMatchObject({ ok: false, reason: 'error' })
  })
})

describe('pickRecord — the record a song card stands for', () => {
  const rec = (over: Partial<LrclibRecord>): LrclibRecord =>
    ({ id: 1, trackName: 'Invented Song', artistName: 'Invented Band', instrumental: false, plainLyrics: 'made up words', ...over }) as LrclibRecord

  it('finds a subtitled title that the search list would fold away', () => {
    const records = [rec({ id: 1 }), rec({ id: 2, trackName: 'Invented Song (Subtitle Words)' })]
    expect(toHits(records).map((h) => h.id)).toEqual([1])
    expect(pickRecord(records, { title: 'Invented Song (Subtitle Words)', artist: 'Invented Band' })?.id).toBe(2)
  })
  it('takes the first match in LRCLIB order, skipping instrumentals, empty words and other artists', () => {
    const records = [
      rec({ id: 1, instrumental: true }),
      rec({ id: 2, plainLyrics: '   ' }),
      rec({ id: 3, artistName: 'Some Other Choir' }),
      rec({ id: 4 }),
      rec({ id: 5 })
    ]
    expect(pickRecord(records, { title: 'Invented Song', artist: 'Invented Band' })?.id).toBe(4)
  })
  it('answers null when nothing is this song', () => {
    expect(pickRecord([rec({ artistName: 'Some Other Choir' })], { title: 'Invented Song', artist: 'Invented Band' })).toBeNull()
    expect(pickRecord([], { title: 'Invented Song', artist: 'Invented Band' })).toBeNull()
  })
})

describe('lyricsPreview — one polite request per song card', () => {
  const record = (over: Partial<LrclibRecord> = {}): LrclibRecord => ({
    id: 77,
    trackName: 'Invented Song',
    artistName: 'Invented Band',
    instrumental: false,
    plainLyrics: '[Verse 1]\nan invented opening line\nand another made up one',
    ...over
  })
  const reply = (status: number, body: unknown, retryAfter?: string) => ({
    status,
    json: async () => body,
    headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter ?? null : null) }
  })
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearLyricsCache()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('answers the id and the opening line, and names itself to LRCLIB', async () => {
    setLyricsClientVersion('9.9.9')
    fetchMock.mockResolvedValueOnce(reply(200, [record()]))
    expect(await lyricsPreview('Invented Song', 'Invented Band')).toEqual({ ok: true, id: 77, firstLine: 'an invented opening line' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://lrclib.net/api/search?q=Invented%20Song%20Invented%20Band')
    expect(init.headers['User-Agent']).toContain('Trilorah v9.9.9')
    expect(init.headers['User-Agent']).toContain('https://trilorah.com')
  })
  it('a hover hears busy at once — no retry', async () => {
    fetchMock.mockResolvedValue(reply(503, { name: 'ServerOverloaded' }, '1'))
    expect(await lyricsPreview('Invented Song', 'Invented Band')).toMatchObject({ ok: false, reason: 'busy' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('a click waits out one short Retry-After, exactly once', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(reply(503, null, '1')).mockResolvedValueOnce(reply(200, [record()]))
    const answer = lyricsPreview('Invented Song', 'Invented Band', { retry: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await answer).toMatchObject({ ok: true, id: 77 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('a click still says busy when the second answer is busy too, or the wait is long', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(reply(503, null, '1'))
    const twice = lyricsPreview('Invented Song', 'Invented Band', { retry: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await twice).toMatchObject({ ok: false, reason: 'busy' })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockReset()
    fetchMock.mockResolvedValue(reply(429, null, '30'))
    expect(await lyricsPreview('Invented Song', 'Invented Band', { retry: true })).toMatchObject({ ok: false, reason: 'busy' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('the click after a hover opens the words without asking LRCLIB again', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, [record()]))
    const preview = await lyricsPreview('Invented Song', 'Invented Band')
    expect(preview.ok).toBe(true)
    const words = await getLyrics(77)
    expect(words).toMatchObject({ ok: true, title: 'Invented Song', artist: 'Invented Band' })
    expect(words.ok && words.lyrics).toContain('an invented opening line')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('joins an identical search already on the wire', async () => {
    let answer!: (value: unknown) => void
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { answer = resolve }))
    const a = lyricsPreview('Invented Song', 'Invented Band')
    const b = lyricsPreview('Invented Song', 'Invented Band')
    answer(reply(200, [record()]))
    expect(await a).toEqual(await b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('a record with nothing sung in it is not-found, not a card that opens empty', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, [record({ plainLyrics: '[Intro]\n[Instrumental]\n[Outro]' })]))
    expect(await lyricsPreview('Invented Song', 'Invented Band')).toMatchObject({ ok: false, reason: 'not-found' })
  })
  it('passes over a labels-only record for a later whole one of the same song', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, [record({ id: 5, plainLyrics: '[Intro]\n[Instrumental]' }), record({ id: 6 })]))
    expect(await lyricsPreview('Invented Song', 'Invented Band')).toEqual({ ok: true, id: 6, firstLine: 'an invented opening line' })
  })
  it('same title by another artist is not-found', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, [record({ artistName: 'Some Other Choir' })]))
    expect(await lyricsPreview('Invented Song', 'Invented Band')).toMatchObject({ ok: false, reason: 'not-found' })
  })
  it('asks for the base title and first-named artist, and caps what it sends', async () => {
    fetchMock.mockResolvedValue(reply(200, []))
    await lyricsPreview('Invented Song (feat. Pretend Singer)', 'Invented Band & Pretend Singer')
    expect(fetchMock.mock.calls[0][0]).toBe('https://lrclib.net/api/search?q=Invented%20Song%20Invented%20Band')
    await lyricsPreview('x'.repeat(5000), 'y'.repeat(5000))
    expect(decodeURIComponent(String(fetchMock.mock.calls[1][0]).split('q=')[1]).length).toBeLessThanOrEqual(401)
  })
  it('a dead network is offline', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    expect(await lyricsPreview('Invented Song', 'Invented Band')).toMatchObject({ ok: false, reason: 'offline' })
  })
})
