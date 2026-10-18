/**
 * Trilorah Sender's window API: the part of the main app's window.api that
 * src/sender/SenderBar.tsx uses, on the same channels, plus open at login.
 * No exitSenderMode — there is no operator window to go back to, so the
 * sender window leaves that button out.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('set-setting', { key, value }),
  getAudioCaptureCapabilities: () => ipcRenderer.invoke('get-audio-capture-capabilities'),
  requestMicPermission: () => ipcRenderer.invoke('request-mic-permission'),

  startNetworkSound: () => ipcRenderer.invoke('network-sound-start'),
  stopNetworkSound: () => ipcRenderer.invoke('network-sound-stop'),
  sendNetworkSoundFrame: (frame: { sampleRate: number; channels: number; samples: number; data: ArrayBuffer }) =>
    ipcRenderer.send('network-sound-frame', frame),
  onNetworkSoundStatus: (callback: (status: { name: string; connections: number; error?: string }) => void) => {
    const subscription = (_event: IpcRendererEvent, status: any) => callback(status)
    ipcRenderer.on('on-network-sound-status', subscription)
    return () => ipcRenderer.removeListener('on-network-sound-status', subscription)
  },

  senderOpensAtLogin: () => ipcRenderer.invoke('sender-opens-at-login'),
  setSenderOpensAtLogin: (open: boolean) => ipcRenderer.invoke('set-sender-opens-at-login', open),
})
