/**
 * Turning a photographed (or pasted) order of service into rows.
 *
 * The first importer asked one question of each line — "does it contain a
 * word I know?" — and threw away everything else: the line if the answer was
 * no, and the clock time, the duration and the minister's name even when it
 * was yes. But a church programme is not prose to be keyword-searched. It is
 * a TABLE, and nearly always the same table:
 *
 *     9:00 – Opening Prayer
 *     09.00am-09.10am   Praise & Worship   (Choir)
 *     10:15 Sermon — Pastor Dan
 *     Offering ........ 10 mins
 *     3. Announcements
 *
 * a time, a name for the moment, and sometimes who leads it or how long it
 * runs. So this module reads the SHAPE first — peel off the time, the
 * duration, the numbering, the person — and only then asks serviceAliases
 * what the remaining words mean. Two consequences the owner asked for:
 *
 *   - a row is a row because it is shaped like one, not because the app
 *     recognises its name. "9:40 – Hour of Visitation" is kept, with its
 *     time, as type null, and the operator picks the type. Nothing is ever
 *     dropped except lines that cannot be rows at all (the "ORDER OF
 *     SERVICE" heading, a "TIME | ACTIVITY | MINISTER" column header).
 *   - times carry information even when durations are not printed: the gap
 *     between one start and the next IS the duration, so the timers can be
 *     set from a bulletin that never mentions minutes.
 *
 * OCR does not return the table it saw. Columns come back as separate lines
 * (all the times, then all the titles), or interleaved (time, title, time,
 * title), digits come back as letters ("1O:3O"), and spaces go missing. Each
 * of those gets a named step below rather than a cleverer regex.
 *
 * Pure text in, plain objects out; the only import is the sibling alias
 * table, which itself imports nothing — so main process, renderer and tests
 * all run the same code.
 */

import { matchSegment } from './serviceAliases'

export interface ParsedTime {
  /** Minutes from midnight. */
  start: number
  end?: number
}

export interface ParsedRow {
  /** The source line(s), untouched — shown to the operator beside the guess. */
  raw: string
  time?: ParsedTime
  /** Printed ("10 mins"), or the span of a printed range, or derived from
      the next row's start. `durationDerived` says which. */
  durationMin?: number
  durationDerived?: boolean
  /** What the church called it, cleaned of time, numbering and person. */
  title: string
  /** A segment type id, or null when the name is not one we know. */
  type: string | null
  confidence: number
  /** The alias that matched, for "matched as …" in the UI. */
  alias?: string
  /** For 'custom' matches: the type this would be if the app had one. */
  wouldBe?: string
  person?: string
}

/* ------------------------------------------------------------------ */
/* Step 1 — clock times                                                */
/* ------------------------------------------------------------------ */

interface RawTime {
  h: number
  m: number
  mer: 'am' | 'pm' | null
}

/* OCR reads 0 as O and 1 as l/I inside times as readily as inside words. */
const D = '0-9OoIl'
const MILITARY = new RegExp(`(?<![\\w:.])([${D}]{4})\\s?(?:hrs?|hours|h)\\b\\.?`, 'g')
const CLOCK = new RegExp(
  `(?<![\\w:.])([${D}]{1,2})\\s?[:.;]\\s?([${D}]{2})(?![0-9])(?:\\s*([aApP])\\.?\\s?[mM]\\b\\.?|\\s?(?:hrs?|HRS?)\\b\\.?)?`,
  'g',
)
const HOUR_ONLY = /(?<![\w:.])(1[0-2]|0?[1-9])\s?([aApP])\.?\s?[mM]\b\.?/g

/*
 * "Bible Reading: John 3:16" must not schedule anything for sixteen minutes
 * past three. A clock-shaped thing straight after a book of the Bible is a
 * verse — unless it has am/pm, or opens the line, where a time belongs.
 */
const BOOK = new RegExp(
  '^(?:gen|exod?|lev|num|deut|josh|judg|ruth|sam|kings?|kgs|chron|chr|ezra|neh|esth?|job|ps|psa|psalms?|prov|eccl|' +
    'song|isa|jer|lam|ezek|dan|hos|joel|amos|obad|jonah|mic|nah|hab|zeph|hag|zech|mal|matt?|mk|mark|lk|luke|jn|' +
    'john|acts|rom|cor|gal|eph|phil|col|thess|tim|titus|philem|heb|jas|james|pet|peter|jude|rev)[a-z]*$',
  'i',
)

