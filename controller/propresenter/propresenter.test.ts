import { describe, expect, it, vi } from 'vitest'
import type { ControlHost } from '../../electron/control/dispatcher'
import { ControlDispatcher } from '../../electron/control/dispatcher'
import { switchableHost } from '../recipes/targets'
import { pickThemeSlide, proClient, type FetchLike } from './client'
import { discoverProPresenter, portsFromListing } from './discover'
import { matchPresentation, proPresenterHost, referenceLine, SCRIPTURE_MESSAGE_NAME } from './host'
import { proPresenterTarget, PROPRESENTER_TARGET_ID } from './target'

const tick = () => new Promise((r) => setTimeout(r, 5))

/** A ProPresenter that answers like 22.0.1 did on 2026-11-23, remembering what was asked of it. */
function fakePro(state: { messages?: any[]; library?: any[]; down?: boolean } = {}) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = []
  const messages = state.messages ?? []
  const library = state.library ?? [{ uuid: 'p-1', name: 'Amazing Grace', index: 0 }, { uuid: 'p-2', name: 'Amazing Love', index: 1 }, { uuid: 'p-3', name: 'How Great Thou Art', index: 2 }]
  const themes = { groups: [{ id: { uuid: '', name: 'Lyric Styles', index: 0 }, groups: [], themes: [{ id: { uuid: '', name: 'Black Box', index: 0 }, slides: [{ id: { uuid: 't-two', name: 'Two Lines', index: 0 } }, { id: { uuid: 't-scr', name: 'Scripture Lower Third', index: 3 } }] }] }] }
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url)
    const path = u.pathname
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(init.body) : undefined
    calls.push({ method, path, body })
    if (state.down) throw new TypeError('fetch failed')
    const json = (v: unknown, status = 200) => ({ ok: status < 300, status, text: async () => (v === undefined ? '' : JSON.stringify(v)) })
    if (path === '/version') return json({ name: 'PC', platform: 'win', os_version: '10', host_description: 'ProPresenter 22.0.1', api_version: 'v1' })
    if (path === '/v1/messages' && method === 'GET') return json(messages)
    if (path === '/v1/messages' && method === 'POST') { const made = { ...body, id: { ...body.id, uuid: 'm-1', index: messages.length } }; messages.push(made); return json(made) }
    if (path === '/v1/themes') return json(themes)
    if (path === '/v1/library/Default') return json({ updateType: 'all', items: library })
    if (/^\/v1\/message\/[^/]+\/trigger$/.test(path)) return json(undefined, 204)
    if (/^\/v1\/clear\/layer\//.test(path) || path === '/v1/trigger/next' || path === '/v1/trigger/previous' || /\/trigger$/.test(path)) return json(undefined, 204)
    return json({ error: 'not found' }, 404)
  }
  return { fetch, calls, messages }
}

function ownHost() {
  const state = { preview: null as any, takes: 0 }
  const own: ControlHost = {
    listening: () => false, startListening: () => null, stopListening: () => undefined,
    stageScripture: (ref, version) => (state.preview = ref === 'Nowhere 9:9' ? null : { book: 'John', chapter: 3, verse: 16, version: version ?? 'WEB', text: 'For God so loved the world…' }),
    take: () => { state.takes++; return state.preview },
    clearLive: () => undefined, next: () => undefined, previous: () => undefined,
    setScreen: () => true, toggleScreen: () => undefined, screen: () => 'live', preview: () => state.preview, live: () => null, openConsole: () => undefined,
  }
  return { own, state }
}

describe('ProPresenter client', () => {
  it('speaks the API: JSON in, JSON out, 204 as nothing, and plain words when it is unreachable', async () => {
    const pro = fakePro()
    const c = proClient({ base: 'http://127.0.0.1:1/', fetch: pro.fetch })
    expect((await c.version()).api_version).toBe('v1')
    expect(await c.clearLayer('slide')).toBeUndefined()
    expect(pro.calls.map((x) => x.path)).toEqual(['/version', '/v1/clear/layer/slide'])
    const down = proClient({ base: 'http://127.0.0.1:1', fetch: fakePro({ down: true }).fetch })
    await expect(down.version()).rejects.toThrow(/could not reach ProPresenter.*Enable Network/)
  })

  it('picks the Scripture theme slide when there is one, else the first slide', () => {
    const tree = { groups: [{ id: { uuid: '', name: 'g', index: 0 }, themes: [{ id: { uuid: '', name: 'Plain', index: 0 }, slides: [{ id: { uuid: 'a', name: 'One', index: 0 } }, { id: { uuid: 'b', name: 'Scripture Lower Third', index: 1 } }] }] }] }
    expect(pickThemeSlide(tree, /scripture/i)?.uuid).toBe('b')
    expect(pickThemeSlide(tree, /nothing like this/)?.uuid).toBe('a')
    expect(pickThemeSlide([], /x/)).toBeNull()
  })
})

