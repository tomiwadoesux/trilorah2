import { describe, expect, it, vi } from 'vitest'
import { AllusionFinder } from './allusionFinder'
import type { SemanticCandidate, SemanticMatcher } from './semanticMatcher'

const candidate: SemanticCandidate = {
  passageId: 'test-john-11', ref: 'John 11:1-3', book: 'John', chapter: 11, verse: 1, endVerse: 3,
  title: 'Lazarus', text: 'Lazarus was sick.', evidence: ['lazarus'], meaning: .7, overlap: .5, score: .8, confident: false,
}
function setup(score: number | null = 3, confident = false) {
  const search = vi.fn(async () => [{ ...candidate, confident }])
  const detectStory = vi.fn(() => null)
  const finder = new AllusionFinder({
    semantic: { ready: true, search } as unknown as SemanticMatcher,
    judge: score === null ? null : async () => score,
    detectStory,
  })
  return { finder, search, detectStory }
}
const spoken = { spoken: true }

describe('spoken passage search relevance', () => {
  it('does not let the passage on the wall rescue a weak match', async () => {
    const { finder } = setup(1)
    finder.sermon.noteLive('John', 11, 1000)
    const words = 'he waited two more days before going to them'.split(' ')
    expect(await finder.find(words, 2000, spoken)).toEqual([])
    expect(await finder.find(words, 2000)).toHaveLength(1)
  })

  it('requires independent meaning and wording evidence if the judge is unavailable', async () => {
    expect(await setup(null).finder.find(['Lazarus', 'was', 'sick'], 0, spoken)).toEqual([])
    expect(await setup(null, true).finder.find(['Lazarus', 'was', 'sick'], 0, spoken)).toHaveLength(1)
  })

  it.each([
    'Let us pray Father thank you for your word in Jesus name amen',
    'he called me last night about the school meeting',
    'Goliath killed David with a stone',
    'Jonah built an ark before the flood',
    'Daniel was thrown into the fiery furnace',
  ])('does not turn unsupported speech into a related Bible answer: %s', async text => {
    const { finder, search, detectStory } = setup(10)
    expect(await finder.find(text.split(' '), 0, spoken)).toEqual([])
    expect(search).not.toHaveBeenCalled()
    expect(detectStory).not.toHaveBeenCalled()
  })

  it('keeps the full utterance and a focused25-word reading with its remembered subject', async () => {
    const { finder, search } = setup(3)
    finder.names.note('Think about Noah', 1000)
    const words = ('now I want you to listen to me very carefully this morning because what I am about to say is important for somebody sitting here in this room today ' +
      'he kept building for years while people laughed and then the rain came').split(' ')
    await finder.find(words, 2000, spoken)
    const queries = search.mock.calls.map(call => (call as unknown as [string])[0])
    expect(queries).toContain(words.join(' '))
    expect(queries).toContain(`noah ${words.slice(-25).join(' ')}`)
  })

  it('rejects an invalid relevance score', async () => {
    expect(await setup(Number.NaN).finder.find(['Lazarus', 'was', 'sick'], 0, spoken)).toEqual([])
  })
})
