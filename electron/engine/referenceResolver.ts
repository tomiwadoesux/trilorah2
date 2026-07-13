/**
 * Spoken scripture-reference resolver — in-process TypeScript rewrite of the
 * lost Python ml/ WebSocket resolver.
 *
 * Responsibilities (per the original spec):
 *  - state machine that buffers spoken numbers across ASR chunks
 *    ("John ... three ... sixteen")
 *  - alias resolution ("first corinthians", "1st cor", "psalm")
 *  - normalization of ordinals, number words, and filler
 *    ("the third chapter of John and verse five")
 *  - book-name stripping before number extraction
 *    (prevents "1 John 3:16" from reading the "1" as a chapter)
 *
 * It exposes the exact surface main.ts used for the Python client
 * (connectML / sendTranscript / disconnectML) so the fan-out wiring is
 * unchanged — it just no longer needs a Python runtime.
 */

import { bookIdMap } from '../data/books'

export interface ResolvedReference {
  type: 'verse'
  book: string
  chapter: number | null
  verse: number | null
  endVerse?: number | null
  rangeEnd?: number | null
  confidence: number
  source: 'resolver'
}

type VerseCallback = (data: ResolvedReference) => void

/** Gate consulted before emitting a bare book mention (no numbers).
 *  Lets the intent engine suppress narrative mentions ("Paul wrote to the
 *  Romans…") while still allowing explicit references through. */
export type BareBookGate = () => boolean

/* ------------------------------------------------------------------ */
/* Number-word parsing                                                 */
/* ------------------------------------------------------------------ */

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19
}

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90
}

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12
}

/** Parse a number starting at words[i].
 *  Handles digits ("23"), number words ("twenty three"),
 *  "a hundred (and) nineteen", and returns how many words were consumed. */
export function parseSpokenNumber(
  words: string[],
  i: number
): { value: number; consumed: number } | null {
  const w = words[i]
  if (w === undefined) return null

  if (/^\d{1,3}$/.test(w)) {
    return { value: parseInt(w, 10), consumed: 1 }
  }

  let value = 0
  let consumed = 0
  let j = i

  // "(a|one) hundred (and)? ..."
  if ((words[j] === 'a' || words[j] === 'one') && words[j + 1] === 'hundred') {
    value = 100
    consumed = 2
    j += 2
  } else if (words[j] === 'hundred') {
    value = 100
    consumed = 1
    j += 1
  } else if (ONES[words[j]] !== undefined && words[j + 1] === 'hundred') {
    value = ONES[words[j]] * 100
    consumed = 2
    j += 2
  }

  if (consumed > 0 && words[j] === 'and') {
    consumed += 1
    j += 1
  }

  if (words[j] !== undefined && TENS[words[j]] !== undefined) {
    value += TENS[words[j]]
    consumed += 1
    j += 1
    if (words[j] !== undefined && ONES[words[j]] !== undefined && ONES[words[j]] < 10) {
      value += ONES[words[j]]
      consumed += 1
    }
    return { value, consumed }
  }

  if (words[j] !== undefined && ONES[words[j]] !== undefined) {
    value += ONES[words[j]]
    consumed += 1
    return { value, consumed }
  }

  if (consumed > 0) return { value, consumed }
  return null
}

/** Parse a single free-standing token that might be a number ("34", "thirty"). */
export function parseNumberToken(text: string): number | null {
  const words = normalizeWords(text)
  if (words.length === 0) return null
  const parsed = parseSpokenNumber(words, 0)
  if (parsed && parsed.consumed === words.length) return parsed.value
  return null
}

/* ------------------------------------------------------------------ */
/* Book alias table                                                    */
/* ------------------------------------------------------------------ */

const NUMBER_PREFIX: Record<string, string> = {
  '1': '1', '1st': '1', first: '1', one: '1', i: '1',
  '2': '2', '2nd': '2', second: '2', two: '2', ii: '2',
  '3': '3', '3rd': '3', third: '3', three: '3', iii: '3'
}

