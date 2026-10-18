import type { PreacherStats, ReviewItem } from './types'

export interface BookAlias {
  heard: string
  means: string
  /** `learned` came out of voice training; `taught` a person typed in. */
  source: 'learned' | 'taught'
  hits: number
}

export interface PreacherTeaching {
  soundsLike: BookAlias[]
  vocabulary: string[]
  ignoreTails: string[]
  voiceCommands: boolean
}

export interface PreacherLearningDetail extends PreacherTeaching {
  stats: PreacherStats
  gates: { trust: number; samples: number; services: number }
  reviews: ReviewItem[]
  history: { label: string; trust: number; precision: number }[]
  legacySamples: number
  serviceOpen: boolean
  habits: { avgSermonMin: number | null; mostQuoted: string | null; topBooks: string[]; lastPreached: string | null }
  recent: { date: string; verses: number; accuracy: number | null; minutes: number }[]
  training: TrainingSummary
  books: Record<string, BookStanding>
}

/* ------------------------------------------------------------------ */
/* The shelf                                                           */
/* ------------------------------------------------------------------ */

/**
 * All 66 books, in canonical order, with what voice training needs to know
 * about each: the shelf label, its length (the spine's height), and one
 * well-known verse to read aloud.
 *
 * The verse is a famous one on purpose. A preacher reading "Philippians
 * 4:13" says it the way they say it from the pulpit; an obscure verse gets
 * read like a phone number.
 */
export interface ShelfBook {
  book: string
  short: string
  chapters: number
  testament: 'old' | 'new'
  chapter: number
  verse: number
}

const B = (book: string, short: string, chapters: number, testament: 'old' | 'new', chapter: number, verse: number): ShelfBook =>
  ({ book, short, chapters, testament, chapter, verse })

export const BIBLE_SHELF: readonly ShelfBook[] = [
  B('Genesis', 'Gen', 50, 'old', 1, 1), B('Exodus', 'Exod', 40, 'old', 14, 14), B('Leviticus', 'Lev', 27, 'old', 19, 18),
  B('Numbers', 'Num', 36, 'old', 6, 24), B('Deuteronomy', 'Deut', 34, 'old', 31, 6), B('Joshua', 'Josh', 24, 'old', 1, 9),
  B('Judges', 'Judg', 21, 'old', 6, 12), B('Ruth', 'Ruth', 4, 'old', 1, 16), B('1 Samuel', '1 Sam', 31, 'old', 16, 7),
  B('2 Samuel', '2 Sam', 24, 'old', 22, 31), B('1 Kings', '1 Kgs', 22, 'old', 19, 12), B('2 Kings', '2 Kgs', 25, 'old', 6, 17),
  B('1 Chronicles', '1 Chr', 29, 'old', 4, 10), B('2 Chronicles', '2 Chr', 36, 'old', 7, 14), B('Ezra', 'Ezra', 10, 'old', 7, 10),
  B('Nehemiah', 'Neh', 13, 'old', 8, 10), B('Esther', 'Esth', 10, 'old', 4, 14), B('Job', 'Job', 42, 'old', 19, 25),
  B('Psalms', 'Ps', 150, 'old', 23, 1), B('Proverbs', 'Prov', 31, 'old', 3, 5), B('Ecclesiastes', 'Eccl', 12, 'old', 3, 1),
  B('Song of Solomon', 'Song', 8, 'old', 2, 4), B('Isaiah', 'Isa', 66, 'old', 40, 31), B('Jeremiah', 'Jer', 52, 'old', 29, 11),
  B('Lamentations', 'Lam', 5, 'old', 3, 22), B('Ezekiel', 'Ezek', 48, 'old', 37, 4), B('Daniel', 'Dan', 12, 'old', 3, 17),
  B('Hosea', 'Hos', 14, 'old', 6, 6), B('Joel', 'Joel', 3, 'old', 2, 28), B('Amos', 'Amos', 9, 'old', 5, 24),
  B('Obadiah', 'Obad', 1, 'old', 1, 15), B('Jonah', 'Jonah', 4, 'old', 2, 9), B('Micah', 'Mic', 7, 'old', 6, 8),
  B('Nahum', 'Nah', 3, 'old', 1, 7), B('Habakkuk', 'Hab', 3, 'old', 2, 2), B('Zephaniah', 'Zeph', 3, 'old', 3, 17),
  B('Haggai', 'Hag', 2, 'old', 2, 9), B('Zechariah', 'Zech', 14, 'old', 4, 6), B('Malachi', 'Mal', 4, 'old', 3, 10),
  B('Matthew', 'Matt', 28, 'new', 6, 33), B('Mark', 'Mark', 16, 'new', 11, 24), B('Luke', 'Luke', 24, 'new', 1, 37),
  B('John', 'John', 21, 'new', 3, 16), B('Acts', 'Acts', 28, 'new', 1, 8), B('Romans', 'Rom', 16, 'new', 8, 28),
  B('1 Corinthians', '1 Cor', 16, 'new', 13, 4), B('2 Corinthians', '2 Cor', 13, 'new', 5, 17), B('Galatians', 'Gal', 6, 'new', 2, 20),
  B('Ephesians', 'Eph', 6, 'new', 2, 8), B('Philippians', 'Phil', 4, 'new', 4, 13), B('Colossians', 'Col', 4, 'new', 3, 23),
  B('1 Thessalonians', '1 Thess', 5, 'new', 5, 17), B('2 Thessalonians', '2 Thess', 3, 'new', 3, 3), B('1 Timothy', '1 Tim', 6, 'new', 6, 12),
  B('2 Timothy', '2 Tim', 4, 'new', 1, 7), B('Titus', 'Titus', 3, 'new', 2, 11), B('Philemon', 'Phlm', 1, 'new', 1, 6),
  B('Hebrews', 'Heb', 13, 'new', 11, 1), B('James', 'Jas', 5, 'new', 1, 5), B('1 Peter', '1 Pet', 5, 'new', 5, 7),
  B('2 Peter', '2 Pet', 3, 'new', 3, 9), B('1 John', '1 John', 5, 'new', 4, 8), B('2 John', '2 John', 1, 'new', 1, 6),
  B('3 John', '3 John', 1, 'new', 1, 2), B('Jude', 'Jude', 1, 'new', 1, 24), B('Revelation', 'Rev', 22, 'new', 3, 20),
]

