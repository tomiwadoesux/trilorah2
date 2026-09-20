import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RUN,
  SEGMENT_ALIASES,
  UNTYPED_ALIASES,
  WEAK_ALIASES,
  matchSegment,
  normalise
} from './serviceAliases'

/** The ids the app already has — Live.tsx SEGMENT_TYPES plus the engine's. */
const KNOWN_IDS = [
  'worship', 'sermon', 'welcome', 'announcements', 'offering',
  'altar-call', 'closing', 'communion', 'prayer', 'pre-service', 'custom'
]

describe('the alias table', () => {
  it('maps only onto segment ids the app already has', () => {
    for (const id of Object.keys(SEGMENT_ALIASES)) expect(KNOWN_IDS).toContain(id)
    for (const seg of DEFAULT_RUN) expect(KNOWN_IDS).toContain(seg.type)
  })

  it('knows at least ten names for every segment', () => {
    for (const [id, aliases] of Object.entries(SEGMENT_ALIASES)) {
      expect(aliases.length, id).toBeGreaterThanOrEqual(10)
    }
  })

  it('is written in the normalised form it is compared in', () => {
    const all = [...Object.values(SEGMENT_ALIASES), ...Object.values(UNTYPED_ALIASES)].flat()
    for (const alias of all) expect(alias, alias).toMatch(/^[a-z0-9 ]+$/)
  })

  it('never files one name under two types', () => {
    const seen = new Map<string, string>()
    for (const [id, aliases] of Object.entries(SEGMENT_ALIASES)) {
      for (const alias of aliases) {
        expect(seen.get(alias), `${alias} is under ${seen.get(alias)} and ${id}`).toBeUndefined()
        seen.set(alias, id)
      }
    }
  })

  it('marks as weak only names that exist', () => {
    const all = new Set([...Object.values(SEGMENT_ALIASES), ...Object.values(UNTYPED_ALIASES)].flat())
    for (const weak of WEAK_ALIASES) expect(all.has(weak), weak).toBe(true)
  })
})

describe('matchSegment — what churches call things', () => {
  const cases: [string, string][] = [
    // the owner's complaint
    ['Preaching', 'sermon'],
    ['Sermon', 'sermon'],
    // Nigerian Pentecostal
    ['Praise and Worship', 'worship'],
    ['Praise & Worship', 'worship'],
    ['High Praise', 'worship'],
    ['Special Number', 'worship'],
    ['Choir Rendition', 'worship'],
    ['Choir Ministration', 'worship'],
    ['Ministration', 'sermon'],
    ['The Word', 'sermon'],
    ['Exhortation', 'sermon'],
    ['Charge', 'sermon'],
    ['Tithes and Offering', 'offering'],
    ['Tithes & Offerings', 'offering'],
    ['Seed Sowing', 'offering'],
    ['First Fruit', 'offering'],
    ['Thanksgiving', 'offering'],
    ['Altar Call', 'altar-call'],
    ['Sharing the Grace', 'closing'],
    ['The Grace', 'closing'],
    ['Benediction', 'closing'],
    ['Closing Prayer', 'closing'],
    ['Opening Prayer', 'welcome'],
    ['Welcome of Guest', 'welcome'],
    ['Recognition of First Timers', 'welcome'],
    ['Pastoral Prayer', 'prayer'],
    ['Intercessory Prayers', 'prayer'],
    ['Prayer Points', 'prayer'],
    ['Sunday School', 'pre-service'],
    ['Workers Meeting', 'pre-service'],
    // liturgical
    ['Call to Worship', 'welcome'],
    ['Processional Hymn', 'worship'],
    ['Recessional Hymn', 'worship'],
    ['Hymn', 'worship'],
    ['Homily', 'sermon'],
    ['Sermonette', 'sermon'],
    ['Notices', 'announcements'],
    ['Notices and Banns', 'announcements'],
    ['Offertory', 'offering'],
    ['Holy Communion', 'communion'],
    ["The Lord's Supper", 'communion'],
    ['The Lord’s Supper', 'communion'],
    ['Eucharist', 'communion'],
    ['Prayers of the People', 'prayer'],
    ['Sending Forth', 'closing'],
    ['Dismissal with Blessing', 'closing'],
    ['Recessional', 'closing'],
    // American evangelical
    ['Message', 'sermon'],
    ['Worship Set', 'worship'],
    ['Giving', 'offering'],
    ['Announcements', 'announcements'],
    ['Next Steps', 'announcements'],
    ['Response Time', 'altar-call'],
    ['Invitation', 'altar-call'],
    ['Countdown', 'pre-service'],
    ['Meet & Greet', 'welcome']
  ]

  it.each(cases)('%s -> %s', (text, type) => {
    expect(matchSegment(text)?.type).toBe(type)
  })

  it('recognises what the app has no type for, as custom with a hint', () => {
    expect(matchSegment('Testimony Time')).toMatchObject({ type: 'custom', wouldBe: 'testimony' })
    expect(matchSegment('Bible Reading')).toMatchObject({ type: 'custom', wouldBe: 'reading' })
    expect(matchSegment('Scripture Reading')).toMatchObject({ type: 'custom', wouldBe: 'reading' })
    expect(matchSegment('First Lesson')).toMatchObject({ type: 'custom', wouldBe: 'reading' })
    expect(matchSegment('Child Dedication')).toMatchObject({ type: 'custom', wouldBe: 'special' })
  })
})

