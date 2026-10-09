import { describe, expect, it } from 'vitest'
import {
  NO_BACKGROUND,
  backgroundDropAction,
  backgroundSrc,
  backgroundFor,
  liveBackgroundNotice,
  previewBackgroundNotice,
  isBackgroundDropKey,
  liveThemeFromSettings,
  sameTheme,
  shortHash,
  themeFieldsFromSettings,
  wallBackgroundMedia,
  wallUrlToMediaId,
} from './backgroundDrop'
import { outputThemeSettings } from './outputTheme'
import type { ThemeMedia } from '../design/screens/mediaLibrary'

const media = (over: Partial<ThemeMedia>): ThemeMedia => ({
  id: 'x', label: 'x', detail: '', seed: 0, style: 'smoke', source: 'local', ...over,
})

/* A stand-in for mediaSrc: a wash draws its own data: picture. */
const srcOf = (m: ThemeMedia) => (m.url ? m.url.replace(/^file:\/+/, 'local-media://file/') : `data:image/svg+xml,wash-${m.seed}`)

const library: ThemeMedia[] = [
  media({ id: 'clip', kind: 'video', url: 'local-media://file/media/clip.mp4', poster: 'data:image/jpeg,poster' }),
  media({ id: 'sanctuary', kind: 'photo', url: 'local-media://file/Users/me/Library/backgrounds/sanctuary.jpg' }),
  media({ id: 'stock', kind: 'photo', url: 'https://cdn.example.test/thumb.jpg' }),
  media({ id: 'quiet-sea', seed: 5, source: 'stock' }),
]

describe('which drop does what', () => {
  it('only the three background targets are background drops', () => {
    expect(isBackgroundDropKey('media-themes')).toBe(true)
    expect(isBackgroundDropKey('stage-preview')).toBe(true)
    expect(isBackgroundDropKey('stage-live')).toBe(true)
    expect(isBackgroundDropKey('seg-1')).toBe(false)
    expect(isBackgroundDropKey(null)).toBe(false)
    expect(isBackgroundDropKey('')).toBe(false)
  })

  it.each([
    ['media-themes', 'photo', 'preview'],
    ['media-themes', 'video', 'preview'],
    ['stage-preview', 'photo', 'preview'],
    ['stage-preview', 'video', 'preview'],
    ['stage-live', 'photo', 'live'],
    ['stage-live', 'video', 'live'],
  ] as const)('%s with a %s → %s', (key, kind, action) => {
    expect(backgroundDropAction(key, { kind })).toBe(action)
  })

  it('a wash (no kind) is a still', () => {
    expect(backgroundDropAction('stage-live', {})).toBe('live')
  })

  it('refuses an item that is no longer on the shelf', () => {
    expect(backgroundDropAction('stage-live', undefined)).toBe('refuse')
  })
})

describe('reading the wall back onto the shelf', () => {
  it('matches a file:// setting to the local-media:// card that holds the same file', () => {
    expect(wallUrlToMediaId('file:///Users/me/Library/backgrounds/sanctuary.jpg', library, srcOf)).toBe('sanctuary')
  })

  it('matches a local-media:// setting as written', () => {
    expect(wallUrlToMediaId('local-media://file/Users/me/Library/backgrounds/sanctuary.jpg', library, srcOf)).toBe('sanctuary')
  })

  it('matches a wash by the picture it draws', () => {
    expect(wallUrlToMediaId('data:image/svg+xml,wash-5', library, srcOf)).toBe('quiet-sea')
  })

  it('matches an http picture as written', () => {
    expect(wallUrlToMediaId('https://cdn.example.test/thumb.jpg', library, srcOf)).toBe('stock')
  })

  it('an empty wall is no background, not the first picture on the shelf', () => {
    expect(wallUrlToMediaId('', library, srcOf)).toBe(NO_BACKGROUND)
    expect(wallUrlToMediaId(undefined, library, srcOf)).toBe(NO_BACKGROUND)
  })

  it('never answers with a clip, even when its poster is what the wall holds', () => {
    expect(wallUrlToMediaId('data:image/jpeg,poster', library, srcOf)).toBeUndefined()
  })

  it('says so when the wall shows something the shelf has never seen', () => {
    expect(wallUrlToMediaId('file:///elsewhere/new.png', library, srcOf)).toBeUndefined()
  })

  it('keeps the card already in use when two cards hold the same file', () => {
    const twice = [...library, media({ id: 'sanctuary-again', kind: 'photo', url: 'file:///Users/me/Library/backgrounds/sanctuary.jpg' })]
    expect(wallUrlToMediaId('file:///Users/me/Library/backgrounds/sanctuary.jpg', twice, srcOf, 'sanctuary-again')).toBe('sanctuary-again')
    expect(wallUrlToMediaId('file:///Users/me/Library/backgrounds/sanctuary.jpg', twice, srcOf, 'quiet-sea')).toBe('sanctuary')
  })

  it('files an unknown wall picture as a themes photo with a short stable id', () => {
    const wash = `data:image/svg+xml,${'x'.repeat(5000)}`
    const card = wallBackgroundMedia(wash)
    expect(card).toMatchObject({ kind: 'photo', collection: 'themes', url: wash, source: 'local' })
    expect(card.id.length).toBeLessThan(20)
    expect(wallBackgroundMedia(wash).id).toBe(card.id)
    /* file:// and local-media:// are the same file, so the same card. */
    expect(wallBackgroundMedia('file:///a/b.jpg').id).toBe(wallBackgroundMedia('local-media://file/a/b.jpg').id)
    expect(shortHash('a')).not.toBe(shortHash('b'))
  })
})

