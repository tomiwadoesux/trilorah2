import * as fs from 'node:fs'
import * as path from 'node:path'

const FAMOUS_VERSES: Record<string, number> = {
  // John
  'John 3:16': 3,
  'John 1:1': 3,
  'John 14:6': 3,
  'John 11:35': 3,
  'John 8:32': 3,
  'John 10:10': 3,
  'John 15:13': 3,
  'John 3:3': 3,
  'John 1:14': 3,
  'John 14:1': 3,
  'John 14:27': 3,
  // Romans
  'Romans 8:28': 3,
  'Romans 3:23': 3,
  'Romans 6:23': 3,
  'Romans 5:8': 3,
  'Romans 10:9': 3,
  'Romans 10:10': 3,
  'Romans 8:1': 3,
  'Romans 8:38': 3,
  'Romans 12:1': 3,
  'Romans 12:2': 3,
  // Psalms
  'Psalms 23:1': 3,
  'Psalms 23:4': 3,
  'Psalms 46:1': 3,
  'Psalms 119:105': 3,
  'Psalms 27:1': 3,
  'Psalms 37:4': 3,
  'Psalms 91:1': 3,
  'Psalms 100:1': 3,
  'Psalms 139:14': 3,
  'Psalms 34:8': 3,
  'Psalms 118:24': 3,
  'Psalms 121:1': 3,
  'Psalms 51:10': 3,
  // Proverbs
  'Proverbs 3:5': 3,
  'Proverbs 3:6': 3,
  'Proverbs 22:6': 3,
  'Proverbs 18:21': 3,
  'Proverbs 27:17': 3,
  'Proverbs 4:23': 3,
  'Proverbs 16:3': 3,
  'Proverbs 31:10': 3,
  // Genesis
  'Genesis 1:1': 3,
  'Genesis 1:27': 3,
  'Genesis 12:1': 3,
  // Isaiah
  'Isaiah 40:31': 3,
  'Isaiah 41:10': 3,
  'Isaiah 53:5': 3,
  'Isaiah 55:8': 3,
  'Isaiah 55:9': 3,
  'Isaiah 54:17': 3,
  'Isaiah 9:6': 3,
  'Isaiah 26:3': 3,
  'Isaiah 43:2': 3,
  'Isaiah 61:1': 3,
  // Jeremiah
  'Jeremiah 29:11': 3,
  'Jeremiah 33:3': 3,
  'Jeremiah 1:5': 3,
  // Matthew
  'Matthew 6:33': 3,
  'Matthew 11:28': 3,
  'Matthew 28:19': 3,
  'Matthew 28:20': 3,
  'Matthew 5:14': 3,
  'Matthew 5:16': 3,
  'Matthew 7:7': 3,
  'Matthew 18:20': 3,
  'Matthew 19:26': 3,
  'Matthew 22:37': 3,
  // Philippians
  'Philippians 4:13': 3,
  'Philippians 4:6': 3,
  'Philippians 4:7': 3,
  'Philippians 4:8': 3,
  'Philippians 2:10': 3,
  'Philippians 1:6': 3,
  // Ephesians
  'Ephesians 2:8': 3,
  'Ephesians 2:9': 3,
  'Ephesians 6:11': 3,
  'Ephesians 6:12': 3,
  'Ephesians 3:20': 3,
  // Galatians
  'Galatians 2:20': 3,
  'Galatians 5:22': 3,
  // Hebrews
  'Hebrews 11:1': 3,
  'Hebrews 12:1': 3,
  'Hebrews 12:2': 3,
  'Hebrews 13:8': 3,
  'Hebrews 4:12': 3,
  'Hebrews 11:6': 3,
  // 2 Timothy
  '2 Timothy 1:7': 3,
  '2 Timothy 3:16': 3,
  // 1 Corinthians
  '1 Corinthians 13:4': 3,
  '1 Corinthians 13:13': 3,
  '1 Corinthians 10:13': 3,
  // 2 Corinthians
  '2 Corinthians 5:17': 3,
  '2 Corinthians 5:7': 3,
  '2 Corinthians 12:9': 3,
  // Colossians
  'Colossians 3:23': 3,
  // 1 Peter
  '1 Peter 5:7': 3,
  // James
  'James 1:2': 3,
  'James 1:5': 3,
  'James 4:7': 3,
  // Revelation
  'Revelation 3:20': 3,
  'Revelation 21:4': 3,
  // Deuteronomy
  'Deuteronomy 31:6': 3,
  // Joshua
  'Joshua 1:9': 3,
  // Micah
  'Micah 6:8': 3,
  // Habakkuk
  'Habakkuk 2:2': 3,
  // Malachi
  'Malachi 3:10': 3,
  // Luke
  'Luke 1:37': 3,
  // Mark
  'Mark 11:24': 3,
  // Acts
  'Acts 1:8': 3,
  'Acts 2:38': 3,
  // 1 John
  '1 John 1:9': 3,
  '1 John 4:4': 3,
  '1 John 4:8': 3
}

