import WebSocket, { WebSocketServer } from 'ws'
import type { BrowserWindow } from 'electron'

let wss: WebSocketServer | null = null
let mainWindow: BrowserWindow | null = null

export function startWebSocketServer(win: BrowserWindow, port = 8081) {
  mainWindow = win
  try {
    wss = new WebSocketServer({ port })
    console.log(`🌐 WebSocket API Server started on ws://localhost:${port}`)
    wss.on('connection', (ws) => {
      console.log('🔗 External client connected via WebSocket')
      ws.send(JSON.stringify({ status: 'connected', version: '1.0.0' }))
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString())
          console.log('⚡ Received command via WS:', data)
          if (data.action) {
            handleExternalCommand(data, ws)
          }
        } catch (e) {
          console.error('❌ Failed to parse WS message', message.toString())
        }
      })
      ws.on('close', () => {
        console.log('🔌 External client disconnected')
      })
    })
  } catch (error) {
    console.error('❌ Failed to start WebSocket Server', error)
  }
}

export function stopWebSocketServer() {
  if (wss) {
    wss.close()
    wss = null
    console.log('🛑 WebSocket API Server stopped')
  }
}

function handleExternalCommand(data: any, ws: WebSocket) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  switch (data.action) {
    case 'START_LISTENING':
      mainWindow.webContents.send('on-external-command', {
        command: 'start-listening'
      })
      ws.send(JSON.stringify({ action: 'START_LISTENING', status: 'success' }))
      break
    case 'STOP_LISTENING':
      mainWindow.webContents.send('on-external-command', {
        command: 'stop-listening'
      })
      ws.send(JSON.stringify({ action: 'STOP_LISTENING', status: 'success' }))
      break
    case 'CLEAR_SCREEN':
      mainWindow.webContents.send('on-external-command', {
        command: 'clear-screen'
      })
      ws.send(JSON.stringify({ action: 'CLEAR_SCREEN', status: 'success' }))
      break
    case 'PUSH_PREVIEW':
      mainWindow.webContents.send('on-external-command', {
        command: 'push-preview'
      })
      ws.send(JSON.stringify({ action: 'PUSH_PREVIEW', status: 'success' }))
      break
    case 'SET_MODE':
      if (data.mode === 'worship' || data.mode === 'sermon') {
        mainWindow.webContents.send('on-external-command', {
          command: 'set-mode',
          value: data.mode
        })
        ws.send(JSON.stringify({ action: 'SET_MODE', status: 'success' }))
      }
      break
    default:
      console.warn('⚠️ Unknown external command:', data.action)
      ws.send(JSON.stringify({ action: data.action, status: 'unknown' }))
  }
}
