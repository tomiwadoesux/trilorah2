/**
 * Candidate list — every detection becomes a ranked shortlist, not a
 * single answer.
 *
 * The resolver emits ONE reference with a confidence. ASR is wrong in
 * predictable ways though ("John" ↔ "Jonah", "thirteen" ↔ "thirty"), so we
 * expand the primary into the alternates it could plausibly have been,
 * score them, and let the caller decide:
 *
 *  - a clear winner → auto mode may push it
 *  - a CLASH (top two within ~15 points) → hold and ask the operator
 *  - the same list later feeds congregation polls
 *
 * Pure: verse existence, recent context and seasonal weighting are injected.
 */

export type CandidateSource = 'primary' | 'confusion' | 'quote' | 'context'

export interface Candidate {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  /** 0..100 */
  score: number
  reasons: string[]
  source: CandidateSource
}

export interface PrimaryDetection {
  book: string
  chapter: number
  verse: number
  endVerse?: number | null
  /** 0..1 */
  confidence: number
}

export interface CandidateContext {
  verseExists: (book: string, chapter: number, verse: number) => boolean
  /** Chapters recently on screen — an alternate landing there gets +10. */
  recentRefs?: { book: string; chapter: number }[]
  /** Already-scored quote matches (see candidatesFromQuotes). */
  quoteCandidates?: Candidate[]
  /** Extra points for an in-season book (0 when out of season). */
  seasonalBoost?: (book: string) => number
  /** Raw ASR text — a number alternate spoken verbatim gets +5. */
  heardText?: string
}

/** Minimal shape of quoteMatcher's QuoteMatch (kept local on purpose). */
export interface QuoteLike {
  ref: string
  chapter: number
  verse: number
  confidence: number
  matchedWords?: number
}

export const NUMBER_ALT_PENALTY = 25
export const BOOK_ALT_PENALTY = 30
export const RECENT_CHAPTER_BONUS = 10
export const HEARD_NUMBER_BONUS = 5
export const MAX_CANDIDATES = 4
export const CLASH_MARGIN_PTS = 15
/** A top score at/above this is never a clash, however close the runner-up. */
export const CLASH_CEILING = 92

/* ------------------------------------------------------------------ */
/* Known ASR confusions                                                 */
/* ------------------------------------------------------------------ */

const NUMBER_PAIRS: [number, number][] = [
  [13, 30],
  [14, 40],
  [15, 50],
  [16, 60],
  [17, 70],
  [18, 80],
  [19, 90]
]

const NUMBER_WORDS: Record<number, string> = {
  13: 'thirteen',
  14: 'fourteen',
  15: 'fifteen',
  16: 'sixteen',
  17: 'seventeen',
  18: 'eighteen',
  19: 'nineteen',
  30: 'thirty',
  40: 'forty',
  50: 'fifty',
  60: 'sixty',
  70: 'seventy',
  80: 'eighty',
  90: 'ninety'
}

const BOOK_PAIRS: [string, string][] = [
  ['John', 'Jonah'],
  ['John', 'Joel'],
  ['John', '1 John'],
  ['Jonah', 'Joel'],
  ['Jonah', '1 John'],
  ['Joel', '1 John'],
  ['Genesis', 'John'],
  ['Acts', 'Amos'],
  ['1 Kings', '1 Chronicles'],
  ['2 Kings', '2 Chronicles'],
  ['Philippians', 'Philemon'],
  ['Titus', '1 Timothy'],
  ['Titus', '2 Timothy'],
  ['Mark', 'Micah'],
  ['Ruth', 'Luke'],
  ['Jude', 'Judges'],
  ['Ezra', 'Esther']
]

const numberAlternates = new Map<number, number[]>()
for (const [a, b] of NUMBER_PAIRS) {
  numberAlternates.set(a, [...(numberAlternates.get(a) ?? []), b])
  numberAlternates.set(b, [...(numberAlternates.get(b) ?? []), a])
}

const bookAlternates = new Map<string, string[]>()
for (const [a, b] of BOOK_PAIRS) {
  const ka = a.toLowerCase()
  const kb = b.toLowerCase()
  bookAlternates.set(ka, [...(bookAlternates.get(ka) ?? []), b])
  bookAlternates.set(kb, [...(bookAlternates.get(kb) ?? []), a])
}

/** Books that could have been misheard as `book` (canonical names). */
export function bookConfusions(book: string): string[] {
  return bookAlternates.get(book.trim().toLowerCase()) ?? []
}

/** Numbers that could have been misheard as `n`. */
export function numberConfusions(n: number): number[] {
  return numberAlternates.get(n) ?? []
}

/* ------------------------------------------------------------------ */
/* Building                                                             */
/* ------------------------------------------------------------------ */

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function keyOf(c: { book: string; chapter: number; verse: number; endVerse?: number }): string {
  return `${c.book.toLowerCase()}|${c.chapter}|${c.verse}|${c.endVerse ?? ''}`
}

