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
    expect(onProblem).toHaveBeenCalledWith('findVerse', 'EasyWorship was never taught where verses are searched — re-teach it')
  })
})

describe('one thing at a time in the app', () => {
  const slow = (calls: string[][], ms = 5): Inspector => ({
    run: (args) => new Promise((r) => { calls.push(args); setTimeout(() => r({ ok: true }), ms) }),
  })
  const settle = () => new Promise((r) => setTimeout(r, 60))

  it('a take waits for the search before it, instead of going live between its steps', async () => {
    const calls: string[][] = []
    const host = recipeHost({ recipe, inspector: slow(calls), own })
    host.stageScripture('John 3:16')
    host.take('remote')
    host.clearLive()
    await settle()
    expect(calls.map((c) => c[0])).toEqual(['type', 'press', 'press'])
    expect(calls[1][4]).toBe('name:Go Live')
    expect(host.live()).toBeNull()
  })

  it('of references staged before the app could type the first, only the last is searched', async () => {
    const calls: string[][] = []
    const host = recipeHost({ recipe, inspector: slow(calls), own })
    host.stageScripture('John 3:1-3')
    host.stageScripture('Romans 8:28')
    host.stageScripture('Psalm 23:1')
    host.take('remote')
    await settle()
    const typed = calls.filter((c) => c[0] === 'type').map((c) => c[6])
    expect(typed).toEqual(['Psalm 23:1'])
    expect(host.live()?.book).toBe('Psalm 23:1')
  })

  it('a failed search leaves nothing to take', async () => {
    const calls: string[][] = []
    const inspector: Inspector = { async run(args) { calls.push(args); return args[0] === 'type' ? { ok: false, error: 'no Search box' } : { ok: true } } }
    const host = recipeHost({ recipe, inspector, own, onProblem: () => undefined })
    host.stageScripture('John 3:16')
    host.take('remote')
    await settle()
    expect(calls.map((c) => c[0])).toEqual(['type'])
    expect(host.live()).toBeNull()
  })
})

describe('the words typed into the app', () => {
  it("are Trilorah's own for the reference; only an unknown one is typed as it came", async () => {
    const calls: string[][] = []
    const inspector: Inspector = { async run(args) { calls.push(args); return { ok: true } } }
    const host = recipeHost({ recipe, inspector, own, words: (r) => (r === 'Psalm 23:1' ? 'Psalms 23:1' : null) })
    expect(host.stageScripture('Psalm 23:1')?.book).toBe('Psalms 23:1')
    await new Promise((r) => setTimeout(r, 10))
    host.stageScripture('Nonsense 9:9')
    await new Promise((r) => setTimeout(r, 10))
    expect(calls.filter((c) => c[0] === 'type').map((c) => c[6])).toEqual(['Psalms 23:1', 'Nonsense 9:9'])
  })
})

describe('put back', () => {
  const quick = (calls: string[][]): Inspector => ({ run: async (args) => { calls.push(args); return { ok: true } } })
  const settle = () => new Promise((r) => setTimeout(r, 20))

  it('presses the taught put-back control and no longer counts our verse as live', async () => {
    const calls: string[][] = []
    const taught = parseRecipe({
      format: 1, platform: 'windows', app: { id: 'EasyWorship.exe', name: 'EasyWorship' },
      abilities: {
        findVerse: [{ path: '0/2', role: 'Edit', name: 'Search', action: { do: 'type', text: '$query' } }],
        show: [{ role: 'Pane', name: 'Go Live', action: { do: 'press' } }],
        restore: [{ role: 'Pane', class: 'TsdSpeedButton', name: 'Go Back', action: { do: 'press', via: 'message' } }],
      },
      taught: { by: 'trilorah', at: '2026-11-28T00:00:00Z' },
    })!
    const host = recipeHost({ recipe: taught, inspector: quick(calls), own })
    host.stageScripture('John 3:16'); host.take('remote')
    await settle()
    expect(host.live()?.book).toBe('John 3:16')
    expect(host.restore!()).toBeNull()
    await settle()
    expect(calls[calls.length - 1]).toEqual(['press', 'EasyWorship.exe', 'role:Pane', 'class:TsdSpeedButton', 'name:Go Back', '--action', 'message'])
    expect(host.live()).toBeNull()
  })

  it('says so when the app was never taught one', () => {
    const host = recipeHost({ recipe, inspector: quick([]), own })
    expect(host.restore!()).toMatch(/not taught how to put back/)
  })
})

