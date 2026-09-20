import { describe, expect, it } from 'vitest'
import { parseOrderOfService } from './runOfServiceParse'
import { DEFAULT_RUN } from './serviceAliases'
import {
  defaultSegments,
  findSongForItem,
  formatMinutes,
  planLine,
  rowFlag,
  rowsToSegments,
  totalMinutes,
} from './runPlan'

describe('defaultSegments', () => {
  it('is DEFAULT_RUN in order, with its minutes', () => {
    const segs = defaultSegments()
    expect(segs.map((s) => s.id)).toEqual(DEFAULT_RUN.map((s) => s.type))
    expect(segs[2]).toEqual({ id: 'sermon', label: 'sermon', durationMin: 40 })
    expect(totalMinutes(segs)).toBe(95)
  })

  it('puts the altar call directly after the sermon', () => {
    const ids = defaultSegments().map((s) => s.id)
    expect(ids[ids.indexOf('sermon') + 1]).toBe('altar-call')
  })
})

describe('rowsToSegments', () => {
  const rows = parseOrderOfService(
    ['8:OOam - Opening Prayer', '8:10 – High Praise (Choir)', '9:05 Preaching — Pastor Dan', 'Children dedication .... 10 mins'].join('\n'),
  )

  it('keeps every row, typed or not', () => {
    const segs = rowsToSegments(rows)
    expect(segs).toHaveLength(rows.length)
    for (const s of segs) expect(s.id).toBeTruthy()
  })

  it('sends an untyped row in as custom under its own words', () => {
    const untyped = rows.findIndex((r) => r.type === null)
    if (untyped < 0) return
    const seg = rowsToSegments(rows)[untyped]
    expect(seg.id).toBe('custom')
    expect(seg.label).toBe(rows[untyped].title.trim().toLowerCase())
  })

  it('carries printed times and durations', () => {
    const segs = rowsToSegments([
      { raw: '', title: 'Sermon', type: 'sermon', confidence: 1, time: { start: 545 }, durationMin: 40 },
    ])
    expect(segs[0]).toEqual({ id: 'sermon', label: 'sermon', startMin: 545, durationMin: 40 })
  })

  it('drops a row whose title was deleted', () => {
    expect(rowsToSegments([{ raw: 'x', title: '  ', type: 'sermon', confidence: 1 }])).toEqual([])
  })
})

describe('planLine', () => {
  it('reads time then length', () => {
    expect(planLine({ startMin: 545, durationMin: 40 })).toBe('9:05 am · 40 min')
  })
  it('gives what it has', () => {
    expect(planLine({ durationMin: 5 })).toBe('5 min')
    expect(planLine({ startMin: 480 })).toBe('8:00 am')
    expect(planLine({})).toBe('')
    expect(planLine({ durationMin: 0 })).toBe('')
  })
  it('formats long segments in hours', () => {
    expect(formatMinutes(90)).toBe('1h 30')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(65)).toBe('1h 05')
  })
})

describe('rowFlag', () => {
  it('asks for a type when there is none', () => {
    expect(rowFlag({ type: null, confidence: 0 })).toBe('pick')
  })
  it('marks a guess for checking', () => {
    expect(rowFlag({ type: 'worship', confidence: 0.7 })).toBe('check')
    expect(rowFlag({ type: 'worship', confidence: 0.9 })).toBeNull()
  })
})

describe('findSongForItem', () => {
  const songs = [
    { id: 'a', title: 'Holy, Holy, Holy' },
    { id: 'b', title: 'Holy' },
    { id: 'c', title: "'Tis So Sweet to Trust in Jesus" },
  ]
  it('prefers the id, even after a rename', () => {
    expect(findSongForItem(songs, { songId: 'a', title: 'Old Name', label: 'Old Name — Verse 1' })?.id).toBe('a')
  })
  it('falls back to the carried title', () => {
    expect(findSongForItem(songs, { title: 'holy holy holy', label: 'x' })?.id).toBe('a')
  })
  it('reads the title off a dragged label', () => {
    expect(findSongForItem(songs, { label: 'Holy — Chorus' })?.id).toBe('b')
    expect(findSongForItem(songs, { label: 'Tis so sweet to trust in Jesus' })?.id).toBe('c')
  })
  it('never matches on a substring', () => {
    expect(findSongForItem(songs, { label: 'Holy, Holy' })).toBeNull()
  })
  it('falls through a stale id to the title', () => {
    expect(findSongForItem(songs, { songId: 'gone', title: 'Holy', label: '' })?.id).toBe('b')
  })
})
