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

const SAMPLE_RATE = 16000
const CHUNK_SECONDS = 5
const MODEL_CANDIDATES = [
  'ggml-small.en.bin',
  'ggml-base.en.bin',
  'ggml-tiny.en.bin'
]

let micProcess: ChildProcess | null = null
let stopped = true
let pending = Buffer.alloc(0)
let transcribing = false

export function whisperModelDir(): string {
  return path.join(app.getPath('userData'), 'models')
}

export function findWhisperModel(): string | null {
  const dir = whisperModelDir()
  for (const name of MODEL_CANDIDATES) {
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
  deviceLabel?: string
): void {
  const modelPath = findWhisperModel()
  if (!modelPath) {
    const dir = whisperModelDir()
    console.error(`❌ No whisper model found in ${dir}`)
    onError?.(
      new Error(
        `Local ASR needs a whisper model. Download ggml-base.en.bin from huggingface.co/ggerganov/whisper.cpp and place it in ${dir}`
      )
    )
    return
  }
  console.log(`🎤 Starting local Whisper ASR (${path.basename(modelPath)})...`)
  stopped = false
  pending = Buffer.alloc(0)

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
  micProcess.stdout?.on('data', (chunk: Buffer) => {
    if (stopped) return
    pending = Buffer.concat([pending, chunk])
    const target = SAMPLE_RATE * 2 * CHUNK_SECONDS
    if (pending.length >= target && !transcribing) {
      const slice = pending
      pending = Buffer.alloc(0)
      void transcribeChunk(slice, modelPath, onText, onError)
    }
  })
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
      whisperOptions: { language: 'en', word_timestamps: false }
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
  pending = Buffer.alloc(0)
  console.log('🎤 Local Whisper ASR stopped')
}
