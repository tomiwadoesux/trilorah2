/**
 * Trilorah Stage Timer — the small separate download for the preacher's
 * countdown screen (owner, 2026-11-22), the way Trilorah Sender is the small
 * download for the sound computer.
 *
 * It is the stage timer on its own: one control window (src/timerapp) where
 * the operator types a duration, starts it, and grants extra time, and a
 * full-screen timer face on whichever display they choose. The clock is the
 * main app's own TimerStore (electron/engine/timers.ts), so the two apps can
 * never disagree about what a countdown does.
 *
 * None of the main app comes along — no engine, Bible, models or speech
 * recognition — which is the point: it runs on the computers Trilorah
 * itself will not.
 *
 * If Trilorah IS running on the same network with its stage-timer link
 * switched on (settings → external control), this app hears its UDP beacon
 * (shared/stageLink.ts), connects, and shows each scripture the preacher
 * NAMES on the timer screen for a few seconds — reference only, never the
 * verse text, and only when the operator here has the option on.
 *
 * Built by scripts/build-timerapp.mjs with vite.timerapp.config.ts and
 * packaged with electron-builder.timerapp.yml.
 */

import { app, BrowserWindow, ipcMain, screen } from 'electron'
import dgram from 'node:dgram'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { TimerStore, type CreateTimerInput, type UpdateTimerPatch } from '../engine/timers'
import {
  STAGE_LINK_BEACON_PORT,
  STAGE_LINK_BEACON_TIMEOUT_MS,
  isStageBeacon,
  isStageMessage
} from '../../shared/stageLink'

/* The face has to keep counting while the control window sits behind
   something else, or on the one-computer setup where the timer display IS
   this computer's screen and the operator is in another app (the same fix
   as the main app's outputs, 2026-10-07). */
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

// TRI_DEBUG_PORT lets a script attach over CDP, as in the main app.
if (process.env.TRI_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.TRI_DEBUG_PORT)
}

if (!app.requestSingleInstanceLock()) app.quit()

/* ------------------------------------------------------------------ */
/* Settings: this week's duration and screen, so a restart carries on.  */
/* ------------------------------------------------------------------ */

interface TimerAppSettings {
  timerName?: string
  durationSec?: number
  /** Show the scriptures the preacher names, when Trilorah is on the network. */
  showVerses?: boolean
  /** The display the timer screen last showed on. */
  displayId?: number
}

const settingsFile = () => path.join(app.getPath('userData'), 'stage-timer-settings.json')
let settings: TimerAppSettings = {}

function loadSettings() {
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) as TimerAppSettings
  } catch {
    settings = {}
  }
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2))
  } catch (e: any) {
    console.error('Could not save the timer settings:', e?.message ?? e)
  }
}

/* ------------------------------------------------------------------ */
/* Windows                                                              */
/* ------------------------------------------------------------------ */

let controlWindow: BrowserWindow | null = null
let screenWindow: BrowserWindow | null = null

function broadcast(channel: string, payload?: unknown): void {
  for (const win of [controlWindow, screenWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 620,
    height: 760,
    minWidth: 480,
    minHeight: 560,
    title: 'Trilorah Stage Timer',
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })
  controlWindow.loadFile(path.join(__dirname, 'renderer/timerapp.html'))
  controlWindow.on('closed', () => {
    controlWindow = null
    // The control window is the app: the screen must not survive it,
    // unfindable on a projector with nothing to close it from.
    closeTimerScreen()
  })
}

