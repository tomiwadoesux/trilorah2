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
    expect(report).toEqual({ ok: true, checked: 3, broken: [] })
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
    const result = await perform(recipe, 'find', inspector, { query: 'John 3:16' })
    expect(result.ok).toBe(true)
    expect(calls[0]).toEqual(['type', 'com.example.slides', 'path:0/3', 'role:AXTextField', 'name:search', '--text', 'John 3:16', '--submit'])
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
