/**
 * Local Whisper ASR — the free-tier ears. No API key, nothing leaves the
 * machine. EXPERIMENTAL: chunked (not word-streamed) transcription.
 *
 * Capture: the same SoX `rec` pipeline as the Deepgram path, but audio is
 * accumulated into ~5s WAV chunks and transcribed with whisper.cpp via the
 * `whisper-node` package. Latency is chunk-sized (~5-7s vs Deepgram's
 * sub-second), acceptable for verse detection and notes; the paid tier
 * remains the low-latency option.
 *
 * Model: looks for a ggml model under <userData>/models/. If missing, the
 * provider reports a clear status instead of failing silently.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { app } from 'electron'
import { getSetting } from '../data/settings'
import { setAudioSink, clearAudioSink, soxAvailable } from './audioBus'
import { emitMicRequest, emitMicStop } from '../emitters'
import { cleanWhisperStdout, whisperArgs } from './whisperOutput'

let usingWindowMic = false

const SAMPLE_RATE = 16000
const CHUNK_SECONDS = 5
/** .en models are English-only; the multilingual ones serve every other
 *  language, so non-English setups should download ggml-small.bin etc. */
const EN_MODEL_CANDIDATES = ['ggml-medium.en.bin', 'ggml-small.en.bin', 'ggml-base.en.bin', 'ggml-tiny.en.bin']
const MULTILINGUAL_MODEL_CANDIDATES = ['ggml-medium.bin', 'ggml-small.bin', 'ggml-base.bin', 'ggml-tiny.bin']

export type WhisperModelSize = 'base' | 'small' | 'medium'
const MODEL_SIZES: WhisperModelSize[] = ['base', 'small', 'medium']

/** Setting `whisperModelSize` ('base' | 'small' | 'medium'); missing/unknown → 'base'. */
export function whisperModelSize(): WhisperModelSize {
  const raw = (getSetting as (key: string) => unknown)('whisperModelSize')
  return MODEL_SIZES.includes(raw as WhisperModelSize) ? (raw as WhisperModelSize) : 'base'
}

/** ggml filename for a size + language (English-only `.en` vs multilingual). */
export function whisperModelFilename(size: WhisperModelSize, lang: string): string {
  return lang === 'en' ? `ggml-${size}.en.bin` : `ggml-${size}.bin`
}

let micProcess: ChildProcess | null = null
let stopped = true
let pending = Buffer.alloc(0)
let transcribing = false

export function whisperModelDir(): string {
  return path.join(app.getPath('userData'), 'models')
}

/** Public whisper.cpp model weights — no account or token required. */
const MODEL_BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

let downloading = false

/**
 * Download the right ggml model into <userData>/models when none exists,
 * reporting progress through the callback (rendered in the ASR status pill).
 * Size follows the `whisperModelSize` setting (base ~142MB / small ~466MB /
 * medium ~1.5GB); `.en` variants for English setups, multilingual otherwise.
 */
export async function ensureWhisperModel(
  onProgress: (message: string) => void
): Promise<string | null> {
  const existing = findWhisperModel()
  if (existing) return existing
  if (downloading) return null
  downloading = true
  const lang = (getSetting('asrLanguage') || 'en-US').split('-')[0]
  const name = whisperModelFilename(whisperModelSize(), lang)
  const dir = whisperModelDir()
  const dest = path.join(dir, name)
  const tmp = `${dest}.download`
  try {
    fs.mkdirSync(dir, { recursive: true })
    onProgress('Downloading speech model (one time)…')
    const res = await fetch(`${MODEL_BASE_URL}/${name}`)
    if (!res.ok || !res.body) throw new Error(`model download failed (HTTP ${res.status})`)
    const total = Number(res.headers.get('content-length')) || 0
    const out = fs.createWriteStream(tmp)
    let received = 0
    let lastPct = -1
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      if (!out.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => out.once('drain', () => resolve()))
      }
      if (total > 0) {
        const pct = Math.floor((received / total) * 100)
        if (pct !== lastPct && pct % 5 === 0) {
          lastPct = pct
          onProgress(`Downloading speech model — ${pct}%`)
        }
      }
    }
    await new Promise<void>((resolve, reject) => {
      out.end(() => resolve())
      out.on('error', reject)
    })
    fs.renameSync(tmp, dest)
    console.log(`✅ Whisper model downloaded: ${dest}`)
    return dest
  } catch (e) {
    try { fs.unlinkSync(tmp) } catch { /* nothing partial to clean */ }
    console.error('❌ Whisper model download failed:', e)
    return null
  } finally {
    downloading = false
  }
}

