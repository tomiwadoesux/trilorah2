import corpus from '../data/passages/bsb-sections.json'

export interface SearchCorrection { from: string; to: string }

// Use the Bible's actual vocabulary. Keep real words and ambiguous guesses intact.
const vocabulary = new Set<string>()
const neighboringWords = new Set<string>()
for (const section of corpus.sections) {
  for (const text of [section.title, ...section.verses.map(verse => verse.text)]) {
    const words = text.toLowerCase().match(/[a-z]+/g) ?? []
    for (const [index, word] of words.entries()) {
      vocabulary.add(word)
      if (index) neighboringWords.add(`${words[index - 1]} ${word}`)
    }
  }
}
const byLength = new Map<number, string[]>()
for (const word of vocabulary) {
  const words = byLength.get(word.length) ?? []
  words.push(word)
  byLength.set(word.length, words)
}

/** Bounded edit distance, including adjacent swapped letters. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  let beforePrevious = previous
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], beforePrevious[j - 2] + 1)
    }
    if (Math.min(...row) > limit) return limit + 1
    beforePrevious = previous
    previous = row
  }
  return previous[b.length]
}

const cache = new Map<string, string[]>()
function candidatesFor(word: string): string[] {
  if (vocabulary.has(word) || word.length < 5 || word.length > 24) return [word]
  const cached = cache.get(word)
  if (cached !== undefined) return cached
  const limit = word.length >= 8 ? 2 : 1
  let best = limit + 1
  let matches: string[] = []
  for (let length = word.length - limit; length <= word.length + limit; length++) {
    for (const candidate of byLength.get(length) ?? []) {
      const edits = distance(word, candidate, limit)
      if (edits > limit) continue
      if (edits < best) { best = edits; matches = [candidate] }
      else if (edits === best) matches.push(candidate)
    }
  }
  if (cache.size >= 500) cache.clear()
  cache.set(word, matches)
  return matches
}

export function correctSearchSpelling(text: string): { text: string; corrections: SearchCorrection[] } {
  const corrections: SearchCorrection[] = []
  const words = [...text.matchAll(/[\p{L}\p{M}]+/gu)].map(match => match[0].toLowerCase())
  let index = 0
  // Unicode word boundaries keep non-English words intact rather than correcting fragments.
  const corrected = text.replace(/[\p{L}\p{M}]+/gu, original => {
    const at = index++
    if (!/^[a-z]+$/i.test(original)) return original
    const candidates = candidatesFor(original.toLowerCase())
    // Surrounding words can settle a tie, e.g. “the stomr” → “the storm”.
    // If several readings fit the context, keep the original spelling.
    const contextual = candidates.filter(candidate =>
      neighboringWords.has(`${words[at - 1]} ${candidate}`) || neighboringWords.has(`${candidate} ${words[at + 1]}`))
    const replacement = candidates.length === 1 ? candidates[0] : contextual.length === 1 ? contextual[0] : original.toLowerCase()
    if (replacement === original.toLowerCase()) return original
    const to = /^[A-Z]/.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement
    corrections.push({ from: original, to })
    return to
  })
  return { text: corrected, corrections }
}
