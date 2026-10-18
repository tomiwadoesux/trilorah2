/**
 * Sound between two Trilorahs over the local network, using NDI®.
 *
 * Sender mode runs on the computer the soundboard is plugged into: its small
 * window captures the chosen input (src/sender/senderCapture.ts) and posts
 * float frames here, and this sends them as an NDI source called
 * "Trilorah Sound" — NDI puts the computer's name in front, the way vMix
 * Desktop Capture's sources appear. The NDI library ships inside the app
 * (the grandi package), so neither computer installs anything else.
 *
 * The listening Trilorah finds those sources, receives sound only (no
 * picture asked for, so Wi-Fi is enough), and turns it into the 16-bit mono
 * chunks the speech engines already eat from the app window's microphone.
 *
 * NDI is loaded on first use, never at startup: a church that never touches
 * this pays nothing for it, and a missing or broken library is a message in
 * the window rather than an app that will not open.
 */

import type { Finder, Grandi, Receiver, Sender, Source } from 'grandi'
import { SENDER_SOURCE_NAME } from '../../shared/audioInput'
import { Resampler, floatToInt16, levelDb, planarToMono } from './pcm'

let loading: Promise<Grandi> | null = null

function ndi(): Promise<Grandi> {
  loading ??= import('grandi').then((mod) => {
    const grandi = (mod.default ?? mod) as Grandi
    if (!grandi.isSupportedCPU()) throw new Error('NDI does not run on this computer’s processor')
    if (!grandi.initialize()) throw new Error('NDI could not start on this computer')
    return grandi
  })
  // A failed load is tried again next time instead of being cached forever.
  loading.catch(() => { loading = null })
  return loading
}

/* ------------------------------------------------------------------ */
/* Sending (sender mode)                                                */
/* ------------------------------------------------------------------ */

export interface SoundFrame {
  sampleRate: number
  channels: number
  samples: number
  /** Planar float32: every sample of channel 0, then channel 1. */
  data: ArrayBuffer
}

export interface SenderStatus {
  /** The name other computers see, e.g. "VMIX-PC (Trilorah Sound)". Empty until NDI is up. */
  name: string
  /** How many receivers have this source open. */
  connections: number
  /** Why sending stopped, in words for the window. */
  error?: string
}

let sender: Sender | null = null
let senderOpening: Promise<Sender> | null = null
let sendChain: Promise<void> = Promise.resolve()
let queued = 0
/* Whether sending is wanted, and which start it belongs to. Sound already on
   its way from the window when sending stops must not open the source again:
   "Trilorah Sound" would stay on the network, silent, until the app quit. */
let wanted = false
let generation = 0

let openingGeneration = -1

async function openSender(): Promise<Sender> {
  if (sender) return sender
  // An opening left over from before a stop is not reused; it closes itself.
  if (!senderOpening || openingGeneration !== generation) {
    const mine = generation
    openingGeneration = mine
    senderOpening = ndi()
      .then((grandi) => grandi.send({ name: SENDER_SOURCE_NAME, clockAudio: false, clockVideo: false }))
      .then((s) => {
        // Stopped while NDI was opening it: close it instead of keeping it.
        if (!wanted || mine !== generation) {
          s.destroy()
          throw new Error('Sending was stopped')
        }
        sender = s
        return s
      })
      .finally(() => { if (openingGeneration === mine) senderOpening = null })
  }
  return senderOpening
}

/**
 * One frame from the sender window. Sends run one after another; if NDI
 * falls behind, frames are dropped rather than queued, because sound that
 * arrives seconds late is worse for catching scripture than a gap.
 */
export function sendSound(frame: SoundFrame, onError: (message: string) => void): void {
  if (!wanted || queued > 8) return
  const mine = generation
  queued++
  sendChain = sendChain
    .then(async () => {
      if (!wanted || mine !== generation) return
      const [grandi, s] = await Promise.all([ndi(), openSender()])
      await s.audio({
        sampleRate: frame.sampleRate,
        channels: frame.channels,
        samples: frame.samples,
        channelStrideBytes: frame.samples * 4,
        data: Buffer.from(frame.data),
        fourCC: grandi.FourCC.FLTp, // planar float: the only sound format NDI sends
      })
    })
    .catch((err: unknown) => onError(err instanceof Error ? err.message : String(err)))
    .finally(() => { queued-- })
}

export function senderStatus(): SenderStatus {
  if (!sender) return { name: '', connections: 0 }
  try {
    return { name: sender.sourceName(), connections: sender.connections() }
  } catch {
    return { name: '', connections: 0 }
  }
}

/** Start the source before any sound arrives, so its name is known and it can be found. */
export async function announceSender(): Promise<SenderStatus> {
  wanted = true
  await openSender()
  return senderStatus()
}

/** Is a sender wanted right now? A start that finished after a stop is not. */
export function isSending(): boolean {
  return wanted
}

