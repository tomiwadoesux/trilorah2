import { describe, it, expect } from 'vitest'
import { CommandRegistry } from './registry'
import { ALL_ENTRIES } from './entries'
import { SearchIndex, NullEmbedding, stem, tokenize, trigramSimilarity, type EmbeddingProvider } from './index'

function makeIndex(embed?: EmbeddingProvider) {
  return new SearchIndex(new CommandRegistry(ALL_ENTRIES), { embed })
}

describe('text utils', () => {
  it('stems plurals, -ing and -ed', () => {
    expect(stem('verses')).toBe('vers')
    expect(stem('verse')).toBe('vers')
    expect(stem('change')).toBe('chang')
    expect(stem('listening')).toBe('listen')
    expect(stem('changed')).toBe('chang')
    expect(stem('churches')).toBe('church')
    expect(stem('obs')).toBe('obs')
  })
  it('tokenises and drops stopwords', () => {
    expect(tokenize('How do I change the mic?')).toEqual(['chang', 'mic'])
  })
  it('trigram similarity tolerates typos', () => {
    expect(trigramSimilarity('postog', 'posthog')).toBeGreaterThan(0.5)
    expect(trigramSimilarity('postog', 'giving')).toBeLessThan(0.2)
  })
})

describe('CommandRegistry', () => {
  it('registers, gets, removes', () => {
    const r = new CommandRegistry()
    r.register(ALL_ENTRIES)
    expect(r.size).toBe(ALL_ENTRIES.length)
    expect(r.get('action.go-live')?.actionId).toBe('go-live')
    expect(r.remove('action.go-live')).toBe(true)
    expect(r.get('action.go-live')).toBeUndefined()
  })
  it('seed ids are unique', () => {
    const ids = new Set(ALL_ENTRIES.map((e) => e.id))
    expect(ids.size).toBe(ALL_ENTRIES.length)
  })
})

describe('SearchIndex', () => {
  it('empty query returns nothing', async () => {
    const idx = makeIndex()
    expect(await idx.search('')).toEqual({ navigation: [], actions: [] })
    expect(idx.searchSync('   ')).toEqual({ navigation: [], actions: [] })
  })

  it('"how do I change the mic" puts the ASR engine setting first', async () => {
    const { navigation } = await makeIndex().search('how do I change the mic')
    expect(navigation[0].entry.id).toBe('setting.asrProvider')
    expect(navigation[0].entry.route).toBe('/settings#asr')
  })

  it('"go live" is an action, separate from navigation', async () => {
    const { actions, navigation } = await makeIndex().search('go live')
    expect(actions[0].entry.actionId).toBe('go-live')
    expect(navigation.every((h) => h.kind !== 'action')).toBe(true)
    expect(navigation[0].entry.id).toBe('screen.live')
  })

  it('tolerates typos in the query', async () => {
    const idx = makeIndex()
    const a = await idx.search('deepgrm key')
    expect(a.navigation[0].entry.id).toBe('setting.deepgramApiKey')
    const b = await idx.search('wisper modle')
    expect(b.navigation.slice(0, 2).map((h) => h.entry.id)).toContain('setting.whisperModelSize')
    const c = await idx.search('vmxi')
    expect(c.navigation.some((h) => h.entry.id.includes('vmix'))).toBe(true)
  })

  it('finds settings by natural questions', async () => {
    const idx = makeIndex()
    const t = await idx.search('switch to NIV')
    expect(t.navigation[0].entry.id).toBe('setting.displayVersion')
    expect(t.actions[0].entry.actionId).toBe('switch-version')
    const g = await idx.search('zelle')
    expect(g.navigation[0].entry.id).toBe('setting.givingZelle')
    const o = await idx.search('connect to obs')
    expect(o.navigation[0].entry.id.startsWith('setting.obs') || o.navigation[0].entry.id === 'section.settings.integrations').toBe(true)
  })

  it('respects limit', async () => {
    const { navigation } = await makeIndex().search('setting', { limit: 3 })
    expect(navigation.length).toBeLessThanOrEqual(3)
  })

  it('NullEmbedding behaves like no provider', async () => {
    const a = await makeIndex().search('clear screen')
    const b = await makeIndex(new NullEmbedding()).search('clear screen')
    expect(b.actions[0].entry.actionId).toBe('clear-screen')
    expect(b.actions[0].score).toBeCloseTo(a.actions[0].score, 6)
  })

  it('blends embedding similarity when a provider is supplied', async () => {
    // A toy provider: vector = [contains "logo", contains "screen"]
    const provider: EmbeddingProvider = {
      async embed(text) {
        const t = text.toLowerCase()
        return [t.includes('logo') ? 1 : 0, t.includes('screen') ? 1 : 0, 0.01]
      }
    }
    const idx = makeIndex(provider)
    const { actions } = await idx.search('logo')
    expect(actions[0].entry.actionId).toBe('show-logo')
    expect(actions[0].score).toBeGreaterThan(0.5)
  })

  it('rebuilds when the registry changes', () => {
    const reg = new CommandRegistry(ALL_ENTRIES)
    const idx = new SearchIndex(reg)
    expect(idx.searchSync('posthog').navigation.find((h) => h.entry.id === 'setting.posthog')).toBeUndefined()
    reg.register({
      id: 'setting.posthog', kind: 'setting', title: 'PostHog analytics', route: '/settings#privacy',
      keywords: ['posthog', 'analytics', 'telemetry'], description: 'Send anonymous usage analytics to PostHog.'
    })
    idx.build()
    expect(idx.searchSync('postog').navigation[0].entry.id).toBe('setting.posthog')
  })
})
