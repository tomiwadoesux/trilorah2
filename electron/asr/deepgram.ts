import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { usesWindowCapture } from '../../shared/audioInput'
import { spawn, type ChildProcess } from 'node:child_process'
// post-recovery: ASR language is a setting (multilingual support)
import { getSetting } from '../data/settings'
// post-recovery: window-mic capture path (no SoX dependency)
import { setAudioSink, clearAudioSink, soxAvailable } from './audioBus'
import { emitMicRequest, emitMicStop } from '../emitters'
import { toWordTimings, type WordTiming } from '../../shared/wordTimings'

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

/*
 * The socket's own lifecycle, apart from the microphone's.
 *
 * Deepgram closes a live socket on its own: after about ten seconds without
 * audio or a KeepAlive, and on any network hiccup. The app used to log the
 * close and carry on: the mic kept feeding a dead socket, the pill still
 * said "listening", and the transcript simply stopped — which is exactly
 * the mid-service silence the owner reported. Now the socket reconnects by
 * itself while the microphone keeps running, and silence is kept alive.
 */
let stopping = false
let everOpened = false
let reconnectTimer: NodeJS.Timeout | null = null
let keepAliveTimer: NodeJS.Timeout | null = null
let attempt = 0
let lastAudioAt = 0
let currentOnText: ((text: string, isFinal: boolean, display?: string, words?: WordTiming[] | null) => void) | null = null
let currentOnError: ((error: Error) => void) | undefined
const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000]
const MAX_ATTEMPTS = 12
const KEEPALIVE_MS = 5000

export function startDeepgram(
  onText: (text: string, isFinal: boolean, display?: string, words?: WordTiming[] | null) => void,
  onError?: (error: Error) => void,
  deviceLabel?: string,
  onStatus?: (message: string) => void
): void {
  currentDeviceLabel = deviceLabel
  currentOnStatus = onStatus
  currentOnText = onText
  currentOnError = onError
  stopping = false
  everOpened = false
  attempt = 0
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    console.error('❌ DEEPGRAM_API_KEY not set in environment')
    onError?.(new Error('DEEPGRAM_API_KEY not configured'))
    return
  }
  console.log('🎤 Starting Deepgram ASR...')
  openConnection(apiKey)
}

function openConnection(apiKey: string): void {
  const deepgram = createClient(apiKey)
  const connection = deepgram.listen.live({
    model: 'nova-2',
    language: getSetting('asrLanguage') || 'en-US',
    smart_format: true,
    // Smart formatting otherwise holds unfinished number/entity phrases for
    // up to three seconds. Recognition takes priority over polished formatting.
    no_delay: true,
    interim_results: true,
    punctuate: true,
    // Per-word start/end times. The companion page lights the word being
    // spoken from these; without them a phone can only fade paragraphs.
    // Costs nothing extra — it is the same transcription either way.
    words: true,
    diarize: true,
    /* Milliseconds of silence before Deepgram closes a sentence. Quotes and
       passages can already act on interim words. Final-only commands should
       not wait several seconds, and the reference resolver handles its own
       pending window for numbers split across pauses. */
    endpointing: 350,
    sample_rate: SAMPLE_RATE,
    encoding: 'linear16',
    channels: 1,
    ...(deepgramKeywordList.length ? { keywords: deepgramKeywordList } : {})
  })
  deepgramConnection = connection
  connection.on(LiveTranscriptionEvents.Open, () => {
    if (deepgramConnection !== connection) return
    console.log(everOpened ? '✅ Deepgram connection reopened' : '✅ Deepgram connection opened')
    attempt = 0
    // The microphone is opened once; a reconnected socket just takes over
    // the audio that is already flowing.
    if (!everOpened) startMicrophoneCapture()
    everOpened = true
    startKeepAlive()
    // Only now is the app genuinely listening: the socket is up and the mic
    // has been asked for. Saying so any earlier — as the caller used to, the
    // instant start() returned — left the pill reading 'Listening...' through
    // a failed connection, with no audio behind it.
    currentOnStatus?.('Listening...')
  })
  connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
    if (deepgramConnection !== connection) return
    const alternative = data.channel?.alternatives?.[0]
    const transcript = alternative?.transcript
    if (!transcript) return
    const isFinal = data.is_final || data.speech_final
    console.log(`📝 ${isFinal ? 'Final' : 'Partial'}: ${transcript}`)
    // Finals only: a partial's words are re-sent, re-timed and sometimes
    // re-worded on the next packet, and a phone highlighting those would
    // stutter backwards mid-sentence.
    currentOnText?.(transcript.toLowerCase(), isFinal, transcript, isFinal ? toWordTimings(alternative?.words) : null)
  })
  connection.on(LiveTranscriptionEvents.Error, (error: any) => {
    if (deepgramConnection !== connection) return
    console.error('❌ Deepgram error:', error)
    // Before the first open an error is the real answer (a bad key, no
    // network); after it, the close that follows is what we act on.
    if (!everOpened) {
      stopping = true
      currentOnError?.(error instanceof Error ? error : new Error(String(error?.message ?? error)))
    }
  })
  connection.on(LiveTranscriptionEvents.Close, () => {
    if (deepgramConnection !== connection) return
    console.log('🔌 Deepgram connection closed')
    stopKeepAlive()
    if (stopping || !everOpened) return
    scheduleReconnect(apiKey)
  })
}

function scheduleReconnect(apiKey: string): void {
  if (reconnectTimer) return
  if (attempt >= MAX_ATTEMPTS) {
    stopping = true
    currentOnError?.(new Error('lost the connection to Deepgram and could not get it back — check the internet, then press start listening'))
    return
  }
  const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)]
  attempt++
  console.log(`🔁 Deepgram reconnect ${attempt}/${MAX_ATTEMPTS} in ${delay}ms`)
  currentOnStatus?.('Connecting...')
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (stopping) return
    openConnection(apiKey)
  }, delay)
}

/* Deepgram drops a socket that hears nothing for ~10s. A church is quiet
   between songs and during prayer, so the socket is told we are still here. */
function startKeepAlive(): void {
  stopKeepAlive()
  keepAliveTimer = setInterval(() => {
    const c = deepgramConnection
    if (!c || c.getReadyState() !== 1) return
    if (Date.now() - lastAudioAt < KEEPALIVE_MS) return
    try { c.keepAlive() } catch { /* the close handler takes it from here */ }
  }, KEEPALIVE_MS)
}
function stopKeepAlive(): void {
  if (keepAliveTimer) clearInterval(keepAliveTimer)
  keepAliveTimer = null
}

function startMicrophoneCapture(): void {
  if (!deepgramConnection) return
  console.log(`🎙️ Starting microphone at ${SAMPLE_RATE}Hz...`)
  // No SoX on this machine → capture the mic in the app window instead
  // (getUserMedia → PCM chunks over IPC → audio bus → Deepgram).
  if (usesWindowCapture(currentDeviceLabel) || !soxAvailable()) {
    console.log('🎙️ SoX not found — capturing microphone via the app window')
    usingWindowMic = true
    setAudioSink((chunk) => {
      if (deepgramConnection?.getReadyState() === 1) {
        deepgramConnection.send(chunk)
        lastAudioAt = Date.now()
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
      lastAudioAt = Date.now()
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
  stopping = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  stopKeepAlive()
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
