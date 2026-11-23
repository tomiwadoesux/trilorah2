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

  it('keeps the Windows window class as a cue, so the Songs tab is not the SONGS heading', () => {
    const cues = cuesFromWatch({ path: '0/1/0/1/0/0/1/1', role: 'Pane', title: 'Songs', class: 'TsdImageButton', id: '69754' }, 'the Songs tab')
    expect(cues).toMatchObject({ class: 'TsdImageButton', id: '69754' })
    expect(selectorWords(cues)).toEqual(['path:0/1/0/1/0/0/1/1', 'role:Pane', 'id:69754', 'class:TsdImageButton', 'name:Songs'])
    const r = parseRecipe({ ...good, platform: 'windows', abilities: { show: [{ role: 'Pane', class: 'TsdSpeedButton', name: 'Go Live', action: { do: 'press' } }] } })
    expect(r?.abilities.show?.[0]).toMatchObject({ class: 'TsdSpeedButton', name: 'Go Live' })
  })
})

describe('old recipes', () => {
  it("the four-question days' one 'find' serves as both finds until re-taught", () => {
    const r = parseRecipe(good)
    expect(r?.abilities.findVerse?.[0]).toMatchObject({ path: '0/6' })
    expect(r?.abilities.findSong?.[0]).toMatchObject({ path: '0/6' })
    expect((r?.abilities as Record<string, unknown>)?.find).toBeUndefined()
  })

  it('an explicit findVerse wins over a lingering find key', () => {
    const both = { ...good, abilities: { ...good.abilities, findVerse: [{ path: '0/7', role: 'AXTextField', name: 'verses', action: { do: 'type', text: '$query' } }] } }
    expect(parseRecipe(both)?.abilities.findVerse?.[0]).toMatchObject({ path: '0/7' })
    expect(parseRecipe(both)?.abilities.findSong?.[0]).toMatchObject({ path: '0/6' })
  })
})