function heardNumber(heardText: string | undefined, n: number): boolean {
  if (!heardText) return false
  const t = heardText.toLowerCase()
  const word = NUMBER_WORDS[n]
  return new RegExp(`\\b${n}\\b`).test(t) || (!!word && new RegExp(`\\b${word}\\b`).test(t))
}

export function buildCandidates(primary: PrimaryDetection, ctx: CandidateContext): Candidate[] {
  const base = clamp(primary.confidence * 100)
  const endVerse = primary.endVerse ?? undefined
  const out: Candidate[] = []

  out.push({
    book: primary.book,
    chapter: primary.chapter,
    verse: primary.verse,
    endVerse,
    score: base,
    reasons: [`resolver confidence ${base}`],
    source: 'primary'
  })

  const recent = ctx.recentRefs ?? []
  const contextual = (book: string, chapter: number): boolean =>
    recent.some((r) => r.book.toLowerCase() === book.toLowerCase() && r.chapter === chapter)

  const pushAlternate = (
    book: string,
    chapter: number,
    verse: number,
    penalty: number,
    reason: string,
    heardBonus = false
  ): void => {
    if (!ctx.verseExists(book, chapter, verse)) return
    let score = base - penalty
    const reasons = [reason]
    if (contextual(book, chapter)) {
      score += RECENT_CHAPTER_BONUS
      reasons.push('recent chapter')
    }
    const seasonal = ctx.seasonalBoost?.(book) ?? 0
    if (seasonal > 0) {
      score += seasonal
      reasons.push(`in season +${seasonal}`)
    }
    if (heardBonus) {
      score += HEARD_NUMBER_BONUS
      reasons.push('heard verbatim')
    }
    out.push({
      book,
      chapter,
      verse,
      // A verse swap drops any range — the range was anchored on the heard verse.
      endVerse: verse === primary.verse && chapter === primary.chapter ? endVerse : undefined,
      score: clamp(score),
      reasons,
      source: 'confusion'
    })
  }

  for (const v of numberConfusions(primary.verse)) {
    pushAlternate(
      primary.book,
      primary.chapter,
      v,
      NUMBER_ALT_PENALTY,
      `verse ${primary.verse} ↔ ${v}`,
      heardNumber(ctx.heardText, v)
    )
  }
  for (const c of numberConfusions(primary.chapter)) {
    pushAlternate(
      primary.book,
      c,
      primary.verse,
      NUMBER_ALT_PENALTY,
      `chapter ${primary.chapter} ↔ ${c}`,
      heardNumber(ctx.heardText, c)
    )
  }
  for (const b of bookConfusions(primary.book)) {
    pushAlternate(b, primary.chapter, primary.verse, BOOK_ALT_PENALTY, `${primary.book} ↔ ${b}`)
  }

  for (const q of ctx.quoteCandidates ?? []) {
    out.push({ ...q, score: clamp(q.score), reasons: [...q.reasons] })
  }

  return rank(out)
}

/** Dedup (highest score wins, reasons merged), sort desc, cap. */
export function rank(list: Candidate[], cap = MAX_CANDIDATES): Candidate[] {
  const byKey = new Map<string, Candidate>()
  for (const c of list) {
    const k = keyOf(c)
    const prev = byKey.get(k)
    if (!prev) {
      byKey.set(k, { ...c, reasons: [...c.reasons] })
      continue
    }
    const winner = c.score > prev.score ? c : prev
    byKey.set(k, {
      ...winner,
      reasons: [...new Set([...prev.reasons, ...c.reasons])]
    })
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, cap)
}

/** Top two within `marginPts` and the leader not confident enough to win outright. */
export function isClash(candidates: Candidate[], marginPts = CLASH_MARGIN_PTS): boolean {
  if (candidates.length < 2) return false
  const [top, second] = candidates
  return top.score < CLASH_CEILING && top.score - second.score <= marginPts
}

/** Map quoteMatcher results ("John 3:16", confidence 0..1) to candidates. */
export function candidatesFromQuotes(results: QuoteLike[]): Candidate[] {
  return results.map((q) => {
    const book = q.ref.replace(/\s+\d+:\d+(?:-\d+)?\s*$/, '').trim()
    const reasons = ['quoted text']
    if (typeof q.matchedWords === 'number') reasons.push(`${q.matchedWords} words matched`)
    return {
      book,
      chapter: q.chapter,
      verse: q.verse,
      score: clamp(q.confidence * 100),
      reasons,
      source: 'quote' as const
    }
  })
}

export function formatCandidate(c: Candidate): string {
  return c.endVerse ? `${c.book} ${c.chapter}:${c.verse}-${c.endVerse}` : `${c.book} ${c.chapter}:${c.verse}`
}
