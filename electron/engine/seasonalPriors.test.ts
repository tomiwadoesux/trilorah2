import { describe, it, expect } from 'vitest'
import {
  easterDate,
  adventStart,
  thanksgivingDate,
  getSeason,
  seasonalBoost
} from './seasonalPriors'

describe('seasonalPriors — calendar math', () => {
  it('computes Easter correctly for known years', () => {
    expect(easterDate(2024).toDateString()).toBe(new Date(2024, 2, 31).toDateString())
    expect(easterDate(2025).toDateString()).toBe(new Date(2025, 3, 20).toDateString())
    expect(easterDate(2026).toDateString()).toBe(new Date(2026, 3, 5).toDateString())
  })

  it('computes Advent start (4th Sunday before Christmas)', () => {
    // 2026: Christmas is a Friday; Sunday before = Dec 20; Advent = Nov 29
    expect(adventStart(2026).toDateString()).toBe(new Date(2026, 10, 29).toDateString())
  })

  it('computes US Thanksgiving (4th Thursday of November)', () => {
    expect(thanksgivingDate(2026).toDateString()).toBe(new Date(2026, 10, 26).toDateString())
  })
})

describe('seasonalPriors — seasons', () => {
  it('Christmas day is christmas', () => {
    expect(getSeason(new Date(2026, 11, 25))).toBe('christmas')
  })
  it('mid-December is advent', () => {
    expect(getSeason(new Date(2026, 11, 10))).toBe('advent')
  })
  it('Easter Sunday is easter', () => {
    expect(getSeason(easterDate(2026))).toBe('easter')
  })
  it('Good Friday week is holy-week', () => {
    expect(getSeason(new Date(2026, 3, 3))).toBe('holy-week')
  })
  it('mid-July is ordinary', () => {
    expect(getSeason(new Date(2026, 6, 12))).toBe('ordinary')
  })
})

describe('seasonalPriors — boosts', () => {
  it('boosts Luke 2 at Christmas, not in July', () => {
    expect(seasonalBoost('Luke', 2, new Date(2026, 11, 25))).toBeGreaterThan(1)
    expect(seasonalBoost('Luke', 2, new Date(2026, 6, 12))).toBe(1)
  })
  it('boosts 1 Corinthians 15 at Easter', () => {
    expect(seasonalBoost('1 Corinthians', 15, easterDate(2026))).toBeGreaterThan(1)
  })
  it('never boosts chapterless detections', () => {
    expect(seasonalBoost('Luke', null, new Date(2026, 11, 25))).toBe(1)
  })
})
