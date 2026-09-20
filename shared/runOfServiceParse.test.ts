import { describe, it, expect } from 'vitest'
import { formatClock, parseOrderOfService, rowsToSchedule, type ParsedRow } from './runOfServiceParse'

const at = (h: number, m = 0) => h * 60 + m
const one = (line: string): ParsedRow => {
  const rows = parseOrderOfService(line)
  expect(rows).toHaveLength(1)
  return rows[0]
}

describe('one row at a time', () => {
  const cases: [string, Partial<ParsedRow>][] = [
    ['9:00 – Opening Prayer', { time: { start: at(9) }, title: 'Opening Prayer', type: 'welcome' }],
    [
      '09.00am-09.10am  Praise & Worship  (Choir)',
      { time: { start: at(9), end: at(9, 10) }, durationMin: 10, title: 'Praise & Worship', type: 'worship', person: 'Choir' }
    ],
    ['10:15 Sermon — Pastor Dan', { time: { start: at(10, 15) }, title: 'Sermon', type: 'sermon', person: 'Pastor Dan' }],
    ['Offering ........ 10 mins', { title: 'Offering', type: 'offering', durationMin: 10 }],
    ['3. Announcements', { title: 'Announcements', type: 'announcements' }],
    ['3.Announcements', { title: 'Announcements', type: 'announcements' }],
    ['iv) Benediction', { title: 'Benediction', type: 'closing' }],
    ['• Holy Communion', { title: 'Holy Communion', type: 'communion' }],
    ['9am Preaching', { time: { start: at(9) }, title: 'Preaching', type: 'sermon' }],
    ['9 a.m. - 10:30 a.m. Worship', { time: { start: at(9), end: at(10, 30) }, durationMin: 90, type: 'worship' }],
    ['9:00 - 9:10am Prayer', { time: { start: at(9), end: at(9, 10) }, type: 'prayer' }],
    ['11:30 – 12:30pm The Word', { time: { start: at(11, 30), end: at(12, 30) }, durationMin: 60, type: 'sermon' }],
    ['12:45 to 1:15 Announcements', { time: { start: at(12, 45), end: at(13, 15) }, durationMin: 30 }],
    ['0900hrs Arrival', { time: { start: at(9) }, type: 'pre-service' }],
    ['6:30 PM | Message | Rev. Okon', { time: { start: at(18, 30) }, title: 'Message', person: 'Rev. Okon' }],
    ['Message by Pastor (Mrs) Ade', { title: 'Message', type: 'sermon', person: 'Pastor (Mrs) Ade' }],
    ['Worship led by the Worship Team', { title: 'Worship', type: 'worship', person: 'the Worship Team' }],
    ['Sermon (35 mins)', { title: 'Sermon', durationMin: 35 }],
    ['Sermon 1hr 15mins', { title: 'Sermon', durationMin: 75 }],
    ['Opening Prayer 9:00', { time: { start: at(9) }, title: 'Opening Prayer', type: 'welcome' }],
    // a sermon TITLE is not a person
    ['Sermon: The Power of Faith', { title: 'Sermon: The Power of Faith', type: 'sermon' }],
    // a verse is not a time
    ['Bible Reading: John 3:16-18', { type: 'custom', wouldBe: 'reading' }],
    ['10:05 Bible Reading — Psalm 23:1', { time: { start: at(10, 5) }, type: 'custom' }]
  ]

  it.each(cases)('%s', (line, want) => {
    expect(one(line)).toMatchObject(want)
  })

  it('does not mistake a sermon title for a person, or a verse for a time', () => {
    expect(one('Sermon: The Power of Faith').person).toBeUndefined()
    expect(one('Bible Reading: John 3:16-18').time).toBeUndefined()
  })

  it('reads OCR-mangled digits in times and durations', () => {
    expect(one('1O:3O Serm0n')).toMatchObject({ time: { start: at(10, 30) }, type: 'sermon' })
    expect(one('l0:15 0ffering')).toMatchObject({ time: { start: at(10, 15) }, type: 'offering' })
    expect(one('Offering 1O mins')).toMatchObject({ durationMin: 10, type: 'offering' })
  })
})

describe('unknown rows are kept', () => {
  it('keeps a row it cannot name, with its time, as type null', () => {
    expect(one('9:40 – Hour of Visitation')).toMatchObject({
      raw: '9:40 – Hour of Visitation',
      time: { start: at(9, 40) },
      title: 'Hour of Visitation',
      type: null,
      confidence: 0
    })
  })

  it('never returns fewer rows than there are row-shaped lines', () => {
    const rows = parseOrderOfService(['9:00 Doxa', '9:10 Praise', '9:30 Zoe Moment', '9:40 Word'].join('\n'))
    expect(rows.map((r) => r.type)).toEqual([null, 'worship', null, 'sermon'])
  })

  it('drops only headings and column headers', () => {
    const rows = parseOrderOfService(
      ['ORDER OF SERVICE', 'TIME   ACTIVITY   MINISTER', '---', '2', '9:00 Opening Prayer', 'Grace Assembly, Ikeja'].join('\n')
    )
    expect(rows.map((r) => r.title)).toEqual(['Opening Prayer', 'Grace Assembly, Ikeja'])
    expect(rows[1].type).toBeNull()
  })
})

