import { describe, expect, it } from 'vitest'
import { fillText, perform, verify, type Inspector } from './runner'
import { parseRecipe } from './schema'

const recipe = parseRecipe({
  format: 1,
  platform: 'macos',
  app: { id: 'com.example.slides', name: 'Slides' },
  abilities: {
    find: [{ path: '0/3', role: 'AXTextField', name: 'search', label: 'the search box', action: { do: 'type', text: '$query', submit: true } }],
    show: [{ path: '0/9', role: 'AXButton', name: 'Go Live', label: 'the Go Live button', action: { do: 'press' } }],
    clear: [{ action: { do: 'menu', path: 'Screen>Clear' } }],
  },
  taught: { by: 'operator', at: '2026-11-10T12:00:00Z' },
})!

/** An inspector that answers from a script and remembers what it was asked. */
function fake(answers: Record<string, { ok: boolean; count?: number; error?: string }>) {
  const calls: string[][] = []
  const inspector: Inspector = {
    async run(args) {
      calls.push(args)
      const key = `${args[0]} ${args.slice(2).join(' ')}`
      const hit = Object.entries(answers).find(([k]) => key.startsWith(k))
      return hit ? hit[1] : { ok: true, count: 1 }
    },
  }
  return { inspector, calls }
}

describe('recipe runner', () => {
  it('verify is green when every control resolves to exactly one element, and never presses', async () => {
    const { inspector, calls } = fake({})
    const report = await verify(recipe, inspector)
    // the legacy 'find' ability parses into findVerse AND findSong, so four lookups
    expect(report).toEqual({ ok: true, checked: 4, broken: [] })
    expect(calls.every((c) => c[0] === 'find')).toBe(true)
  })

  it('verify names the broken step in the operator\'s words', async () => {
    const { inspector } = fake({ 'find path:0/9': { ok: true, count: 0 } })
    const report = await verify(recipe, inspector)
    expect(report.ok).toBe(false)
    expect(report.broken).toEqual([{ ability: 'show', index: 0, ok: false, label: 'the Go Live button', problem: 'no control matches any more' }])
  })

  it('perform runs the steps with the moment\'s words filled in', async () => {
    const { inspector, calls } = fake({})
    const result = await perform(recipe, 'findVerse', inspector, { query: 'John 3:16' })
    expect(result.ok).toBe(true)
    expect(calls[0]).toEqual(['type', 'com.example.slides', 'path:0/3', 'role:AXTextField', 'name:search', '--text', 'John 3:16', '--submit'])
  })

  it('perform asks for the side of a control when the step names one', async () => {
    const arrows = parseRecipe({
      format: 1, platform: 'windows', app: { id: 'EasyWorship.exe', name: 'EasyWorship' },
      abilities: {
        show: [{ role: 'Pane', name: 'Go Live', action: { do: 'press' } }],
        next: [{ path: '0/1/9', role: 'Pane', class: 'TsdPanel', action: { do: 'press', at: 'right' } }],
        previous: [{ path: '0/1/9', role: 'Pane', class: 'TsdPanel', action: { do: 'press', at: 'left' } }],
      },
      taught: { by: 'trilorah', at: '2026-11-23T00:00:00Z' },
    })!
    const { inspector, calls } = fake({})
    expect((await perform(arrows, 'next', inspector)).ok).toBe(true)
    expect(calls[0]).toEqual(['press', 'EasyWorship.exe', 'path:0/1/9', 'role:Pane', 'class:TsdPanel', '--at', 'right'])
    await perform(arrows, 'previous', inspector)
    expect(calls[1].slice(-2)).toEqual(['--at', 'left'])
    await perform(arrows, 'show', inspector)
    expect(calls[2]).toEqual(['press', 'EasyWorship.exe', 'role:Pane', 'name:Go Live'])
    const clicky = parseRecipe({
      format: 1, platform: 'windows', app: { id: 'MediaShout 7.exe', name: 'MediaShout' },
      abilities: { show: [{ role: 'Button', name: 'Bibles', action: { do: 'press', via: 'click' } }] },
      taught: { by: 'trilorah', at: '2026-11-23T00:00:00Z' },
    })!
    await perform(clicky, 'show', inspector)
    expect(calls[3]).toEqual(['press', 'MediaShout 7.exe', 'role:Button', 'name:Bibles', '--action', 'click'])
  })

  it('perform stops at the first failing step and says which', async () => {
    const { inspector } = fake({ 'press path:0/9': { ok: false, error: '"Go Live" is disabled right now' } })
    const result = await perform(recipe, 'show', inspector)
    expect(result.ok).toBe(false)
    expect(result.failed).toMatchObject({ ability: 'show', index: 0, label: 'the Go Live button', problem: '"Go Live" is disabled right now' })
  })

  it('an ability the app was never taught is refused, not improvised', async () => {
    const result = await perform(recipe, 'next', fake({}).inspector)
    expect(result.ok).toBe(false)
    expect(result.failed?.problem).toContain('never taught how to next')
  })

  it('fills the two placeholders and leaves other text alone', () => {
    expect(fillText('$reference in $query', { reference: 'Psalm 23', query: 'shepherd' })).toBe('Psalm 23 in shepherd')
    expect(fillText('plain', {})).toBe('plain')
  })
})

describe('a trail with enroute steps', () => {
  const trailed = parseRecipe({
    format: 1, platform: 'macos', app: { id: 'com.example.slides', name: 'Slides' },
    abilities: {
      show: [{ path: '0/9', role: 'AXButton', name: 'Go Live', action: { do: 'press' } }],
      findVerse: [
        { path: '0/1/2', role: 'AXRadioButton', name: 'Scriptures', label: 'on the way: Scriptures', enroute: true, action: { do: 'press' } },
        { path: '0/3', role: 'AXTextField', name: 'search', label: 'the verse search box', action: { do: 'type', text: '$query', submit: true } },
      ],
    },
    taught: { by: 'operator', at: '2026-11-10T12:00:00Z' },
  })!

  it('perform goes straight to a reachable target, never re-pressing the way there', async () => {
    const { inspector, calls } = fake({})
    const result = await perform(trailed, 'findVerse', inspector, { query: 'John 3:16' })
    expect(result.ok).toBe(true)
    // one look, then the type — the Scriptures tab was not pressed again
    expect(calls.map((c) => c[0])).toEqual(['find', 'type'])
  })

  it('perform walks the trail when the target is hidden', async () => {
    const { inspector, calls } = fake({ 'find path:0/3': { ok: true, count: 0 } })
    // the look fails, so every step runs: press the tab, then type into the box
    const result = await perform(trailed, 'findVerse', inspector, { query: 'John 3:16' })
    expect(result.ok).toBe(true)
    expect(calls.map((c) => c[0])).toEqual(['find', 'press', 'type'])
  })

  it('verify passes a hidden target while its door is still there, and names it when both are gone', async () => {
    const hidden = await verify(trailed, fake({ 'find path:0/3': { ok: true, count: 0 } }).inspector)
    expect(hidden.ok).toBe(true)
    const gone = await verify(trailed, fake({ 'find path:0/3': { ok: true, count: 0 }, 'find path:0/1/2': { ok: true, count: 0 } }).inspector)
    expect(gone.ok).toBe(false)
    expect(gone.broken[0].problem).toContain('the way there is gone too')
  })
})
