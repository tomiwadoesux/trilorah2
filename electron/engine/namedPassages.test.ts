import { describe, it, expect } from 'vitest'
import { findNamedPassage } from './namedPassages'

describe('named passages', () => {
  it('finds the Lord\'s Prayer however it is punctuated', () => {
    for (const t of ["bring up the Lord's Prayer please", 'the lords prayer', 'Let us look at The Lord’s prayer.']) {
      expect(findNamedPassage(t)).toMatchObject({ book: 'Matthew', chapter: 6, verse: 9, end: 13 })
    }
  })
  it('prefers the longer name', () => {
    expect(findNamedPassage('the parable of the lost sheep')?.name).toBe('parable of the lost sheep')
  })
  it('knows the pew-Bible headings', () => {
    expect(findNamedPassage('david and goliath')).toMatchObject({ book: '1 Samuel', chapter: 17 })
    expect(findNamedPassage('turn to the beatitudes')).toMatchObject({ book: 'Matthew', chapter: 5, verse: 3 })
    expect(findNamedPassage('the ten commandments')).toMatchObject({ book: 'Exodus', chapter: 20 })
  })
  it('ordinary preaching vocabulary is not a passage', () => {
    for (const t of ['you must be born again', 'after the fall we were lost', 'he is risen indeed', 'on the day he arrived']) {
      expect(findNamedPassage(t)).toBeNull()
    }
  })
})
