import { describe, expect, it, vi } from 'vitest'
import type { ControlHost } from '../../electron/control/dispatcher'
import { ControlDispatcher } from '../../electron/control/dispatcher'
import type { FetchLike } from '../propresenter/client'
import { switchableHost } from '../recipes/targets'
import { openLpClient } from './client'
import { openLpHost } from './host'
import { OPENLP_TARGET_ID, openLpTarget } from './target'

const tick = () => new Promise((r) => setTimeout(r, 5))

/** An OpenLP that answers like 3.1.7 did on 2026-11-23. */
function fakeOpenLp(state: { down?: boolean; login?: boolean } = {}) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url)
    const path = u.pathname + (u.search ? decodeURIComponent(u.search) : '')
    const method = init?.method ?? 'GET'
    calls.push({ method, path, body: init?.body ? JSON.parse(init.body) : undefined })
    if (state.down) throw new TypeError('fetch failed')
    const json = (v: unknown, status = 200) => ({ ok: status < 300, status, text: async () => (v === undefined ? '' : JSON.stringify(v)) })
    if (path === '/api/v2/core/system') return json({ api_revision: 6, api_version: 2, login_required: !!state.login, websocket_port: 4317 })
    if (path.startsWith('/api/v2/plugins/songs/search?text=')) {
      const q = path.split('text=')[1].toLowerCase()
      const all: Array<[number, string, string]> = [[7, 'Amazing Grace', ''], [8, 'And Can it Be', ''], [9, 'Amazing Love', '']]
      return json(all.filter((s) => s[1].toLowerCase().includes(q.split(' ')[0])))
    }
    if (path.startsWith('/api/v2/plugins/bibles/search?text=')) {
      const q = path.split('text=')[1]
      return json(q.startsWith('Nowhere') ? [] : [[q, 'For God so loved the world…']])
    }
    if (method === 'POST' && /\/api\/v2\/(plugins\/(songs|bibles)\/live|controller\/progress|core\/display)$/.test(path)) return json(undefined, 204)
    return json('<h1>Not Found</h1>', 404)
  }
  return { fetch, calls }
}

function ownHost() {
  const state = { takes: 0 }
  const own: ControlHost = {
    listening: () => false, startListening: () => null, stopListening: () => undefined,
    stageScripture: () => null, take: () => { state.takes++; return null },
    clearLive: () => undefined, next: () => undefined, previous: () => undefined,
    setScreen: () => true, toggleScreen: () => undefined, screen: () => 'live', preview: () => null, live: () => null, openConsole: () => undefined,
  }
  return { own, state }
}

describe('OpenLP client', () => {
  it('speaks the API under /api/v2 and says plainly when OpenLP is not there', async () => {
    const olp = fakeOpenLp()
    const c = openLpClient({ base: 'http://127.0.0.1:4316/', fetch: olp.fetch })
    expect((await c.system()).api_version).toBe(2)
    expect(await c.searchSongs('amazing')).toEqual([[7, 'Amazing Grace', ''], [9, 'Amazing Love', '']])
    expect(await c.progress('next')).toBeUndefined()
    expect(olp.calls.map((x) => `${x.method} ${x.path}`)).toEqual(['GET /api/v2/core/system', 'GET /api/v2/plugins/songs/search?text=amazing', 'POST /api/v2/controller/progress'])
    await expect(openLpClient({ base: 'http://x', fetch: fakeOpenLp({ down: true }).fetch }).system()).rejects.toThrow(/could not reach OpenLP.*Remote plugin/)
  })
})

