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
import { spawn, type ChildProcess } from 'node:child_process'
import { app } from 'electron'
import { getSetting } from '../data/settings'
import { setAudioSink, clearAudioSink, soxAvailable } from './audioBus'
import { emitMicRequest, emitMicStop } from '../emitters'

let usingWindowMic = false

const SAMPLE_RATE = 16000
const CHUNK_SECONDS = 5
/** .en models are English-only; the multilingual ones serve every other
 *  language, so non-English setups should download ggml-small.bin etc. */
const EN_MODEL_CANDIDATES = ['ggml-small.en.bin', 'ggml-base.en.bin', 'ggml-tiny.en.bin']
const MULTILINGUAL_MODEL_CANDIDATES = ['ggml-small.bin', 'ggml-base.bin', 'ggml-tiny.bin']

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
 * base.en (~142MB) for English setups, multilingual base otherwise.
 */
export async function ensureWhisperModel(
  onProgress: (message: string) => void
): Promise<string | null> {
  const existing = findWhisperModel()
  if (existing) return existing
  if (downloading) return null
  downloading = true
  const lang = (getSetting('asrLanguage') || 'en-US').split('-')[0]
  const name = lang === 'en' ? 'ggml-base.en.bin' : 'ggml-base.bin'
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
  const candidates =
    lang === 'en'
      ? [...EN_MODEL_CANDIDATES, ...MULTILINGUAL_MODEL_CANDIDATES]
      : MULTILINGUAL_MODEL_CANDIDATES
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
  const modelPath = findWhisperModel()
  if (!modelPath) {
    // First run: fetch the model, then start for real. The status callback
    // keeps the operator informed instead of failing silently.
    void ensureWhisperModel(onStatus ?? (() => undefined)).then((downloaded) => {
      if (downloaded) {
        startWhisperLocal(onText, onError, deviceLabel, onStatus)
        onStatus?.('Listening...')
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
    // whisper-node is CJS with loose typings; import lazily so the app
    // boots even if the native binary isn't built on this machine.
    const mod: any = await import('whisper-node')
    const whisper = mod.whisper ?? mod.default?.whisper ?? mod.default ?? mod
    const result = await whisper(wavPath, {
      modelPath,
      whisperOptions: {
        language: (getSetting('asrLanguage') || 'en-US').split('-')[0],
        word_timestamps: false
      }
    })
    const text = Array.isArray(result)
      ? result.map((r: any) => r.speech ?? r.text ?? '').join(' ').trim()
      : String(result ?? '').trim()
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