const SHELF_BY_BOOK = new Map(BIBLE_SHELF.map((b) => [b.book, b]))
export const shelfBook = (book: string) => SHELF_BY_BOOK.get(book)

/**
 * The order training works through the shelf: the names speech engines
 * trip on first, so the first four minutes do the most good. A preacher
 * who only ever does one round has still covered the books that matter.
 */
export const TRAINING_ORDER: readonly string[] = [
  'Philippians', 'Ecclesiastes', '1 Thessalonians', 'Habakkuk', 'Deuteronomy', 'Colossians',
  'Lamentations', 'Zechariah', 'Galatians', 'Leviticus', 'Ephesians', '1 John',
  'Revelation', 'Haggai', 'Nehemiah', 'Zephaniah', '2 Thessalonians', 'Song of Solomon',
  'Hebrews', 'Micah', 'Malachi', 'Hosea', 'Obadiah', 'Nahum',
  'Romans', 'Psalms', 'Proverbs', 'Isaiah', 'Jeremiah', 'Ezekiel',
  '1 Corinthians', '2 Corinthians', '1 Timothy', '2 Timothy', '1 Peter', '2 Peter',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'James',
  'Genesis', 'Exodus', 'Numbers', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Esther', 'Job', 'Daniel', 'Joel', 'Amos',
  'Jonah', 'Titus', 'Philemon', 'Jude', '2 John', '3 John',
]

export const TRAINING_ROUND = 12

/* ------------------------------------------------------------------ */
/* Voice training                                                      */
/* ------------------------------------------------------------------ */

export type TrainingEngine = 'whisper-local' | 'deepgram'

export interface TrainingPrompt {
  book: string
  chapter: number
  verse: number
  /** How the reference is printed for the preacher to read: "Philippians 4:13". */
  say: string
}

/**
 * How one reference went.
 *
 *   caught    understood first time
 *   learned   misheard, a book-name fix was saved, and the retry proved it
 *   retry     understood on a later try with no fix needed
 *   missed    never understood in three tries
 *   skipped   the operator moved on
 */
export type TrainingOutcome = 'caught' | 'learned' | 'retry' | 'missed' | 'skipped'

export interface TrainingStepResult {
  book: string
  ref: string
  outcome: TrainingOutcome
  /** Everything heard across the tries, newest last. */
  heard: string
  /** The misheard phrase saved as a fix, when one was. */
  learned?: string
}

/** What the last try sounded like, so the screen can say why. */
export type TrainingVerdict = 'caught' | 'learned' | 'numbers' | 'other-book' | 'nothing'

