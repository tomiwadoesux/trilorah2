import { describe, expect, it, vi } from 'vitest'
import corpus from '../data/passages/bsb-sections.json'
import { PassageMatcher } from './passageMatcher'

describe('PassageMatcher — sourced local passages', () => {
  const engine = new PassageMatcher()

  it('covers all 66 books with nonempty, unique, same-chapter sections', () => {
    expect(new Set(corpus.sections.map(section => section.book)).size).toBe(66)
    expect(corpus.sections.length).toBeGreaterThan(3000)
    expect(new Set(corpus.sections.map(section => section.id)).size).toBe(corpus.sections.length)
    for (const section of corpus.sections) {
      expect(section.verse).toBe(section.verses[0].verse)
      expect(section.endVerse).toBe(section.verses.at(-1)?.verse)
      for (const verse of section.verses) {
        expect(verse.text).not.toMatch(/\\(?:w|f|x|v|q)|strong=/)
        expect(verse.text.length).toBeGreaterThan(1)
      }
    }
  })

  it('recognises a story before the speaker quotes or finishes a sentence', () => {
    expect(new PassageMatcher().updateTranscript('when David faced Goliath', false)).toMatchObject({
      passageId: 'BSB:1SA:17:38', book: '1 Samuel', chapter: 17, verse: 38, endVerse: 58,
    })
  })

  it('finds unnamed story details and narrows to the relevant verse', () => {
    expect(engine.detect('A shepherd boy picked five smooth stones before approaching the giant')).toMatchObject({
      book: '1 Samuel', chapter: 17, verse: 40, endVerse: 40,
    })
  })

  it('accepts paraphrased weapons and narrows without changing the story identity', () => {
    const initial = engine.detect('David faced Goliath')
    const specific = engine.detect('He told the giant you have weapons but I come in the name of the Lord')
    expect(specific).toMatchObject({ ref: '1 Samuel 17:45', passageId: initial?.passageId })
    expect(specific?.evidence).toContain('name-of-lord')
  })

  it('tolerates a distinctive name with a single transcription error', () => {
    expect(engine.detect('David faced Goliat')).toMatchObject({ book: '1 Samuel', chapter: 17 })
  })

  it.each([
    ['A Samaritan helped the man left beaten beside the road', 'Luke', 10, 30],
    ['After wasting his inheritance the younger son returned home and his father ran to meet him', 'Luke', 15, 20],
    ['Daniel was thrown into the den of lions', 'Daniel', 6, 16],
    ['Jonah was swallowed by a great fish for three days', 'Jonah', 1, 17],
  ])('retrieves the sourced account: %s', (text, book, chapter, verse) => {
    const found = engine.detect(text)
    expect(found).toMatchObject({ book, chapter })
    expect(found!.verse).toBeLessThanOrEqual(verse)
    expect(found!.endVerse).toBeGreaterThanOrEqual(verse)
  })

  it.each([
    'We all have giants in our lives',
    'God will help us overcome the storms',
    'Love and faith give us hope for tomorrow',
    'Please collect the offering and welcome our visitors',
    'I went to the shop and bought five stones for the garden',
    'My son and my father came home yesterday',
    'David ran away from Goliath',
    'Goliath killed David',
    'Daniel was thrown into the fiery furnace',
    'Jonah built the ark',
  ])('abstains from generic, unrelated or contradictory speech: %s', text => {
    expect(engine.detect(text)).toBeNull()
  })

  it('replaces interim revisions rather than accumulating their words', () => {
    const matcher = new PassageMatcher()
    expect(matcher.updateTranscript('David', false)).toBeNull()
    expect(matcher.updateTranscript('We face giants in business', false)).toBeNull()
    expect(matcher.updateTranscript('We face giants in business', true)).toBeNull()
  })

  it('retains final context and expires it after a listening gap', () => {
    vi.useFakeTimers()
    try {
      const matcher = new PassageMatcher()
      matcher.updateTranscript('David faced Goliath', true)
      expect(matcher.updateTranscript('He had five smooth stones', false)).toMatchObject({ book: '1 Samuel', chapter: 17 })
      vi.advanceTimersByTime(30_001)
      expect(matcher.updateTranscript('He had a problem to overcome', false)).toBeNull()
      matcher.updateTranscript('David faced Goliath', true)
      matcher.reset()
      expect(matcher.updateTranscript('He had a problem to overcome', false)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not reuse the old story when the current speech supplies no matching evidence', () => {
    const matcher = new PassageMatcher()
    matcher.updateTranscript('when David faced Goliath', true)
    expect(matcher.updateTranscript('the Lords prayer', true)).toBeNull()
    expect(matcher.updateTranscript('the ten commandments', true)).toBeNull()
    expect(matcher.updateTranscript('welcome everyone to the service', true)).toBeNull()
  })
})