/** Extra spoken forms per canonical book (beyond the name itself). */
const EXTRA_ALIASES: Record<string, string[]> = {
  Genesis: ['gen'],
  Exodus: ['exo', 'ex'],
  Leviticus: ['lev'],
  Numbers: ['num'],
  Deuteronomy: ['deut', 'deuteronomies'],
  Joshua: ['josh'],
  Judges: ['judg'],
  '1 Samuel': ['1 sam', 'first samuel'],
  '2 Samuel': ['2 sam', 'second samuel'],
  Psalms: ['psalm', 'the psalms', 'psa'],
  Proverbs: ['prov', 'the proverbs'],
  Ecclesiastes: ['ecc', 'ecclesiastics'],
  'Song of Solomon': ['song of songs', 'songs of solomon'],
  Isaiah: ['isa'],
  Jeremiah: ['jer'],
  Lamentations: ['lam'],
  Ezekiel: ['ezek'],
  Matthew: ['matt', 'mathew'],
  John: ['the gospel of john'],
  Acts: ['the acts', 'acts of the apostles', 'the book of acts'],
  Romans: ['rom'],
  '1 Corinthians': ['1 cor', 'first corinthians'],
  '2 Corinthians': ['2 cor', 'second corinthians'],
  Galatians: ['gal'],
  Ephesians: ['eph'],
  Philippians: ['phil', 'philippians'],
  Colossians: ['col'],
  '1 Thessalonians': ['1 thess', 'first thessalonians'],
  '2 Thessalonians': ['2 thess', 'second thessalonians'],
  '1 Timothy': ['1 tim', 'first timothy'],
  '2 Timothy': ['2 tim', 'second timothy'],
  Hebrews: ['heb'],
  '1 Peter': ['1 pet', 'first peter'],
  '2 Peter': ['2 pet', 'second peter'],
  '1 John': ['first john'],
  '2 John': ['second john'],
  '3 John': ['third john'],
  Revelation: ['revelations', 'the revelation', 'rev']
}

interface BookAlias {
  /** normalized alias words, longest first at match time */
  words: string[]
  canonical: string
}

function buildAliasTable(): BookAlias[] {
  const aliases: BookAlias[] = []
  const add = (alias: string, canonical: string) => {
    const words = normalizeWords(alias)
    if (words.length > 0) aliases.push({ words, canonical })
  }

  for (const canonical of Object.keys(bookIdMap)) {
    const numbered = canonical.match(/^([123]) (.+)$/)
    if (numbered) {
      const [, digit, stem] = numbered
      for (const [spoken, mapped] of Object.entries(NUMBER_PREFIX)) {
        if (mapped === digit) add(`${spoken} ${stem}`, canonical)
      }
      // "the book of second samuel" style
      add(`the book of ${digit} ${stem}`, canonical)
    } else {
      add(canonical, canonical)
      add(`the book of ${canonical}`, canonical)
    }
    for (const extra of EXTRA_ALIASES[canonical] ?? []) {
      add(extra, canonical)
    }
  }

  // Longest alias first so "1 john" wins over "john", "song of songs" over "song"
  aliases.sort((a, b) => b.words.length - a.words.length)
  return aliases
}

const ALIAS_TABLE = buildAliasTable()

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

/** Lowercase, expand "3:16" → "3 16", strip punctuation, split. */
export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d+):(\d+)/g, '$1 $2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
}

interface BookMatch {
  canonical: string
  start: number
  end: number // exclusive
}

/** Find book-name matches in the word stream (longest alias wins, no overlap). */
function findBookMatches(words: string[]): BookMatch[] {
  const matches: BookMatch[] = []
  const taken = new Array<boolean>(words.length).fill(false)
  for (const alias of ALIAS_TABLE) {
    const n = alias.words.length
    for (let i = 0; i + n <= words.length; i++) {
      let ok = true
      for (let k = 0; k < n; k++) {
        if (taken[i + k] || words[i + k] !== alias.words[k]) {
          ok = false
          break
        }
      }
      // Guard: a bare ordinal word ("first") followed by a stem was already
      // handled by the alias itself; nothing extra needed here.
      if (ok) {
        for (let k = 0; k < n; k++) taken[i + k] = true
        matches.push({ canonical: alias.canonical, start: i, end: i + n })
      }
    }
  }
  matches.sort((a, b) => a.start - b.start)
  return matches
}

/* ------------------------------------------------------------------ */
/* The resolver state machine                                          */
/* ------------------------------------------------------------------ */

const PENDING_TTL_MS = 8000
const DEDUP_WINDOW_MS = 4000
const FILLER = new Set(['uh', 'um', 'ah', 'the', 'now', 'so', 'okay', 'well'])

export interface ResolverOptions {
  /** Consulted before emitting a bare book mention. Default: allow. */
  bareBookGate?: BareBookGate
  /** Injectable clock for tests. */
  now?: () => number
}

export class SpokenReferenceResolver {
  private onDetection: VerseCallback
  private bareBookGate: BareBookGate
  private now: () => number

  private pendingBook: string | null = null
  private pendingChapter: number | null = null
  private pendingAt = 0

  private lastEmitKey = ''
  private lastEmitAt = 0

  constructor(onDetection: VerseCallback, opts: ResolverOptions = {}) {
    this.onDetection = onDetection
    this.bareBookGate = opts.bareBookGate ?? (() => true)
    this.now = opts.now ?? Date.now
  }