function describeDisplays() {
  const primary = screen.getPrimaryDisplay()
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Display ${i + 1}`,
    width: Math.round(d.size.width * d.scaleFactor) || d.size.width,
    height: Math.round(d.size.height * d.scaleFactor) || d.size.height,
    primary: d.id === primary.id,
    showing: !!screenWindow && !screenWindow.isDestroyed() && screenWindow.getBounds().x === d.bounds.x && screenWindow.getBounds().y === d.bounds.y
  }))
}

function openTimerScreen(displayId: number): boolean {
  const display = screen.getAllDisplays().find((d) => d.id === displayId) ?? screen.getPrimaryDisplay()
  closeTimerScreen()
  screenWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    fullscreen: true,
    backgroundColor: '#080808',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })
  screenWindow.loadFile(path.join(__dirname, 'renderer/timerapp.html'), { hash: 'screen' })
  // Esc closes the face from the face itself — the operator at the pulpit
  // computer should not have to find the control window first.
  screenWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') closeTimerScreen()
  })
  screenWindow.on('closed', () => {
    screenWindow = null
    broadcast('on-screen-state', { open: false })
    if (controlWindow && !controlWindow.isDestroyed()) controlWindow.webContents.send('on-displays', describeDisplays())
  })
  settings.displayId = display.id
  saveSettings()
  broadcast('on-screen-state', { open: true, displayId: display.id })
  return true
}

function closeTimerScreen(): void {
  if (screenWindow && !screenWindow.isDestroyed()) screenWindow.close()
  screenWindow = null
}

/* ------------------------------------------------------------------ */
/* The clock itself: the main app's TimerStore, run locally.            */
/* ------------------------------------------------------------------ */

/*
 * TRI_TIME_SCALE runs the clock faster than real time, so the states that
 * only appear after many minutes — the ten-minute overrun cap above all —
 * can be reached and looked at in a few seconds. Dev only: an installed
 * copy never sets it, and the store's clock is Date.now as usual.
 */
const timeScale = Number(process.env.TRI_TIME_SCALE) || 1
const startedAt = Date.now()
const clock = timeScale === 1 ? Date.now : () => startedAt + (Date.now() - startedAt) * timeScale

const timers = new TimerStore((snapshots) => broadcast('on-timers', snapshots), clock)

/* ------------------------------------------------------------------ */
/* The link to Trilorah on this network (shared/stageLink.ts).          */
/* ------------------------------------------------------------------ */

interface LinkState {
  connected: boolean
  /** The name Trilorah announced (church or computer). */
  name: string
}

let link: LinkState = { connected: false, name: '' }
let linkSocket: net.Socket | null = null
let beaconSocket: dgram.Socket | null = null
let lastBeaconAt = 0
let connecting = false

function setLink(next: LinkState): void {
  if (link.connected === next.connected && link.name === next.name) return
  link = next
  broadcast('on-link', link)
}

function connectTo(host: string, port: number, name: string): void {
  if (connecting || (linkSocket && !linkSocket.destroyed)) return
  connecting = true
  const socket = net.connect({ host, port })
  socket.setKeepAlive(true, 10_000)
  let carry = ''
  socket.on('connect', () => {
    connecting = false
    linkSocket = socket
    setLink({ connected: true, name })
  })
  socket.on('data', (chunk) => {
    carry += chunk.toString('utf8')
    const lines = carry.split('\n')
    carry = lines.pop() ?? ''
    // A flooded or garbled peer is not Trilorah: drop the line, keep the link.
    if (carry.length > 64_000) carry = ''
    for (const line of lines) {
      if (!line.trim()) continue
      let message: unknown
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }
      if (!isStageMessage(message)) continue
      if (message.t === 'hello') setLink({ connected: true, name: message.name || name })
      // References only ever travel to the windows — what shows, and where,
      // is the renderer's choice (the operator's showVerses option).
      else if (message.t === 'reference') broadcast('on-stage-reference', { ref: message.ref, at: Date.now() })
    }
  })
  const gone = () => {
    connecting = false
    if (linkSocket === socket) linkSocket = null
    setLink({ connected: false, name: link.name })
  }
  socket.on('error', gone)
  socket.on('close', gone)
}

function startListeningForTrilorah(): void {
  beaconSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  beaconSocket.on('error', (e) => console.warn('beacon listen error:', e.message))
  beaconSocket.on('message', (bytes, from) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(bytes.toString('utf8'))
    } catch {
      return
    }
    if (!isStageBeacon(parsed)) return
    lastBeaconAt = Date.now()
    connectTo(from.address, parsed.port, parsed.name)
  })
  try {
    beaconSocket.bind(STAGE_LINK_BEACON_PORT)
  } catch (e: any) {
    console.warn('could not listen for Trilorah:', e?.message ?? e)
  }
  // A Trilorah that stopped announcing is gone, even if TCP has not said so.
  setInterval(() => {
    if (link.connected && lastBeaconAt && Date.now() - lastBeaconAt > STAGE_LINK_BEACON_TIMEOUT_MS && (!linkSocket || linkSocket.destroyed)) {
      setLink({ connected: false, name: link.name })
    }
  }, 3000)
}

/* ------------------------------------------------------------------ */
/* What the windows ask for                                             */
/* ------------------------------------------------------------------ */

const fromOurs = (event: Electron.IpcMainInvokeEvent) =>
  [controlWindow, screenWindow].some((w) => w && !w.isDestroyed() && event.sender === w.webContents)

ipcMain.handle('get-settings', () => ({ ...settings }))
ipcMain.handle('set-setting', (event, { key, value }: { key: string; value: unknown }) => {
  if (!fromOurs(event)) return false
  if (key === 'timerName' && typeof value === 'string') settings.timerName = value
  else if (key === 'durationSec' && typeof value === 'number' && value > 0) settings.durationSec = value
  else if (key === 'showVerses' && typeof value === 'boolean') settings.showVerses = value
  else return false
  saveSettings()
  // The screen follows the option without asking: a toggle in the control
  // window must land on the wall the preacher is looking at.
  if (key === 'showVerses') broadcast('on-show-verses', settings.showVerses)
  return true
})

ipcMain.handle('list-timers', () => timers.snapshot())
ipcMain.handle('create-timer', (event, input: CreateTimerInput) => (fromOurs(event) ? timers.create(input) : null))
ipcMain.handle('update-timer', (event, id: string, patch: UpdateTimerPatch) => (fromOurs(event) ? timers.update(id, patch) : null))
ipcMain.handle('start-timer', (event, id: string) => (fromOurs(event) ? timers.start(id) : null))
ipcMain.handle('pause-timer', (event, id: string) => (fromOurs(event) ? timers.pause(id) : null))
ipcMain.handle('reset-timer', (event, id: string) => (fromOurs(event) ? timers.reset(id) : null))
ipcMain.handle('remove-timer', (event, id: string) => (fromOurs(event) ? timers.remove(id) : false))

ipcMain.handle('list-displays', () => describeDisplays())
ipcMain.handle('open-screen', (event, displayId: number) => (fromOurs(event) ? openTimerScreen(Number(displayId)) : false))
ipcMain.handle('close-screen', (event) => {
  if (fromOurs(event)) closeTimerScreen()
  return true
})
ipcMain.handle('screen-state', () => ({
  open: !!screenWindow && !screenWindow.isDestroyed(),
  displayId: settings.displayId
}))
ipcMain.handle('link-state', () => ({ ...link }))

/* ------------------------------------------------------------------ */
/* Start and stop                                                       */
/* ------------------------------------------------------------------ */

app.on('second-instance', () => {
  if (!controlWindow || controlWindow.isDestroyed()) return
  if (controlWindow.isMinimized()) controlWindow.restore()
  controlWindow.focus()
})

app.whenReady().then(() => {
  loadSettings()
  createControlWindow()
  startListeningForTrilorah()
  const refresh = () => {
    if (controlWindow && !controlWindow.isDestroyed()) controlWindow.webContents.send('on-displays', describeDisplays())
  }
  screen.on('display-added', refresh)
  screen.on('display-removed', refresh)
  screen.on('display-metrics-changed', refresh)
})

app.on('activate', () => {
  if (!controlWindow) createControlWindow()
})

app.on('window-all-closed', () => app.quit())

app.on('before-quit', () => {
  timers.dispose()
  try { beaconSocket?.close() } catch { /* already closed */ }
  linkSocket?.destroy()
})
