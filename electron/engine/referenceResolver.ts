/**
 * Spoken scripture-reference resolver — in-process TypeScript rewrite of the
 * lost Python ml/ WebSocket resolver, now MULTILINGUAL.
 *
 * Responsibilities (per the original spec):
 *  - state machine that buffers spoken numbers across ASR chunks
 *    ("John ... three ... sixteen")
 *  - alias resolution ("first corinthians", "1st cor", "psalm")
 *  - normalization of ordinals, number words, and filler
 *  - book-name stripping before number extraction
 *    (prevents "1 John 3:16" from reading the "1" as a chapter)
 *
 * Language packs (electron/engine/lang/) extend every table with native
 * book names, number words, and chapter/verse keywords — English always
 * stays active underneath so bilingual preachers can code-switch.
 * Chinese uses a dedicated substring path (no word boundaries).
 *
 * It exposes the exact surface main.ts used for the Python client
 * (connectML / sendTranscript / disconnectML) so the fan-out wiring is
 * unchanged — it just no longer needs a Python runtime.
 */

import { bookIdMap } from '../data/books'
import { CHAPTER_COUNTS } from '../../shared/chapterCounts'
import { EN_NUMBER_WORDS, parseNumberWithTable, parseSpokenNumber } from '../../shared/spokenNumbers'
export { parseSpokenNumber } from '../../shared/spokenNumbers'
import { chineseNumberValue, type LanguagePack } from './lang'

export interface ResolvedReference {
  type: 'verse'
  book: string
  chapter: number | null
  verse: number | null
  endVerse?: number | null
  rangeEnd?: number | null
  confidence: number
  source: 'resolver'
  explicitBook?: boolean
}

type VerseCallback = (data: ResolvedReference) => void

/** Gate consulted before emitting a bare book mention (no numbers).
 *  Lets the intent engine suppress narrative mentions ("Paul wrote to the
 *  Romans…") while still allowing explicit references through. */
export type BareBookGate = () => boolean

/* ------------------------------------------------------------------ */
/* English number tables (base layer for every language)               */
/* ------------------------------------------------------------------ */



const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12
}

/** Language-aware parser factory (English base + pack words/connectors). */
export function makePackNumberParser(
  pack: LanguagePack | null
): (words: string[], i: number) => { value: number; consumed: number } | null {
  if (!pack) return parseSpokenNumber
  const table = { ...EN_NUMBER_WORDS, ...pack.numberWords }
  const connectors = new Set(['and', ...pack.numberConnectors])
  const compounds = [...pack.numberCompounds].sort((a, b) => b.length - a.length)
  return (words, i) => {
    // The voice-command engine hands us raw normalized words — merge the
    // pack's number compounds locally before parsing.
    const merged = mergeCompounds(words, compounds)
    // Re-locate index i after merging (compounds only ever shrink AFTER i
    // when they start at/after i; conservative approach: if lengths differ,
    // parse on the merged array at the recomputed position).
    if (merged.length === words.length) {
      return parseNumberWithTable(words, i, table, connectors)
    }
    let pos = 0
    let consumedRaw = 0
    for (const token of merged) {
      const span = token.length > 0 ? countSpan(words, consumedRaw, token, compounds) : 1
      if (consumedRaw >= i) break
      consumedRaw += span
      pos++
    }
    const result = parseNumberWithTable(merged, pos, table, connectors)
    if (!result) return null
    // Map consumed merged-tokens back to raw-word count.
    let rawCount = 0
    let scan = i
    for (let k = 0; k < result.consumed; k++) {
      const span = countSpan(words, scan, merged[pos + k], compounds)
      rawCount += span
      scan += span
    }
    return { value: result.value, consumed: rawCount }
  }
}

