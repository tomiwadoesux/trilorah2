import { describe, expect, it } from 'vitest'
import { parseRecipe } from './schema'
import { QUESTIONS, stepsFromTrail, teach, type WatchRecord } from './teach'

const verseBox: WatchRecord = { path: '0/3', role: 'AXTextField', description: 'scripture search', actions: ['AXConfirm'] }
const songBox: WatchRecord = { path: '0/4', role: 'AXTextField', description: 'song search', actions: ['AXConfirm'] }
const tab: WatchRecord = { path: '0/1/2', role: 'AXRadioButton', title: 'Scriptures', actions: ['AXPress'] }
const goLive: WatchRecord = { path: '0/9', role: 'AXButton', title: 'Go Live', actions: ['AXPress'] }
const clear: WatchRecord = { path: '0/10', role: 'AXButton', title: 'Clear', actions: ['AXPress'] }

describe('the six questions', () => {
  it('writes a recipe from what the operator showed, in the order asked', async () => {
    const asked: string[] = []
    const answers: Record<string, WatchRecord[]> = { findVerse: [verseBox], findSong: [songBox], show: [goLive], clear: [clear], next: [], previous: [] }
    const result = await teach(async (ability) => answers[ability], {
      platform: 'macos', app: { id: 'com.example.slides', name: 'Slides' }, say: (_ask, a) => asked.push(a), now: () => new Date('2026-11-10T12:00:00Z'),
    })
    expect(asked).toEqual(['findVerse', 'findSong', 'show', 'clear', 'next', 'previous'])
    expect(result.skipped).toEqual(['next', 'previous'])
    const recipe = parseRecipe(result.recipe)
    expect(recipe?.abilities.show?.[0]).toMatchObject({ path: '0/9', role: 'AXButton', name: 'Go Live', label: 'the go-live button ("Go Live")', action: { do: 'press' } })
    expect(recipe?.abilities.findVerse?.[0].action).toEqual({ do: 'type', text: '$query', submit: true })
    expect(recipe?.abilities.findSong?.[0]).toMatchObject({ path: '0/4', label: `the song search box ("song search")` })
    expect(recipe?.taught).toEqual({ by: 'operator', at: '2026-11-10T12:00:00.000Z' })
  })

  it('without the show answer there is no recipe, and it says why', async () => {
    const result = await teach(async (ability) => (ability === 'findVerse' ? [verseBox] : []), {
      platform: 'macos', app: { id: 'com.example.slides', name: 'Slides' },
    })
    expect(result.recipe).toBeNull()
    expect(result.problem).toContain('cannot put anything on its screen')
  })

  it('a trail keeps every click: the last is the target, the way there is enroute presses', () => {
    const steps = stepsFromTrail('findVerse', [tab, verseBox])
    expect(steps).toHaveLength(2)
    expect(steps[0]).toMatchObject({ path: '0/1/2', enroute: true, label: 'on the way: radio button "Scriptures"', action: { do: 'press' } })
    expect(steps[1]).toMatchObject({ path: '0/3', action: { do: 'type', text: '$query', submit: true } })
    expect(steps[1].enroute).toBeUndefined()
  })

  it('a trail to a plain button ends on a press, never a type', () => {
    const steps = stepsFromTrail('show', [tab, goLive])
    expect(steps[1].action).toEqual({ do: 'press' })
  })

  it('a one-click answer has no enroute steps and survives a round trip through parse', () => {
    const recipe = parseRecipe({
      format: 1, platform: 'macos', app: { id: 'x', name: 'X' },
      abilities: { show: stepsFromTrail('show', [goLive]), findVerse: stepsFromTrail('findVerse', [tab, verseBox]) },
      taught: { by: 'operator', at: '2026-11-10T12:00:00Z' },
    })
    expect(recipe?.abilities.show?.[0].enroute).toBeUndefined()
    expect(recipe?.abilities.findVerse?.[0].enroute).toBe(true)
  })

  it('asks for the one required answer, and verses and songs apart', () => {
    expect(QUESTIONS.filter((q) => q.required).map((q) => q.ability)).toEqual(['show'])
    expect(QUESTIONS.map((q) => q.ability).slice(0, 2)).toEqual(['findVerse', 'findSong'])
  })
})