function digits(s: string): number | null {
  if (!/[0-9]/.test(s)) return null // "lo" is a word, not ten
  return Number(s.replace(/[Oo]/g, '0').replace(/[Il]/g, '1'))
}

const MARK = '\u0001'

/** Replace every time in the line with a numbered marker; return both. */
function liftTimes(line: string): { text: string; times: RawTime[] } {
  const times: RawTime[] = []
  const put = (t: RawTime) => `${MARK}${times.push(t) - 1}${MARK}`

  let text = line.replace(MILITARY, (whole, hhmm: string) => {
    const n = digits(hhmm)
    if (n === null) return whole
    const h = Math.floor(n / 100)
    const m = n % 100
    return h < 24 && m < 60 ? put({ h, m, mer: null }) : whole
  })

  text = text.replace(CLOCK, (whole, hh: string, mm: string, mer: string | undefined, offset: number, src: string) => {
    /* One real digit between them is enough: "8:OO" is eight o'clock. */
    if (!/[0-9]/.test(hh + mm)) return whole
    const h = digits(`0${hh}`) as number
    const m = digits(`0${mm}`) as number
    if (h > 23 || m > 59) return whole
    if (!mer && offset > 0) {
      const before = /([A-Za-z]+)\.?\s*$/.exec(src.slice(0, offset))
      if (before && BOOK.test(before[1])) return whole
    }
    return put({ h, m, mer: mer ? (mer.toLowerCase() === 'a' ? 'am' : 'pm') : null })
  })

  text = text.replace(HOUR_ONLY, (_whole, hh: string, mer: string) =>
    put({ h: Number(hh), m: 0, mer: mer.toLowerCase() === 'a' ? 'am' : 'pm' }),
  )
  return { text, times }
}

function to24(t: RawTime, mer: 'am' | 'pm' | null = t.mer): number {
  let h = t.h
  if (mer === 'pm' && h < 12) h += 12
  if (mer === 'am' && h === 12) h = 0
  return h * 60 + t.m
}

const RANGE_GAP = /^\s*(?:-|–|—|~|_|to|till|til|until|\s)*\s*$/i

/**
 * One or two markers -> a start and maybe an end. Two times are a RANGE only
 * when nothing but a dash or "to" sits between them; "9:00 Service one,
 * 11:00 Service two" is two facts and only the first is this row's start.
 *
 * In "9:00 – 9:10am" the am belongs to both. In "11:30 – 12:30pm" it does
 * not — copying it would start the row at 23:30 — so the borrowed meridiem
 * is kept only if it leaves the start before the end.
 */
function readTimes(text: string, lifted: RawTime[]): { time?: ParsedTime; explicitMeridiem: boolean } {
  if (lifted.length === 0) return { explicitMeridiem: false }
  /* Markers are numbered in the order the three patterns ran, which is not
     the order they sit in the line ("9am – 10:30am"); position decides. */
  const placed = lifted
    .map((t, n) => ({ t, at: text.indexOf(`${MARK}${n}${MARK}`), len: String(n).length + 2 }))
    .sort((x, y) => x.at - y.at)
  const first = placed[0].t
  let second: RawTime | null = null
  if (placed.length > 1) {
    const gap = text.slice(placed[0].at + placed[0].len, placed[1].at)
    if (RANGE_GAP.test(gap)) second = placed[1].t
  }
  if (!second) return { time: { start: to24(first) }, explicitMeridiem: first.mer !== null }

  const end = to24(second)
  let start = to24(first)
  if (first.mer === null && second.mer !== null) {
    const borrowed = to24(first, second.mer)
    const flipped = to24(first, second.mer === 'am' ? 'pm' : 'am')
    start = borrowed <= end ? borrowed : flipped <= end ? flipped : start
  }
  return { time: { start, end }, explicitMeridiem: first.mer !== null || second.mer !== null }
}

/* ------------------------------------------------------------------ */
/* Step 2 — durations                                                  */
/* ------------------------------------------------------------------ */