const WELL_KNOWN_VERSES: Record<string, number> = {
  'Psalms 23:2': 4,
  'Psalms 23:3': 4,
  'Psalms 23:5': 4,
  'Psalms 23:6': 4,
  'Romans 8:29': 4,
  'Romans 8:30': 4,
  'Romans 8:31': 4,
  'Isaiah 53:4': 4,
  'Isaiah 53:6': 4,
  'John 3:17': 4,
  'John 14:2': 4,
  'John 14:3': 4,
  'Matthew 5:3': 4,
  'Matthew 5:4': 4,
  'Matthew 5:5': 4,
  'Matthew 5:6': 4,
  'Matthew 5:7': 4,
  'Matthew 5:8': 4,
  'Matthew 5:9': 4,
  '1 Corinthians 13:5': 4,
  '1 Corinthians 13:6': 4,
  '1 Corinthians 13:7': 4,
  'Ephesians 6:13': 4,
  'Ephesians 6:14': 4,
  'Ephesians 6:15': 4,
  'Ephesians 6:16': 4,
  'Ephesians 6:17': 4,
  'Galatians 5:23': 4,
  'Genesis 1:2': 4,
  'Genesis 1:3': 4
}

const DEFAULT_MIN_MATCHES = 6

function getMinMatches(ref: string): number {
  if (FAMOUS_VERSES[ref] !== undefined) return FAMOUS_VERSES[ref]
  if (WELL_KNOWN_VERSES[ref] !== undefined) return WELL_KNOWN_VERSES[ref]
  return DEFAULT_MIN_MATCHES
}

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

const WINDOW_SIZE = 5

/** One entry of bible_index.json — the pre-built quote-matching index. */
export interface BibleIndexEntry {
  ref: string
  bookId: number
  chapter: number
  verse: number
  words: string[]
}

export interface QuoteMatch {
  ref: string
  bookId: number
  chapter: number
  verse: number
  confidence: number
  lowConfidence: boolean
  matchedWords?: number
}

export class QuoteMatcher {
  verses: BibleIndexEntry[]
  wordIndex: Record<string, number[]>
  rollingWords: string[]
  lastQuoteRef: string | null
  lastQuoteTime: number
  isLoaded: boolean

  constructor() {
    this.verses = []
    this.wordIndex = {}
    this.rollingWords = []
    this.lastQuoteRef = null
    this.lastQuoteTime = 0
    this.isLoaded = false
  }

  /**
   * Load Bible index and build all-words lookup
   * The all-words index allows matching from ANY position in a verse,
   * not just the beginning
   */
  loadIndex(): boolean {
    try {
      const dataDir = path.join(process.cwd(), 'electron', 'data')
      const versesPath = path.join(dataDir, 'bible_index.json')
      if (!fs.existsSync(versesPath)) {
        console.error(
          '❌ bible_index.json not found. Run build scripts first.'
        )
        return false
      }
      this.verses = JSON.parse(fs.readFileSync(versesPath, 'utf8'))
      this.wordIndex = {}
      this.verses.forEach((v, i) => {
        const uniqueWords = new Set(v.words)
        for (const word of uniqueWords) {
          if (STOPWORDS.has(word)) continue
          if (!this.wordIndex[word]) this.wordIndex[word] = []
          this.wordIndex[word].push(i)
        }
      })
      this.isLoaded = true
      console.log(
        `✅ QuoteMatcher loaded: ${this.verses.length} verses, ${Object.keys(this.wordIndex).length} unique words indexed`
      )
      return true
    } catch (error) {
      console.error('❌ Failed to load quote index:', error)
      return false
    }
  }

