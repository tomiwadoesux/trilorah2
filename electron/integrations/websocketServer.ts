/**
 * Local WebSocket control server (ws://<host>:8081).
 *
 * Drives the app from a phone, Stream Deck / Companion, or any LAN client —
 * but only after the socket proves it is paired. First message must be
 * either `{ type: 'auth', token }` or `{ type: 'pair', code, deviceName }`
 * (which redeems a fresh 6-digit code from PairingStore and returns a
 * token). Anything else on an unauthenticated socket closes it.
 *
 * No Electron dependency: main.ts supplies a RemoteHandlers bag of
 * callbacks, so this module unit-tests with a real `ws` server.
 */

import WebSocket, { WebSocketServer } from 'ws'
import type { PairingStore, PairedDeviceInfo } from './pairing'

export type RemoteMode = 'worship' | 'sermon'

export interface RemoteState {
  listening: boolean
  pendingRef: string | null
  liveRef: string | null
  autoMode: boolean
  /** 'live' | 'clear' | 'black' | 'logo' — see electron/output/outputState.ts */
  screen?: string
  alert?: { id: string; text: string } | null
}

export interface RemoteHandlers {
  startListening: () => void
  stopListening: () => void
  clearScreen: () => void
  blackScreen: () => void
  showLogo: () => void
  pushPreview: () => void
  approvePending: () => void
  dismissPending: () => void
  nextVerse: () => void
  previousVerse: () => void
  setAutoMode: (enabled: boolean) => void
  typeReference: (ref: string) => void
  setMode: (mode: RemoteMode) => void
  getState: () => RemoteState
  /** Optional: message alerts (EasyWorship-style "real-time alerts"). */
  showAlert?: (text: string, opts: { target?: string; durationSec?: number | null }) => void
  dismissAlert?: () => void
}

export const PROTOCOL_VERSION = '2.0.0'
export const AUTH_TIMEOUT_MS = 5000

interface ClientInfo {
  device: PairedDeviceInfo | null
  authTimer: NodeJS.Timeout | null
}

let wss: WebSocketServer | null = null
let handlers: RemoteHandlers | null = null
let pairingStore: PairingStore | null = null
const clients = new Map<WebSocket, ClientInfo>()

/** Legacy Stream Deck / Companion action names → typed commands. */
const LEGACY_ACTIONS: Record<string, string> = {
  START_LISTENING: 'startListening',
  STOP_LISTENING: 'stopListening',
  CLEAR_SCREEN: 'clearScreen',
  BLACK_SCREEN: 'blackScreen',
  SHOW_LOGO: 'showLogo',
  PUSH_PREVIEW: 'pushPreview',
  APPROVE_PENDING: 'approvePending',
  DISMISS_PENDING: 'dismissPending',
  NEXT_VERSE: 'nextVerse',
  PREVIOUS_VERSE: 'previousVerse',
  SET_AUTO_MODE: 'setAutoMode',
  TYPE_REFERENCE: 'typeReference',
  SET_MODE: 'setMode',
  GET_STATE: 'getState',
  SHOW_ALERT: 'showAlert',
  DISMISS_ALERT: 'dismissAlert'
}

export function startWebSocketServer(
  h: RemoteHandlers,
  pairing: PairingStore,
  port = 8081
): WebSocketServer | null {
  handlers = h
  pairingStore = pairing
  try {
    wss = new WebSocketServer({ port })
    console.log(`🌐 WebSocket API Server started on ws://localhost:${port}`)
    wss.on('error', (e) => console.error('❌ WebSocket Server error', e))
    wss.on('connection', (ws) => {
      console.log('🔗 External client connected via WebSocket')
      const info: ClientInfo = { device: null, authTimer: null }
      clients.set(ws, info)
      send(ws, { type: 'hello', version: PROTOCOL_VERSION, authRequired: true })
      info.authTimer = setTimeout(() => {
        if (!info.device) {
          send(ws, { type: 'error', code: 'unauthorized', message: 'auth timeout' })
          ws.close(4401, 'unauthorized')
        }
      }, AUTH_TIMEOUT_MS)

      ws.on('message', (message) => {
        let data: any
        try {
          data = JSON.parse(message.toString())
        } catch {
          console.error('❌ Failed to parse WS message', message.toString())
          if (!info.device) rejectAndClose(ws)
          else send(ws, { type: 'error', code: 'bad_json' })
          return
        }
        if (!info.device) {
          handleAuth(ws, info, data)
          return
        }
        handleCommand(ws, data)
      })
      ws.on('close', () => {
        if (info.authTimer) clearTimeout(info.authTimer)
        clients.delete(ws)
        console.log(`🔌 External client disconnected${info.device ? ` (${info.device.deviceName})` : ''}`)
      })
      ws.on('error', () => {
        /* close handler cleans up */
      })
    })
    return wss
  } catch (error) {
    console.error('❌ Failed to start WebSocket Server', error)
    wss = null
    return null
  }
}

