import { describe, expect, it } from 'vitest'
import { cuesFromWatch, parseRecipe, selectorWords } from './schema'

const good = {
  format: 1,
  platform: 'macos',
  app: { id: 'com.apple.TextEdit', name: 'TextEdit' },
  abilities: {
    find: [{ path: '0/6', role: 'AXComboBox', name: 'font size', action: { do: 'type', text: '$query', submit: true } }],
    show: [{ path: '0/1/0', role: 'AXCheckBox', name: 'bold', action: { do: 'press' } }],
    clear: [{ action: { do: 'menu', path: 'Edit>Select All' } }, { action: { do: 'key', keys: 'delete' } }],
  },
  taught: { by: 'operator', at: '2026-11-10T12:00:00Z' },
}

describe('recipes', () => {
  it('accepts a taught recipe and keeps every cue', () => {
    const r = parseRecipe(good)
    expect(r?.abilities.show?.[0]).toMatchObject({ path: '0/1/0', role: 'AXCheckBox', name: 'bold' })
    expect(r?.taught.by).toBe('operator')
  })

  it('refuses a recipe that cannot put anything on the screen', () => {
    expect(parseRecipe({ ...good, abilities: { clear: good.abilities.clear } })).toBeNull()
  })

  it('refuses a press with nothing to aim at, and unknown actions', () => {
    expect(parseRecipe({ ...good, abilities: { show: [{ action: { do: 'press' } }] } })).toBeNull()
    expect(parseRecipe({ ...good, abilities: { show: [{ name: 'x', action: { do: 'launch-missiles' } }] } })).toBeNull()
  })

  it('turns a watch record into cues, and cues into selector words with the path first', () => {
    const cues = cuesFromWatch({ path: '0/1/0', role: 'AXCheckBox', description: 'bold', actions: ['AXPress'] }, 'the bold button')
    expect(cues).toEqual({ path: '0/1/0', role: 'AXCheckBox', name: 'bold', label: 'the bold button' })
    expect(selectorWords(cues)).toEqual(['path:0/1/0', 'role:AXCheckBox', 'name:bold'])
  })
})
