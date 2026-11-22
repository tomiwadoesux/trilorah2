import { describe, expect, it } from 'vitest'
import { searchSongsLive, tailWords } from './liveSearch'

const WAY_MAKER = {
  id: 'way-maker',
  title: 'Way Maker',
  sections: [{ label: 'chorus', lines: ['way maker miracle worker promise keeper', 'light in the darkness my God that is who you are'] }],
}
const GOODNESS = {
  id: 'goodness',
  title: 'Goodness of God',
  sections: [{ label: 'chorus', lines: ['all my life you have been faithful', 'all my life you have been so so good'] }],
}
/** Same chorus line as Way Maker, to force a tie the schedule must break. */
const COVER = {
  id: 'cover',
  title: 'Way Maker (acoustic)',
  sections: [{ label: 'chorus', lines: ['way maker miracle worker promise keeper'] }],
}

const onPlan = (...ids: string[]) => [{
  label: 'Worship',
  items: ids.map((id) => ({ key: id, source: 'song' as const, label: id, songId: id })),
}]

describe('searchSongsLive', () => {
  it('finds the song whose line was heard and says which section', () => {
    const matches = searchSongsLive('as we sing way maker miracle worker promise keeper', [WAY_MAKER, GOODNESS], [])
    expect(matches[0]).toMatchObject({ id: 'way-maker', title: 'Way Maker', section: 'chorus' })
    expect(matches[0].score).toBeGreaterThan(0)
    expect(matches[0].scheduled).toBeUndefined()
  })

  it('ranks a scheduled song ahead of an equal library match', () => {
    const heard = 'way maker miracle worker promise keeper'
    const without = searchSongsLive(heard, [WAY_MAKER, COVER], [])
    expect(without[0].id).toBe('way-maker')
    const withPlan = searchSongsLive(heard, [WAY_MAKER, COVER], onPlan('cover'))
    expect(withPlan[0]).toMatchObject({ id: 'cover', scheduled: true })
    expect(withPlan[1].id).toBe('way-maker')
  })

  it('never resurrects a scheduled song whose line was not heard', () => {
    const matches = searchSongsLive('way maker miracle worker promise keeper', [WAY_MAKER, GOODNESS], onPlan('goodness'))
    expect(matches.map((m) => m.id)).not.toContain('goodness')
  })

  it('matches nothing on plain talk', () => {
    expect(searchSongsLive('please take your seats and greet your neighbour', [WAY_MAKER, GOODNESS], [])).toEqual([])
  })
})

describe('tailWords', () => {
  it('joins the finalized lines and the line still forming', () => {
    expect(tailWords(['all my life you', 'have been faithful'], 'all my')).toBe('all my life you have been faithful all my')
  })

  it('keeps only the newest words', () => {
    expect(tailWords(['one two three four'], 'five six', 3)).toBe('four five six')
  })

  it('is empty before anything was heard', () => {
    expect(tailWords([], '')).toBe('')
  })
})
