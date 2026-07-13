/**
 * Seasonal awareness — deterministic, zero AI.
 *
 * The liturgical calendar is math: Easter via the computus, Advent counts
 * back from Christmas, everything else is a fixed date or an offset.
 * Seasons contribute (a) a display theme id the renderer may use and
 * (b) detection priors — verses a preacher is far more likely to reference
 * in that season get a small confidence boost.
 */

export type Season =
  | 'ordinary'
  | 'advent'
  | 'christmas'
  | 'epiphany'
  | 'lent'
  | 'holy-week'
  | 'easter'
  | 'pentecost'
  | 'thanksgiving'

/** Anonymous Gregorian computus — Easter Sunday for a given year. */
export function easterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

/** 4th Sunday before Christmas. */
export function adventStart(year: number): Date {
  const christmas = new Date(year, 11, 25)
  const dow = christmas.getDay() // 0 = Sunday
  const sundayBefore = addDays(christmas, dow === 0 ? -7 : -dow)
  return addDays(sundayBefore, -21)
}

/** 4th Thursday of November (US). */
export function thanksgivingDate(year: number): Date {
  const nov1 = new Date(year, 10, 1)
  const firstThursday = 1 + ((4 - nov1.getDay() + 7) % 7)
  return new Date(year, 10, firstThursday + 21)
}

export function getSeason(date: Date): Season {
  const y = date.getFullYear()
  const t = date.getTime()
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

  const easter = easterDate(y)
  const ashWednesday = addDays(easter, -46)
  const palmSunday = addDays(easter, -7)
  const pentecost = addDays(easter, 49)

  if (t >= day(new Date(y, 11, 25)) && t <= day(new Date(y, 11, 31))) return 'christmas'
  if (t >= day(new Date(y, 0, 1)) && t <= day(new Date(y, 0, 6))) return 'christmas'
  if (t >= day(adventStart(y)) && t < day(new Date(y, 11, 25))) return 'advent'
  if (t >= day(new Date(y, 0, 7)) && t <= day(addDays(new Date(y, 0, 6), 14))) return 'epiphany'
  if (t >= day(palmSunday) && t < day(easter)) return 'holy-week'
  if (t >= day(ashWednesday) && t < day(palmSunday)) return 'lent'
  if (t >= day(easter) && t < day(addDays(easter, 49))) return 'easter'
  if (t >= day(pentecost) && t <= day(addDays(pentecost, 7))) return 'pentecost'
  const tg = thanksgivingDate(y)
  if (t >= day(addDays(tg, -3)) && t <= day(addDays(tg, 3))) return 'thanksgiving'
  return 'ordinary'
}

/** Verse references (bare "Book Chapter" granularity) boosted per season. */
const SEASONAL_CHAPTERS: Record<Season, string[]> = {
  ordinary: [],
  advent: ['Isaiah 9', 'Isaiah 7', 'Micah 5', 'Luke 1', 'Matthew 1', 'Isaiah 40'],
  christmas: ['Luke 2', 'Matthew 2', 'John 1', 'Isaiah 9', 'Galatians 4'],
  epiphany: ['Matthew 2', 'Isaiah 60', 'John 2'],
  lent: ['Joel 2', 'Psalms 51', 'Matthew 4', 'Isaiah 58', 'Jonah 3'],
  'holy-week': ['Matthew 21', 'Matthew 26', 'Matthew 27', 'John 12', 'John 13', 'John 19', 'Isaiah 53', 'Psalms 22'],
  easter: ['Matthew 28', 'Mark 16', 'Luke 24', 'John 20', 'John 21', '1 Corinthians 15', 'Romans 6'],
  pentecost: ['Acts 2', 'Joel 2', 'John 14', '1 Corinthians 12'],
  thanksgiving: ['Psalms 100', 'Psalms 136', '1 Thessalonians 5', 'Philippians 4', 'Luke 17']
}

/** Multiplier applied to detection confidence for in-season chapters. */
export function seasonalBoost(book: string, chapter: number | null, date: Date): number {
  if (chapter === null) return 1
  const season = getSeason(date)
  if (season === 'ordinary') return 1
  const key = `${book} ${chapter}`
  return SEASONAL_CHAPTERS[season].includes(key) ? 1.1 : 1
}

/** Theme id the renderer/output can adopt ("the system feels alive"). */
export function seasonalThemeId(date: Date): Season {
  return getSeason(date)
}
