import { isLocalAssetUrl, isVideoUrl } from './mediaUrl'
import { describe, it, expect } from 'vitest'
import { cssImageUrl, toDisplayUrl, fileToDisplayUrl } from './mediaUrl'

describe('CSS background paths', () => {
  it('quotes a saved image path containing spaces and parentheses', () => {
    const url = 'local-media://file/Users/a/Library/Application Support/backgrounds/Sunday (1).jpg'
    expect(cssImageUrl(url)).toBe(`url("${url}")`)
  })
  it('escapes quotes in a filename', () => {
    expect(cssImageUrl('local-media://file/a/"Sunday".jpg')).toBe('url("local-media://file/a/\\"Sunday\\".jpg")')
  })
})

describe('toDisplayUrl — a stored file:// becomes drawable', () => {
  it('converts file://', () => {
    expect(toDisplayUrl('file:///Users/a/bg.jpg')).toBe('local-media://file/Users/a/bg.jpg')
  })
  it('leaves everything else alone, including web-root paths', () => {
    for (const u of ['', 'https://x.test/a.png', 'data:image/png;base64,AA', 'local-media://file/a.png', '/assets/wash.png']) {
      expect(toDisplayUrl(u)).toBe(u)
    }
    expect(toDisplayUrl(null)).toBe('')
  })
})

describe('fileToDisplayUrl — what the operator put on the wall', () => {
  it('takes a bare POSIX path', () => {
    expect(fileToDisplayUrl('/Users/a/clip.mp4')).toBe('local-media://file/Users/a/clip.mp4')
  })
  it('takes a Windows path', () => {
    expect(fileToDisplayUrl('C:\\Users\\a\\clip.mp4')).toBe('local-media://file/C:/Users/a/clip.mp4')
  })
  it('escapes spaces and odd characters so the URL parses', () => {
    expect(fileToDisplayUrl('/Users/a/Sunday Clip #2.mp4')).toBe('local-media://file/Users/a/Sunday%20Clip%20%232.mp4')
  })
  it('passes real URLs through the ordinary conversion', () => {
    expect(fileToDisplayUrl('file:///Users/a/clip.mp4')).toBe('local-media://file/Users/a/clip.mp4')
    expect(fileToDisplayUrl('local-media://file/Users/a/clip.mp4')).toBe('local-media://file/Users/a/clip.mp4')
    expect(fileToDisplayUrl('https://x.test/clip.mp4')).toBe('https://x.test/clip.mp4')
  })
})

it('distinguishes looping clips from animated image backgrounds', () => {
  expect(isVideoUrl('local-media://file/loop.MP4')).toBe(true)
  expect(isVideoUrl('https://example.test/loop.webm?token=abc')).toBe(true)
  expect(isVideoUrl('file:///animated.gif')).toBe(false)
  expect(isVideoUrl('data:video/mp4;base64,AAAA')).toBe(true)
})

describe('local library assets', () => {
  const origin = 'http://127.0.0.1:5173'
  it('keeps device files, downloaded stock, embedded previews, and bundled assets', () => {
    for (const url of ['file:///Users/a/song.png', 'C:\\Media\\clip.mp4', '/assets/photo.jpg', './slides/one.png', 'local-media://file/downloaded.jpg', 'data:image/png;base64,AA', `${origin}/assets/photo.jpg`, `blob:${origin}/image-id`]) {
      expect(isLocalAssetUrl(url, origin), url).toBe(true)
    }
  })
  it('excludes remote images and previews even if they are stored in the library', () => {
    for (const url of ['https://images.example.com/photo.jpg', '//images.example.com/photo.jpg', 'blob:https://images.example.com/id', 'file://server/shared/photo.jpg', '\\\\server\\photos\\one.jpg', 'javascript:alert(1)', '']) {
      expect(isLocalAssetUrl(url, origin), url).toBe(false)
    }
    expect(isLocalAssetUrl(undefined, origin)).toBe(false)
  })
})
