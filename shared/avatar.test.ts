import { describe, it, expect } from 'vitest'
import { avatarFor, fnv1a, hexToHsl, hslToHex, initialsFor, paletteFor } from './avatar'

describe('fnv1a', () => {
  it('matches known vectors', () => {
    expect(fnv1a('')).toBe(0x811c9dc5)
    expect(fnv1a('a')).toBe(0xe40c292c)
  })
})

describe('hex <-> hsl', () => {
  it('round-trips', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#3b82f6', '#808080', '#123456']) {
      expect(hslToHex(hexToHsl(hex)!)).toBe(hex)
    }
  })
  it('accepts short hex and rejects junk', () => {
    expect(hexToHsl('fff')).toEqual({ h: 0, s: 0, l: 1 })
    expect(hexToHsl('#zzz')).toBeNull()
    expect(hexToHsl('')).toBeNull()
  })
})

describe('initialsFor', () => {
  it('takes first letters of the first two words, uppercase', () => {
    expect(initialsFor('pastor john')).toBe('PJ')
    expect(initialsFor('Grace')).toBe('G')
    expect(initialsFor('  new   life church ')).toBe('NL')
    expect(initialsFor('')).toBe('?')
  })
})

describe('avatarFor', () => {
  it('is deterministic', () => {
    const a = avatarFor('Pastor Ade', { brandColor: '#1e6fd9' })
    const b = avatarFor('Pastor Ade', { brandColor: '#1e6fd9' })
    expect(a).toEqual(b)
    expect(a.svg).toBe(b.svg)
  })
  it('differs by seed', () => {
    expect(avatarFor('alpha').svg).not.toBe(avatarFor('beta').svg)
    expect(avatarFor('alpha').colors).not.toEqual(avatarFor('beta').colors)
  })
  it('contains initials, three hex colours and two radial gradients', () => {
    const a = avatarFor('Sunday Service')
    expect(a.initials).toBe('SS')
    expect(a.svg).toContain('>SS</text>')
    expect(a.colors).toHaveLength(3)
    for (const c of a.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    expect(a.svg.match(/<radialGradient/g)).toHaveLength(2)
    expect(a.svg).toContain('fill="#ffffff" fill-opacity="0.92"')
  })
  it('honours size', () => {
    expect(avatarFor('x', { size: 40 }).svg).toContain('width="40" height="40"')
  })
  it('stays within ±30° of the brand hue', () => {
    const brand = hexToHsl('#e11d48')!
    for (const seed of ['a', 'b', 'c', 'pastor', 'worship team', 'z9']) {
      const [base, hi, lo] = paletteFor(seed, '#e11d48')
      for (const c of [base, hi, lo]) {
        const h = hexToHsl(c)!.h
        const diff = Math.min(Math.abs(h - brand.h), 360 - Math.abs(h - brand.h))
        expect(diff).toBeLessThanOrEqual(61) // ±30° base, ±30° accent spread, rounding
      }
    }
  })
  it('brand colour changes the palette; junk brand colour is ignored', () => {
    expect(avatarFor('x').colors).not.toEqual(avatarFor('x', { brandColor: '#10b981' }).colors)
    expect(avatarFor('x').colors).toEqual(avatarFor('x', { brandColor: 'nope' }).colors)
  })
  it('escapes initials in markup', () => {
    expect(avatarFor('<b> & co').svg).not.toContain('<b>')
  })
})
