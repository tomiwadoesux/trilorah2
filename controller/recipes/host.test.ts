import { describe, expect, it, vi } from 'vitest'
import type { ControlHost } from '../../electron/control/dispatcher'
import { recipeHost } from './host'
import type { Inspector } from './runner'
import { parseRecipe } from './schema'

const recipe = parseRecipe({
  format: 1,
  platform: 'windows',
  app: { id: 'EasyWorship.exe', name: 'EasyWorship' },
  abilities: {
    find: [{ path: '0/2', role: 'Edit', name: 'Search', action: { do: 'type', text: '$query', submit: true } }],
    show: [{ path: '0/9', role: 'Button', name: 'Go Live', label: 'the Go Live button', action: { do: 'press' } }],
    clear: [{ path: '0/10', role: 'Button', name: 'Clear', action: { do: 'press' } }],
  },
  taught: { by: 'operator', at: '2026-11-10T12:00:00Z' },
})!

const own: ControlHost = {
  listening: () => true, startListening: () => null, stopListening: () => undefined,
  stageScripture: () => null, take: () => null, clearLive: () => undefined, next: () => undefined, previous: () => undefined,
  setScreen: () => true, toggleScreen: () => undefined, screen: () => 'live', preview: () => null, live: () => null, openConsole: () => undefined,
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('a recipe as a control host', () => {
  it('stages through the app\'s search and takes through its go-live, reporting what was asked', async () => {
    const calls: string[][] = []
    const inspector: Inspector = { async run(args) { calls.push(args); return { ok: true } } }
    const host = recipeHost({ recipe, inspector, own })
    const staged = host.stageScripture('John 3:16')
    expect(staged).toMatchObject({ book: 'John 3:16', version: 'EasyWorship' })
    await tick()
    expect(calls[0]).toEqual(['type', 'EasyWorship.exe', 'path:0/2', 'role:Edit', 'name:Search', '--text', 'John 3:16', '--submit'])
    expect(host.take('remote')).toMatchObject({ book: 'John 3:16' })
    await tick()
    expect(calls[1]).toEqual(['press', 'EasyWorship.exe', 'path:0/9', 'role:Button', 'name:Go Live'])
    expect(host.live()?.book).toBe('John 3:16')
  })

  it('take with nothing staged is a refusal, exactly as on Trilorah\'s own wall', () => {
    const host = recipeHost({ recipe, inspector: { async run() { return { ok: true } } }, own })
    expect(host.take('remote')).toBeNull()
  })

  it('a failing step raises a problem in the step\'s words and nothing goes live', async () => {
    const onProblem = vi.fn()
    const inspector: Inspector = { async run(args) { return args[0] === 'press' ? { ok: false, error: '"Go Live" is disabled right now' } : { ok: true } } }
    const host = recipeHost({ recipe, inspector, own, onProblem })
    host.stageScripture('Psalm 23')
    await tick()
    host.take('remote')
    await tick()
    expect(onProblem).toHaveBeenCalledWith('show', '"Go Live" is disabled right now')
    expect(host.live()).toBeNull()
  })

  it('listening and the screen stay Trilorah\'s own', () => {
    const host = recipeHost({ recipe, inspector: { async run() { return { ok: true } } }, own })
    expect(host.listening()).toBe(true)
    expect(host.screen()).toBe('live')
  })

  it('an app never taught to search cannot stage, and says so', () => {
    const onProblem = vi.fn()
    const noFind = parseRecipe({ ...recipe, abilities: { show: recipe.abilities.show } })!
    const host = recipeHost({ recipe: noFind, inspector: { async run() { return { ok: true } } }, own, onProblem })
    expect(host.stageScripture('John 3:16')).toBeNull()
    expect(onProblem).toHaveBeenCalledWith('find', 'EasyWorship was never taught how to search')
  })
})