export interface TrainingState {
  sessionId: string
  preacherId: string
  engine: TrainingEngine
  status: 'starting' | 'listening' | 'result' | 'finished' | 'error'
  message: string
  index: number
  prompts: TrainingPrompt[]
  results: TrainingStepResult[]
  attempt: number
  /** Words arriving right now (an interim result). */
  live: string
  /** Final words heard for the current reference, this try. */
  heard: string
  detected: string | null
  verdict: TrainingVerdict | null
  /** A fix saved during this reference, until it is proven or undone. */
  learned: { heard: string; means: string } | null
}

export interface TrainingSessionRecord {
  id: string
  date: string
  engine: TrainingEngine
  results: TrainingStepResult[]
}

export interface TrainingSummary {
  sessions: number
  lastDate: string | null
  rounds: { date: string; engine: TrainingEngine; caught: number; learned: number; missed: number; total: number }[]
}

export const refLabel = (r: { book: string; chapter: number; verse: number | null }) =>
  `${r.book} ${r.chapter}${r.verse ? `:${r.verse}` : ''}`

export function promptFor(book: string): TrainingPrompt | null {
  const b = shelfBook(book)
  return b ? { book: b.book, chapter: b.chapter, verse: b.verse, say: refLabel(b) } : null
}

/**
 * Does a detection answer the prompt? One-chapter books are read both ways
 * — "Jude 24" and "Jude 1:24" — and both are right.
 */
export function answersPrompt(prompt: TrainingPrompt, ref: { book: string; chapter: number; verse: number | null }): boolean {
  if (ref.book !== prompt.book) return false
  if (ref.chapter === prompt.chapter && ref.verse === prompt.verse) return true
  return shelfBook(prompt.book)?.chapters === 1 && ref.chapter === prompt.verse && !ref.verse
}

/* ------------------------------------------------------------------ */
/* Where each book stands                                              */
/* ------------------------------------------------------------------ */

/**
 * One spine on the shelf.
 *
 *   unheard  no training and never used in a service
 *   caught   understood — in training, or used in a service
 *   learned  needed a book-name fix, and has one
 *   trouble  still not understood the last time it was tried
 */
export interface BookStanding {
  state: 'unheard' | 'caught' | 'learned' | 'trouble'
  /** Times a verse from this book went up in a service. */
  quoted: number
  /** Misheard phrases saved for this book. */
  fixes: string[]
}

export function bookStandings(
  sessions: TrainingSessionRecord[],
  soundsLike: BookAlias[],
  quoted: Record<string, number>,
): Record<string, BookStanding> {
  const out: Record<string, BookStanding> = {}
  for (const b of BIBLE_SHELF) {
    out[b.book] = { state: 'unheard', quoted: quoted[b.book] ?? 0, fixes: soundsLike.filter((a) => a.means === b.book).map((a) => a.heard) }
  }
  for (const s of sessions) {
    for (const r of s.results) {
      const spot = out[r.book]
      if (!spot || r.outcome === 'skipped') continue
      spot.state = r.outcome === 'missed' ? 'trouble' : r.outcome === 'learned' ? 'learned' : 'caught'
    }
  }
  for (const spot of Object.values(out)) {
    if (spot.state === 'unheard' && spot.fixes.length) spot.state = 'learned'
    else if (spot.state === 'unheard' && spot.quoted > 0) spot.state = 'caught'
    else if (spot.state === 'caught' && spot.fixes.length) spot.state = 'learned'
  }
  return out
}

export function trainingSummary(sessions: TrainingSessionRecord[]): TrainingSummary {
  return {
    sessions: sessions.length,
    lastDate: sessions.at(-1)?.date ?? null,
    rounds: sessions.map((s) => {
      const tried = s.results.filter((r) => r.outcome !== 'skipped')
      return {
        date: s.date,
        engine: s.engine,
        caught: tried.filter((r) => r.outcome === 'caught' || r.outcome === 'retry').length,
        learned: tried.filter((r) => r.outcome === 'learned').length,
        missed: tried.filter((r) => r.outcome === 'missed').length,
        total: tried.length,
      }
    }),
  }
}

/**
 * The next round: books that still trip the engine up, then books it has
 * never heard, in TRAINING_ORDER. Books already understood come last, so a
 * fully trained preacher gets a re-check of the hardest names rather than
 * nothing.
 */
export function nextTrainingBooks(standings: Record<string, BookStanding>, size = TRAINING_ROUND): string[] {
  const rank = (book: string) => ({ trouble: 0, unheard: 1, learned: 2, caught: 3 }[standings[book]?.state ?? 'unheard'])
  return [...TRAINING_ORDER].sort((a, b) => rank(a) - rank(b) || TRAINING_ORDER.indexOf(a) - TRAINING_ORDER.indexOf(b)).slice(0, size)
}
