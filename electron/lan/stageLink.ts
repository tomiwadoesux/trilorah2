/**
 * The stage link's Trilorah half (shared/stageLink.ts has the protocol).
 *
 * While the `stageLinkEnabled` setting is on, this runs a tiny read-only TCP
 * line server and shouts a UDP beacon so a Trilorah Stage Timer on the same
 * network can find it. emitters.ts calls stageLinkPreview() with every
 * preview detection; only the ones the preacher actually NAMED go out, as a
 * reference string and nothing more.
 *
 * Off, or before start(), every call here is a no-op — the engine never has
 * to know whether the link is running.
 */

import dgram from 'node:dgram'
import net from 'node:net'
import os from 'node:os'
import {
  STAGE_LINK_BEACON_MS,
  STAGE_LINK_BEACON_PORT,
  STAGE_LINK_PROTOCOL,
  stageReferenceText,
  type StageBeacon,
  type StageMessage
} from '../../shared/stageLink'

interface Running {
  server: net.Server
  beacon: dgram.Socket
  beaconTimer: ReturnType<typeof setInterval>
  clients: Set<net.Socket>
  name: () => string
}

let running: Running | null = null

const log = (line: string) => console.log(`🕐 stage link: ${line}`)

function send(socket: net.Socket, message: StageMessage): void {
  try {
    socket.write(`${JSON.stringify(message)}\n`)
  } catch {
    /* a half-closed client is cleaned up by its own 'close' */
  }
}

/**
 * Start announcing and serving. `name` is read per beacon, so a church name
 * typed into settings shows up on the timer without a restart.
 */
export function startStageLink(name: () => string): void {
  if (running) return

  const clients = new Set<net.Socket>()
  const server = net.createServer((socket) => {
    clients.add(socket)
    socket.setKeepAlive(true, 10_000)
    socket.setNoDelay(true)
    // Read-only: whatever a client writes is ignored, but has to be consumed
    // or the socket's buffer fills.
    socket.on('data', () => undefined)
    socket.on('error', () => undefined)
    socket.on('close', () => clients.delete(socket))
    send(socket, { t: 'hello', v: STAGE_LINK_PROTOCOL, name: displayName(name) })
    log(`a stage timer connected (${clients.size} connected)`)
  })
  server.on('error', (e) => log(`server error: ${(e as Error).message}`))

  // An ephemeral port, announced in the beacon: nothing to collide with.
  server.listen(0, () => {
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    if (!port) return
    const beacon = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    beacon.on('error', (e) => log(`beacon error: ${e.message}`))
    beacon.bind(() => {
      try {
        beacon.setBroadcast(true)
      } catch {
        /* no broadcast permission: the link simply stays unfound */
      }
    })
    const shout = () => {
      const message: StageBeacon = { t: 'trilorah', v: STAGE_LINK_PROTOCOL, port, name: displayName(name) }
      const bytes = Buffer.from(JSON.stringify(message))
      // 255.255.255.255 covers the simple church LAN; each interface's own
      // broadcast address covers the routers that drop the global one.
      for (const to of broadcastAddresses()) {
        beacon.send(bytes, STAGE_LINK_BEACON_PORT, to, () => undefined)
      }
    }
    const beaconTimer = setInterval(shout, STAGE_LINK_BEACON_MS)
    shout()
    running = { server, beacon, beaconTimer, clients, name }
    log(`announcing on udp ${STAGE_LINK_BEACON_PORT}, serving on tcp ${port}`)
  })
}

export function stopStageLink(): void {
  if (!running) return
  const r = running
  running = null
  clearInterval(r.beaconTimer)
  try { r.beacon.close() } catch { /* already closed */ }
  for (const socket of r.clients) socket.destroy()
  r.clients.clear()
  r.server.close()
  log('stopped')
}

export function stageLinkRunning(): boolean {
  return running !== null
}

/**
 * Called by emitters.emitVerseDetected with every preview. Relays only a
 * reference the preacher NAMED: a preview, not moved to by itself
 * (`stepped`), and not one of the engine's recognitions (a quote, a named
 * passage, a story) — the same filter as the gold sweep's `kind === 'said'`
 * (src/lib/catchSets.ts catchKind: no recognition means said).
 */
export function stageLinkPreview(detection: {
  isPreview?: boolean
  stepped?: boolean
  recognition?: unknown
  book?: string
  chapter?: number
  verse?: number | null
  endVerse?: number | null
}): void {
  if (!running || running.clients.size === 0) return
  if (!detection.isPreview || detection.stepped || detection.recognition) return
  const ref = stageReferenceText(detection)
  if (!ref) return
  const message: StageMessage = { t: 'reference', ref, at: Date.now() }
  for (const socket of running.clients) send(socket, message)
}

function displayName(name: () => string): string {
  try {
    return name().trim() || os.hostname()
  } catch {
    return os.hostname()
  }
}

/** The IPv4 broadcast address of every real interface, plus the global one. */
function broadcastAddresses(): string[] {
  const out = new Set<string>(['255.255.255.255'])
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family !== 'IPv4' || a.internal || !a.address || !a.netmask) continue
      const ip = a.address.split('.').map(Number)
      const mask = a.netmask.split('.').map(Number)
      if (ip.length !== 4 || mask.length !== 4) continue
      out.add(ip.map((part, i) => (part | (~mask[i] & 255)) & 255).join('.'))
    }
  }
  return [...out]
}
