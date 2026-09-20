import { describe, it, expect } from 'vitest'
import {
  parseVideoId,
  pickTrack,
  decodeEntities,
  cleanCaptionLine,
  removeRollingRepeats,
  eventsToLines,
  extractPlayerResponse
} from './youtubeCaptions'
import { toHits, hitKey, failureFrom, type LrclibRecord } from './lyricsSearch'

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
