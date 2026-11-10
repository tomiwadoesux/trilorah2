import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ControlHost } from '../../electron/control/dispatcher'
import { ControlDispatcher } from '../../electron/control/dispatcher'
import type { Inspector } from './runner'
import { loadRecipes } from './store'
import { switchableHost } from './targets'

const taughtJson = {
  format: 1, platform: 'macos', app: { id: 'com.example.slides', name: 'Slides' },
  abilities: { show: [{ path: '0/9', role: 'AXButton', name: 'Go Live', label: 'the Go Live button', action: { do: 'press' } }] },
  taught: { by: 'operator', at: '2026-11-10T12:00:00Z' },
}

function ownHost() {
  const state = { preview: null as any, live: null as any, takes: 0 }
  const own: ControlHost = {
    listening: () => false, startListening: () => null, stopListening: () => undefined,
    stageScripture: (ref) => (state.preview = { book: ref, chapter: 1, verse: 1, version: 'KJV', text: '' }),
    take: () => { state.takes++; state.live = state.preview; return state.live },
    clearLive: () => undefined, next: () => undefined, previous: () => undefined,
    setScreen: () => true, toggleScreen: () => undefined, screen: () => 'live', preview: () => state.preview, live: () => state.live, openConsole: () => undefined,
  }
  return { own, state }
}

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('targets', () => {
  let dir = ''
  afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }) })

  it('loads taught recipes for this platform and ignores bad files and other platforms', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri-recipes-'))
    fs.writeFileSync(path.join(dir, 'slides.json'), JSON.stringify(taughtJson))
    fs.writeFileSync(path.join(dir, 'win.json'), JSON.stringify({ ...taughtJson, platform: 'windows', app: { id: 'x.exe', name: 'X' } }))
    fs.writeFileSync(path.join(dir, 'junk.json'), '{not json')
    const loaded = loadRecipes({ taughtDir: dir, shippedDir: path.join(dir, 'none'), platform: 'darwin' })
    expect(loaded.map((r) => r.id)).toEqual(['app:com.example.slides'])
    expect(loaded[0].source).toBe('taught')
  })

  it('starts on Trilorah, lists the taught apps, and switches the five abilities to the app', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri-recipes-'))
    fs.writeFileSync(path.join(dir, 'slides.json'), JSON.stringify(taughtJson))
    const calls: string[][] = []
    const inspector: Inspector = { async run(args) { calls.push(args); return { ok: true, count: 1 } } }
    const { own, state } = ownHost()
    const onVerified = vi.fn()
    const host = switchableHost({ own, inspector, onVerified, recipes: () => loadRecipes({ taughtDir: dir, shippedDir: path.join(dir, 'none'), platform: 'darwin' }) })
    const d = new ControlDispatcher(host)

    expect(d.snapshot().target).toBe('trilorah')
    const list = d.execute({ kind: 'target.list' }, 'socket')
    expect(list.ok && list.targets?.map((t) => t.id)).toEqual(['trilorah', 'app:com.example.slides'])

    expect(d.execute({ kind: 'target.set', id: 'Slides' }, 'socket').ok).toBe(true)
    expect(d.snapshot().target).toBe('app:com.example.slides')
    await tick()
    expect(onVerified).toHaveBeenCalledWith('app:com.example.slides', true, [])
    expect(calls[0][0]).toBe('find')

    // Staging now needs the app's own search, which this recipe never learned.
    const staged = d.execute({ kind: 'scripture.stage', reference: 'John 3:16' }, 'socket')
    expect(staged.ok).toBe(false)
    expect(state.takes).toBe(0)

    expect(d.execute({ kind: 'target.set', id: 'trilorah' }, 'socket').ok).toBe(true)
    expect(d.execute({ kind: 'live.take', reference: 'John 3:16' }, 'socket').ok).toBe(true)
    expect(state.takes).toBe(1)
  })

  it('refuses an unknown app and a platform with no inspector, in words', () => {
    const { own } = ownHost()
    const noInspector = switchableHost({ own, inspector: null, recipes: () => [{ id: 'app:x', source: 'taught', file: '', recipe: { ...taughtJson, format: 1 } as any }] })
    expect(noInspector.setTarget!('app:x')).toContain('no inspector')
    expect(noInspector.setTarget!('app:nope')).toContain('no taught app')
  })
})
