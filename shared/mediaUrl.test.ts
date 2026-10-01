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