export function stopWebSocketServer() {
  for (const [ws, info] of clients) {
    if (info.authTimer) clearTimeout(info.authTimer)
    try {
      ws.close(1001, 'server shutting down')
    } catch {
      /* already gone */
    }
  }
  clients.clear()
  if (wss) {
    wss.close()
    wss = null
    console.log('🛑 WebSocket API Server stopped')
  }
  handlers = null
  pairingStore = null
}

/** Push the current state snapshot to every paired client. */
export function broadcastState(): void {
  if (!handlers) return
  broadcastToClients({ type: 'state', state: handlers.getState() })
}

/** Send any event object to every authenticated client. */
export function broadcastToClients(event: Record<string, unknown>): void {
  const payload = JSON.stringify(event)
  for (const [ws, info] of clients) {
    if (info.device && ws.readyState === WebSocket.OPEN) ws.send(payload)
  }
}

/** Authenticated device names — handy for a "connected remotes" pill. */
export function connectedDevices(): PairedDeviceInfo[] {
  return [...clients.values()].flatMap((c) => (c.device ? [c.device] : []))
}

/* ------------------------------------------------------------------ */

function send(ws: WebSocket, msg: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function rejectAndClose(ws: WebSocket) {
  send(ws, { type: 'error', code: 'unauthorized' })
  ws.close(4401, 'unauthorized')
}

function handleAuth(ws: WebSocket, info: ClientInfo, data: any) {
  if (!pairingStore || !data || typeof data !== 'object') {
    rejectAndClose(ws)
    return
  }
  let device: PairedDeviceInfo | null = null
  let issuedToken: string | undefined
  if (data.type === 'auth') {
    device = pairingStore.verify(String(data.token ?? ''))
  } else if (data.type === 'pair') {
    const result = pairingStore.redeem(String(data.code ?? ''), String(data.deviceName ?? 'Remote'))
    if (result) {
      issuedToken = result.token
      device = pairingStore.verify(result.token)
    }
  }
  if (!device) {
    console.warn('🚫 Remote auth rejected')
    rejectAndClose(ws)
    return
  }
  info.device = device
  if (info.authTimer) {
    clearTimeout(info.authTimer)
    info.authTimer = null
  }
  console.log(`✅ Remote authenticated: ${device.deviceName}`)
  send(ws, {
    type: 'authenticated',
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    ...(issuedToken ? { token: issuedToken } : {}),
    state: handlers?.getState() ?? null
  })
}

function handleCommand(ws: WebSocket, data: any) {
  if (!handlers || !data || typeof data !== 'object') return
  // Re-auth on an already authenticated socket is harmless — just ack.
  if (data.type === 'auth' || data.type === 'pair') {
    send(ws, { type: 'authenticated', state: handlers.getState() })
    return
  }
  const legacy = typeof data.action === 'string'
  const command: string | undefined = legacy ? LEGACY_ACTIONS[data.action] : data.type
  const ack = (status: 'success' | 'unknown' | 'invalid', extra: Record<string, unknown> = {}) =>
    send(ws, legacy ? { action: data.action, status, ...extra } : { type: 'ack', command: data.type, status, ...extra })

  console.log('⚡ Received command via WS:', command ?? data)
  switch (command) {
    case 'startListening':
    case 'stopListening':
    case 'clearScreen':
    case 'blackScreen':
    case 'showLogo':
    case 'pushPreview':
    case 'approvePending':
    case 'dismissPending':
    case 'nextVerse':
    case 'previousVerse':
      handlers[command]()
      ack('success')
      break
    case 'setAutoMode': {
      const enabled = data.enabled ?? data.value
      if (typeof enabled !== 'boolean') return ack('invalid')
      handlers.setAutoMode(enabled)
      ack('success')
      break
    }
    case 'typeReference': {
      const ref = data.ref ?? data.reference ?? data.value
      if (typeof ref !== 'string' || !ref.trim()) return ack('invalid')
      handlers.typeReference(ref.trim())
      ack('success')
      break
    }
    case 'setMode': {
      const mode = data.mode ?? data.value
      if (mode !== 'worship' && mode !== 'sermon') return ack('invalid')
      handlers.setMode(mode)
      ack('success')
      break
    }
    case 'showAlert': {
      const text = data.text ?? data.value
      if (typeof text !== 'string' || !text.trim() || !handlers.showAlert) return ack('invalid')
      const durationSec =
        data.durationSec === null ? null : typeof data.durationSec === 'number' ? data.durationSec : undefined
      handlers.showAlert(text, { target: typeof data.target === 'string' ? data.target : undefined, durationSec })
      ack('success')
      break
    }
    case 'dismissAlert':
      if (!handlers.dismissAlert) return ack('invalid')
      handlers.dismissAlert()
      ack('success')
      break
    case 'getState':
      send(ws, { type: 'state', state: handlers.getState() })
      break
    default:
      console.warn('⚠️ Unknown external command:', data.action ?? data.type)
      ack('unknown')
  }
}
