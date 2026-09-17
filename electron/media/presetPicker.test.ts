import { describe, it, expect } from 'vitest'
import { PRESET_IDS, canonicalBook, presetForReference, presetForSeason } from './presetPicker'
import { STOCK_PRESETS } from '../../src/lib/stockPresets'

describe('PRESET_IDS', () => {
  it('mirrors src/lib/stockPresets.ts exactly', () => {
    expect([...PRESET_IDS]).toEqual(STOCK_PRESETS.map((p) => p.id))
  })
})

describe('canonicalBook', () => {
  it('resolves names, abbreviations and 0-based indexes', () => {
    expect(canonicalBook('psalm')).toBe('Psalms')
    expect(canonicalBook('Ps')).toBe('Psalms')
    expect(canonicalBook('1cor')).toBe('1 Corinthians')
    expect(canonicalBook('revelations')).toBe('Revelation')
    expect(canonicalBook(0)).toBe('Genesis')
    expect(canonicalBook(65)).toBe('Revelation')
    expect(canonicalBook(99)).toBeNull()
    expect(canonicalBook('xyzzy')).toBeNull()
  })
})

describe('presetForReference', () => {
  const pick = (book: string | number, chapter?: number, season?: string) =>
    presetForReference({ book, chapter }, season).presetId

  it('maps specific passages', () => {
    expect(pick('Psalms', 23)).toBe('shepherd')
    expect(pick('John', 15)).toBe('vine')
    expect(pick('Acts', 2)).toBe('pentecost')
    expect(pick('Genesis', 1)).toBe('light')
    expect(pick('Exodus', 14)).toBe('ocean')
    expect(pick('Matthew', 27)).toBe('cross')
    expect(pick('John', 19)).toBe('cross')
    expect(pick('Luke', 2)).toBe('christmas')
    expect(pick('John', 20)).toBe('tomb')
    expect(pick('Matthew', 28)).toBe('tomb')
    expect(pick('Revelation', 5)).toBe('crown')
    expect(pick('Ephesians', 6)).toBe('armor')
    expect(pick('John', 4)).toBe('water')
  })

  it('falls back by genre', () => {
    expect(pick('Psalms', 100)).toBe('bokeh')
    expect(pick('Psalms')).toBe('bokeh')
    expect(pick('Isaiah', 6)).toBe('desert')
    expect(pick('Habakkuk', 2)).toBe('desert')
    expect(pick('Mark', 9)).toBe('path')
    expect(pick('Romans', 12)).toBe('gradient')
    expect(pick('Philemon')).toBe('gradient')
  })

  it('season overrides only when there is no specific match', () => {
    expect(pick('Romans', 12, 'advent')).toBe('advent')
    expect(pick('Psalms', 100, 'Easter')).toBe('easter')
    expect(pick('Isaiah', 6, 'good-friday')).toBe('goodfriday')
    expect(pick('Psalms', 23, 'advent')).toBe('shepherd')
    expect(pick('Luke', 2, 'easter')).toBe('christmas')
    expect(pick('Romans', 12, 'ordinary time')).toBe('gradient')
  })

  it('handles unknown books and numeric ids', () => {
    expect(presetForReference({ book: 'nope' })).toEqual({ presetId: 'gradient', reason: expect.stringContaining('unknown') })
    expect(pick('nope', 1, 'pentecost')).toBe('pentecost')
    expect(pick(18, 23)).toBe('shepherd')
    expect(pick(42, 15)).toBe('vine')
  })

  it('always returns a real preset id with a reason', () => {
    const ids = new Set<string>(PRESET_IDS)
    for (let b = 0; b < 66; b++) {
      for (const ch of [undefined, 1, 2, 6, 15, 23, 28]) {
        const r = presetForReference({ book: b, chapter: ch })
        expect(ids.has(r.presetId)).toBe(true)
        expect(r.reason.length).toBeGreaterThan(0)
      }
    }
  })

  it('presetForSeason normalises', () => {
    expect(presetForSeason('Palm_Sunday')).toBe('palm')
    expect(presetForSeason(undefined)).toBeNull()
    expect(presetForSeason('summer')).toBeNull()
  })
})