describe('a window open over the app', () => {
  const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms))
  /** An inspector whose app has "Edit Song" open for the first N presses. */
  const dialogFor = (presses: number, calls: string[][]): Inspector => ({
    run: async (args) => {
      calls.push(args)
      if (args[0] === 'press' && presses-- > 0) return { ok: false, error: 'a window is open over the app: "Edit Song"', busy: true, window: 'Edit Song' }
      return { ok: true }
    },
  })

  it('holds the take while the window is open and goes ahead once it closes', async () => {
    const calls: string[][] = []
    const held: [string, string, boolean][] = []
    const host = recipeHost({ recipe, inspector: dialogFor(2, calls), own, holdPollMs: 5, holdMs: 500, onHeld: (a, w, waiting) => held.push([a, w, waiting]) })
    host.stageScripture('John 3:16'); host.take('remote')
    await settle()
    expect(calls.filter((c) => c[0] === 'press').length).toBe(3)
    expect(held).toEqual([['show', 'Edit Song', true], ['show', 'Edit Song', false]])
    expect(host.live()?.book).toBe('John 3:16')
  })

  it('gives up after the grace and says so, pressing nothing in that window', async () => {
    const calls: string[][] = []
    const problems: string[] = []
    const held: boolean[] = []
    const host = recipeHost({ recipe, inspector: dialogFor(99, calls), own, holdPollMs: 5, holdMs: 30, onProblem: (_a, p) => problems.push(p), onHeld: (_a, _w, waiting) => held.push(waiting) })
    host.stageScripture('John 3:16'); host.take('remote')
    await settle(120)
    expect(held).toEqual([true, false])
    expect(problems[0]).toMatch(/still had "Edit Song" open after \d+ s, so the show was dropped/)
    expect(host.live()).toBeNull()
  })

  it('an ordinary refusal is not held', async () => {
    const calls: string[][] = []
    const problems: string[] = []
    const inspector: Inspector = { run: async (args) => { calls.push(args); return args[0] === 'press' ? { ok: false, error: '"Go Live" is disabled right now' } : { ok: true } } }
    const host = recipeHost({ recipe, inspector, own, holdPollMs: 5, onProblem: (_a, p) => problems.push(p) })
    host.stageScripture('John 3:16'); host.take('remote')
    await settle()
    expect(calls.filter((c) => c[0] === 'press').length).toBe(1)
    expect(problems).toEqual(['"Go Live" is disabled right now'])
  })
})

describe('a Clear that stays on', () => {
  const quick = (calls: string[][]): Inspector => ({ run: async (args) => { calls.push(args); return { ok: true } } })
  const settle = () => new Promise((r) => setTimeout(r, 20))
  const names = (calls: string[][]) => calls.map((c) => c.find((w) => w.startsWith('name:')) ?? c[0])

  it('is lifted after the next show, so the verse sent live is seen', async () => {
    const calls: string[][] = []
    const host = recipeHost({ recipe: { ...recipe, clearStaysOn: true }, inspector: quick(calls), own })
    host.stageScripture('John 3:16'); host.take('remote'); host.clearLive()
    // A second clear must not press the switch again: that would bring the slide back.
    host.clearLive()
    await settle()
    host.stageScripture('Romans 8:28'); host.take('remote')
    await settle()
    expect(names(calls)).toEqual(['name:Search', 'name:Go Live', 'name:Clear', 'name:Search', 'name:Go Live', 'name:Clear'])
    expect(host.live()?.book).toBe('Romans 8:28')
    // Lifted once: the take after that leaves Clear alone.
    host.stageScripture('Psalm 23:1'); host.take('remote')
    await settle()
    expect(names(calls).slice(6)).toEqual(['name:Search', 'name:Go Live'])
  })

  it('is left alone in an app whose Clear is not a switch', async () => {
    const calls: string[][] = []
    const host = recipeHost({ recipe, inspector: quick(calls), own })
    host.stageScripture('John 3:16'); host.take('remote'); host.clearLive()
    await settle()
    host.stageScripture('Romans 8:28'); host.take('remote')
    await settle()
    expect(names(calls)).toEqual(['name:Search', 'name:Go Live', 'name:Clear', 'name:Search', 'name:Go Live'])
  })
})