export function findWhisperModel(): string | null {
  const dir = whisperModelDir()
  const lang = (getSetting('asrLanguage') || 'en-US').split('-')[0]
  // Non-English languages need a multilingual model; English prefers the
  // smaller/faster .en models but can use a multilingual one too.
  const preferred = whisperModelFilename(whisperModelSize(), lang)
  const candidates = [
    preferred,
    ...(lang === 'en'
      ? [...EN_MODEL_CANDIDATES, ...MULTILINGUAL_MODEL_CANDIDATES]
      : MULTILINGUAL_MODEL_CANDIDATES)
  ]
  for (const name of candidates) {
    const p = path.join(dir, name)
    if (fs.existsSync(p)) return p
  }
  return null
}

/** Minimal RIFF/WAVE header for 16-bit mono PCM. */
function wavHeader(dataLength: number): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataLength, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataLength, 40)
  return header
}

export function startWhisperLocal(
  onText: (text: string, isFinal: boolean) => void,
  onError?: (error: Error) => void,
  deviceLabel?: string,
  onStatus?: (message: string) => void
): void {
  // Must come before ANYTHING touches the whisper-node package. Its shell.js
  // runs at import: if the compiled whisper.cpp binary is missing it tries
  // `make`, and when that fails it calls process.exit(1) — the whole app
  // vanishes, with no message, on the first press of Start Listening. That is
  // every Windows install (no `make`, no binary), so say so instead of dying.
  if (!whisperBinaryPath()) {
    onError?.(
      new Error(
        'Offline speech is not available on this computer yet. Add a Deepgram key in Settings → Audio & speech, then press Start Listening again.'
      )
    )
    return
  }
  const modelPath = findWhisperModel()
  if (!modelPath) {
    // First run: fetch the model, then start for real. The status callback
    // keeps the operator informed instead of failing silently.
    void ensureWhisperModel(onStatus ?? (() => undefined)).then((downloaded) => {
      if (downloaded) {
        startWhisperLocal(onText, onError, deviceLabel, onStatus)
      } else {
        onError?.(
          new Error(
            'Could not download the speech model — check the internet connection and press Start Listening again.'
          )
        )
      }
    })
    return
  }
  console.log(`🎤 Starting local Whisper ASR (${path.basename(modelPath)})...`)
  stopped = false
  pending = Buffer.alloc(0)

  const accumulate = (chunk: Buffer) => {
    if (stopped) return
    pending = Buffer.concat([pending, chunk])
    const target = SAMPLE_RATE * 2 * CHUNK_SECONDS
    if (pending.length >= target && !transcribing) {
      const slice = pending
      pending = Buffer.alloc(0)
      void transcribeChunk(slice, modelPath, onText, onError)
    }
  }

  // No SoX → capture the mic in the app window (getUserMedia → IPC).
  if (!soxAvailable()) {
    console.log('🎙️ SoX not found — capturing microphone via the app window')
    usingWindowMic = true
    setAudioSink(accumulate)
    emitMicRequest({ sampleRate: SAMPLE_RATE, deviceLabel })
    // The model is loaded and the mic has been asked for: this is the moment
    // the app is listening. Said here, for both the first-run download path
    // and the ordinary one, because the caller no longer says it on faith.
    onStatus?.('Listening...')
    return
  }

  const spawnEnv = { ...process.env }
  if (deviceLabel && deviceLabel !== 'default') {
    spawnEnv.AUDIODEV = deviceLabel
    console.log(`🎙️ AUDIODEV set to: "${deviceLabel}"`)
  }
  micProcess = spawn(
    'rec',
    ['-q', '-t', 'raw', '-e', 'signed-integer', '-b', '16', '-c', '1', '-r', SAMPLE_RATE.toString(), '-'],
    { stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv }
  )
  micProcess.stdout?.on('data', accumulate)
  // First bytes off the mic, not the spawn, are the proof it is capturing.
  micProcess.stdout?.once('data', () => onStatus?.('Listening...'))
  micProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString()
    if (msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')) {
      console.error('[Mic Error]', msg)
    }
  })
  micProcess.on('error', (err) => {
    console.error('❌ Mic process error (is SoX installed? `brew install sox`):', err.message)
    onError?.(err)
  })
}

