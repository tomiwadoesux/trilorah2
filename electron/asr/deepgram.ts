import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { spawn, type ChildProcess } from 'node:child_process'
// post-recovery: ASR language is a setting (multilingual support)
import { getSetting } from '../data/settings'
// post-recovery: window-mic capture path (no SoX dependency)
import { setAudioSink, clearAudioSink, soxAvailable } from './audioBus'
import { emitMicRequest, emitMicStop } from '../emitters'

let usingWindowMic = false

let deepgramConnection: any = null
let micProcess: ChildProcess | null = null
let currentDeviceLabel: string | undefined
let currentOnStatus: ((message: string) => void) | undefined
const SAMPLE_RATE = 48000

/** Vocabulary boosts ("Ayotomiwa:2") — see preachers/vocabulary.ts. */
let deepgramKeywordList: string[] = []

/**
 * Set the keyword boosts for the NEXT connection (Deepgram takes repeated
 * `keywords=` query params; the SDK appends one per array item). Call
 * before startDeepgram(), or restart the ASR for a change to apply.
 */
export function setDeepgramKeywords(list: string[]): void {
  deepgramKeywordList = [...new Set(list.map((k) => k.trim()).filter(Boolean))]
  if (deepgramKeywordList.length) {
    console.log(`📚 Deepgram keywords: ${deepgramKeywordList.length} boosted`)
  }
}

export function startDeepgram(
  onText: (text: string, isFinal: boolean, display?: string) => void,
  onError?: (error: Error) => void,
  deviceLabel?: string,
  onStatus?: (message: string) => void
): void {
  currentDeviceLabel = deviceLabel
  currentOnStatus = onStatus
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    console.error('❌ DEEPGRAM_API_KEY not set in environment')
    onError?.(new Error('DEEPGRAM_API_KEY not configured'))
    return
  }
  console.log('🎤 Starting Deepgram ASR...')
  const deepgram = createClient(apiKey)
  deepgramConnection = deepgram.listen.live({
    model: 'nova-2',
    language: getSetting('asrLanguage') || 'en-US',
    smart_format: true,
    interim_results: true,
    punctuate: true,
    /* Milliseconds of silence before Deepgram closes a sentence. This was
       3500, and the engine acts on finals — so every spoken command and
       every reference waited three and a half seconds after the preacher
       stopped talking. A reference split across a pause is already joined
       by the resolver's own pending window, so the recogniser does not need
       to hold the sentence open to keep it together. */
    endpointing: 700,
    sample_rate: SAMPLE_RATE,
    encoding: 'linear16',
    channels: 1,
    ...(deepgramKeywordList.length ? { keywords: deepgramKeywordList } : {})
  })
  deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
    console.log('✅ Deepgram connection opened')
    startMicrophoneCapture()
    // Only now is the app genuinely listening: the socket is up and the mic
    // has been asked for. Saying so any earlier — as the caller used to, the
    // instant start() returned — left the pill reading 'Listening...' through
    // a failed connection, with no audio behind it.
    currentOnStatus?.('Listening...')
  })
  deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript
    if (!transcript) return
    const isFinal = data.is_final || data.speech_final
    console.log(`📝 ${isFinal ? 'Final' : 'Partial'}: ${transcript}`)
    onText(transcript.toLowerCase(), isFinal, transcript)
  })
  deepgramConnection.on(LiveTranscriptionEvents.Error, (error: any) => {
    console.error('❌ Deepgram error:', error)
    onError?.(error)
  })
  deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
    console.log('🔌 Deepgram connection closed')
  })
}

function startMicrophoneCapture(): void {
  if (!deepgramConnection) return
  console.log(`🎙️ Starting microphone at ${SAMPLE_RATE}Hz...`)
  // No SoX on this machine → capture the mic in the app window instead
  // (getUserMedia → PCM chunks over IPC → audio bus → Deepgram).
  if (!soxAvailable()) {
    console.log('🎙️ SoX not found — capturing microphone via the app window')
    usingWindowMic = true
    setAudioSink((chunk) => {
      if (deepgramConnection?.getReadyState() === 1) {
        deepgramConnection.send(chunk)
      }
    })
    emitMicRequest({ sampleRate: SAMPLE_RATE, deviceLabel: currentDeviceLabel })
    return
  }
  const spawnEnv = { ...process.env }
  if (currentDeviceLabel && currentDeviceLabel !== 'default') {
    spawnEnv.AUDIODEV = currentDeviceLabel
    console.log(`🎙️ AUDIODEV set to: "${currentDeviceLabel}"`)
  }
  micProcess = spawn(
    'rec',
    [
      '-q', // Quiet mode (less output)
      '-t',
      'raw', // Raw audio format
      '-e',
      'signed-integer',
      '-b',
      '16', // 16 bits per sample
      '-c',
      '1', // Mono
      '-r',
      SAMPLE_RATE.toString(),
      '-' // Output to stdout
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: spawnEnv
    }
  )
  let bytesSent = 0
  micProcess.stdout?.on('data', (chunk: Buffer) => {
    if (deepgramConnection?.getReadyState() === 1) {
      deepgramConnection.send(chunk)
      bytesSent += chunk.length
      if (bytesSent % (SAMPLE_RATE * 2) < chunk.length) {
        console.log(
          `🎤 Audio streaming... (${Math.round(bytesSent / 1024)}KB sent)`
        )
      }
    }
  })
  micProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString()
    if (msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')) {
      console.error('[Mic Error]', msg)
    }
  })
  micProcess.on('close', (code) => {
    console.log(`🎤 Mic process exited with code ${code}`)
  })
  micProcess.on('error', (err) => {
    console.error('❌ Failed to start mic:', err)
    console.log('💡 Install sox: brew install sox')
  })
}

export function stopDeepgram(): void {
  if (micProcess) {
    micProcess.kill()
    micProcess = null
  }
  if (usingWindowMic) {
    clearAudioSink()
    emitMicStop()
    usingWindowMic = false
  }
  if (deepgramConnection) {
    deepgramConnection.finish()
    deepgramConnection = null
  }
  currentDeviceLabel = undefined
  console.log('🎤 Deepgram stopped')
}
