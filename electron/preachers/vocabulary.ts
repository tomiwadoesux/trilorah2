/**
 * Per-preacher vocabulary — the names, titles and church words the ASR
 * keeps mangling ("Pastor Ayotomiwa" → "pastor i owe to me one").
 *
 * Two uses:
 *   applyVocabulary()   post-correct a transcript: any span that SOUNDS
 *                       like a term is replaced by the term
 *   deepgramKeywords()  feed the same terms to Deepgram as keyword boosts
 *
 * Pure module: storage dir injected, no Electron. Persists to
 * <storageDir>/vocabulary/<safeId>.json.
 */

import fs from 'node:fs'
import path from 'node:path'
import { phoneticKey } from './correctionLedger'

export interface Vocabulary {
  terms: string[]
}

/** Common English words a single-word span must never be replaced from. */
const STOPLIST = new Set(
  (
    'the a an and or but to of in on at for with by from is are was were be been being ' +
    'i you he she it we they me him her us them my your his our their this that these those ' +
    'one two three four five six seven eight nine ten not no yes so if then than when what who ' +
    'how why where which there here now here will would can could shall should may might must ' +
    'do does did done have has had as about into over under like just more most own oh yeah ' +
    'amen god lord jesus christ verse verses chapter say said says go come came all some any ' +
    'up down out off back next again also very only even because while after before through ' +
    'let us pray thank love'
  ).split(/\s+/)
)

function letters(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = cur
  }
  return prev[b.length]
}

function hasSilentE(w: string): boolean {
  const groups = (w.match(/[aeiou]+/g) ?? []).length
  return w.length > 2 && w.endsWith('e') && !w.endsWith('ee') && groups > 1
}

/** Rough syllable count: vowel groups, minus a trailing silent "e". */
function syllables(word: string): number {
  const w = letters(word)
  if (!w) return 0
  const groups = (w.match(/[aeiou]+/g) ?? []).length
  return Math.max(1, groups - (hasSilentE(w) ? 1 : 0))
}

/** "owe" → "ow", "one" → "on": the silent e is not a sound. */
function spoken(word: string): string {
  const w = letters(word)
  return hasSilentE(w) ? w.slice(0, -1) : w
}

/** Consonant skeleton with vowels (and glides w/y/h) folded to one marker. */
function shape(s: string): string {
  return s.replace(/[aeiouwyh]+/g, 'V').replace(/(.)\1+/g, '$1')
}

function isVowel(c: string): boolean {
  return 'aeiou'.includes(c)
}

/**
 * Does a transcript span sound like `term`?
 *  1. exact / phonetic-key match
 *  2. Levenshtein ≤ max(1, ⌊len/4⌋)
 *  3. for multi-word spans (ASR split one name into several short words):
 *     same syllable count, near-identical consonant skeleton, same opening
 *     sound class and comparable length.
 */
export function soundsLike(spanWords: string[], term: string): boolean {
  const a = letters(spanWords.join(''))
  const b = letters(term)
  if (!a || !b) return false
  if (a === b) return true
  if (phoneticKey(a) === phoneticKey(b)) return true
  if (levenshtein(a, b) <= Math.max(1, Math.floor(b.length / 4))) return true
  if (spanWords.length >= 2 && b.length >= 6) {
    const sylA = spanWords.reduce((n, w) => n + syllables(w), 0)
    if (sylA !== syllables(b)) return false
    const sa = spanWords.map(spoken).join('')
    const sb = spoken(b)
    const ratio = sa.length / sb.length
    if (ratio < 0.8 || ratio > 1.3) return false
    if (isVowel(sa[0]) !== isVowel(sb[0])) return false
    return levenshtein(shape(sa), shape(sb)) <= 1
  }
  return false
}

function maxSpanFor(termWord: string): number {
  return Math.max(1, Math.min(6, Math.ceil(letters(termWord).length / 2)))
}

/**
 * Try to align `termWords` against `words` starting at `i`; returns how many
 * transcript words were consumed, or 0. Shortest span per term word wins
 * (so "ayotomiwa is" never swallows "is").
 */
