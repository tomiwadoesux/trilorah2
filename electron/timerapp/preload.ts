/**
 * Trilorah Stage Timer's window API. The timer channels mirror the main
 * app's names (createTimer, startTimer, onTimers…) so the two control
 * surfaces read the same; the screen/link channels are this app's own.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const on = (channel: string) => (callback: (payload: any) => void) => {
  const subscription = (_event: IpcRendererEvent, payload: any) => callback(payload)
  ipcRenderer.on(channel, subscription)
  return () => ipcRenderer.removeListener(channel, subscription)
}

contextBridge.exposeInMainWorld('timerApi', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('set-setting', { key, value }),

  listTimers: () => ipcRenderer.invoke('list-timers'),
  createTimer: (input: unknown) => ipcRenderer.invoke('create-timer', input),
  updateTimer: (id: string, patch: unknown) => ipcRenderer.invoke('update-timer', id, patch),
  startTimer: (id: string) => ipcRenderer.invoke('start-timer', id),
  pauseTimer: (id: string) => ipcRenderer.invoke('pause-timer', id),
  resetTimer: (id: string) => ipcRenderer.invoke('reset-timer', id),
  removeTimer: (id: string) => ipcRenderer.invoke('remove-timer', id),
  onTimers: on('on-timers'),

  listDisplays: () => ipcRenderer.invoke('list-displays'),
  onDisplays: on('on-displays'),
  openScreen: (displayId: number) => ipcRenderer.invoke('open-screen', displayId),
  closeScreen: () => ipcRenderer.invoke('close-screen'),
  screenState: () => ipcRenderer.invoke('screen-state'),
  onScreenState: on('on-screen-state'),

  linkState: () => ipcRenderer.invoke('link-state'),
  onLink: on('on-link'),
  onStageReference: on('on-stage-reference'),
  onShowVerses: on('on-show-verses'),
})