export function stopSending(): void {
  wanted = false
  generation++
  const s = sender
  sender = null
  // Let a send in flight finish before the native sender goes away under it.
  sendChain = sendChain.then(() => { s?.destroy() }).catch(() => undefined)
}

/* ------------------------------------------------------------------ */
/* Finding sources                                                      */
/* ------------------------------------------------------------------ */

let finder: Finder | null = null
let finderOpening: Promise<Finder> | null = null

async function openFinder(): Promise<Finder> {
  if (finder) return finder
  finderOpening ??= ndi()
    // Local sources too: a sender and a listener on one computer is how this gets tested.
    .then((grandi) => grandi.find({ showLocalSources: true }))
    .then(async (f) => {
      finder = f
      // NDI hears about sources over the next moment; the first answer is usually empty.
      await f.wait(1500)
      return f
    })
    .finally(() => { finderOpening = null })
  return finderOpening
}

/**
 * Every NDI source on the network, Trilorah senders first. Anything with sound
 * can be listened to (a vMix output, say), but the senders are what this is for.
 */
export async function listNetworkSounds(): Promise<string[]> {
  const f = await openFinder()
  const names = f.sources().map((s) => s.name)
  const ours = (n: string) => n.endsWith(`(${SENDER_SOURCE_NAME})`)
  return [...names.filter(ours), ...names.filter((n) => !ours(n))]
}

/* ------------------------------------------------------------------ */
/* Receiving (the listening Trilorah)                                   */
/* ------------------------------------------------------------------ */

export interface ReceiveCallbacks {
  /** 16-bit little-endian mono at the rate asked for, for the audio bus. */
  onChunk: (chunk: Buffer) => void
  /** RMS dB about every 200 ms, for the level meter. */
  onLevel: (db: number) => void
  /** Sound has stopped arriving (true) or come back (false). */
  onQuiet: (quiet: boolean) => void
  /** NDI itself failed — library missing, receiver refused. */
  onError: (message: string) => void
}

let receiving: { stop: () => void } | null = null

/** How long without a frame before the operator is told the other computer has gone quiet. */
const QUIET_MS = 4000

export function startReceiving(sourceName: string, sampleRate: number, cb: ReceiveCallbacks): void {
  stopReceiving()
  let active = true
  let receiver: Receiver | null = null
  receiving = {
    stop: () => {
      active = false
      try { receiver?.destroy() } catch { /* already gone */ }
      receiver = null
    },
  }
  void (async () => {
    let resampler: Resampler | null = null
    let lastFrameAt = Date.now()
    let quiet = false
    let lastLevelAt = 0
    let levelBuffer: Float32Array[] = []
    try {
      const grandi = await ndi()
      // The finder's copy carries the address, which connects faster; the bare name works too.
      const known = finder?.sources().find((s) => s.name === sourceName)
      const source: Source = known ?? { name: sourceName }
      if (!active) return
      receiver = await grandi.receive({ source, bandwidth: grandi.Bandwidth.AudioOnly, name: 'Trilorah listening' })
      if (!active) { receiver.destroy(); return }
      while (active && receiver) {
        let frame
        const askedAt = Date.now()
        try {
          frame = await receiver.audio({ audioFormat: grandi.AudioFormat.Float32Separate }, 1000)
        } catch {
          frame = null // a timeout: nothing in the last second
          // An instant refusal is not a timeout; don't spin on it.
          if (Date.now() - askedAt < 50) await new Promise((r) => setTimeout(r, 250))
        }
        if (!active) break
        const now = Date.now()
        if (!frame || frame.samples < 1) {
          if (!quiet && now - lastFrameAt > QUIET_MS) { quiet = true; cb.onQuiet(true) }
          continue
        }
        lastFrameAt = now
        if (quiet) { quiet = false; cb.onQuiet(false) }
        const mono = planarToMono(frame.data, frame.channels, frame.samples, frame.channelStrideInBytes)
        if (!resampler || resampler.fromRate !== frame.sampleRate) resampler = new Resampler(frame.sampleRate, sampleRate)
        cb.onChunk(floatToInt16(resampler.process(mono)))
        levelBuffer.push(mono)
        if (now - lastLevelAt > 200) {
          lastLevelAt = now
          const joined = new Float32Array(levelBuffer.reduce((n, b) => n + b.length, 0))
          let at = 0
          for (const b of levelBuffer) { joined.set(b, at); at += b.length }
          levelBuffer = []
          cb.onLevel(levelDb(joined))
        }
      }
    } catch (err) {
      if (active) cb.onError(err instanceof Error ? err.message : String(err))
    }
  })()
}

export function stopReceiving(): void {
  receiving?.stop()
  receiving = null
}

/** Everything off, for quitting. */
export function closeNetworkSound(): void {
  stopReceiving()
  stopSending()
  try { finder?.destroy() } catch { /* already gone */ }
  finder = null
}
