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
  it('searches a new topic without bringing back a story from earlier speech', () => {
    const heard = new HeardWindow()
    heard.note('Abraham took Isaac up the mountain', true, 1000)
    heard.note('the car park is closed next sunday for repairs', true, 12000)
    expect(heard.forSearch(13000)).toBe('the car park is closed next sunday for repairs')
  })
  it('carries a nearby fragment but not an old sentence', () => {
    const heard = new HeardWindow()
    heard.note('Abraham took Isaac', true, 1000)
    heard.note('up the mountain', false, 2000)
    expect(heard.forSearch(3000)).toBe('Abraham took Isaac up the mountain')
    heard.note('David faced Goliath', false, 10000)
    expect(heard.forSearch(11000)).toBe('David faced Goliath')
    expect(heard.forSearch(60000)).toBe('')
  })
  it('preserves earlier actions in a long utterance and clears them on reset', () => {
    const heard = new HeardWindow()
    const text = 'Goliath killed David ' + Array(30).fill('word').join(' ')
    heard.note(text, true, 1000)
    expect(heard.forSearch(2000)).toBe(text)
    heard.reset()
    expect(heard.forSearch(2000)).toBe('')
  })
})
