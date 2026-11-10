import { describe, expect, it } from 'vitest'
import { parseRecipe } from './schema'
import { QUESTIONS, stepFromRecord, teach, type WatchRecord } from './teach'

const box: WatchRecord = { path: '0/3', role: 'AXTextField', description: 'search', actions: ['AXConfirm'] }
const goLive: WatchRecord = { path: '0/9', role: 'AXButton', title: 'Go Live', actions: ['AXPress'] }
const clear: WatchRecord = { path: '0/10', role: 'AXButton', title: 'Clear', actions: ['AXPress'] }

describe('the four questions', () => {
  it('writes a recipe from what the operator showed, in the order asked', async () => {
    const asked: string[] = []
    const answers: Record<string, WatchRecord[]> = { find: [box], show: [goLive], clear: [clear], next: [], previous: [] }
    const result = await teach(async (ability) => answers[ability], {
      platform: 'macos', app: { id: 'com.example.slides', name: 'Slides' }, say: (_ask, a) => asked.push(a), now: () => new Date('2026-11-10T12:00:00Z'),
    })
    expect(asked).toEqual(['find', 'show', 'clear', 'next', 'previous'])
    expect(result.skipped).toEqual(['next', 'previous'])
    const recipe = parseRecipe(result.recipe)
    expect(recipe?.abilities.show?.[0]).toMatchObject({ path: '0/9', role: 'AXButton', name: 'Go Live', label: 'the go-live button ("Go Live")', action: { do: 'press' } })
    expect(recipe?.abilities.find?.[0].action).toEqual({ do: 'type', text: '$query', submit: true })
    expect(recipe?.taught).toEqual({ by: 'operator', at: '2026-11-10T12:00:00.000Z' })
  })

  it('without the show answer there is no recipe, and it says why', async () => {
    const result = await teach(async (ability) => (ability === 'find' ? [box] : []), {
      platform: 'macos', app: { id: 'com.example.slides', name: 'Slides' },
    })
    expect(result.recipe).toBeNull()
    expect(result.problem).toContain('cannot put anything on its screen')
  })

  it('a text-like control types even outside the find question; a button presses', () => {
    expect(stepFromRecord('show', { role: 'AXComboBox', title: 'slide number' }).action.do).toBe('type')
    expect(stepFromRecord('clear', clear).action.do).toBe('press')
  })

  it('asks for the one required answer and four optional ones', () => {
    expect(QUESTIONS.filter((q) => q.required).map((q) => q.ability)).toEqual(['show'])
  })
})