const HOURS = /\(?\b(\d+(?:\.\d+)?)\s?(?:hours?|hrs?|h)\b\.?(?:\s*(?:and|&)?\s*(\d{1,2})\s?(?:minutes?|mins?|m)\b\.?)?\)?/i
const MINUTES = /\(?(?<![\w.])([0-9OoIl]{1,3})\s?(?:minutes?|mins?|min|m|['′])(?![a-z])\.?\)?/i

function liftDuration(text: string): { text: string; durationMin?: number } {
  const hours = HOURS.exec(text)
  if (hours) {
    const total = Math.round(Number(hours[1]) * 60) + (hours[2] ? Number(hours[2]) : 0)
    if (total > 0) return { text: text.replace(hours[0], ' '), durationMin: total }
  }
  const mins = MINUTES.exec(text)
  if (mins) {
    const n = digits(mins[1])
    if (n !== null && n > 0) return { text: text.replace(mins[0], ' '), durationMin: n }
  }
  return { text }
}

/* ------------------------------------------------------------------ */
/* Step 3 — what is left is the title, and maybe a person              */
/* ------------------------------------------------------------------ */

const HONORIFIC =
  /^(?:pastor|pst|ps|pr|rev|revd|reverend|rt|very|ven|venerable|canon|bishop|archbishop|apostle|prophet|prophetess|evangelist|evang|evg|elder|eld|deacon|deaconess|dcn|dcns|dn|bro|brother|sis|sister|min|minister|dr|prof|mr|mrs|ms|miss|fr|father|mummy|daddy|mama|papa|gen|chief|sir|lady|hon|engr|barr)\b\.?/i

/** Groups that lead things without having a title of their own. */
const GROUP = /\b(?:choir|team|band|ministers?|ushers?|protocol|mc|moderator|host|teens|youths?|children|voices|singers|elders|pastorate|guest)\b/i

function cleanTitle(text: string): string {
  return text
    .replace(new RegExp(`${MARK}\\d+${MARK}`, 'g'), ' ')
    .replace(/[|\t]/g, '  ')
    .replace(/\.{2,}|…+|_{2,}|-{3,}|·{2,}/g, '  ') // dot leaders
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/^\s*(?:[-–—•*▪●○◦>]+|\(?[ivxIVX]{1,4}[.)]|\(?[a-zA-Z][.)])\s+/, '')
    .replace(/^\s*\(?\d{1,2}[.)]\s*(?=[A-Za-z])/, '') // "3." "iv)" "a." "•"
    .replace(/^[\s\-–—:;,.|]+|[\s\-–—:;,|]+$/g, '')
    .replace(/[  ]{3,}/g, '  ')
    .trim()
}

/**
 * Split "Sermon — Pastor Dan" / "Praise & Worship (Choir)" / "Message by Rev.
 * Okon" into a title and a person.
 *
 * Strict on purpose. "Sermon: The Power of Faith" has the same shape as
 * "Sermon: Pastor Dan", and guessing that a sermon TITLE is a PERSON is a
 * worse error than leaving a name in the label. So a tail is a person only
 * when it says so: it is in brackets, it follows "by", or it opens with an
 * honorific or names a group (choir, worship team, ushers).
 */
function splitPerson(title: string): { title: string; person?: string } {
  const paren = /^(.*?)[\s]*[([]([^()[\]]+)[)\]]\s*$/.exec(title)
  if (paren && paren[1].trim() && (matchSegment(paren[1]) || !matchSegment(paren[2]))) {
    return { title: tidy(paren[1]), person: tidy(paren[2]) }
  }
  const by = /^(.+?)\s+(?:by|with|led by|anchored by|taken by)\s*[:\-–—]?\s+(.+)$/i.exec(title)
  if (by && (HONORIFIC.test(by[2]) || GROUP.test(by[2]) || /^[A-Z]/.test(by[2]))) {
    return { title: tidy(by[1]), person: tidy(by[2]) }
  }
  const parts = title.split(/\s+[-–—:]\s+|\s*[–—]\s*|:\s+|\s{2,}/)
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1].trim()
    const head = title.slice(0, title.lastIndexOf(tail)).trim()
    const named = HONORIFIC.test(tail) && !/\d/.test(tail)
    if (tail && head && (named || (GROUP.test(tail) && matchSegment(head)))) {
      return { title: tidy(head), person: tidy(tail) }
    }
  }
  return { title: tidy(title) }
}

function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/^[\s\-–—:;,.]+|[\s\-–—:;,]+$/g, '').trim()
}