/** How many raw words the (possibly merged) token spans at position `at`. */
function countSpan(
  words: string[],
  at: number,
  token: string,
  compounds: string[][]
): number {
  for (const seq of compounds) {
    if (seq.join('') === token) {
      let ok = true
      for (let k = 0; k < seq.length; k++) {
        if (words[at + k] !== seq[k]) {
          ok = false
          break
        }
      }
      if (ok) return seq.length
    }
  }
  return 1
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
/* English book alias table (base layer)                               */
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

function buildAliasTable(pack: LanguagePack | null): BookAlias[] {
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

  // Language pack aliases layer on top of English (code-switch friendly).
  if (pack && pack.matchMode === 'words') {
    for (const [canonical, list] of Object.entries(pack.bookAliases)) {
      for (const alias of list) add(alias, canonical)
    }
  }

  // Longest alias first so "1 john" wins over "john", "song of songs" over "song"
  aliases.sort((a, b) => b.words.length - a.words.length)
  return aliases
}

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

/** Fold Latin diacritics only (é→e) — leaves Devanagari/CJK untouched. */
function foldLatin(text: string): string {
  return text.replace(/[À-ÖØ-öø-ž]/g, (ch) =>
    ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
  )
}

/** Lowercase, fold Latin diacritics, expand "3:16" → "3 16", strip
 *  punctuation (Unicode-aware — keeps letters, digits, AND combining
 *  marks: Devanagari vowel signs are \p{M}, stripping them would mangle
 *  Hindi; Latin accents were already folded away above). */
export function normalizeWords(text: string): string[] {
  return foldLatin(text.toLowerCase())
    .replace(/(\d+)[:：](\d+)/g, '$1 $2')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
}

/** Merge multi-word number compounds into joined atomic tokens
 *  (French "quatre vingt dix neuf" → "quatrevingtdixneuf"). */
function mergeCompounds(words: string[], compounds: string[][]): string[] {
  if (compounds.length === 0) return words
  const out: string[] = []
  let i = 0
  while (i < words.length) {
    let merged = false
    for (const seq of compounds) {
      if (seq.length > 1 && i + seq.length <= words.length) {
        let ok = true
        for (let k = 0; k < seq.length; k++) {
          if (words[i + k] !== seq[k]) {
            ok = false
            break
          }
        }
        if (ok) {
          out.push(seq.join(''))
          i += seq.length
          merged = true
          break
        }
      }
    }
    if (!merged) {
      out.push(words[i])
      i++
    }
  }
  return out
}

interface BookMatch {
  canonical: string
  start: number
  end: number // exclusive
}

/* ------------------------------------------------------------------ */
/* The resolver state machine                                          */
/* ------------------------------------------------------------------ */

const PENDING_TTL_MS = 8000
/** How long "chapter N" may still mean the last book named — a sermon point, not a sentence. */
const LAST_BOOK_TTL_MS = 15 * 60_000
const DEDUP_WINDOW_MS = 4000
const EN_FILLER = ['uh', 'um', 'ah', 'the', 'now', 'so', 'okay', 'well']

export interface ResolverOptions {
  /** Consulted before emitting a bare book mention. Default: allow. */
  bareBookGate?: BareBookGate
  /** Injectable clock for tests. */
  now?: () => number
  /** Active language pack (English base always stays on). */
  pack?: LanguagePack | null
}

export class SpokenReferenceResolver {
  private onDetection: VerseCallback
  private bareBookGate: BareBookGate
  private now: () => number

  private aliasTable: BookAlias[]
  private numberTable: Record<string, number>
  private compounds: string[][]
  private connectors: Set<string>
  private chapterWords: Set<string>
  private verseWords: Set<string>
  private rangeWords: Set<string>
  private fillers: Set<string>
  private substringPack: LanguagePack | null
  private substringAliases: Array<{ alias: string; canonical: string }> = []

  /*
   * The book the sermon is IN, as opposed to the book a sentence is in.
   *
   * pendingBook lives 8 seconds — long enough to join "Philippians chapter
   * four … verse six". But a preacher who read Exodus 4:7 and, a minute of
   * preaching later, says "let's go to chapter nine verse two" means Exodus
   * 9:2, and by then pendingBook is long gone: the chapter was discarded and
   * a bookless ":2" went out, which the session turned into Exodus 4:2.
   *
   * Only an EXPLICIT "chapter N" may borrow it. Bare numbers never do — that
   * is what the short window and the adjacency rule are for.
   */
  private lastBook: string | null = null
  private lastBookAt = 0
  private pendingBook: string | null = null
  private pendingChapter: number | null = null
  private pendingAt = 0
  /** True while nothing but fillers/connectors/keywords has been spoken since
   *  the pending book (or the last emitted reference). A bare number only
   *  attaches as chapter/verse while this holds — "Romans about three years
   *  later" must not become Romans 3, even though Romans is still pending
   *  for an explicit "chapter three" within the TTL. */
  private pendingAdjacent = false

  private lastEmitKey = ''
  private lastEmitAt = 0

  /** The reference parsed from the utterance currently in flight.
   *
   *  Deepgram sends cumulative partials, so "romans four twenty one" arrives as
   *  four separate re-parses and the third of them genuinely reads 4:20 — the
   *  words "twenty one" had not finished arriving. Emitting each parse as it
   *  came put 4:20 on the projector before 4:21, and 4:21 before 4:21-22.
   *
   *  A refinement cannot be recognised after the fact: the dedup below keys on
   *  the whole reference, so 4:20 and 4:21 are simply two different references.
   *  Hold an open number until isFinal or until non-reference words show
   *  that reading has moved past it. That boundary lets a complete reference
   *  reach preview while the preacher continues the sentence. */
  private heldEmit: (() => void) | null = null
  private heldAt = 0
  /** A closed reference already delivered during this same ASR utterance. */
  private earlyEmitKey = ''

  /** Whether the chunk being walked right now was the recogniser's final. */
  private utteranceFinal = true
  private explicitBook = false
  private committedVerse = false
  private partialContext: {
    pendingBook: string | null
    pendingChapter: number | null
    pendingAt: number
    pendingAdjacent: boolean
  } | null = null

  constructor(onDetection: VerseCallback, opts: ResolverOptions = {}) {
    this.onDetection = onDetection
    this.bareBookGate = opts.bareBookGate ?? (() => true)
    this.now = opts.now ?? Date.now
    const pack = opts.pack ?? null

    this.aliasTable = buildAliasTable(pack)
    this.numberTable = { ...EN_NUMBER_WORDS, ...(pack?.numberWords ?? {}) }
    this.compounds = [...(pack?.numberCompounds ?? [])].sort(
      (a, b) => b.length - a.length
    )
    this.connectors = new Set(['and', ...(pack?.numberConnectors ?? [])])
    this.chapterWords = new Set(['chapter', ...(pack?.chapterWords ?? [])])
    this.verseWords = new Set(['verse', 'verses', ...(pack?.verseWords ?? [])])
    this.rangeWords = new Set(['to', 'through', 'thru', ...(pack?.rangeWords ?? [])])
    this.fillers = new Set([...EN_FILLER, ...(pack?.fillers ?? [])])
    this.substringPack = pack?.matchMode === 'substring' ? pack : null
    if (this.substringPack) {
      this.substringAliases = Object.entries(this.substringPack.bookAliases)
        .flatMap(([canonical, list]) => list.map((alias) => ({ alias, canonical })))
        .sort((a, b) => b.alias.length - a.alias.length)
    }
  }

  reset(): void {
    this.pendingBook = null
    this.pendingChapter = null
    this.pendingAt = 0
    this.pendingAdjacent = false
    // An abandoned utterance must not surface later behind the next one.
    this.heldEmit = null
    this.earlyEmitKey = ''
  }

  /** Feed one ASR chunk. Partial chunks refresh state; finals detect fully. */
  process(text: string, isFinal: boolean): boolean {
    // Each partial replaces the recognizer's previous hypothesis.
    if (this.partialContext) {
      const words = mergeCompounds(normalizeWords(text), this.compounds)
      // A provider can split "John ... chapter three" into separate chunks.
      const continuation = isFinal && this.pendingBook && this.now() - this.pendingAt <= PENDING_TTL_MS &&
        (this.chapterWords.has(words[0]) || this.verseWords.has(words[0])) &&
        this.findBookMatches(words).length === 0
      if (!continuation) Object.assign(this, this.partialContext)
    }
    if (!isFinal && !this.partialContext) {
      this.partialContext = {
        pendingBook: this.pendingBook,
        pendingChapter: this.pendingChapter,
        pendingAt: this.pendingAt,
        pendingAdjacent: this.pendingAdjacent
      }
    }
    if (text.trim()) this.heldEmit = null
    this.explicitBook = false
    this.committedVerse = false
    this.utteranceFinal = isFinal
    try {
      if (text.trim()) this.walkChunk(text, isFinal)
    } finally {
      // A final releases whatever the partials settled on, including when the
      // final itself parsed nothing new — Deepgram often closes an utterance
      // with a chunk that adds no words, and the reference would otherwise sit
      // held forever.
      if (isFinal && this.heldEmit) {
        const held = this.heldEmit
        this.heldEmit = null
        if (this.now() - this.heldAt <= PENDING_TTL_MS) held()
      }
      if (isFinal) {
        this.earlyEmitKey = ''
        this.partialContext = null
        // Bare numbers may finish a chapter-only reference, not reopen one
        // that already has a verse in a different utterance.
        if (this.committedVerse) this.pendingAdjacent = false
      }
    }
    return this.committedVerse
  }

  discardPartial(): void {
    if (this.partialContext) Object.assign(this, this.partialContext)
    this.partialContext = null
    this.heldEmit = null
    this.earlyEmitKey = ''
  }

  private walkChunk(text: string, isFinal: boolean): void {
    const now = this.now()
    if (this.pendingBook && now - this.pendingAt > PENDING_TTL_MS) {
      const delivered = this.earlyEmitKey
      this.reset()
      this.earlyEmitKey = delivered
    }

    // Chinese path first (no word boundaries); the word path still runs
    // afterward so English code-switching keeps working.
    if (this.substringPack) {
      this.processSubstring(text, now)
    }

    const rawWords = mergeCompounds(normalizeWords(text), this.compounds)
    if (rawWords.length === 0) return
    const books = this.findBookMatches(rawWords)
    this.explicitBook ||= books.length > 0

    // Strip book-name words BEFORE number extraction, so "1 John 3 16"
    // never reads the leading "1" as a number.
    const stripped: { word: string; bookBoundary: BookMatch | null }[] = []
    let wi = 0
    let bi = 0
    while (wi < rawWords.length) {
      const b = books[bi]
      if (b && wi === b.start) {
        stripped.push({ word: ' BOOK', bookBoundary: b })
        wi = b.end
        bi++
      } else {
        stripped.push({ word: rawWords[wi], bookBoundary: null })
        wi++
      }
    }

    this.walk(stripped, isFinal, now)
  }

  /** Find book-name matches in the word stream (longest alias wins, no overlap). */
  private findBookMatches(words: string[]): BookMatch[] {
    const matches: BookMatch[] = []
    const taken = new Array<boolean>(words.length).fill(false)
    for (const alias of this.aliasTable) {
      const n = alias.words.length
      for (let i = 0; i + n <= words.length; i++) {
        let ok = true
        for (let k = 0; k < n; k++) {
          if (taken[i + k] || words[i + k] !== alias.words[k]) {
            ok = false
            break
          }
        }
        if (ok) {
          for (let k = 0; k < n; k++) taken[i + k] = true
          matches.push({ canonical: alias.canonical, start: i, end: i + n })
        }
      }
    }
    matches.sort((a, b) => a.start - b.start)
    return matches
  }

  private parseNum(
    words: string[],
    i: number
  ): { value: number; consumed: number } | null {
    return parseNumberWithTable(words, i, this.numberTable, this.connectors)
  }

  /* ------------- Chinese substring path ("约翰福音3章16节") ------------- */

  private processSubstring(text: string, now: number): void {
    const NUM = '[0-9〇零一二三四五六七八九十百]+'
    for (const { alias, canonical } of this.substringAliases) {
      let from = 0
      while (true) {
        const idx = text.indexOf(alias, from)
        if (idx === -1) break
        from = idx + alias.length
        const rest = text.slice(idx + alias.length)
        // "3章16节" | "三章十六节" | "23篇" (Psalms) | "3:16" | "一到五节"
        // (the verse-start 节 is only optional when a 到/至 range follows,
        // so a chapter followed by unrelated numerals is still chapter-only)
        let m = rest.match(
          new RegExp(
            `^\\s*第?(${NUM})[章篇][\\s,，]*(?:第?(${NUM})(?:[节節]|(?=[到至])))?(?:[到至](${NUM})[节節]?)?`
          )
        )
        if (!m) {
          m = rest.match(/^\s*([0-9]+)[:：]([0-9]+)(?:[-到至]([0-9]+))?/)
        }
        if (m) {
          const chapter = chineseNumberValue(m[1])
          const verse = m[2] !== undefined ? chineseNumberValue(m[2]) : null
          const rangeEnd = m[3] !== undefined ? chineseNumberValue(m[3]) : null
          if (chapter !== null) {
            this.explicitBook = true
            this.emit(canonical, chapter, verse, rangeEnd, verse !== null ? 0.95 : 0.9, now)
          }
        } else if (this.bareBookGate()) {
          this.emit(canonical, null, null, null, 0.9, now)
        }
      }
    }
  }

  /* ---------------------- word-mode walk ---------------------- */

  private walk(
    tokens: { word: string; bookBoundary: BookMatch | null }[],
    isFinal: boolean,
    now: number
  ): void {
    let i = 0

    while (i < tokens.length) {
      const t = tokens[i]

      if (t.bookBoundary) {
        const book = t.bookBoundary.canonical
        // "Psalm twenty three" — the number directly after Psalms is a chapter.
        this.pendingBook = book
        this.pendingChapter = null
        this.pendingAt = now
        this.pendingAdjacent = true

        const after = this.readReferenceNumbers(tokens, i + 1, book)
        if (after) {
          const { chapter, verse, rangeEnd, consumed, explicit } = after
          i += 1 + consumed
          this.emit(book, chapter, verse, rangeEnd, explicit ? 0.95 : 0.88, now, this.hasReferenceBoundary(tokens, i))
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

      if (this.chapterWords.has(t.word)) {
        const num = this.parseNum(tokens.map((x) => x.word), i + 1)
        if (num && !this.pendingBook && this.lastBook && now - this.lastBookAt < LAST_BOOK_TTL_MS) {
          this.pendingBook = this.lastBook
        }
        if (num && this.pendingBook) {
          this.pendingChapter = num.value
          this.pendingAt = now
          i += 1 + num.consumed
          // "chapter three verse sixteen" | "chapter three and verse sixteen"
          let j = i
          while (
            j < tokens.length &&
            (this.connectors.has(tokens[j].word) || this.fillers.has(tokens[j].word))
          )
            j++
          if (tokens[j] && this.verseWords.has(tokens[j].word)) {
            const v = this.parseNum(tokens.map((x) => x.word), j + 1)
            if (v) {
              const range =
                this.readRange(tokens, j + 1 + v.consumed) ??
                this.readAndPair(tokens, j + 1 + v.consumed, v.value)
              i = j + 1 + v.consumed + (range?.consumed ?? 0)
              this.emit(this.pendingBook, num.value, v.value, range?.end ?? null, 0.95, now, this.hasReferenceBoundary(tokens, i))
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
          while (j < tokens.length && (tokens[j].word === 'of' || this.fillers.has(tokens[j].word))) j++
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

      if (this.verseWords.has(t.word)) {
        const num = this.parseNum(tokens.map((x) => x.word), i + 1)
        if (num) {
          const range =
            this.readRange(tokens, i + 1 + num.consumed) ??
            this.readAndPair(tokens, i + 1 + num.consumed, num.value)
          const rangeEnd = range?.end ?? null
          if (this.pendingBook && this.pendingChapter) {
            this.emit(this.pendingBook, this.pendingChapter, num.value, rangeEnd, 0.95, now, this.hasReferenceBoundary(tokens, i + 1 + num.consumed + (range?.consumed ?? 0)))
          } else {
            // Bare "verse N" — session attaches it to current context.
            this.emit('', null, num.value, rangeEnd, 0.86, now)
          }
          i += 1 + num.consumed + (range?.consumed ?? 0)
          continue
        }
        i++
        continue
      }

      // Number continuation after a pending book: "John ... three ... sixteen".
      // Only while adjacent — a number spoken after intervening narrative
      // words ("Romans about three years later") is not a chapter.
      if (this.pendingBook && this.pendingAdjacent) {
        const num = this.parseNum(tokens.map((x) => x.word), i)
        if (num) {
          if (this.pendingChapter === null) {
            // Two consecutive numbers = chapter + verse ("three sixteen")
            const second = this.parseNum(tokens.map((x) => x.word), i + num.consumed)
            if (second) {
              i += num.consumed + second.consumed
              this.emit(this.pendingBook, num.value, second.value, null, 0.88, now, this.hasReferenceBoundary(tokens, i))
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
            this.emit(this.pendingBook, this.pendingChapter, num.value, null, 0.86, now, this.hasReferenceBoundary(tokens, i + num.consumed))
            i += num.consumed
            continue
          }
        }
      }

      // Any other word (not a filler/connector/keyword) breaks adjacency:
      // later bare numbers no longer attach to the pending book.
      if (!this.fillers.has(t.word) && !this.connectors.has(t.word)) {
        this.pendingAdjacent = false
      }
      i++
    }
  }

  /** After a book token: read "3 16", "3 verse 16", "chapter 3 verse 16". */
  private readReferenceNumbers(
    tokens: { word: string; bookBoundary: BookMatch | null }[],
    start: number,
    book?: string
  ): { chapter: number; verse: number | null; rangeEnd: number | null; consumed: number; explicit: boolean } | null {
    const words = tokens.map((x) => x.word)
    let i = start
    let explicit = false
    while (i < tokens.length && this.fillers.has(words[i])) i++
    if (this.chapterWords.has(words[i])) {
      explicit = true
      i++
    }
    // "Exodus 165": the transcriber ran "sixteen five" together into one
    // number. No book has that many chapters, so it is a chapter and a verse
    // written as one — the longest chapter the book has, then the rest.
    const chapters = book === undefined ? undefined : CHAPTER_COUNTS[bookIdMap[book]]
    if (chapters !== undefined && /^\d{3,4}$/.test(words[i] ?? '') && Number(words[i]) > chapters) {
      const digits = words[i]
      for (const split of [2, 1]) {
        const chapter = Number(digits.slice(0, split))
        const verse = Number(digits.slice(split))
        if (chapter >= 1 && chapter <= chapters && verse >= 1) {
          return { chapter, verse, rangeEnd: null, consumed: i + 1 - start, explicit }
        }
      }
    }
    const chap = this.parseNum(words, i)
    if (!chap) return null
    i += chap.consumed
    let j = i
    while (
      j < tokens.length &&
      (this.connectors.has(words[j]) || this.fillers.has(words[j]))
    )
      j++
    if (this.verseWords.has(words[j])) {
      explicit = true
      const v = this.parseNum(words, j + 1)
      if (v) {
        const range =
          this.readRange(tokens, j + 1 + v.consumed) ??
          this.readAndPair(tokens, j + 1 + v.consumed, v.value)
        return {
          chapter: chap.value,
          verse: v.value,
          rangeEnd: range?.end ?? null,
          consumed: j + 1 + v.consumed - start + (range?.consumed ?? 0),
          explicit
        }
      }
    }
    const v2 = this.parseNum(words, i)
    if (v2) {
      const range = this.readRange(tokens, i + v2.consumed)
      return {
        chapter: chap.value,
        verse: v2.value,
        rangeEnd: range?.end ?? null,
        consumed: i + v2.consumed - start + (range?.consumed ?? 0),
        explicit
      }
    }
    return { chapter: chap.value, verse: null, rangeEnd: null, consumed: i - start, explicit }
  }

  /** "to five" / "through five" / "al cinco" immediately after a verse number.
   *  Returns the range end AND the number of tokens used (range word + the
   *  number's tokens) so multi-word ends like "through thirty two" are fully
   *  consumed — callers used to assume exactly 2, leaking "two" as a verse. */
  private readRange(
    tokens: { word: string; bookBoundary: BookMatch | null }[],
    at: number
  ): { end: number; consumed: number } | null {
    const words = tokens.map((x) => x.word)
    if (this.rangeWords.has(words[at])) {
      const n = this.parseNum(words, at + 1)
      if (n) return { end: n.value, consumed: 1 + n.consumed }
    }
    return null
  }

  /**
   * "verse four and five" — two consecutive verses named together are one
   * passage, not two detections that replace each other on the screen.
   * Consecutive only: "verse four and nine" really is two places, and
   * "verse four and the Lord said" must not read "and" as a range at all.
   */
  private readAndPair(
    tokens: { word: string; bookBoundary: BookMatch | null }[],
    at: number,
    start: number
  ): { end: number; consumed: number } | null {
    const words = tokens.map((x) => x.word)
    if (words[at] !== 'and') return null
    let j = at + 1
    if (this.verseWords.has(words[j])) j++
    const n = this.parseNum(words, j)
    if (n && n.value === start + 1) return { end: n.value, consumed: j - at + n.consumed }
    return null
  }

  /** Reading has moved beyond the reference, so an interim number cannot
   * still grow from twenty to twenty one or acquire a range endpoint. */
  private hasReferenceBoundary(tokens: { word: string; bookBoundary: BookMatch | null }[], at: number): boolean {
    const token = tokens[at]
    if (!token) return false
    if (token.bookBoundary) return true
    if (this.connectors.has(token.word) || this.rangeWords.has(token.word) ||
      this.verseWords.has(token.word) || this.chapterWords.has(token.word) ||
      ['uh', 'um', 'ah'].includes(token.word)) return false
    return !this.parseNum(tokens.map((item) => item.word), at)
  }

  private emit(
    book: string,
    chapter: number | null,
    verse: number | null,
    rangeEnd: number | null,
    confidence: number,
    now: number,
    closed = false
  ): void {
    const key = `${book}|${chapter}|${verse}|${rangeEnd ?? ''}`

    // Mid-utterance: park the newest reading and let a later partial overwrite
    // it. Each partial re-parses the whole sentence, so the last one standing
    // when isFinal arrives is the complete reading — 4:21, never the 4:20 that
    // the truncated "romans four twenty" parsed to a moment earlier.
    if (!this.utteranceFinal && !(closed && book && chapter !== null && verse !== null && (this.explicitBook || confidence >= 0.95))) {
      const explicitBook = this.explicitBook
      this.heldAt = now
      this.heldEmit = () => this.commit(book, chapter, verse, rangeEnd, confidence, this.now(), explicitBook)
      return
    }

    this.heldEmit = null
    this.commit(book, chapter, verse, rangeEnd, confidence, now, this.explicitBook)
    if (!this.utteranceFinal) this.earlyEmitKey = key
  }

  /** The emit proper, once the utterance that produced it has settled. */
  private commit(
    book: string,
    chapter: number | null,
    verse: number | null,
    rangeEnd: number | null,
    confidence: number,
    now: number,
    explicitBook: boolean
  ): void {
    const key = `${book}|${chapter}|${verse}|${rangeEnd ?? ''}`
    const duplicate = key === this.earlyEmitKey || (key === this.lastEmitKey && now - this.lastEmitAt < DEDUP_WINDOW_MS)
    this.committedVerse = verse !== null
    if (chapter !== null) {
      this.pendingBook = book
      this.pendingChapter = chapter
      this.pendingAt = now
      this.pendingAdjacent = true
    }
    if (book) {
      this.lastBook = book
      this.lastBookAt = now
    }
    if (duplicate) return
    this.lastEmitKey = key
    this.lastEmitAt = now
    this.onDetection({
      type: 'verse',
      book,
      chapter,
      verse,
      rangeEnd,
      endVerse: rangeEnd,
      confidence,
      source: 'resolver',
      explicitBook
    })
  }
}

/* ------------------------------------------------------------------ */
/* mlClient-compatible surface (drop-in for the lost Python resolver)  */
/* ------------------------------------------------------------------ */

let resolver: SpokenReferenceResolver | null = null
let onVerseCb: ((data: any) => void) | null = null
let gate: BareBookGate = () => true
let activePack: LanguagePack | null = null

/** Lets main.ts wire the intent engine in after construction. */
export function setBareBookGate(g: BareBookGate): void {
  gate = g
}

/** Switch the resolver's language pack live (null = English only). */
export function setResolverLanguage(pack: LanguagePack | null): void {
  activePack = pack
  if (onVerseCb) {
    resolver = new SpokenReferenceResolver(onVerseCb, {
      bareBookGate: () => gate(),
      pack: activePack
    })
    console.log(`🌍 Resolver language: ${pack ? `${pack.label} (${pack.code}) + English` : 'English'}`)
  }
}

export function connectML(onVerse: (data: any) => void): void {
  onVerseCb = onVerse
  resolver = new SpokenReferenceResolver(onVerse, {
    bareBookGate: () => gate(),
    pack: activePack
  })
  console.log('🧠 In-process reference resolver ready (Python ML replaced)')
}

export function sendTranscript(text: string, isFinal = false): boolean {
  return resolver?.process(text, isFinal) ?? false
}

export function discardPartialReference(): void {
  resolver?.discardPartial()
}

export function disconnectML(): void {
  resolver = null
  onVerseCb = null
}