  /**
   * Normalize text to word array
   */
  normalizeText(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)
  }

  /**
   * Update rolling word buffer with new transcript text
   */
  updateRollingWords(text: string) {
    const words = this.normalizeText(text).filter((w) => !STOPWORDS.has(w))
    this.rollingWords.push(...words)
    if (this.rollingWords.length > 60) {
      this.rollingWords = this.rollingWords.slice(-60)
    }
  }

  /**
   * Clear the rolling word buffer
   */
  clearBuffer() {
    this.rollingWords = []
  }

  /**
   * Count matching words at same positions
   */
  countMatches(a: string[], b: string[]): number {
    let matches = 0
    for (let i = 0; i < a.length && i < b.length; i++) {
      if (a[i] === b[i]) matches++
    }
    return matches
  }

  /**
   * Find the rarest word in a set (fewest verses containing it)
   * Used to minimize candidate lookups for performance
   */
  getRarestWord(words: string[]): string {
    let rarest = words[0]
    let minCount = this.wordIndex[rarest]?.length ?? Infinity
    for (const word of words) {
      const count = this.wordIndex[word]?.length ?? Infinity
      if (count < minCount) {
        minCount = count
        rarest = word
      }
    }
    return rarest
  }

  /**
   * Find ALL quoted verses matching the rolling buffer
   * Uses rarest-word lookup for performance, supports mid-verse matching
   */
  findAllQuotedVerses(): QuoteMatch[] {
    if (!this.isLoaded || this.rollingWords.length < WINDOW_SIZE) return []
    const matches: QuoteMatch[] = []
    const seenRefs = new Set<string>()
    for (let i = 0; i <= this.rollingWords.length - WINDOW_SIZE; i++) {
      const win = this.rollingWords.slice(i, i + WINDOW_SIZE)
      const rarestWord = this.getRarestWord(win)
      const candidates = this.wordIndex[rarestWord]
      if (!candidates) continue
      for (const verseIdx of candidates) {
        const verse = this.verses[verseIdx]
        if (!verse || verse.words.length < WINDOW_SIZE) continue
        if (seenRefs.has(verse.ref)) continue
        for (let j = 0; j <= verse.words.length - WINDOW_SIZE; j++) {
          const verseSlice = verse.words.slice(j, j + WINDOW_SIZE)
          const matchCount = this.countMatches(win, verseSlice)
          const minRequired = getMinMatches(verse.ref)
          if (matchCount >= minRequired) {
            let substantiveMatches = 0
            for (let k = 0; k < WINDOW_SIZE && k < win.length && k < verseSlice.length; k++) {
              if (win[k] === verseSlice[k] && !STOPWORDS.has(win[k])) {
                substantiveMatches++
              }
            }
            if (substantiveMatches < 2) break
            seenRefs.add(verse.ref)
            const confidence = matchCount / WINDOW_SIZE
            matches.push({
              ref: verse.ref,
              bookId: verse.bookId,
              chapter: verse.chapter,
              verse: verse.verse,
              confidence,
              lowConfidence: confidence < 0.8
            })
            break
          }
        }
      }
    }
    matches.sort((a, b) => b.confidence - a.confidence)
    return matches
  }

  /**
   * Find a single quoted verse (backwards-compatible)
   */
  findQuotedVerse(): QuoteMatch | null {
    const results = this.findAllQuotedVerses()
    return results.length > 0 ? results[0] : null
  }

  /**
   * Try to detect quotes with debouncing
   * Returns all matching verses (may be multiple with similar wording)
   */
  tryDetectQuotes(): QuoteMatch[] {
    const results = this.findAllQuotedVerses()
    const now = Date.now()
    if (results.length === 0) return []
    const bestRef = results[0].ref
    if (bestRef === this.lastQuoteRef && now - this.lastQuoteTime < 1500) {
      return []
    }
    this.lastQuoteRef = bestRef
    this.lastQuoteTime = now
    this.rollingWords = []
    console.log(
      `📜 Quote detected: ${results.length} candidate(s), best: ${bestRef}`
    )
    return results
  }

  /**
   * Single-result version (backwards-compatible)
   */
  tryDetectQuote(): QuoteMatch | null {
    const results = this.tryDetectQuotes()
    return results.length > 0 ? results[0] : null
  }

  /**
   * Get current rolling buffer state (for debugging)
   */
  getBufferState(): string[] {
    return [...this.rollingWords]
  }
}

let instance: QuoteMatcher | null = null

export function getQuoteMatcher(): QuoteMatcher {
  if (!instance) {
    instance = new QuoteMatcher()
  }
  return instance
}
