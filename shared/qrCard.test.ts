import { describe, it, expect } from 'vitest'
import { buildQrCard, qrInner, qrViewBox, esc, displayUrl } from './qrCard'

const QR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="29" height="29" fill="#fff"/><path d="M0 0h7v7H0z"/></svg>'
const card = (over: Partial<Parameters<typeof buildQrCard>[0]> = {}) =>
  buildQrCard({ qrSvg: QR, caption: 'Follow along on your phone', url: 'https://trilorah.com/live/vrc', ...over })

describe('displayUrl — what is worth reading from the back row', () => {
  it('drops the scheme nobody types', () => {
    expect(displayUrl('https://trilorah.com/live/vrc')).toBe('trilorah.com/live/vrc')
    expect(displayUrl('http://trilorah.com/live/vrc')).toBe('trilorah.com/live/vrc')
  })
  it('drops a trailing slash', () => {
    expect(displayUrl('https://trilorah.com/')).toBe('trilorah.com')
  })
  it('leaves a bare address alone', () => {
    expect(displayUrl('trilorah.com/live/vrc')).toBe('trilorah.com/live/vrc')
  })
})

describe('esc — a church name must not break the card', () => {
  it('escapes the characters that would end the SVG early', () => {
    expect(esc('Grace & Peace')).toBe('Grace &amp; Peace')
    expect(esc('a<b>c"d')).toBe('a&lt;b&gt;c&quot;d')
  })
  it('an ampersand in the name still yields parseable output', () => {
    const svg = card({ churchName: 'Grace & Peace Assembly' })
    expect(svg).toContain('Grace &amp; Peace Assembly')
    expect(svg).not.toMatch(/>[^<]*&(?!amp;|lt;|gt;|quot;)/)
  })
})

describe('qrInner / qrViewBox — reusing the library’s drawing', () => {
  it('keeps the shapes and drops the wrapper', () => {
    const inner = qrInner(QR)
    expect(inner).toContain('<path')
    expect(inner).not.toContain('<svg')
    expect(inner).not.toContain('</svg>')
  })
  it('carries the viewBox across so the code is not distorted', () => {
    expect(qrViewBox(QR)).toBe('0 0 29 29')
  })
  it('falls back rather than throwing on something unexpected', () => {
    expect(qrViewBox('<svg></svg>')).toBe('0 0 33 33')
  })
})

describe('buildQrCard — what goes on the wall', () => {
  it('is one well-formed svg at the projector’s size', () => {
    const svg = card()
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
    expect(svg).toContain('width="1920"')
    expect(svg).toContain('height="1080"')
  })
  it('says what to do, and shows the address for anyone who cannot scan', () => {
    const svg = card()
    expect(svg).toContain('Follow along on your phone')
    expect(svg).toContain('trilorah.com/live/vrc')
  })
  it('names the church when one is set, and stays quiet when not', () => {
    expect(card({ churchName: 'Victory Royal Church' })).toContain('Victory Royal Church')
    const anonymous = card({ churchName: '   ' })
    expect(anonymous).toContain('Follow along')
    expect((anonymous.match(/<text/g) ?? []).length).toBe(2)
  })
  it('keeps the code square, and on a white plate with a quiet zone', () => {
    const svg = card()
    const plate = /<rect x="[\d.]+" y="[\d.]+" width="(\d+)" height="(\d+)" rx="\d+" fill="#ffffff"/.exec(svg)
    expect(plate).not.toBeNull()
    expect(plate![1]).toBe(plate![2])
    const inner = /<svg x="[\d.]+" y="[\d.]+" width="(\d+)" height="(\d+)"/.exec(svg)
    expect(inner![1]).toBe(inner![2])
    expect(Number(plate![1])).toBeGreaterThan(Number(inner![1]))
  })
  it('fits inside the canvas on a short, wide screen', () => {
    const svg = card({ width: 2560, height: 1080 })
    const m = /<rect x="([\d.]+)" y="([\d.]+)" width="(\d+)" height="(\d+)" rx="\d+" fill="#ffffff"/.exec(svg)!
    const [x, y, w, h] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
    expect(x).toBeGreaterThan(0)
    expect(y).toBeGreaterThan(0)
    expect(x + w).toBeLessThan(2560)
    expect(y + h).toBeLessThan(1080)
  })
  it('puts the church above the caption, and the address below the code', () => {
    const svg = card({ churchName: 'Victory Royal Church' })
    const y = (needle: string) => Number(/y="([\d.]+)"/.exec(svg.slice(svg.indexOf(needle) - 260, svg.indexOf(needle)))![1])
    expect(y('Victory Royal Church')).toBeLessThan(y('Follow along'))
    expect(y('trilorah.com')).toBeGreaterThan(y('Follow along'))
  })
})
