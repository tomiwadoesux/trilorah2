/**
 * Audio bus — routes microphone PCM captured IN THE APP WINDOW to whichever
 * ASR provider is live.
 *
 * Why: the recovered engine shelled out to SoX (`rec`), an external tool
 * most machines don't have (`spawn rec ENOENT` = silent dead transcript).
 * The renderer captures the mic with getUserMedia instead — no system
 * dependencies — and streams 16-bit mono PCM chunks over IPC to this bus.
 * SoX still works as a fallback when it IS installed (some setups use
 * AUDIODEV routing for external audio interfaces).
 */

import { spawnSync } from 'node:child_process'

type AudioSink = (chunk: Buffer) => void

let sink: AudioSink | null = null

export function setAudioSink(next: AudioSink): void {
  sink = next
}

export function clearAudioSink(): void {
  sink = null
}

/** Called by main.ts for every 'audio-chunk' IPC message from the window. */
export function feedAudioChunk(chunk: Buffer): void {
  sink?.(chunk)
}

export function hasAudioSink(): boolean {
  return sink !== null
}

let soxChecked: boolean | null = null

/** Is the SoX `rec` binary available on this machine? (cached) */
export function soxAvailable(): boolean {
  if (soxChecked !== null) return soxChecked
  try {
    const res = spawnSync('rec', ['--version'], { timeout: 3000 })
    soxChecked = !res.error
  } catch {
    soxChecked = false
  }
  return soxChecked
}
