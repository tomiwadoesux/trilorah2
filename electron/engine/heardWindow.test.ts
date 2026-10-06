import { describe, expect, it } from 'vitest'
import { HeardWindow } from './heardWindow'

describe('HeardWindow', () => {
  it('joins recent finals with the sentence still being spoken', () => {
    const heard = new HeardWindow()
    heard.note('when God told Abraham', true, 1_000)
    heard.note('that his only', false, 2_000)
    expect(heard.recent(3_000)).toBe('when God told Abraham that his only')
  })
  it('forgets what was said too long ago', () => {
    const heard = new HeardWindow()
    heard.note('when God told Abraham', true, 1_000)
    expect(heard.recent(40_000)).toBe('when God told Abraham')
    expect(heard.recent(60_000)).toBe('')
  })
  it('keeps only the newest words and drops a partial once it is final', () => {
    const heard = new HeardWindow()
    heard.note('one two', false, 1_000)
    heard.note('one two three', true, 1_500)
    heard.note('four five six', true, 2_000)
    expect(heard.recent(2_500, 45_000, 4)).toBe('three four five six')
  })
})