/* ------------------------------------------------------------------ */
/* Step 4 — lines that cannot be rows                                  */
/* ------------------------------------------------------------------ */

const COLUMN_WORDS = new Set([
  'time', 'times', 'activity', 'activities', 'programme', 'program', 'item', 'items', 'event', 'events',
  'minister', 'ministers', 'officiant', 'officiating', 'anchor', 'duration', 'sn', 's', 'n', 'no', 'remark',
  'remarks', 'by', 'person', 'responsible', 'handler', 'segment', 'details', 'description', 'period', 'who',
  'what', 'when', 'lead', 'leader', 'mins', 'minutes',
])

const HEADING =
  /^(?:the )?(?:(?:order|run|programme|program|schedule|outline|flow|order of) of (?:service|worship|events?|programme|program|the day)|run sheet|run ?down|service (?:schedule|rundown|run ?down|outline|flow|programme|program)|(?:sunday |service )?(?:programme|program|schedule|agenda|timetable))(?: for .*)?$/

function isFurniture(text: string): boolean {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return true // page numbers, rules, stray punctuation
  if (HEADING.test(words.join(' '))) return true
  return words.length >= 2 && words.every((w) => COLUMN_WORDS.has(w))
}

/* ------------------------------------------------------------------ */
/* Step 5 — putting the table back together                            */
/* ------------------------------------------------------------------ */

interface Piece {
  raw: string
  time?: ParsedTime
  explicitMeridiem: boolean
  durationMin?: number
  text: string
}

function readLine(raw: string): Piece {
  const lifted = liftTimes(raw)
  const { time, explicitMeridiem } = readTimes(lifted.text, lifted.times)
  const dur = liftDuration(lifted.text)
  return { raw, time, explicitMeridiem, durationMin: dur.durationMin, text: cleanTitle(dur.text) }
}

const hasWords = (p: Piece) => /[A-Za-z]{2}/.test(p.text)

/**
 * OCR reads a two-column table in one of three ways, and only one of them
 * is already rows. The other two:
 *
 *   interleaved            column by column
 *     9:00                   9:00
 *     Opening Prayer         9:10
 *     9:10                   Opening Prayer
 *     Praise                 Praise
 *
 * Both are runs of time-only lines beside runs of word-only lines, so a run
 * of k bare times is zipped with the k word-only lines that follow it (k=1
 * is the interleaved case). Some scanners emit the title ABOVE its time; the
 * tell is that the document then ENDS on a bare time, which a time-first
 * layout never does, and the zip runs backwards instead.
 */
function stitch(pieces: Piece[]): Piece[] {
  const bareTime = (p: Piece) => !!p.time && !hasWords(p)
  const bareWords = (p: Piece) => !p.time && hasWords(p)
  const content = pieces.filter((p) => p.time || hasWords(p))
  const timeAfter = content.length > 1 && bareTime(content[content.length - 1])

  const out: Piece[] = []
  let i = 0
  while (i < pieces.length) {
    const p = pieces[i]

    /* A lone "10 mins" under a row belongs to that row. */
    if (!p.time && !hasWords(p) && p.durationMin !== undefined) {
      const prev = out[out.length - 1]
      if (prev && prev.durationMin === undefined) {
        prev.durationMin = p.durationMin
        prev.raw += `\n${p.raw}`
        i += 1
        continue
      }
    }

    if (!bareTime(p)) {
      out.push(p)
      i += 1
      continue
    }

    let k = 1
    while (i + k < pieces.length && bareTime(pieces[i + k])) k += 1

    if (timeAfter) {
      /* The k word-only rows already emitted just above are this run's titles. */
      const titles = out.slice(-k)
      if (titles.length === k && titles.every(bareWords)) {
        titles.forEach((t, n) => merge(t, pieces[i + n]))
        i += k
        continue
      }
    } else {
      const titles = pieces.slice(i + k, i + 2 * k)
      if (titles.length === k && titles.every(bareWords)) {
        for (let n = 0; n < k; n += 1) out.push(merge({ ...titles[n] }, pieces[i + n]))
        i += 2 * k
        continue
      }
    }

    /* A time with nothing to attach to is still kept — never dropped. */
    for (let n = 0; n < k; n += 1) out.push(pieces[i + n])
    i += k
  }
  return out
}

