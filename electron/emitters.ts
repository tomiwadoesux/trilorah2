import { BrowserWindow } from 'electron'
import type { SegmentType, VerseDetection, VoiceCommandEvent } from '../shared/types'

let lastRef = ''
let lastTime = 0
export const DEBOUNCE_MS = 5000

export function shouldEmit(ref: string): boolean {
  const now = Date.now()
  if (ref === lastRef && now - lastTime < DEBOUNCE_MS) {
    return false
  }
  lastRef = ref
  lastTime = now
  return true
}

export function emitVerseDetected(
  detection: VerseDetection & Record<string, any>
): void {
  const refStr =
    detection.endVerse && detection.endVerse !== detection.verse
      ? `${detection.book} ${detection.chapter}:${detection.verse}-${detection.endVerse}`
      : `${detection.book} ${detection.chapter}:${detection.verse || 1}`
  if (detection.isPreview) {
    console.log(`👁️ Preview: ${refStr}`)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed())
        win.webContents.send('on-verse-preview', detection)
    })
  } else {
    console.log(`📤 Live: ${refStr}`)
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed())
        win.webContents.send('on-verse-detected', detection)
    })
  }
}

export function emitTranscript(text: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-transcript-update', text)
  })
}

export function emitASRStatus(status: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-asr-status', status)
  })
}

export function emitSegmentChanged(data: {
  type: SegmentType
  startedAt: number
  confidence: number
  previous?: SegmentType
}): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-segment-changed', data)
  })
}

export function emitMediaSuggestion(data: {
  mediaId: string
  title: string
  confidence: number
}): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-media-suggestion', data)
  })
}

export function emitVerseAutoDismiss(): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('on-verse-auto-dismiss')
  })
}

/* ---------------- added post-recovery (agentic feature set) ---------------- */

function broadcast(channel: string, payload?: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  })
}

export function emitVoiceCommand(event: VoiceCommandEvent): void {
  broadcast('on-voice-command', event)
}

export function emitVersionChanged(version: string): void {
  broadcast('on-version-changed', version)
}

export function emitQueueUpdated(
  queue: Array<{ ref: string; reason: string; ts: number }>
): void {
  broadcast('on-queue-updated', queue)
}

export function emitPrayerMode(inPrayer: boolean): void {
  broadcast('on-prayer-mode', inPrayer)
}

export function emitIntentState(state: string): void {
  broadcast('on-intent-state', state)
}