describe('ProPresenter host', () => {
  it('stages a verse from Trilorah\'s own Bible and, on take, shows it as a message it creates once', async () => {
    const pro = fakePro()
    const { own, state } = ownHost()
    const problems: string[] = []
    const host = proPresenterHost({ client: proClient({ base: 'http://x', fetch: pro.fetch }), own, onProblem: (a, p) => problems.push(`${a}: ${p}`) })

    expect(host.stageScripture('Nowhere 9:9')).toBeNull()
    const staged = host.stageScripture('John 3:16', 'WEB')
    expect(staged?.text).toContain('loved')
    expect(host.preview()).toEqual(staged)

    expect(host.take('operator')).toEqual(staged)
    await tick()
    // Trilorah's own wall was not taken: ProPresenter's was.
    expect(state.takes).toBe(0)
    const created = pro.calls.find((c) => c.method === 'POST' && c.path === '/v1/messages')
    expect(created?.body).toMatchObject({ id: { name: SCRIPTURE_MESSAGE_NAME }, message: '{reference}\n{text}', theme: { uuid: 't-scr' } })
    const shown = pro.calls.find((c) => c.path === '/v1/message/m-1/trigger')
    expect(shown?.body).toEqual([{ name: 'reference', text: { text: 'John 3:16 (WEB)' } }, { name: 'text', text: { text: 'For God so loved the world…' } }])
    expect(host.live()).toEqual(staged)
    expect(problems).toEqual([])

    // The second take reuses the message.
    host.take('operator')
    await tick()
    expect(pro.calls.filter((c) => c.method === 'POST' && c.path === '/v1/messages')).toHaveLength(1)

    host.clearLive()
    await tick()
    expect(pro.calls.slice(-2).map((c) => c.path).sort()).toEqual(['/v1/clear/layer/messages', '/v1/clear/layer/slide'])
    expect(host.live()).toBeNull()
    host.next(); host.previous()
    await tick()
    expect(pro.calls.slice(-2).map((c) => c.path)).toEqual(['/v1/trigger/next', '/v1/trigger/previous'])
  })

  it('finds an existing scripture message instead of making another', async () => {
    const pro = fakePro({ messages: [{ id: { name: SCRIPTURE_MESSAGE_NAME, uuid: 'm-old', index: 0 }, message: '{reference}\n{text}', tokens: [], theme: { uuid: 't', name: 't', index: 0 }, visible_on_network: false, is_active: false }] })
    const { own } = ownHost()
    const host = proPresenterHost({ client: proClient({ base: 'http://x', fetch: pro.fetch }), own })
    host.stageScripture('John 3:16')
    host.take('operator')
    await tick()
    expect(pro.calls.some((c) => c.path === '/v1/message/m-old/trigger')).toBe(true)
    expect(pro.calls.some((c) => c.method === 'POST' && c.path === '/v1/messages')).toBe(false)
  })

  it('stages a song by looking it up in the Default library and takes its first slide', async () => {
    const pro = fakePro()
    const { own } = ownHost()
    const problems: string[] = []
    const host = proPresenterHost({ client: proClient({ base: 'http://x', fetch: pro.fetch }), own, onProblem: (a, p) => problems.push(`${a}: ${p}`) })

    const r = host.stageSong!('how great thou art')
    expect('staged' in r && r.staged.version).toBe('ProPresenter')
    await tick()
    expect(host.preview()?.book).toBe('How Great Thou Art')
    host.take('operator')
    await tick()
    expect(pro.calls.at(-1)?.path).toBe('/v1/library/Default/p-3/0/trigger')
    expect(problems).toEqual([])

    host.stageSong!('Amazing')
    await tick()
    expect(host.preview()).toBeNull()
    expect(problems.at(-1)).toMatch(/more than one presentation/)
    host.stageSong!('Nothing Here')
    await tick()
    expect(problems.at(-1)).toMatch(/no presentation called "Nothing Here"/)
    expect(host.take('operator')).toBeNull()
  })

  it('reports a failed take in words and keeps live honest', async () => {
    const pro = fakePro({ down: true })
    const { own } = ownHost()
    const problems: string[] = []
    const host = proPresenterHost({ client: proClient({ base: 'http://x', fetch: pro.fetch }), own, onProblem: (a, p) => problems.push(`${a}: ${p}`) })
    host.stageScripture('John 3:16')
    host.take('operator')
    await tick()
    expect(host.live()).toBeNull()
    expect(problems[0]).toMatch(/^show: could not reach ProPresenter/)
  })

  it('writes references the way a screen reads them', () => {
    expect(referenceLine({ book: 'John', chapter: 3, verse: 16, version: 'WEB', text: '' })).toBe('John 3:16 (WEB)')
    expect(referenceLine({ book: 'Psalm', chapter: 23, verse: 1, endVerse: 3, version: '', text: '' })).toBe('Psalm 23:1-3')
    expect(referenceLine({ book: 'whatever was typed', chapter: 0, verse: 0, version: 'x', text: '' })).toBe('whatever was typed')
  })

  it('matches titles exactly before loosely, and never between two', () => {
    const items = [{ uuid: '1', name: 'Amazing Grace', index: 0 }, { uuid: '2', name: 'Amazing Grace (My Chains Are Gone)', index: 1 }, { uuid: '3', name: 'Great Is Thy Faithfulness', index: 2 }]
    expect(matchPresentation(items, 'amazing grace')).toMatchObject({ uuid: '1' })
    expect(matchPresentation(items, 'Amazing Grace (My')).toMatchObject({ uuid: '2' })
    expect(matchPresentation(items, 'faithfulness')).toMatchObject({ uuid: '3' })
    expect(matchPresentation(items, 'Amazing')).toBe('ambiguous')
    expect(matchPresentation(items, 'Oceans')).toBeNull()
    expect(matchPresentation(items, '  ')).toBeNull()
  })
})