function merge(words: Piece, time: Piece): Piece {
  words.time = time.time
  words.explicitMeridiem = time.explicitMeridiem
  if (words.durationMin === undefined) words.durationMin = time.durationMin
  words.raw = `${time.raw}\n${words.raw}`
  return words
}

/* ------------------------------------------------------------------ */
/* Step 6 — am or pm, and the gaps between rows                        */
/* ------------------------------------------------------------------ */

const NOON = 12 * 60
/** No single segment is longer than this; a bigger gap is a second service. */
const MAX_DERIVED = 180

/**
 * Bulletins rarely print am/pm. Two rules recover it:
 *   - a service that "starts" between 1:00 and 5:59 is an afternoon or
 *     evening service — nobody prints a 2am order of service.
 *   - time only moves forward. "11:30, 12:00, 1:00" is one o'clock in the
 *     afternoon, because the row before it was noon.
 */
function settleMeridiem(pieces: Piece[]): void {
  let prev: number | null = null
  for (const p of pieces) {
    if (!p.time) continue
    if (!p.explicitMeridiem) {
      const shift =
        prev === null ? p.time.start >= 60 && p.time.start < 360 : p.time.start < prev && p.time.start < NOON
      if (shift) {
        p.time.start += NOON
        if (p.time.end !== undefined && p.time.end < NOON) p.time.end += NOON
      }
    }
    if (p.time.end !== undefined && p.time.end < p.time.start && p.time.end < NOON) p.time.end += NOON
    if (p.time.end !== undefined && p.time.end <= p.time.start) delete p.time.end
    prev = p.time.start
  }
}

/**
 * Read an order of service.
 *
 * Every line that could be a row comes back as one, in document order, typed
 * where the name is known and `type: null` where it is not.
 */
export function parseOrderOfService(ocrText: string): ParsedRow[] {
  const pieces = ocrText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(readLine)
    .filter((p) => p.time || p.durationMin !== undefined || !isFurniture(p.text))

  const stitched = stitch(pieces)
  settleMeridiem(stitched)

  const rows: ParsedRow[] = stitched.map((p) => {
    const { title, person } = splitPerson(p.text)
    /*
     * "Gospel: John 1:1-14" — a weak word will not match with strangers
     * beside it (see serviceAliases), but before a colon or dash it is the
     * row's label and what follows is its detail, so the label is asked alone.
     */
    const label = title.split(/\s*[:–—]\s*|\s+-\s+/)[0]
    const match = title ? (matchSegment(title) ?? (label !== title ? matchSegment(label) : null)) : null
    const row: ParsedRow = {
      raw: p.raw,
      title: title || tidy(p.raw),
      type: match ? match.type : null,
      confidence: match ? match.confidence : 0,
    }
    if (p.time) row.time = p.time
    if (match) row.alias = match.alias
    if (match?.wouldBe) row.wouldBe = match.wouldBe
    if (person) row.person = person
    if (p.durationMin !== undefined) row.durationMin = p.durationMin
    else if (p.time?.end !== undefined) row.durationMin = p.time.end - p.time.start
    return row
  })

  /* The gap to the next start is this row's length — see the header. */
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (row.durationMin !== undefined || !row.time) continue
    const next = rows.slice(i + 1).find((r) => r.time)
    if (!next?.time) continue
    const gap = next.time.start - row.time.start
    if (gap > 0 && gap <= MAX_DERIVED) {
      row.durationMin = gap
      row.durationDerived = true
    }
  }
  return rows
}

/** 570 -> "9:30 AM" — the form ScheduleEntry.time already carries. */
export function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

/**
 * Rows -> the `{ type, title, time, notes }` shape `set-service-schedule`
 * takes. Unknown rows go in as 'custom' under the church's own title, so the
 * engine sees the whole service and the operator sees their own words.
 */
export function rowsToSchedule(
  rows: ParsedRow[],
): { type: string; title: string; time?: string; notes?: string }[] {
  return rows.map((r) => {
    const notes = [r.person, r.durationMin !== undefined ? `${r.durationMin} min` : ''].filter(Boolean).join(' · ')
    return {
      type: r.type ?? 'custom',
      title: r.title,
      ...(r.time ? { time: formatClock(r.time.start) } : {}),
      ...(notes ? { notes } : {}),
    }
  })
}