  reset(): void {
    this.pendingBook = null
    this.pendingChapter = null
    this.pendingAt = 0
  }

  /** Feed one ASR chunk. Partial chunks refresh state; finals detect fully. */
  process(text: string, isFinal: boolean): void {
    const now = this.now()
    if (this.pendingBook && now - this.pendingAt > PENDING_TTL_MS) {
      this.reset()
    }

    const rawWords = normalizeWords(text)
    if (rawWords.length === 0) return
    const books = findBookMatches(rawWords)

    // Strip book-name words BEFORE number extraction, so "1 John 3 16"
    // never reads the leading "1" as a number.
    const stripped: { word: string; bookBoundary: BookMatch | null }[] = []
    let wi = 0
    let bi = 0
    while (wi < rawWords.length) {
      const b = books[bi]
      if (b && wi === b.start) {
        stripped.push({ word: ' BOOK', bookBoundary: b })
        wi = b.end
        bi++
      } else {
        stripped.push({ word: rawWords[wi], bookBoundary: null })
        wi++
      }
    }

    this.walk(stripped, isFinal, now)
  }

  private walk(
    tokens: { word: string; bookBoundary: BookMatch | null }[],
    isFinal: boolean,
    now: number
  ): void {
    let i = 0
    let sawExplicitKeyword = false

    while (i < tokens.length) {
      const t = tokens[i]

      if (t.bookBoundary) {
        const book = t.bookBoundary.canonical
        // "Psalm twenty three" — the number directly after Psalms is a chapter.
        this.pendingBook = book
        this.pendingChapter = null
        this.pendingAt = now

        const after = this.readReferenceNumbers(tokens, i + 1)
        if (after) {
          const { chapter, verse, rangeEnd, consumed, explicit } = after
          i += 1 + consumed
          this.emit(book, chapter, verse, rangeEnd, explicit ? 0.95 : 0.88, now)
          continue
        }
        // Bare book mention — emit only if the gate allows (session then
        // waits for chapter/verse), otherwise keep it as silent pending state.
        if (this.bareBookGate()) {
          this.emit(book, null, null, null, 0.9, now)
        }
        i++
        continue
      }

      if (t.word === 'chapter') {
        sawExplicitKeyword = true
        const num = parseSpokenNumber(tokens.map((x) => x.word), i + 1)
        if (num && this.pendingBook) {
          this.pendingChapter = num.value
          this.pendingAt = now
          i += 1 + num.consumed
          // "chapter three verse sixteen" | "chapter three and verse sixteen"
          let j = i
          while (j < tokens.length && (tokens[j].word === 'and' || FILLER.has(tokens[j].word))) j++
          if (tokens[j]?.word === 'verse' || tokens[j]?.word === 'verses') {
            const v = parseSpokenNumber(tokens.map((x) => x.word), j + 1)
            if (v) {
              const range = this.readRange(tokens, j + 1 + v.consumed)
              this.emit(this.pendingBook, num.value, v.value, range, 0.95, now)
              i = j + 1 + v.consumed + (range ? 2 : 0)
              continue
            }
          }
          // Chapter without verse (yet): emit chapter-only so the session
          // can start its "default to verse 1" timer.
          this.emit(this.pendingBook, num.value, null, null, 0.9, now)
          continue
        }
        // "the third chapter of John"
        const prev = tokens[i - 1]?.word
        if (prev && ORDINALS[prev] !== undefined) {
          let j = i + 1
          while (j < tokens.length && tokens[j].word === 'of') j++
          if (tokens[j]?.bookBoundary) {
            const book = tokens[j].bookBoundary!.canonical
            this.pendingBook = book
            this.pendingChapter = ORDINALS[prev]
            this.pendingAt = now
            this.emit(book, ORDINALS[prev], null, null, 0.9, now)
            i = j + 1
            continue
          }
        }
        i++
        continue
      }

      if (t.word === 'verse' || t.word === 'verses') {
        sawExplicitKeyword = true
        const num = parseSpokenNumber(tokens.map((x) => x.word), i + 1)
        if (num) {
          const rangeEnd = this.readRange(tokens, i + 1 + num.consumed)
          if (this.pendingBook && this.pendingChapter) {
            this.emit(this.pendingBook, this.pendingChapter, num.value, rangeEnd, 0.95, now)
          } else {
            // Bare "verse N" — session attaches it to current context.
            this.onDetection({
              type: 'verse',
              book: '',
              chapter: null,
              verse: num.value,
              rangeEnd,
              confidence: 0.86,
              source: 'resolver'
            })
          }
          i += 1 + num.consumed
          continue
        }
        i++
        continue
      }

      // Number continuation after a pending book: "John ... three ... sixteen"
      if (this.pendingBook) {
        const num = parseSpokenNumber(tokens.map((x) => x.word), i)
        if (num) {
          if (this.pendingChapter === null) {
            // Two consecutive numbers = chapter + verse ("three sixteen")
            const second = parseSpokenNumber(tokens.map((x) => x.word), i + num.consumed)
            if (second) {
              this.emit(this.pendingBook, num.value, second.value, null, 0.88, now)
              i += num.consumed + second.consumed
              continue
            }
            this.pendingChapter = num.value
            this.pendingAt = now
            if (isFinal) {
              this.emit(this.pendingBook, num.value, null, null, 0.86, now)
            }
            i += num.consumed
            continue
          } else {
            this.emit(this.pendingBook, this.pendingChapter, num.value, null, 0.86, now)
            i += num.consumed
            continue
          }
        }
      }

      if (!FILLER.has(t.word) && !sawExplicitKeyword && !this.pendingBook) {
        // plain speech, nothing pending — fall through
      }
      i++
    }
  }

