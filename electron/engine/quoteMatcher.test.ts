import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuoteMatcher } from './quoteMatcher'

const engine = new QuoteMatcher()
beforeAll(() => { expect(engine.loadIndex()).toBe(true) })
beforeEach(() => engine.reset())

function hear(text: string, isFinal = false) {
  engine.updateTranscript(text, isFinal)
  return engine.tryDetectQuotes()
}

// The real corpus is deliberate: an invented one-verse index cannot tell us
// whether a short phrase is distinctive or shared across many Bible passages.
describe('QuoteMatcher — distinctive fragments across the Bible', () => {
  it.each([
    ['Jesus wept', 'John 11:35'],
    ['pray without ceasing', '1 Thessalonians 5:17'],
    ['rejoice evermore', '1 Thessalonians 5:16'],
  ])('recognizes the complete, corpus-verified short verse: %s', (text, reference) => {
    expect(hear(text)).toMatchObject([{ ref: reference, confidence: 1 }])
  })

  it('recognizes the opening before the whole sentence or ASR final', () => {
    expect(hear('For God so')).toEqual([])
    expect(hear('For God so loved')[0]).toMatchObject({ ref: 'John 3:16', confidence: 1, matchedWords: 4 })
  })

  it.each([
    ['his only begotten son that whosoever believeth in him', 'John 3:16'],
    ['should not perish but have everlasting life', 'John 3:16'],
    ['whoso offereth praise glorifieth me', 'Psalms 50:23'],
    ['the heavens declare the glory of god', 'Psalms 19:1'],
    ['a soft answer turneth away wrath', 'Proverbs 15:1'],
    ['the harvest is past the summer is ended', 'Jeremiah 8:20'],
    ['listen church this matters lean not unto thine own understanding because your situation does not tell the whole story', 'Proverbs 3:5'],
    ['all scripture is God breathed and is useful for instruction', '2 Timothy 3:16'],
    ['no weapon formed against you will prosper', 'Isaiah 54:17'],
    ['the spirit indeed is willing but the flesh is weak', 'Matthew 26:41'],
    ['how is it that ye have no faith', 'Mark 4:40'],
  ])('finds beginning, middle, or ending words: %s', (text, reference) => {
    expect(hear(text)[0]?.ref).toBe(reference)
  })

  it.each([
    'the lord is good',
    'he said unto them',
    'and it came to pass',
    'Jesus said to the people',
    'I have a meeting today and I want you to give me some time',
    'the meeting will start after the children finish their meal',
    'for God so hated the world',
    'all things work together when the team practices',
    'john explained that david borrowed a sword before the baseball game',
    'be kind',
    'Jesus slept',
    'Jesus wep',
    'pray without seating',
  ])('waits on generic, unrelated, or insufficiently supported speech: %s', (text) => {
    expect(hear(text)).toEqual([])
  })
})

describe('QuoteMatcher — recognition errors', () => {
  it.each([
    'for God so luved the world',
    'his only begoten son that whosoever believeth in him',
    'the heavens declair the glory of god',
    'should not perish but have everlasting lfie',
  ])('tolerates one spelling/ASR word error: %s', (text) => {
    expect(hear(text)[0]?.ref).toBe(text.startsWith('the heavens') ? 'Psalms 19:1' : 'John 3:16')
  })

  it.each([
    'for God loved the world that he gave',
    'his only son that whosoever believeth in him',
    'not perish but everlasting life',
    'the heavens clearly declare the glory of God',
  ])('tolerates an omitted or extra word: %s', (text) => {
    expect(hear(text)[0]?.ref).toBe(text.startsWith('the heavens') ? 'Psalms 19:1' : 'John 3:16')
  })

  it('requires more evidence before guessing from a damaged tiny fragment', () => {
    expect(hear('for God so luved')).toEqual([])
  })

  it('does not choose between equally plausible fuzzy verses', () => {
    const matcher = new QuoteMatcher()
    matcher.loadEntries([
      { ref: 'First 1:1', bookId: 0, chapter: 1, verse: 1, words: ['the', 'bold', 'shepherd', 'watched', 'his', 'sheep', 'all', 'night'] },
      { ref: 'Second 1:1', bookId: 1, chapter: 1, verse: 1, words: ['the', 'kind', 'shepherd', 'watched', 'his', 'sheep', 'all', 'night'] },
    ])
    matcher.updateTranscript('the old shepherd watched his sheep all night', false)
    // The shared long exact ending is legitimate as alternatives, never a
    // confident uniquely identified single reference.
    const results = matcher.tryDetectQuotes()
    expect(results.length === 0 || results.length === 2).toBe(true)
  })
})

describe('QuoteMatcher — streaming transcript lifecycle', () => {
  it('replaces cumulative interim hypotheses instead of appending repetitions', () => {
    hear('for God')
    hear('for God so')
    hear('for God so loved')
    expect(engine.getBufferState()).toEqual(['loved'])
  })

  it('removes an abandoned interim hypothesis', () => {
    hear('for God so loved')
    expect(hear('we will have lunch after the meeting')).toEqual([])
    expect(engine.getBufferState()).not.toContain('loved')
  })

  it('joins consecutive finalized chunks and the current interim', () => {
    expect(hear('for God so', true)).toEqual([])
    expect(hear('loved', false)[0]?.ref).toBe('John 3:16')
    hear('loved the world', true)
    expect(engine.getBufferState()).toEqual(['loved', 'world'])
  })

  it('does not emit the same quote again for growing partials and its final', () => {
    expect(hear('for God so loved')).toHaveLength(1)
    expect(hear('for God so loved the world')).toEqual([])
    expect(hear('for God so loved the world', true)).toEqual([])
    expect(engine.tryDetectQuotes()).toEqual([])
  })

  it('keeps a match available to reasoning tools after publishing it', () => {
    hear('for God so loved')
    expect(engine.findAllQuotedVerses()[0]?.ref).toBe('John 3:16')
  })

  it('does not return an old verse after unrelated new speech', () => {
    hear('for God so loved the world', true)
    expect(hear('please bring the attendance records to the office', true)).toEqual([])
  })

  it('resets a listening session without rebuilding the corpus', () => {
    hear('for God so loved')
    engine.reset()
    expect(hear('for God so loved')[0]?.ref).toBe('John 3:16')
  })

  it('does not combine disconnected speech after a long silence', () => {
    vi.useFakeTimers()
    try {
      expect(hear('for God so', true)).toEqual([])
      vi.advanceTimersByTime(31_000)
      expect(hear('loved the world')).toEqual([])
      expect(engine.getBufferState()).toEqual(['loved', 'world'])
    } finally { vi.useRealTimers() }
  })

  it('does not treat two translations of the same verse as an ambiguity', () => {
    const results = hear('for God so loved')
    expect(results).toHaveLength(1)
    expect(results[0].ref).toBe('John 3:16')
  })
})