describe('the live theme off the wall settings', () => {
  const theme = {
    backgroundId: 'sanctuary', dimness: 57, blur: 3, shadow: 65, font: 'serif', size: 2, verseSize: 1.5, refGap: 0.45,
    layout: 'top-left', safeMargin: 7.5, textWidth: 70, textCase: 'lowercase' as const, textSpacing: 'airy' as const,
  }

  it('round-trips everything the wall stores', () => {
    const settings = outputThemeSettings(theme, 'local-media://file/x.jpg')
    expect(liveThemeFromSettings(settings, { ...theme, dimness: 0, blur: 0, verseSize: 0, layout: 'center' }, 'sanctuary')).toEqual(theme)
  })

  it('keeps what the wall never stores', () => {
    const live = liveThemeFromSettings({ overlayOpacity: 0.2 }, theme, 'sanctuary')
    expect(live).toMatchObject({ size: 2, shadow: 65, font: 'serif', dimness: 20 })
  })

  it('reads a fresh install the way the wall draws it', () => {
    expect(themeFieldsFromSettings({ scriptureFontPreset: 'display-serif', overlayOpacity: 0.3, backgroundBlur: 0, verseLayout: 'center', safeMargin: 10, refScale: 1, refGap: 0.9 }))
      .toEqual({ font: 'serif', dimness: 30, blur: 0, layout: 'center', safeMargin: 10, verseSize: 0, refGap: 0.9 })
  })

  it('maps the old bottom layout and ignores a malformed one', () => {
    expect(themeFieldsFromSettings({ verseLayout: 'bottom' }).layout).toBe('bottom-center')
    expect(themeFieldsFromSettings({ verseLayout: 'sideways' }).layout).toBeUndefined()
  })

  it('compares equal when nothing changed, so the box does not re-render', () => {
    const settings = outputThemeSettings(theme, '')
    expect(sameTheme(liveThemeFromSettings(settings, theme, theme.backgroundId), theme)).toBe(true)
    expect(sameTheme(liveThemeFromSettings({ ...settings, overlayOpacity: 0.9 }, theme, theme.backgroundId), theme)).toBe(false)
  })
})

describe('the live box keeps what the wall already agrees with', () => {
  const theme = {
    backgroundId: 'sanctuary', dimness: 60, blur: 2, shadow: 65, font: 'uppercase', size: 0, verseSize: 0, refGap: 0.9,
    layout: 'center', safeMargin: 10, textWidth: 95,
  }

  it('does not trade the uppercase font, an unset case or an over-wide width for their stored forms', () => {
    /* Stored: modern-sans, textCase 'uppercase', textWidth clamped to 80. */
    const settings = outputThemeSettings(theme, '')
    const live = liveThemeFromSettings(settings, theme, theme.backgroundId)
    expect(live).toEqual(theme)
    expect(sameTheme(live, theme)).toBe(true)
  })

  it('still takes a field the wall really changed', () => {
    const settings = { ...outputThemeSettings(theme, ''), scriptureFontPreset: 'display-serif', overlayOpacity: 0.25 }
    expect(liveThemeFromSettings(settings, theme, theme.backgroundId)).toMatchObject({ font: 'serif', dimness: 25, textWidth: 95 })
  })
})

