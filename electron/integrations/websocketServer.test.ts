import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import { PairingStore } from './pairing'
import {
  startWebSocketServer,
  stopWebSocketServer,
  broadcastState,
  broadcastToClients,
  type RemoteHandlers
} from './websocketServer'

let dir: string
let port: number
let store: PairingStore
let handlers: RemoteHandlers
let state = { listening: false, pendingRef: null as string | null, liveRef: null as string | null, autoMode: false }

function makeHandlers(): RemoteHandlers {
  return {
    startListening: vi.fn(() => { state.listening = true }),
    stopListening: vi.fn(),
    clearScreen: vi.fn(),
    blackScreen: vi.fn(),
    showLogo: vi.fn(),
    pushPreview: vi.fn(),
    approvePending: vi.fn(),
    dismissPending: vi.fn(),
    nextVerse: vi.fn(),
    previousVerse: vi.fn(),
    setAutoMode: vi.fn(),
    typeReference: vi.fn(),
    setMode: vi.fn(),
    getState: () => ({ ...state })
  }
}

type Box = { next: () => Promise<any> }

/** Open a socket with a message inbox attached BEFORE `open` — the server's
 *  hello can share a TCP read with the upgrade response, so it fires
 *  synchronously right after `open`. */
function connect(): Promise<{ ws: WebSocket; box: Box }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const box = inbox(ws)
    ws.once('open', () => resolve({ ws, box }))
    ws.once('error', reject)
  })
}

/** Collect messages as parsed JSON; `next()` awaits the next one. */
function inbox(ws: WebSocket): Box {
  const queue: any[] = []
  const waiters: ((m: any) => void)[] = []
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString())
    const w = waiters.shift()
    if (w) w(m)
    else queue.push(m)
  })
  return {
    next: () =>
      new Promise<any>((resolve) => {
        if (queue.length) resolve(queue.shift())
        else waiters.push(resolve)
      })
  }
}

function closed(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => ws.once('close', (code) => resolve(code)))
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wss-test-'))
  store = new PairingStore(dir)
  handlers = makeHandlers()
  state = { listening: false, pendingRef: null, liveRef: null, autoMode: false }
  const server = startWebSocketServer(handlers, store, 0)!
  port = (server.address() as { port: number }).port
})

afterEach(() => {
  stopWebSocketServer()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('websocket auth handshake', () => {
  it('sends hello, then closes unauthenticated sockets that send a command', async () => {
    const { ws, box } = await connect()
    expect((await box.next()).type).toBe('hello')
    ws.send(JSON.stringify({ action: 'START_LISTENING' }))
    const err = await box.next()
    expect(err).toEqual({ type: 'error', code: 'unauthorized' })
    expect(await closed(ws)).toBe(4401)
    expect(handlers.startListening).not.toHaveBeenCalled()
  })

  it('rejects a bad token', async () => {
    const { ws, box } = await connect()
    await box.next()
    ws.send(JSON.stringify({ type: 'auth', token: 'garbage' }))
    expect((await box.next()).code).toBe('unauthorized')
    expect(await closed(ws)).toBe(4401)
  })

  it('pairs with a code, returns a token, then accepts legacy and typed commands', async () => {
    const code = store.generateCode()
    const { ws, box } = await connect()
    await box.next()
    ws.send(JSON.stringify({ type: 'pair', code, deviceName: 'Companion' }))
    const auth = await box.next()
    expect(auth.type).toBe('authenticated')
    expect(auth.token).toMatch(/^[0-9a-f]{64}$/)
    expect(auth.deviceName).toBe('Companion')
    expect(auth.state.listening).toBe(false)

    ws.send(JSON.stringify({ action: 'START_LISTENING' }))
    expect(await box.next()).toEqual({ action: 'START_LISTENING', status: 'success' })
    expect(handlers.startListening).toHaveBeenCalledTimes(1)

    ws.send(JSON.stringify({ type: 'typeReference', ref: 'John 3:16' }))
    expect(await box.next()).toMatchObject({ type: 'ack', command: 'typeReference', status: 'success' })
    expect(handlers.typeReference).toHaveBeenCalledWith('John 3:16')

    ws.send(JSON.stringify({ action: 'SET_MODE', mode: 'bogus' }))
    expect((await box.next()).status).toBe('invalid')
    ws.send(JSON.stringify({ action: 'SET_MODE', mode: 'worship' }))
    expect((await box.next()).status).toBe('success')
    expect(handlers.setMode).toHaveBeenCalledWith('worship')

    ws.send(JSON.stringify({ type: 'getState' }))
    expect((await box.next()).state.listening).toBe(true)

    // The issued token works on a fresh connection.
    const { ws: ws2, box: box2 } = await connect()
    await box2.next()
    ws2.send(JSON.stringify({ type: 'auth', token: auth.token }))
    expect((await box2.next()).type).toBe('authenticated')

    // Broadcasts reach both paired sockets.
    state.liveRef = 'Romans 8:28'
    broadcastState()
    expect((await box.next()).state.liveRef).toBe('Romans 8:28')
    expect((await box2.next()).state.liveRef).toBe('Romans 8:28')
    broadcastToClients({ type: 'toast', text: 'hi' })
    expect(await box.next()).toEqual({ type: 'toast', text: 'hi' })
    ws.close()
    ws2.close()
  })

  it('does not broadcast to unauthenticated sockets', async () => {
    const { ws, box } = await connect()
    await box.next()
    broadcastToClients({ type: 'secret' })
    const race = await Promise.race([box.next(), new Promise((r) => setTimeout(() => r('none'), 100))])
    expect(race).toBe('none')
    ws.close()
  })
})
