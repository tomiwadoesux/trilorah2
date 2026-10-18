/**
 * Trilorah Sender — the small separate download for the computer the sound
 * desk is plugged into, the way vMix Desktop Capture is a separate little
 * program from vMix.
 *
 * It is sender mode on its own: one small window (src/sender/SenderBar.tsx)
 * that captures the chosen input and sends it as the NDI® source
 * "Trilorah Sound" (electron/ndi/networkSound.ts). Trilorah on another
 * computer lists it in its audio picker as "sound from <computer>".
 *
 * Nothing of the main app comes along: no sermon engine, Bible, models or
 * speech recognition. The main app keeps its own "switch to sender mode";
 * both use the same window and the same NDI code.
 *
 * Built by scripts/build-sender.mjs with vite.sender.config.ts and packaged
 * with electron-builder.sender.yml.
 */

import { app, BrowserWindow, desktopCapturer, ipcMain, session, systemPreferences } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { announceSender, closeNetworkSound, isSending, senderStatus, sendSound, stopSending, type SoundFrame } from '../ndi/networkSound'

// Sound has to keep flowing while the window sits behind vMix all service.
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

// TRI_DEBUG_PORT lets a script attach over CDP, as in the main app.
if (process.env.TRI_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.TRI_DEBUG_PORT)
}

/* One sender per computer. A second "Trilorah Sound" would make the other
   computer choose between two copies of the same desk. */
if (!app.requestSingleInstanceLock()) app.quit()

/* ------------------------------------------------------------------ */
/* Settings: which input and which side, so a restart carries on.      */
/* ------------------------------------------------------------------ */

interface SenderSettings {
  senderDeviceLabel?: string
  senderChannels?: 'both' | 'left' | 'right'
  /** Open at login was switched on by the first start; never forced again after that. */
  loginItemOffered?: boolean
}

const settingsFile = () => path.join(app.getPath('userData'), 'sender-settings.json')
let settings: SenderSettings = {}

function loadSettings() {
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) as SenderSettings
  } catch {
    settings = {}
  }
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2))
  } catch (e: any) {
    console.error('Could not save the sender settings:', e?.message ?? e)
  }
}

/* ------------------------------------------------------------------ */
/* Open at login                                                        */
/* ------------------------------------------------------------------ */

// The Windows Run value is named, so the uninstaller can remove it (build/sender-installer.nsh).
const LOGIN_ITEM = { name: 'Trilorah Sender' }

function opensAtLogin(): boolean {
  const login = app.getLoginItemSettings()
  // Windows: whichever Run value starts this exe, and not switched off in Task Manager's Startup tab.
  return process.platform === 'win32' ? login.executableWillLaunchAtLogin : login.openAtLogin
}

function setOpensAtLogin(open: boolean) {
  app.setLoginItemSettings({ ...LOGIN_ITEM, openAtLogin: open })
}

/* A soundboard computer is switched on before the service and nobody sits at
   it, so the installed app opens with the computer from its first start.
   The window's "opens" row turns it off. A script-driven launch
   (TRI_DEBUG_PORT) or an unpackaged copy never touches the login items. */
function offerLoginItem() {
  if (settings.loginItemOffered || !app.isPackaged || process.env.TRI_DEBUG_PORT) return
  setOpensAtLogin(true)
  settings.loginItemOffered = true
  saveSettings()
}

/* ------------------------------------------------------------------ */
/* The window                                                           */
/* ------------------------------------------------------------------ */

let senderWindow: BrowserWindow | null = null
let statusTimer: ReturnType<typeof setInterval> | null = null

function createSenderWindow() {
  senderWindow = new BrowserWindow({
    width: 460,
    height: 380,
    minWidth: 380,
    minHeight: 360,
    title: 'Trilorah Sender',
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })
  senderWindow.loadFile(path.join(__dirname, 'renderer/sender.html'))
  senderWindow.on('closed', () => {
    senderWindow = null
    stopStatus()
    stopSending()
  })
}