describe('durations from the clock', () => {
  it('derives a duration from the next start when none is printed', () => {
    const rows = parseOrderOfService(
      ['9:00 – Opening Prayer', '9:05 – Praise and Worship', '9:30 – Preaching', '10:15 – Altar Call'].join('\n')
    )
    expect(rows.map((r) => r.durationMin)).toEqual([5, 25, 45, undefined])
    expect(rows.map((r) => r.durationDerived)).toEqual([true, true, true, undefined])
  })

  it('prefers a printed duration over a derived one', () => {
    const rows = parseOrderOfService(['9:00 Worship (20 mins)', '9:30 Sermon'].join('\n'))
    expect(rows[0]).toMatchObject({ durationMin: 20 })
    expect(rows[0].durationDerived).toBeUndefined()
  })

  it('skips untimed rows when looking for the next start', () => {
    const rows = parseOrderOfService(['9:00 Worship', 'Special Number', '9:30 Sermon'].join('\n'))
    expect(rows[0].durationMin).toBe(30)
    expect(rows[1].durationMin).toBeUndefined()
  })

  it('does not call the gap between two services a segment', () => {
    const rows = parseOrderOfService(['7:00 Benediction', '11:00 Opening Prayer'].join('\n'))
    expect(rows[0].durationMin).toBeUndefined()
  })
})

describe('am and pm nobody printed', () => {
  it('carries a morning service past noon', () => {
    const rows = parseOrderOfService(['11:30 Sermon', '12:15 Offering', '1:00 Benediction'].join('\n'))
    expect(rows.map((r) => r.time?.start)).toEqual([at(11, 30), at(12, 15), at(13)])
  })

  it('reads an unmarked 5:00 start as an evening service', () => {
    const rows = parseOrderOfService(['5:00 Praise', '5:30 Word', '6:30 Closing'].join('\n'))
    expect(rows.map((r) => r.time?.start)).toEqual([at(17), at(17, 30), at(18, 30)])
  })

  it('believes a printed am', () => {
    expect(one('5:30am Workers Prayer').time).toEqual({ start: at(5, 30) })
  })
})

describe('tables flattened by OCR', () => {
  it('interleaved: time line, then title line', () => {
    const rows = parseOrderOfService(['9:00', 'Opening Prayer', '9:10', 'Praise & Worship', '9:40', 'The Word'].join('\n'))
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => [r.time?.start, r.type])).toEqual([
      [at(9), 'welcome'],
      [at(9, 10), 'worship'],
      [at(9, 40), 'sermon']
    ])
    expect(rows[0].durationMin).toBe(10)
  })

  it('column by column: all the times, then all the titles', () => {
    const rows = parseOrderOfService(
      ['PROGRAMME', '9:00am', '9:15am', '9:45am', 'Opening Prayer', 'High Praise', 'Ministration'].join('\n')
    )
    expect(rows.map((r) => [r.time?.start, r.type])).toEqual([
      [at(9), 'welcome'],
      [at(9, 15), 'worship'],
      [at(9, 45), 'sermon']
    ])
  })

  it('title above its time', () => {
    const rows = parseOrderOfService(['Opening Prayer', '9:00', 'Praise', '9:10', 'Sermon', '9:40'].join('\n'))
    expect(rows.map((r) => [r.title, r.time?.start])).toEqual([
      ['Opening Prayer', at(9)],
      ['Praise', at(9, 10)],
      ['Sermon', at(9, 40)]
    ])
  })

  it('a duration on its own line belongs to the row above', () => {
    const rows = parseOrderOfService(['Tithes and Offering', '10 mins', 'Announcements', '5 mins'].join('\n'))
    expect(rows.map((r) => [r.type, r.durationMin])).toEqual([
      ['offering', 10],
      ['announcements', 5]
    ])
  })

  it('pipes and tabs from a ruled table', () => {
    const rows = parseOrderOfService('| 9:00 | Opening Prayer | Dcn. Tunde |\n| 9:05 |\tPraise & Worship\t| Choir |')
    expect(rows[0]).toMatchObject({ time: { start: at(9) }, title: 'Opening Prayer', type: 'welcome', person: 'Dcn. Tunde' })
    expect(rows[1]).toMatchObject({ title: 'Praise & Worship', type: 'worship', person: 'Choir' })
  })
})

