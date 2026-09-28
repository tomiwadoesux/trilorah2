import { describe, expect, it } from 'vitest'
import { FalsePositiveFilter } from './falsePositiveFilter'

describe('FalsePositiveFilter — complete named references', () => {
  const filter = new FalsePositiveFilter()
  const john = { book: 'John', chapter: 3, verse: 16, confidence: 0.88 }

  it('accepts an explicit reference after an anecdote about a person', () => {
    expect(filter.shouldBlock({ ...john, explicitBook: true }, ['brother', 'john', 'spoke', 'john', '3:16'], 'sermon')).toBe(false)
  })

  it('accepts explicit verse previews during another service segment', () => {
    for (const segment of ['worship', 'announcements'] as const) expect(filter.shouldBlock({ ...john, explicitBook: true }, ['john', '3:16'], segment)).toBe(false)
  })

  it('still blocks an ambiguous narrative mention', () => {
    expect(filter.shouldBlock(john, ['brother', 'john', 'spoke'], 'sermon')).toBe(true)
  })
})
