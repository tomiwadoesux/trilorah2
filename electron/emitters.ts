import { BrowserWindow } from 'electron'
import type { SegmentType, VerseDetection } from '../shared/types'

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