describe('OpenLP host', () => {
  it('stages a verse from OpenLP\'s own Bible and takes it live', async () => {
    const olp = fakeOpenLp()
    const { own, state } = ownHost()
    const problems: string[] = []
    const host = openLpHost({ client: openLpClient({ base: 'http://x', fetch: olp.fetch }), own, onProblem: (a, p) => problems.push(`${a}: ${p}`) })
    expect(host.stageScripture('John 3:16')?.text).toBe('')
    await tick()
    expect(host.preview()).toMatchObject({ book: 'John 3:16', text: 'For God so loved the world…', version: 'OpenLP' })
    expect(host.take('operator')?.book).toBe('John 3:16')
    await tick()
    expect(olp.calls.find((c) => c.path === '/api/v2/plugins/bibles/live')?.body).toEqual({ id: 'John 3:16' })
    expect(olp.calls.at(-1)).toMatchObject({ path: '/api/v2/core/display', body: { display: 'show' } })
    expect(host.live()?.book).toBe('John 3:16')
    expect(state.takes).toBe(0)

    host.stageScripture('Nowhere 9:9')
    await tick()
    expect(host.preview()).toBeNull()
    expect(problems.at(-1)).toMatch(/nothing for "Nowhere 9:9"/)
    expect(host.take('operator')).toBeNull()

    host.clearLive(); host.next(); host.previous()
    await tick()
    expect(olp.calls.slice(-3).map((c) => JSON.stringify(c.body))).toEqual(['{"display":"blank"}', '{"action":"next"}', '{"action":"previous"}'])
    expect(host.live()).toBeNull()
    expect(problems).toHaveLength(1)
  })

  it('stages a song by title, never between two', async () => {
    const olp = fakeOpenLp()
    const { own } = ownHost()
    const problems: string[] = []
    const host = openLpHost({ client: openLpClient({ base: 'http://x', fetch: olp.fetch }), own, onProblem: (a, p) => problems.push(`${a}: ${p}`) })
    host.stageSong!('amazing grace')
    await tick()
    expect(host.preview()?.book).toBe('Amazing Grace')
    host.take('operator')
    await tick()
    expect(olp.calls.find((c) => c.path === '/api/v2/plugins/songs/live')?.body).toEqual({ id: 7 })
    host.stageSong!('Amazing')
    await tick()
    expect(host.preview()).toBeNull()
    expect(problems.at(-1)).toMatch(/more than one song/)
    host.stageSong!('Oceans')
    await tick()
    expect(problems.at(-1)).toMatch(/no song called "Oceans"/)
  })
})

describe('OpenLP under screen', () => {
  it('appears when its API answers, verifies, and takes the abilities', async () => {
    const olp = fakeOpenLp()
    const { own } = ownHost()
    const target = openLpTarget({ own, settings: () => ({}), fetch: olp.fetch, autoStart: false })
    expect(target.list()).toEqual([])
    expect(await target.probe()).toBe('http://127.0.0.1:4316')
    const onVerified = vi.fn()
    const d = new ControlDispatcher(switchableHost({ own, inspector: null, recipes: () => [], direct: () => target.list(), onVerified }))
    const list = d.execute({ kind: 'target.list' }, 'socket')
    expect(list.ok && list.targets?.map((t) => t.id)).toEqual(['trilorah', OPENLP_TARGET_ID])
    expect(d.execute({ kind: 'target.set', id: 'openlp' }, 'socket').ok).toBe(true)
    await tick()
    expect(onVerified).toHaveBeenCalledWith(OPENLP_TARGET_ID, true, [])
    expect(d.execute({ kind: 'scripture.stage', reference: 'John 3:16' }, 'socket').ok).toBe(true)
    await tick()
    expect(d.execute({ kind: 'live.take' }, 'socket').ok).toBe(true)
    await tick()
    expect(olp.calls.some((c) => c.path === '/api/v2/plugins/bibles/live')).toBe(true)
  })

  it('says why when OpenLP wants a login, and leaves when it stops answering', async () => {
    const { own } = ownHost()
    const locked = openLpTarget({ own, settings: () => ({ port: 5000 }), fetch: fakeOpenLp({ login: true }).fetch, autoStart: false })
    expect(await locked.probe()).toBe('http://127.0.0.1:5000')
    expect((await locked.list()[0].verify()).broken[0]).toMatch(/login/)
    const gone = openLpTarget({ own, settings: () => ({}), fetch: fakeOpenLp({ down: true }).fetch, autoStart: false })
    expect(await gone.probe()).toBeNull()
    expect(gone.list()).toEqual([])
  })
})