  /** After a book token: read "3 16", "3 verse 16", "chapter 3 verse 16". */
  private readReferenceNumbers(
    tokens: { word: string; bookBoundary: BookMatch | null }[],
    start: number
  ): { chapter: number; verse: number | null; rangeEnd: number | null; consumed: number; explicit: boolean } | null {
    const words = tokens.map((x) => x.word)
    let i = start
    let explicit = false
    while (i < tokens.length && FILLER.has(words[i])) i++
    if (words[i] === 'chapter') {
      explicit = true
      i++
    }
    const chap = parseSpokenNumber(words, i)
    if (!chap) return null
    i += chap.consumed
    let j = i
    while (j < tokens.length && (words[j] === 'and' || FILLER.has(words[j]))) j++
    if (words[j] === 'verse' || words[j] === 'verses') {
      explicit = true
      const v = parseSpokenNumber(words, j + 1)
      if (v) {
        const rangeEnd = this.readRange(tokens, j + 1 + v.consumed)
        return {
          chapter: chap.value,
          verse: v.value,
          rangeEnd,
          consumed: j + 1 + v.consumed - start + (rangeEnd ? 2 : 0),
          explicit
        }
      }
    }
    const v2 = parseSpokenNumber(words, i)
    if (v2) {
      const rangeEnd = this.readRange(tokens, i + v2.consumed)
      return {
        chapter: chap.value,
        verse: v2.value,
        rangeEnd,
        consumed: i + v2.consumed - start + (rangeEnd ? 2 : 0),
        explicit
      }
    }
    return { chapter: chap.value, verse: null, rangeEnd: null, consumed: i - start, explicit }
  }

  /** "to five" / "through five" / "thru 5" immediately after a verse number. */
  private readRange(
    tokens: { word: string; bookBoundary: BookMatch | null }[],
    at: number
  ): number | null {
    const words = tokens.map((x) => x.word)
    if (words[at] === 'to' || words[at] === 'through' || words[at] === 'thru') {
      const n = parseSpokenNumber(words, at + 1)
      if (n) return n.value
    }
    return null
  }

  private emit(
    book: string,
    chapter: number | null,
    verse: number | null,
    rangeEnd: number | null,
    confidence: number,
    now: number
  ): void {
    const key = `${book}|${chapter}|${verse}|${rangeEnd ?? ''}`
    if (key === this.lastEmitKey && now - this.lastEmitAt < DEDUP_WINDOW_MS) {
      return
    }
    this.lastEmitKey = key
    this.lastEmitAt = now
    if (chapter !== null) {
      this.pendingBook = book
      this.pendingChapter = chapter
      this.pendingAt = now
    }
    this.onDetection({
      type: 'verse',
      book,
      chapter,
      verse,
      rangeEnd,
      endVerse: rangeEnd,
      confidence,
      source: 'resolver'
    })
  }
}

/* ------------------------------------------------------------------ */
/* mlClient-compatible surface (drop-in for the lost Python resolver)  */
/* ------------------------------------------------------------------ */

let resolver: SpokenReferenceResolver | null = null
let gate: BareBookGate = () => true

/** Lets main.ts wire the intent engine in after construction. */
export function setBareBookGate(g: BareBookGate): void {
  gate = g
}

export function connectML(onVerse: (data: any) => void): void {
  resolver = new SpokenReferenceResolver(onVerse, { bareBookGate: () => gate() })
  console.log('🧠 In-process reference resolver ready (Python ML replaced)')
}

export function sendTranscript(text: string, isFinal = false): void {
  if (!resolver) return
  resolver.process(text, isFinal)
}

export function disconnectML(): void {
  resolver = null
}