function alignTerm(words: string[], i: number, termWords: string[], k = 0): number {
  if (k === termWords.length) return 0
  const tw = termWords[k]
  const max = maxSpanFor(tw)
  for (let n = 1; n <= max && i + n <= words.length; n++) {
    const span = words.slice(i, i + n)
    if (n === 1 && STOPLIST.has(letters(span[0])) && letters(span[0]) !== letters(tw)) continue
    if (!soundsLike(span, tw)) continue
    if (k === termWords.length - 1) return n
    const rest = alignTerm(words, i + n, termWords, k + 1)
    if (rest > 0) return n + rest
  }
  return 0
}

/**
 * Replace every span that sounds like a vocabulary term with the term
 * itself (the term's own capitalisation is kept). Unrelated text is left
 * untouched — exact common words are never replaced.
 */
export function applyVocabulary(text: string, terms: string[]): string {
  const cleanTerms = terms.map((t) => t.trim()).filter((t) => letters(t).length > 0)
  if (cleanTerms.length === 0 || !text.trim()) return text
  const tokens = text.split(/\s+/).filter(Boolean)
  const words = tokens.map((t) => t.toLowerCase())
  const out: string[] = []
  let i = 0
  while (i < tokens.length) {
    let replaced = false
    for (const term of cleanTerms) {
      const termWords = term.split(/\s+/)
      const consumed = alignTerm(words, i, termWords)
      if (consumed === 0) continue
      // exact match already in the transcript → keep the term's casing anyway
      const trailing = tokens[i + consumed - 1].match(/[^\p{L}\p{M}\p{N}]+$/u)?.[0] ?? ''
      out.push(term + trailing)
      i += consumed
      replaced = true
      break
    }
    if (!replaced) {
      out.push(tokens[i])
      i++
    }
  }
  return out.join(' ')
}

/** Deepgram `keywords` params — one boosted word per distinct vocabulary word. */
export function deepgramKeywords(terms: string[], boost = 2): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of terms) {
    for (const w of term.split(/\s+/)) {
      const clean = w.replace(/[^\p{L}\p{M}\p{N}'-]/gu, '')
      const key = clean.toLowerCase()
      if (key.length < 3 || STOPLIST.has(key) || seen.has(key)) continue
      seen.add(key)
      out.push(`${clean}:${boost}`)
    }
  }
  return out
}

export class VocabularyStore {
  private dir: string
  private cache = new Map<string, Vocabulary>()

  constructor(storageDir: string) {
    this.dir = path.join(storageDir, 'vocabulary')
  }

  private filePath(preacherId: string): string {
    const safe = preacherId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(this.dir, `${safe}.json`)
  }

  get(preacherId: string): Vocabulary {
    const cached = this.cache.get(preacherId)
    if (cached) return cached
    let data: Vocabulary
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath(preacherId), 'utf-8'))
      data = { terms: Array.isArray(parsed.terms) ? parsed.terms : [] }
    } catch {
      data = { terms: [] }
    }
    this.cache.set(preacherId, data)
    return data
  }

  set(preacherId: string, terms: string[]): Vocabulary {
    const unique = [...new Set(terms.map((t) => t.trim()).filter(Boolean))]
    const data = { terms: unique }
    this.cache.set(preacherId, data)
    try {
      fs.mkdirSync(this.dir, { recursive: true })
      fs.writeFileSync(this.filePath(preacherId), JSON.stringify(data, null, 2))
    } catch (e) {
      console.error('❌ vocabulary save failed:', e)
    }
    console.log(`📚 Vocabulary for ${preacherId}: ${unique.length} terms`)
    return data
  }

  add(preacherId: string, term: string): Vocabulary {
    return this.set(preacherId, [...this.get(preacherId).terms, term])
  }

  remove(preacherId: string, term: string): Vocabulary {
    const t = term.trim().toLowerCase()
    return this.set(
      preacherId,
      this.get(preacherId).terms.filter((x) => x.toLowerCase() !== t)
    )
  }
}
