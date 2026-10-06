import * as fs from 'node:fs'
import * as path from 'node:path'
import modernBible from '../data/passages/bsb-sections.json'

const STOPWORDS = new Set([
  'the',
  'and',
  'but',
  'will',
  'that',
  'have',
  'come',
  'lord',
  'god',
  'shall',
  'unto',
  'said',
  'they',
  'them',
  'with',
  'from',
  'your',
  'this',
  'was',
  'were',
  'not',
  'all',
  'you',
  'are',
  'his',
  'her',
  'our',
  'for',
  'can',
  'has',
  'had',
  'been',
  'who',
  'what',
  'when',
  'there',
  'which',
  'would',
  'could',
  'should',
  'about',
  'into',
  'just',
  'also',
  'very',
  'then',
  'than',
  'here',
  'know',
  'want',
  'make',
  'like',
  'time',
  'people',
  'way',
  'day',
  'man',
  'thing',
  'see',
  'look',
  'a',
  'an',
  'in',
  'on',
  'at',
  'to',
  'of',
  'by',
  'is',
  'it',
  'be',
  'do',
  'or',
  'so',
  'if',
  'as',
  'no',
  'up',
  'he',
  'she',
  'we',
  'me',
  'him',
  'us',
  'my',
  'its'
])

/** Keep original word order: removing 'for God so' loses useful quote evidence. */
export interface BibleIndexEntry {
  ref: string
  bookId: number
  chapter: number
  verse: number
  /** Legacy substantive words, retained for older packaged indexes. */
  words: string[]
  rawWords?: string[]
}

export interface QuoteMatch {
  ref: string
  bookId: number
  chapter: number
  verse: number
  /** Word-alignment strength, not a probability that the preacher intended this verse. */
  confidence: number
  lowConfidence: boolean
  matchedWords?: number
}

type Evidence = QuoteMatch & { score: number; start: number; end: number; errors: number }
type Alignment = {
  heard: number; verse: number; exact: number; errors: number; typo: number
  informative: Set<string>
}

const MAX_CONTEXT_WORDS = 64
const MAX_SEARCH_WORDS = 28
const MAX_FRAGMENT_WORDS = 16
const MAX_CANDIDATES = 160
// Short English phrases can be unique in the Bible yet ordinary in a meeting
// ("a sword before the", "all things work together"). Permit tiny quotations
// only for these distinctive anchors, still verified against the actual corpus.
// All other Bible verses use the same longer-fragment evidence rules below.
const SHORT_QUOTE_ANCHORS = new Set([
  'for god so loved',
  'the lord is my shepherd',
  'i am the resurrection',
])
// These are complete verses, not a general permission to guess from two words.
const COMPLETE_SHORT_QUOTES = new Set([
  'jesus wept',
  'pray without ceasing',
  'rejoice evermore',
])