describe('ProPresenter discovery', () => {
  const netstat = '\r\nActive Connections\r\n\r\n  Proto  Local Address          Foreign Address        State           PID\r\n  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1234\r\n  TCP    0.0.0.0:56094          0.0.0.0:0              LISTENING       16968\r\n  TCP    127.0.0.1:56094        127.0.0.1:50000        ESTABLISHED     16968\r\n  TCP    [::]:56094             [::]:0                 LISTENING       16968\r\n  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       4321\r\n'

  it('lists the open user-range ports on Windows, and only ProPresenter\'s on macOS', () => {
    expect(portsFromListing(netstat, 'win32')).toEqual([5173, 56094])
    const lsof = 'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\nProPresen 412 me 23u IPv6 0x1 0t0 TCP *:52273 (LISTEN)\nnode 99 me 20u IPv4 0x2 0t0 TCP 127.0.0.1:3000 (LISTEN)\n'
    expect(portsFromListing(lsof, 'darwin')).toEqual([52273])
  })

  it('uses a pinned port without asking the OS, and asks the OS otherwise', async () => {
    const exec = vi.fn(async () => netstat)
    expect(await discoverProPresenter({ port: 1025, exec })).toEqual(['http://127.0.0.1:1025'])
    expect(exec).not.toHaveBeenCalled()
    expect(await discoverProPresenter({ platform: 'win32', exec })).toEqual(['http://127.0.0.1:5173', 'http://127.0.0.1:56094'])
    expect(await discoverProPresenter({ platform: 'linux', exec })).toEqual([])
  })
})

describe('ProPresenter under screen', () => {
  it('appears as a target when its API answers, verifies when chosen, and takes the five abilities', async () => {
    const pro = fakePro()
    const { own, state } = ownHost()
    const target = proPresenterTarget({ own, settings: () => ({}), fetch: pro.fetch, discover: async () => ['http://127.0.0.1:9'], autoStart: false })
    expect(target.list()).toEqual([])
    expect(await target.probe()).toBe('http://127.0.0.1:9')
    const onVerified = vi.fn()
    const host = switchableHost({ own, inspector: null, recipes: () => [], direct: () => target.list(), onVerified })
    const d = new ControlDispatcher(host)
    const list = d.execute({ kind: 'target.list' }, 'socket')
    expect(list.ok && list.targets?.map((t) => t.id)).toEqual(['trilorah', PROPRESENTER_TARGET_ID])

    expect(d.execute({ kind: 'target.set', id: 'ProPresenter' }, 'socket').ok).toBe(true)
    await tick()
    expect(onVerified).toHaveBeenCalledWith(PROPRESENTER_TARGET_ID, true, [])
    expect(d.execute({ kind: 'live.take', reference: 'John 3:16' }, 'socket').ok).toBe(true)
    await tick()
    expect(state.takes).toBe(0)
    expect(pro.calls.some((c) => /\/v1\/message\/.+\/trigger$/.test(c.path))).toBe(true)
  })

  it('leaves the list when ProPresenter stops answering', async () => {
    const pro = fakePro()
    const { own } = ownHost()
    const target = proPresenterTarget({ own, settings: () => ({}), fetch: pro.fetch, discover: async () => ['http://127.0.0.1:9'], autoStart: false })
    await target.probe()
    expect(target.list()).toHaveLength(1)
    const gone = proPresenterTarget({ own, settings: () => ({}), fetch: fakePro({ down: true }).fetch, discover: async () => ['http://127.0.0.1:9'], autoStart: false })
    expect(await gone.probe()).toBeNull()
    expect(gone.list()).toEqual([])
  })
})
