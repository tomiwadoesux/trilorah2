import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTROL_PROTOCOL } from '../../shared/control/schema'
import { ControlDispatcher, type ControlHost } from './dispatcher'
import { startControlServer, type ControlServer } from './socketServer'

const quietHost: ControlHost = {
  listening: () => false,
  startListening: () => null,
  stopListening: () => undefined,
  stageScripture: () => null,
  take: () => null,
  clearLive: () => undefined,
  next: () => undefined,
  previous: () => undefined,
  setScreen: () => true,
  screen: () => 'live',
  preview: () => null,
  live: () => null,
  openConsole: () => undefined,
}

/** A test client: connect, send lines, collect parsed replies. */
function client(socketPath: string) {
  const socket = net.createConnection(socketPath)
  const lines: any[] = []
  const waiters: Array<(line: any) => void> = []
  let buffered = ''
  socket.setEncoding('utf8')
  socket.on('data', (chunk: string) => {
    buffered += chunk
    let eol = buffered.indexOf('\n')
    while (eol >= 0) {
      const line = JSON.parse(buffered.slice(0, eol))
      buffered = buffered.slice(eol + 1)
      eol = buffered.indexOf('\n')
      const waiter = waiters.shift()
      if (waiter) waiter(line)
      else lines.push(line)
    }
  })
  const next = () =>
    new Promise<any>((resolve) => {
      const queued = lines.shift()
      if (queued) resolve(queued)
      else waiters.push(resolve)
    })
  const send = (message: unknown) => socket.write(`${JSON.stringify(message)}\n`)
  const closed = new Promise<void>((resolve) => socket.on('close', () => resolve()))
  return { socket, send, next, closed }
}

describe('control socket server', () => {
  let server: ControlServer | null = null
  let dir = ''
  afterEach(async () => {
    await server?.close()
    server = null
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })

  async function start(dispatcher = new ControlDispatcher(quietHost)) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tri-control-'))
    // macOS caps sun_path around 104 bytes; keep the test socket name short.
    server = await startControlServer({ dir, dispatcher, socketPath: path.join(dir, 's.sock') })
    return { dispatcher, server }
  }

  it('writes the discovery file and removes it on close', async () => {
    await start()
    const discovery = path.join(dir, 'control.json')
    const written = JSON.parse(fs.readFileSync(discovery, 'utf8'))
    expect(written.socket).toBe(server!.path)
    expect(written.protocol).toBe(CONTROL_PROTOCOL)
    await server!.close()
    server = null
    expect(fs.existsSync(discovery)).toBe(false)
  })

  it('greets a right-protocol hello with a snapshot, then answers commands', async () => {
    await start()
    const c = client(server!.path)
    c.send({ jsonrpc: '2.0', id: 1, method: 'hello', params: { protocol: CONTROL_PROTOCOL } })
    const hello = await c.next()
    expect(hello.result.protocol).toBe(CONTROL_PROTOCOL)
    expect(hello.result.snapshot.screen).toBe('live')
    c.send({ jsonrpc: '2.0', id: 2, method: 'command', params: { command: { kind: 'live.take' } } })
    const result = await c.next()
    expect(result.result.ok).toBe(false)
    expect(result.result.error).toContain('nothing is staged')
    c.socket.end()
  })

  it('tells a wrong-protocol client so in words, then drops it', async () => {
    await start()
    const c = client(server!.path)
    c.send({ jsonrpc: '2.0', id: 1, method: 'hello', params: { protocol: '9.0.0' } })
    const refusal = await c.next()
    expect(refusal.error.message).toContain('update the older side')
    await c.closed
  })

  it('drops a client whose first message is not hello', async () => {
    await start()
    const c = client(server!.path)
    c.send({ jsonrpc: '2.0', id: 1, method: 'command', params: { command: { kind: 'status' } } })
    await c.closed
  })

  it('streams dispatcher events to a subscribed client', async () => {
    const { dispatcher } = await start()
    const c = client(server!.path)
    c.send({ jsonrpc: '2.0', id: 1, method: 'hello', params: { protocol: CONTROL_PROTOCOL } })
    await c.next()
    c.send({ jsonrpc: '2.0', id: 2, method: 'subscribe', params: {} })
    const sub = await c.next()
    expect(sub.result.subscribed).toBe(true)
    dispatcher.event('transcript', { text: 'God is love', isFinal: true })
    const event = await c.next()
    expect(event.method).toBe('event')
    expect(event.params.channel).toBe('transcript')
    expect(event.params.seq).toBe(1)
    c.socket.end()
  })
})