/** One letter inserted, removed, replaced, or transposed; never fuzzy-match short words. */
function oneLetterApart(a: string, b: string): boolean {
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  if (a.length === b.length) {
    return a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

export class QuoteMatcher {
  verses: BibleIndexEntry[] = []
  wordIndex: Record<string, number[]> = Object.create(null)
  /** Compatibility/debug view: finalized and current interim words, without stopwords. */
  rollingWords: string[] = []
  lastQuoteRef: string | null = null
  lastQuoteTime = 0
  isLoaded = false
  private finalizedWords: string[] = []
  private interimWords: string[] = []
  private currentChunkLength = 0
  private indexedVerses: BibleIndexEntry[] | null = null
  private phraseCounts = new Map<string, number>()
  private revision = 0
  private searchedRevision = -1
  private cachedMatches: QuoteMatch[] = []
  private lastPublishedRevision = -1
  private lastSpeechAt: number | null = null

  loadIndex(): boolean {
    try {
      const candidates = [path.join(process.cwd(), 'electron', 'data', 'bible_index.json')]
      if (process.resourcesPath) candidates.unshift(path.join(process.resourcesPath, 'bible_index.json'))
      const file = candidates.find((candidate) => fs.existsSync(candidate))
      if (!file) throw new Error('bible_index.json not found. Run npm run bible:index first.')
      const kjv = JSON.parse(fs.readFileSync(file, 'utf8')) as BibleIndexEntry[]
      const bookIds = new Map(kjv.map(verse => [verse.ref.replace(/ \d+:\d+$/, ''), verse.bookId]))
      const modern = modernBible.sections.flatMap(section => section.verses.map(verse => {
        const rawWords = this.normalizeText(verse.text)
        return {
          ref: `${section.book} ${section.chapter}:${verse.verse}`,
          bookId: bookIds.get(section.book) ?? -1,
          chapter: section.chapter,
          verse: verse.verse,
          words: rawWords.filter(word => !STOPWORDS.has(word)),
          rawWords,
        }
      })).filter(verse => verse.bookId >= 0)
      this.loadEntries([...kjv, ...modern])
      console.log(`✅ QuoteMatcher loaded: ${new Set(this.verses.map(verse => verse.ref)).size} references, ${this.verses.length} KJV/BSB wordings`)
      return true
    } catch (error) {
      console.error('❌ Failed to load quote index:', error)
      return false
    }
  }

  /** Also accepts legacy indexes; raw phrases require the rebuilt index. */
  loadEntries(entries: BibleIndexEntry[]) {
    this.verses = entries
    this.wordIndex = Object.create(null)
    entries.forEach((verse, index) => {
      for (const word of new Set(verse.rawWords ?? verse.words)) {
        (this.wordIndex[word] ??= []).push(index)
      }
    })
    this.indexedVerses = entries
    this.phraseCounts.clear()
    this.isLoaded = true
    this.searchedRevision = -1
  }

  normalizeText(text: string): string[] {
    return text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  }

  /** Deepgram revises its interim sentence. Replace it; only finals are appended. */
  updateTranscript(text: string, isFinal: boolean) {
    const now = Date.now()
    if (this.lastSpeechAt !== null && now - this.lastSpeechAt > 30_000) this.reset()
    this.lastSpeechAt = now
    const words = this.normalizeText(text)
    this.currentChunkLength = words.length
    if (isFinal) {
      this.finalizedWords = [...this.finalizedWords, ...words].slice(-MAX_CONTEXT_WORDS)
      this.interimWords = []
    } else {
      this.interimWords = words.slice(-MAX_CONTEXT_WORDS)
    }
    this.rollingWords = [...this.finalizedWords, ...this.interimWords].filter((word) => !STOPWORDS.has(word))
    this.revision++
  }

  /** Existing callers can append a finalized chunk through this API. */
  updateRollingWords(text: string) { this.updateTranscript(text, true) }

  clearBuffer() {
    this.finalizedWords = []
    this.interimWords = []
    this.currentChunkLength = 0
    this.rollingWords = []
    this.revision++
  }

  /** A new listening session (or replay) must not inherit the previous one's dedup. */
  reset() {
    this.clearBuffer()
    this.lastQuoteRef = null
    this.lastQuoteTime = 0
    this.lastPublishedRevision = -1
    this.lastSpeechAt = null
  }

  private wordsFor(index: number): string[] {
    const verse = this.verses[index]
    return verse.rawWords ?? verse.words
  }

  /** Count up to two occurrences across verses, not just the shortlisted candidates. */
  private phraseFrequency(words: string[]): number {
    const key = words.join(' ')
    const cached = this.phraseCounts.get(key)
    if (cached !== undefined) return cached
    const references = new Set<string>()
    const anchor = words.reduce((best, word) =>
      (this.wordIndex[word]?.length ?? 0) < (this.wordIndex[best]?.length ?? 0) ? word : best)
    for (const index of this.wordIndex[anchor] ?? []) {
      const verse = this.wordsFor(index)
      if (verse.some((_, start) => words.every((word, offset) => word === verse[start + offset]))) references.add(this.verses[index].ref)
      if (references.size >= 2) break
    }
    // A bounded cache avoids growing throughout an entire service.
    if (this.phraseCounts.size >= 512) this.phraseCounts.clear()
    this.phraseCounts.set(key, references.size)
    return references.size
  }

  private candidates(words: string[]): number[] {
    const unique = [...new Set(words.slice(-18))]
    const anchors = unique.filter((word) => !STOPWORDS.has(word) && this.wordIndex[word]?.length)
      .sort((a, b) => this.wordIndex[a].length - this.wordIndex[b].length).slice(0, 8)
    const votes = new Map<number, number>()
    for (const word of anchors) {
      const weight = Math.log1p(this.verses.length / this.wordIndex[word].length)
      for (const index of this.wordIndex[word]) votes.set(index, (votes.get(index) ?? 0) + weight)
    }
    return [...votes].sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES).map(([index]) => index)
  }

  private align(words: string[], index: number, freshStart: number, similar: (a: string, b: string) => boolean): Evidence | null {
    const verse = this.verses[index]
    const target = this.wordsFor(index)
    let best: Evidence | null = null
    const rareLimit = Math.max(2, this.verses.length * 0.015)
    const inspect = (start: number, origin: number, state: Alignment) => {
      const heardLength = state.heard - start
      const targetLength = state.verse - origin
      const length = Math.max(heardLength, targetLength)
      const matched = state.exact + state.typo
      // A final ASR chunk may include commentary after a quotation. Search
      // anywhere in this chunk, but never resurrect a quote entirely in an old one.
      if (length < 2 || matched < 2 || state.heard <= freshStart) return
      const phrase = words.slice(start, state.heard).join(' ')
      const completeShortVerse = state.errors === 0 && origin === 0 && state.verse === target.length && COMPLETE_SHORT_QUOTES.has(phrase)
      if (!completeShortVerse && (length < 4 || matched < 4)) return
      const content = [...state.informative]
      if (!content.length) return
      const information = content.reduce((sum, word) => sum + Math.log1p(this.verses.length / (this.wordIndex[word]?.length ?? this.verses.length)), 0)
      if (state.errors === 0 && length < 6) {
        const anchor = completeShortVerse || SHORT_QUOTE_ANCHORS.has(phrase)
        if (!anchor && (length < 5 || content.length < 3 || information < 8)) return
        if (!content.some((word) => this.wordIndex[word]?.length <= rareLimit)) return
        if (this.phraseFrequency(words.slice(start, state.heard)) !== 1) return
      } else {
        // Error tolerance requires more independent evidence than a tiny fragment.
        if (length < 6 || state.exact < 4 || content.length < 2) return
        if (this.verses.length > 100 && information < 5) return
      }
      const confidence = Math.min(1, (state.exact + state.typo * 0.8) / length)
      if (confidence < 0.72) return
      const score = matched * 1.2 + information * 0.45 - state.errors * 1.5 + state.heard / words.length * 0.25
      if (best && best.score >= score) return
      best = {
        ref: verse.ref, bookId: verse.bookId, chapter: verse.chapter, verse: verse.verse,
        confidence, lowConfidence: confidence < 0.85, matchedWords: matched,
        score, start, end: state.heard, errors: state.errors
      }
    }
    const extend = (start: number, origin: number, state: Alignment) => {
      while (state.heard < words.length && state.verse < target.length && state.heard - start < MAX_FRAGMENT_WORDS) {
        const heard = words[state.heard]
        const expected = target[state.verse]
        if (heard === expected) {
          state = { ...state, heard: state.heard + 1, verse: state.verse + 1, exact: state.exact + 1,
            informative: STOPWORDS.has(expected) ? state.informative : new Set([...state.informative, expected]) }
          inspect(start, origin, state)
          continue
        }
        if (state.errors) return
        if (similar(heard, expected)) {
          extend(start, origin, { ...state, heard: state.heard + 1, verse: state.verse + 1, errors: 1, typo: 1,
            informative: STOPWORDS.has(expected) ? state.informative : new Set([...state.informative, expected]) })
        }
        // One wrong, omitted, or extra ASR word. Further errors stop the alignment.
        extend(start, origin, { ...state, heard: state.heard + 1, verse: state.verse + 1, errors: 1 })
        extend(start, origin, { ...state, heard: state.heard + 1, errors: 1 })
        extend(start, origin, { ...state, verse: state.verse + 1, errors: 1 })
        return
      }
    }
    for (let start = 0; start <= words.length - 2; start++) {
      for (let origin = 0; origin <= target.length - 2; origin++) {
        if (words[start] !== target[origin]) continue
        extend(start, origin, { heard: start, verse: origin, exact: 0, errors: 0, typo: 0, informative: new Set() })
      }
    }
    return best
  }

  findAllQuotedVerses(): QuoteMatch[] {
    if (!this.isLoaded) return []
    if (this.indexedVerses !== this.verses) this.loadEntries(this.verses)
    if (this.searchedRevision === this.revision) return this.cachedMatches.map((match) => ({ ...match }))
    const words = [...this.finalizedWords, ...this.interimWords].slice(-MAX_SEARCH_WORDS)
    const freshStart = Math.max(0, words.length - this.currentChunkLength)
    const spellings = new Map<string, boolean>()
    const similar = (a: string, b: string) => {
      const key = `${a}:${b}`
      if (!spellings.has(key)) spellings.set(key, oneLetterApart(a, b))
      return spellings.get(key)!
    }
    const aligned = words.length < 2 ? [] : this.candidates(words)
      .map((index) => this.align(words, index, freshStart, similar))
      .filter((match): match is Evidence => match !== null)
    const byReference = new Map<string, Evidence>()
    for (const match of aligned) {
      if ((byReference.get(match.ref)?.score ?? -Infinity) < match.score) byReference.set(match.ref, match)
    }
    const ranked = [...byReference.values()].sort((a, b) => b.score - a.score)
    // Nearly tied fuzzy fragments need more speech. Long exact parallel passages
    // can still return alternatives for the operator, without choosing one for them.
    const ambiguous = ranked[0]?.errors > 0 && ranked[1] && ranked[0].score - ranked[1].score < 1.25
    this.cachedMatches = ambiguous ? [] : ranked.slice(0, 6).map(({ score: _score, start: _start, end: _end, errors: _errors, ...match }) => match)
    this.searchedRevision = this.revision
    return this.cachedMatches.map((match) => ({ ...match }))
  }

  findQuotedVerse(): QuoteMatch | null { return this.findAllQuotedVerses()[0] ?? null }

  tryDetectQuotes(): QuoteMatch[] {
    if (this.lastPublishedRevision === this.revision) return []
    const results = this.findAllQuotedVerses()
    if (!results.length) return []
    const now = Date.now()
    if (results[0].ref === this.lastQuoteRef && now - this.lastQuoteTime < 15_000) return []
    this.lastQuoteRef = results[0].ref
    this.lastQuoteTime = now
    this.lastPublishedRevision = this.revision
    // Keep context while the current interim sentence is being revised/finalized.
    return results
  }

  tryDetectQuote(): QuoteMatch | null { return this.tryDetectQuotes()[0] ?? null }
  getBufferState(): string[] { return [...this.rollingWords] }
}

let instance: QuoteMatcher | null = null
export function getQuoteMatcher(): QuoteMatcher {
  if (!instance) instance = new QuoteMatcher()
  return instance
}