/** The compiled whisper.cpp binary, wherever this build keeps it, or null.
 *  Packaged: unpacked beside app.asar (see asarUnpack in electron-builder.yml).
 *  Development: the project's own node_modules. */
export function whisperBinaryPath(): string | null {
  const exe = process.platform === 'win32' ? 'main.exe' : 'main'
  const rel = path.join('node_modules', 'whisper-node', 'lib', 'whisper.cpp', exe)
  const roots = [
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked') : '',
    app.getAppPath(),
    process.cwd()
  ].filter(Boolean)
  for (const root of roots) {
    const candidate = path.join(root, rel)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function transcribeChunk(
  pcm: Buffer,
  modelPath: string,
  onText: (text: string, isFinal: boolean) => void,
  onError?: (error: Error) => void
): Promise<void> {
  transcribing = true
  const wavPath = path.join(app.getPath('temp'), `trilorah-chunk-${Date.now()}.wav`)
  try {
    fs.writeFileSync(wavPath, Buffer.concat([wavHeader(pcm.length), pcm]))
    // The whisper.cpp program is run directly, not through the whisper-node
    // wrapper. The wrapper's shell.js runs at import, shells out to `make`
    // when it cannot find the binary, and calls process.exit(1) when that
    // fails — which took the whole app down on Windows. It also `cd`s the
    // entire main process into its own folder. Spawning the binary ourselves
    // is the same five flags, works identically on Windows (main.exe), and
    // cannot exit anything but itself.
    const binary = whisperBinaryPath()
    if (!binary) throw new Error('the offline speech engine is missing from this install')
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        binary,
        whisperArgs({
          modelPath,
          wavPath,
          language: (getSetting('asrLanguage') || 'en-US').split('-')[0],
          // Leave cores for the app and the projector; whisper scales poorly past 4 anyway.
          threads: Math.max(1, Math.min(4, os.cpus().length - 2))
        }),
        // cwd beside the binary: on Windows that is where whisper.dll lives.
        { cwd: path.dirname(binary), timeout: 60_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
        (err, out) => (err ? reject(err) : resolve(out))
      )
    })
    const text = cleanWhisperStdout(stdout)
    if (text) {
      console.log(`📝 Whisper: ${text}`)
      onText(text.toLowerCase(), true)
    }
  } catch (e: any) {
    console.error('❌ Whisper transcription failed:', e?.message ?? e)
    onError?.(e instanceof Error ? e : new Error(String(e)))
  } finally {
    transcribing = false
    try {
      fs.unlinkSync(wavPath)
    } catch {
      /* temp file may already be gone */
    }
  }
}

export function stopWhisperLocal(): void {
  stopped = true
  if (micProcess) {
    micProcess.kill()
    micProcess = null
  }
  if (usingWindowMic) {
    clearAudioSink()
    emitMicStop()
    usingWindowMic = false
  }
  pending = Buffer.alloc(0)
  console.log('🎤 Local Whisper ASR stopped')
}