function stopStatus() {
  if (statusTimer) clearInterval(statusTimer)
  statusTimer = null
}

function sendStatus(error?: string) {
  if (!senderWindow || senderWindow.isDestroyed()) return
  senderWindow.webContents.send('on-network-sound-status', { ...senderStatus(), ...(error ? { error } : {}) })
}

const fromSender = (event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) =>
  !!senderWindow && !senderWindow.isDestroyed() && event.sender === senderWindow.webContents

/* ------------------------------------------------------------------ */
/* What the window asks for (the same channels as the main app's)      */
/* ------------------------------------------------------------------ */

ipcMain.handle('get-settings', () => ({ ...settings }))

ipcMain.handle('set-setting', (_event, { key, value }: { key: string; value: unknown }) => {
  if (key === 'senderDeviceLabel' && typeof value === 'string') settings.senderDeviceLabel = value
  else if (key === 'senderChannels' && (value === 'both' || value === 'left' || value === 'right')) settings.senderChannels = value
  else return false
  saveSettings()
  return true
})

ipcMain.handle('sender-opens-at-login', () => opensAtLogin())
ipcMain.handle('set-sender-opens-at-login', (_event, open: unknown) => {
  setOpensAtLogin(open === true)
  return opensAtLogin()
})

ipcMain.handle('get-audio-capture-capabilities', () => ({ deviceAudio: process.platform === 'win32' }))

ipcMain.handle('request-mic-permission', async () => {
  if (process.platform !== 'darwin') return { granted: true }
  try {
    if (systemPreferences.getMediaAccessStatus('microphone') === 'granted') return { granted: true }
    return { granted: await systemPreferences.askForMediaAccess('microphone') }
  } catch (e: any) {
    return { granted: false, error: e?.message }
  }
})

ipcMain.handle('network-sound-start', async () => {
  try {
    const status = await announceSender()
    stopStatus()
    // The window may have closed while NDI was starting.
    if (isSending() && senderWindow && !senderWindow.isDestroyed()) statusTimer = setInterval(() => sendStatus(), 1000)
    return status
  } catch (e: any) {
    return { name: '', connections: 0, error: e?.message ?? String(e) }
  }
})

ipcMain.handle('network-sound-stop', () => {
  stopStatus()
  stopSending()
  return senderStatus()
})

ipcMain.on('network-sound-frame', (event, frame: SoundFrame) => {
  if (!fromSender(event)) return
  if (!frame || !(frame.data instanceof ArrayBuffer) || frame.channels < 1 || frame.samples < 1) return
  sendSound(frame, (message) => sendStatus(message))
})

/* ------------------------------------------------------------------ */
/* Start and stop                                                       */
/* ------------------------------------------------------------------ */

app.on('second-instance', () => {
  if (!senderWindow || senderWindow.isDestroyed()) return
  if (senderWindow.isMinimized()) senderWindow.restore()
  senderWindow.focus()
})

app.whenReady().then(() => {
  loadSettings()
  offerLoginItem()

  /* Chromium asks before handing a page the microphone and, with no handler,
     denies it — only in a packaged build, where the page is file://. */
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(permission === 'media' || (permission === 'display-capture' && wc === senderWindow?.webContents))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media')
  /* Computer sound on Windows: loopback. Chromium insists on a picture as
     well; it is captured and never used. */
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (process.platform !== 'win32' || request.frame !== senderWindow?.webContents.mainFrame || !request.audioRequested) {
      callback({})
      return
    }
    void desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => callback(sources[0] ? { video: sources[0], audio: 'loopback' } : {}))
      .catch(() => callback({}))
  })

  createSenderWindow()
})

app.on('activate', () => {
  if (!senderWindow) createSenderWindow()
})

// Closing the window stops sending, so the app goes with it — on a Mac too.
app.on('window-all-closed', () => app.quit())

app.on('before-quit', () => {
  stopStatus()
  closeNetworkSound()
})