describe('matchSegment — longest alias wins', () => {
  it.each([
    ['Closing Hymn', 'worship', 'closing hymn'],
    ['Closing Prayer and Benediction', 'closing', 'closing prayer and benediction'],
    ['Opening Hymn', 'worship', 'opening hymn'],
    ['Prophetic Ministration', 'altar-call', 'prophetic ministration'],
    ['Ministration of the Word', 'sermon', 'ministration of the word'],
    ['Thanksgiving and Offering', 'offering', 'thanksgiving and offering'],
    ['The Great Thanksgiving', 'communion', 'the great thanksgiving'],
    ['Invitation Hymn', 'altar-call', 'invitation hymn']
  ])('%s -> %s via "%s"', (text, type, alias) => {
    expect(matchSegment(text)).toMatchObject({ type, alias })
  })
})

describe('matchSegment — OCR noise', () => {
  it.each([
    ['0ffering', 'offering'],
    ['OFFERlNG:', 'offering'],
    ['A1tar Cal1', 'altar-call'],
    ['AItar CaII', 'altar-call'],
    ['Serm0n .....', 'sermon'],
    ['PraiseandWorship', 'worship'],
    ['Praise &Worship', 'worship'],
    ['Of fering', 'offering'],
    ['Annoucements', 'announcements'],
    ['Benedictlon.', 'closing'],
    ['H0ly C0mmunion', 'communion'],
    ['Tithes&Offering', 'offering'],
    ['5ermon', 'sermon'],
    ['— Welcome —', 'welcome']
  ])('%s -> %s', (text, type) => {
    expect(matchSegment(text)?.type).toBe(type)
  })

  it('scores a near miss below an exact hit', () => {
    expect(matchSegment('Announcements')!.confidence).toBe(1)
    expect(matchSegment('Annoucements')!.confidence).toBeLessThan(1)
  })
})

describe('matchSegment — never inside unrelated words', () => {
  it.each([
    'Password reset',
    'Swordfish',
    'Hymnal',
    'Wordsworth',
    'Massive',
    'Foreclosing',
    'Appraisal',
    'Hour of Visitation',
    'Pastor Dan',
    '10 mins',
    '',
    '9:00'
  ])('%s -> null', (text) => {
    expect(matchSegment(text)).toBeNull()
  })

  it('does not read a sentence as a segment', () => {
    expect(
      matchSegment('We thank everyone who came out last week to help with the building and the word got round')
    ).toBeNull()
  })
})

describe('matchSegment — confidence', () => {
  it('is 1 for an exact, unambiguous, whole-title name', () => {
    expect(matchSegment('Praise and Worship')!.confidence).toBe(1)
    expect(matchSegment('Offering Time')!.confidence).toBe(1)
  })
  it('drops for a word that only sometimes means it', () => {
    expect(matchSegment('Word')!.confidence).toBe(0.6)
    expect(matchSegment('Ministration')!.confidence).toBe(0.6)
  })
  it('drops when the title says more than the alias accounts for', () => {
    expect(matchSegment('Offering for the building project')!.confidence).toBe(0.85)
  })
})

describe('normalise', () => {
  it('folds the classic OCR confusions into one spelling', () => {
    expect(normalise('A1tar CaII')).toEqual(normalise('altar call'))
    expect(normalise("Lord's")).toEqual(normalise('Lords'))
    expect(normalise('Tithes & Offering:')).toEqual(normalise('tithes and offering'))
  })
  it('leaves pure numbers alone', () => {
    expect(normalise('10 mins')).toEqual(['10', 'mlns'])
  })
})

describe('DEFAULT_RUN', () => {
  it('puts the altar call directly after the sermon', () => {
    const types = DEFAULT_RUN.map((s) => s.type)
    expect(types.indexOf('altar-call')).toBe(types.indexOf('sermon') + 1)
  })
  it('opens with welcome and ends with closing', () => {
    expect(DEFAULT_RUN[0].type).toBe('welcome')
    expect(DEFAULT_RUN[DEFAULT_RUN.length - 1].type).toBe('closing')
  })
  it('runs about an hour and a half', () => {
    const total = DEFAULT_RUN.reduce((n, s) => n + s.durationMin, 0)
    expect(total).toBeGreaterThanOrEqual(75)
    expect(total).toBeLessThanOrEqual(120)
  })
  it('labels every segment with a name the matcher files under the same type', () => {
    for (const seg of DEFAULT_RUN) expect(matchSegment(seg.label)?.type, seg.label).toBe(seg.type)
  })
})
