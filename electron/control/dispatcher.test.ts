import { describe, expect, it } from 'vitest'
import { ControlDispatcher, type ControlHost } from './dispatcher'
import type { ControlVerse } from '../../shared/control/schema'

/** A little engine: stages what it knows, takes what is staged, lies never. */
function fakeHost() {
  const verse = (ref: string): ControlVerse => ({ book: ref.split(' ')[0], chapter: 3, verse: 16, version: 'WEB', text: 'For God so loved…' })
  const state = {
    listening: false,
    preview: null as ControlVerse | null,
    live: null as ControlVerse | null,
    screen: 'live',
    takes: [] as string[],
    refuseListen: null as string | null,
    consoleOpened: false,
  }
  const host: ControlHost = {
    listening: () => state.listening,
    startListening: () => (state.refuseListen ? state.refuseListen : ((state.listening = true), null)),
    stopListening: () => { state.listening = false },
    stageScripture: (reference) => (reference.startsWith('John') ? (state.preview = verse(reference)) : null),
    take: (via) => {
      if (!state.preview) return null
      state.takes.push(via)
      state.live = state.preview
      state.preview = null
      return state.live
    },
    clearLive: () => { state.live = null; state.screen = 'clear' },
    next: () => undefined,
    previous: () => undefined,
    setScreen: (s) => (s === 'broken' ? false : ((state.screen = s), true)),
    screen: () => state.screen,
    preview: () => state.preview,
    live: () => state.live,
    openConsole: () => { state.consoleOpened = true },
  }
  return { host, state }
}

describe('ControlDispatcher', () => {
  it('stages a known reference and reports the staged verse', () => {
    const { host } = fakeHost()
    const d = new ControlDispatcher(host)
    const r = d.execute({ kind: 'scripture.stage', reference: 'John 3:16' }, 'socket')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.staged?.book).toBe('John')
      expect(r.snapshot.preview?.book).toBe('John')
    }
  })

  it('refuses honestly when nothing is staged to take', () => {
    const d = new ControlDispatcher(fakeHost().host)
    const r = d.execute({ kind: 'live.take' }, 'socket')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('nothing is staged')
  })

  it('take with a reference stages then takes, and the console takes as the operator', () => {
    const { host, state } = fakeHost()
    const d = new ControlDispatcher(host)
    const fromConsole = d.execute({ kind: 'live.take', reference: 'John 3:16' }, 'console')
    expect(fromConsole.ok).toBe(true)
    if (fromConsole.ok) expect(fromConsole.live?.book).toBe('John')
    expect(state.takes).toEqual(['operator'])
    d.execute({ kind: 'live.take', reference: 'John 1:1' }, 'socket')
    expect(state.takes).toEqual(['operator', 'remote'])
  })

  it('a reference the Bible does not have fails with the reference named', () => {
    const d = new ControlDispatcher(fakeHost().host)
    const r = d.execute({ kind: 'scripture.stage', reference: 'Nowhere 9:99' }, 'socket')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Nowhere 9:99')
  })

  it('rejects what is not a command without running anything', () => {
    const d = new ControlDispatcher(fakeHost().host)
    expect(d.execute({ kind: 'reboot.universe' }, 'socket').ok).toBe(false)
    expect(d.execute('rm -rf', 'socket').ok).toBe(false)
    expect(d.execute(null, 'socket').ok).toBe(false)
  })

  it('a refused listen start carries the reason', () => {
    const { host, state } = fakeHost()
    state.refuseListen = 'finish voice training before starting a service'
    const r = new ControlDispatcher(host).execute({ kind: 'listen.start' }, 'socket')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('voice training')
  })

  it('events arrive in order with one epoch, and asr status lands in the snapshot', () => {
    const d = new ControlDispatcher(fakeHost().host)
    const seen: number[] = []
    const off = d.observe((e) => seen.push(e.seq))
    d.event('transcript', { text: 'for God so loved', isFinal: false })
    d.event('asr', 'Listening…')
    d.event('screen', 'black')
    expect(seen).toEqual([1, 2, 3])
    expect(d.snapshot().asrStatus).toBe('Listening…')
    expect(d.snapshot().seq).toBe(3)
    off()
    d.event('screen', 'live')
    expect(seen).toEqual([1, 2, 3])
  })
})
