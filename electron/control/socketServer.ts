import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { CONTROL_PROTOCOL, type ControlEvent, type ControlResult, type ControlSnapshot } from '../../shared/control/schema'

/**
 * The local command socket: how the CLI (and later the console runtime)
 * talks to the running app. JSON-RPC 2.0, one message per line, over a Unix
 * socket on macOS/Linux and a named pipe on Windows — current user only,
 * never the network.
 *
 * A client's first message must be `hello` with its protocol version; the
 * reply carries ours and a snapshot, so a mismatched or stale client learns
 * so in words instead of misbehaving. `command` executes a control command
 * and returns its honest result. `subscribe` streams events as
 * notifications until the connection closes.
 *
 * The socket's address is written to <dir>/control.json so a CLI finds it
 * without guessing. No Electron dependency: main passes the directory, so
 * the whole server unit-tests over a real socket in a temp folder.
 */

interface DispatcherLike {
  execute(raw: unknown, via: 'socket'): ControlResult
  snapshot(): ControlSnapshot
  observe(listener: (event: ControlEvent) => void): () => void
}

export interface ControlServerOptions {
  /** Where the socket (non-Windows) and the discovery file live: userData. */
  dir: string
  dispatcher: DispatcherLike
  log?: (line: string) => void
  /** Override the socket path (tests). */
  socketPath?: string
}

export interface ControlServer {
  path: string
  close(): Promise<void>
}

/** One line of JSON is a message; a client that sends more than this in one line is broken. */
export const MAX_LINE = 64 * 1024
export const DISCOVERY_FILE = 'control.json'

function defaultSocketPath(dir: string): string {
  if (process.platform === 'win32') {
    const user = (os.userInfo().username || 'user').replace(/[^A-Za-z0-9-]/g, '-')
    return `\\\\.\\pipe\\trilorah-control-${user}`
  }
  return path.join(dir, 'control.sock')
}

export function startControlServer(opts: ControlServerOptions): Promise<ControlServer> {
  const log = opts.log ?? (() => undefined)
  const socketPath = opts.socketPath ?? defaultSocketPath(opts.dir)
  // A socket file left by a crashed run blocks the new one; it is ours to clear.
  if (process.platform !== 'win32') {
    try { fs.unlinkSync(socketPath) } catch { /* not there */ }
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      let buffered = ''
      let greeted = false
      let unsubscribe: (() => void) | null = null
      const send = (message: Record<string, unknown>) => {
        if (!socket.destroyed) socket.write(`${JSON.stringify(message)}\n`)
      }
      const drop = (why: string) => {
        log(`control client dropped: ${why}`)
        unsubscribe?.()
        unsubscribe = null
        socket.destroy()
      }

      socket.setEncoding('utf8')
      socket.on('data', (chunk: string) => {
        buffered += chunk
        if (buffered.length > MAX_LINE) return drop('message too large')
        let eol = buffered.indexOf('\n')
        while (eol >= 0) {
          const line = buffered.slice(0, eol).trim()
          buffered = buffered.slice(eol + 1)
          eol = buffered.indexOf('\n')
          if (!line) continue
          let message: any
          try { message = JSON.parse(line) } catch { return drop('not JSON') }
          const id = message?.id
          const reply = (body: Record<string, unknown>) => send({ jsonrpc: '2.0', id, ...body })
          if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
            return drop('not JSON-RPC 2.0')
          }
          if (!greeted) {
            if (message.method !== 'hello') return drop('hello must come first')
            const theirs = String(message.params?.protocol ?? '')
            if (theirs.split('.')[0] !== CONTROL_PROTOCOL.split('.')[0]) {
              reply({ error: { code: -32600, message: `this app speaks control protocol ${CONTROL_PROTOCOL}; the client speaks ${theirs || 'none'} — update the older side` } })
              return drop('protocol mismatch')
            }
            greeted = true
            reply({ result: { protocol: CONTROL_PROTOCOL, snapshot: opts.dispatcher.snapshot() } })
            continue
          }
          switch (message.method) {
            case 'command':
              reply({ result: opts.dispatcher.execute(message.params?.command, 'socket') })
              break
            case 'subscribe':
              unsubscribe?.()
              unsubscribe = opts.dispatcher.observe((event) => send({ jsonrpc: '2.0', method: 'event', params: event }))
              reply({ result: { subscribed: true, snapshot: opts.dispatcher.snapshot() } })
              break
            case 'ping':
              reply({ result: 'pong' })
              break
            default:
              reply({ error: { code: -32601, message: `no such method: ${message.method}` } })
          }
        }
      })
      socket.on('close', () => { unsubscribe?.(); unsubscribe = null })
      socket.on('error', () => { /* close cleans up */ })
    })

    server.on('error', reject)
    server.listen(socketPath, () => {
      if (process.platform !== 'win32') {
        try { fs.chmodSync(socketPath, 0o600) } catch { /* best effort; the dir is already the user's */ }
      }
      const discovery = path.join(opts.dir, DISCOVERY_FILE)
      try {
        fs.writeFileSync(discovery, JSON.stringify({ socket: socketPath, protocol: CONTROL_PROTOCOL, pid: process.pid, startedAt: Date.now() }, null, 2))
      } catch (e) {
        log(`could not write ${discovery}: ${e instanceof Error ? e.message : e}`)
      }
      log(`🎛️ Control socket listening at ${socketPath}`)
      resolve({
        path: socketPath,
        close: () =>
          new Promise<void>((done) => {
            try { fs.unlinkSync(discovery) } catch { /* already gone */ }
            server.close(() => done())
          }),
      })
    })
  })
}