describe('the picture a theme draws', () => {
  const shelf: ThemeMedia[] = [
    media({ id: 'notice', kind: 'photo', url: 'local-media://file/notice.jpg', collection: 'media' }),
    media({ id: 'clip', kind: 'video', url: 'local-media://file/clip.mp4', collection: 'themes' }),
    media({ id: 'sea', kind: 'photo', url: 'local-media://file/sea.jpg', collection: 'themes' }),
    media({ id: 'wash', seed: 2 }),
  ]

  it('draws the chosen still, whichever shelf it is on', () => {
    expect(backgroundFor('notice', shelf)?.id).toBe('notice')
    expect(backgroundFor('wash', shelf)?.id).toBe('wash')
  })

  it('draws nothing for no background', () => {
    expect(backgroundFor(NO_BACKGROUND, shelf)).toBeUndefined()
  })

  it('draws a chosen clip and falls back within the themes shelf', () => {
    expect(backgroundFor('deleted', shelf)?.id).toBe('clip')
    expect(backgroundFor('clip', shelf)?.id).toBe('clip')
  })
})

describe('what the operator is told', () => {
  const verse = { source: 'scripture' }
  const projector = [{ role: 'projector', open: true }]

  it('says the words stay when a background goes up behind a verse', () => {
    expect(liveBackgroundNotice({ screen: 'live', live: verse, outputs: projector })).toBe('on the wall now — the words stay')
    expect(liveBackgroundNotice({ screen: 'live', live: null, outputs: projector })).toBe('on the wall now')
    expect(liveBackgroundNotice({ screen: 'clear', live: verse })).toBe('on the wall now')
  })

  it('says when nobody will see it yet', () => {
    expect(liveBackgroundNotice({ screen: 'black', live: verse })).toMatch(/black/)
    expect(liveBackgroundNotice({ screen: 'logo', live: verse })).toMatch(/logo/)
    expect(liveBackgroundNotice({ screen: 'live', live: { source: 'media', mediaKind: 'photo' }, outputs: projector })).toMatch(/picture is up/)
    expect(liveBackgroundNotice({ screen: 'live', live: { source: 'presentation' }, outputs: projector })).toMatch(/picture is up/)
    expect(liveBackgroundNotice({ screen: 'live', live: verse, outputs: [{ role: 'projector', open: false }] })).toMatch(/no projector window/)
    expect(liveBackgroundNotice({ screen: 'live', live: verse, outputs: [{ role: 'projector', open: true, disabled: true }] })).toMatch(/no projector window/)
    expect(liveBackgroundNotice({ screen: 'live', live: verse, outputs: [{ role: 'stream', open: true }] })).toMatch(/stream never/)
  })

  it('a stage monitor paints the background too', () => {
    expect(liveBackgroundNotice({ screen: 'live', live: verse, outputs: [{ role: 'stage', open: true }] })).toBe('on the wall now — the words stay')
  })

  it('a preview choice says when it goes up and how to send it now', () => {
    expect(previewBackgroundNotice(null, 'click')).toBe('in preview — goes up with the next go live · double-click to put it on the wall now')
    expect(previewBackgroundNotice(verse, 'drop')).toMatch(/drop it on live/)
    expect(previewBackgroundNotice(null, 'pick')).toMatch(/media › themes/)
    expect(previewBackgroundNotice({ source: 'presentation' }, 'click')).toMatch(/not behind the picture/)
  })
})

it('uses the video file instead of its poster for background playback', () => {
  expect(backgroundSrc(library[0], () => 'data:image/jpeg,poster')).toBe('local-media://file/media/clip.mp4')
  expect(wallBackgroundMedia('file:///loop.webm').kind).toBe('video')
  expect(wallUrlToMediaId('local-media://file/media/clip.mp4', library, srcOf)).toBe('clip')
  expect(backgroundSrc(media({ url: 'file:///animated.gif' }), srcOf)).toBe('local-media://file/animated.gif')
})
