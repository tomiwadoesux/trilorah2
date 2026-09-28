import { describe, expect, it } from 'vitest'
import { QuoteMatcher } from './quoteMatcher'

function matcher(ref: string, words: string[]) {
  const engine = new QuoteMatcher()
  engine.verses = [{ ref, bookId: 0, chapter: 1, verse: 1, words }]
  engine.wordIndex = Object.fromEntries(words.map((word) => [word, [0]]))
  engine.isLoaded = true
  return engine
}

describe('QuoteMatcher — matching thresholds', () => {
  it('can match a general verse requiring six substantive words', () => {
    const words = ['whoso', 'offereth', 'praise', 'glorifieth', 'ordereth', 'conversation']
    const engine = matcher('Psalms 50:23', words)
    engine.updateRollingWords(words.join(' '))
    expect(engine.tryDetectQuotes()).toMatchObject([{ ref: 'Psalms 50:23', confidence: 1 }])
  })

  it('keeps five-word matching for a familiar verse', () => {
    const words = ['world', 'loved', 'only', 'begotten', 'son']
    const engine = matcher('John 3:16', words)
    engine.updateRollingWords(words.join(' '))
    expect(engine.tryDetectQuotes()).toMatchObject([{ ref: 'John 3:16' }])
  })

  it('does not relax the general-verse threshold to five words', () => {
    const words = ['whoso', 'offereth', 'praise', 'glorifieth', 'ordereth', 'conversation']
    const engine = matcher('Psalms 50:23', words)
    engine.updateRollingWords(words.slice(0, 5).join(' '))
    expect(engine.tryDetectQuotes()).toEqual([])
  })

  it('keeps the strongest match across different window sizes', () => {
    const words = ['world', 'loved', 'only', 'begotten', 'son', 'everlasting']
    const engine = matcher('John 3:16', words)
    engine.updateRollingWords('world loved only begotten son mercy')
    expect(engine.tryDetectQuotes()).toMatchObject([{ ref: 'John 3:16', confidence: 1 }])
  })
})