describe('whole bulletins', () => {
  it('an RCCG-style numbered order with no times', () => {
    const text = `ORDER OF SERVICE FOR SUNDAY SERVICE
1. Prayer
2. Praise
3. Pastoral Prayer
4. Welcome of guest
5. Congregational Hymn
6. Special Number
7. The Word
8. Altar Call
9. Tithes & Offering
10. Announcements
11. Prayer for Children/Pregnant Women
12. Benediction`
    const rows = parseOrderOfService(text)
    expect(rows.map((r) => r.type)).toEqual([
      'prayer', 'worship', 'prayer', 'welcome', 'worship', 'worship',
      'sermon', 'altar-call', 'offering', 'announcements', 'prayer', 'closing'
    ])
  })

  it('a messy Nigerian Pentecostal scan', () => {
    const text = `  GLORY TABERNACLE
SUNDAY SERVlCE PROGRAMME
TIME          ACTIVITY                 MINISTER
8:OOam - 8:3Oam   Workers Meeting
8.30am-8.40am     0pening Prayer          Dcn. Tunde
8.40am-9.10am     Praise&Worship          (Choir)
9.10am-9.25am     Testimony Time
9.25am-9.35am     Special Number ....... Teens Choir
9.35am-10.35am    MINISTRATION — Pastor B. Ade
10.35am-10.45am   A1tar Call
10.45am-11.00am   Tithes, Offering & First Fruit
11.00am           Announcements / Sharing the Grace`
    const rows = parseOrderOfService(text)
    const table = rows.filter((r) => r.time)
    expect(table.map((r) => r.type)).toEqual([
      'pre-service', 'welcome', 'worship', 'custom', 'worship', 'sermon', 'altar-call', 'offering', 'closing'
    ])
    expect(table.map((r) => r.time!.start)).toEqual([
      at(8), at(8, 30), at(8, 40), at(9, 10), at(9, 25), at(9, 35), at(10, 35), at(10, 45), at(11)
    ])
    expect(table.map((r) => r.durationMin)).toEqual([30, 10, 30, 15, 10, 60, 10, 15, undefined])
    expect(table[1].person).toBe('Dcn. Tunde')
    expect(table[2].person).toBe('Choir')
    expect(table[5].person).toBe('Pastor B. Ade')
    // the church name is not a segment, and is not thrown away either
    expect(rows[0]).toMatchObject({ title: 'GLORY TABERNACLE', type: null })
  })

  it('an Anglican order', () => {
    const text = `Processional Hymn 245
The Collect
First Lesson: Isaiah 40:1-11
Psalm 23
Gospel: John 1:1-14
Sermon — Ven. Dr. Okafor
The Creed
Intercessions
Offertory Hymn
Holy Communion
Notices and Banns
The Grace
Recessional Hymn`
    expect(parseOrderOfService(text).map((r) => r.type)).toEqual([
      'worship', 'prayer', 'custom', 'worship', 'custom', 'sermon', 'custom',
      'prayer', 'offering', 'communion', 'announcements', 'closing', 'worship'
    ])
  })

  it('an American run sheet', () => {
    const text = `10:00 Countdown Video
10:05 Worship Set (3 songs)
10:25 Welcome & Announcements - Host
10:30 Giving
10:33 Message: Anchored, week 2 - Pastor Mike
11:08 Response
11:13 Closing`
    const rows = parseOrderOfService(text)
    expect(rows.map((r) => r.type)).toEqual([
      'pre-service', 'worship', 'announcements', 'offering', 'sermon', 'altar-call', 'closing'
    ])
    expect(rows.map((r) => r.durationMin)).toEqual([5, 20, 5, 3, 35, 5, undefined])
    expect(rows[4].person).toBe('Pastor Mike')
  })

  it('returns nothing for nothing', () => {
    expect(parseOrderOfService('')).toEqual([])
    expect(parseOrderOfService('\n \n')).toEqual([])
  })
})

describe('handing rows to the engine', () => {
  it('formats a clock the way ScheduleEntry.time carries it', () => {
    expect(formatClock(at(9, 5))).toBe('9:05 AM')
    expect(formatClock(at(12))).toBe('12:00 PM')
    expect(formatClock(at(13, 30))).toBe('1:30 PM')
    expect(formatClock(0)).toBe('12:00 AM')
  })

  it('keeps unknown rows as custom under the church’s own words', () => {
    const entries = rowsToSchedule(parseOrderOfService('9:00 Hour of Visitation\n9:20 Preaching — Pastor Dan'))
    expect(entries).toEqual([
      { type: 'custom', title: 'Hour of Visitation', time: '9:00 AM', notes: '20 min' },
      { type: 'sermon', title: 'Preaching', time: '9:20 AM', notes: 'Pastor Dan' }
    ])
  })
})
