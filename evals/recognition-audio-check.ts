/**
 * A small, explicitly synthetic speech-to-recognition check. Generates local
 * macOS speech, streams it in real time to the already-configured Deepgram
 * account, then runs the same local quote/passage matchers. No microphone.
 *
 * node --import tsx evals/recognition-audio-check.ts
 * Keys are read from the environment or .env.local and never printed or saved.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { parse } from 'dotenv'
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { QuoteMatcher } from '../electron/engine/quoteMatcher'
import { PassageMatcher } from '../electron/engine/passageMatcher'

const fixtures = [
  { id: 'short-opening', speech: 'For God so loved.', expected: ['John 3:16'] },
  { id: 'middle-and-ending', speech: 'Should not perish, but have everlasting life.', expected: ['John 3:16', 'John 3:15'] },
  { id: 'story-paraphrase', speech: 'David faced Goliath. He picked five smooth stones and came against the giant in the name of the Lord.', expected: ['1 Samuel 17'] },
  { id: 'ordinary-announcement', speech: 'Please bring the attendance records to the office after lunch.', expected: [] },
]
const SAMPLE_RATE = 48_000
const BYTES_PER_MS = SAMPLE_RATE * 2 / 1_000
const FRAME_MS = 20
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const round = (n: number) => Number(n.toFixed(1))

function pcmFromWave(file: string): Buffer {
  const wav = fs.readFileSync(file)
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Speech output is not a WAV file')
  let pcm: Buffer | undefined
  for (let offset = 12; offset + 8 <= wav.length;) {
    const size = wav.readUInt32LE(offset + 4)
    const id = wav.toString('ascii', offset, offset + 4)
    if (id === 'fmt ' && (wav.readUInt16LE(offset + 8) !== 1 || wav.readUInt16LE(offset + 10) !== 1 || wav.readUInt32LE(offset + 12) !== SAMPLE_RATE || wav.readUInt16LE(offset + 22) !== 16)) {
      throw new Error('Expected mono 48kHz 16-bit PCM speech')
    }
    if (id === 'data') pcm = wav.subarray(offset + 8, offset + 8 + size)
    offset += 8 + size + size % 2
  }
  if (!pcm?.length) throw new Error('Speech output contains no PCM samples')
  return pcm
}

type Observation = {
  transcript: string
  isFinal: boolean
  receivedMs: number
  lastRecognizedWordEndMs: number | null
  arrivalAfterLastRecognizedWordMs: number | null
  matchingMs: number
  quotes: string[]
  passage: string | null
}

async function main() {
  const envFile = path.join(process.cwd(), '.env.local')
  const key = process.env.DEEPGRAM_API_KEY || (fs.existsSync(envFile) ? parse(fs.readFileSync(envFile)).DEEPGRAM_API_KEY : '')
  if (!key) throw new Error('No configured Deepgram key is available')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-synthetic-speech-'))
  const quote = new QuoteMatcher()
  if (!quote.loadIndex()) throw new Error('Quote index unavailable')
  const passage = new PassageMatcher()
  const deepgram = createClient(key)
  const report: { provenance: string; caveats: string[]; provider: Record<string, unknown>; cases: unknown[]; directory: string } = {
    provenance: 'Synthetic macOS say speech streamed in real time; not human preaching or microphone audio.',
    caveats: ['Four illustrative cases do not establish production accuracy.', 'Timing starts at the first PCM frame sent and excludes microphone capture.', 'Word-end delay includes ASR processing, network transit, local scheduling, and matching.', 'Audio frames contain a short interval of upcoming audio; provider word timestamps have their own rounding, so tiny negative word-end differences are measurement granularity rather than negative latency.'],
    provider: { model: 'nova-2', language: 'en-US', no_delay: true, endpointing: 350, sample_rate: SAMPLE_RATE, encoding: 'linear16', channels: 1 },
    cases: [], directory,
  }
  for (const fixture of fixtures) {
    const file = path.join(directory, `${fixture.id}.wav`)
    execFileSync('/usr/bin/say', ['-r', '175', '-o', file, '--file-format=WAVE', '--data-format=LEI16@48000', fixture.speech], { stdio: 'pipe' })
    const pcm = pcmFromWave(file)
    quote.reset()
    passage.reset()
    const observations: Observation[] = []
    let started = 0
    let connectionFailed = false
    let closed = false
    const connection = deepgram.listen.live({
      ...report.provider,
      interim_results: true, smart_format: true, punctuate: true, words: true, diarize: true,
    })
    const opened = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Deepgram connection timed out')), 12_000)
      connection.once(LiveTranscriptionEvents.Open, () => { clearTimeout(timeout); resolve() })
      connection.once(LiveTranscriptionEvents.Error, () => { clearTimeout(timeout); reject(new Error('Deepgram connection failed (provider details omitted to protect credentials)')) })
    })
    connection.on(LiveTranscriptionEvents.Error, () => { connectionFailed = true })
    connection.on(LiveTranscriptionEvents.Close, () => { closed = true })
    connection.on(LiveTranscriptionEvents.Transcript, (message: any) => {
      const alternative = message.channel?.alternatives?.[0]
      const transcript = alternative?.transcript?.trim()
      if (!transcript || !started) return
      const receivedMs = performance.now() - started
      const isFinal = Boolean(message.is_final || message.speech_final)
      const start = performance.now()
      quote.updateTranscript(transcript, isFinal)
      const quotes = quote.tryDetectQuotes().map(match => match.ref)
      const candidate = passage.updateTranscript(transcript, isFinal)
      const lastWord = alternative.words?.at(-1)
      const lastEnd = typeof lastWord?.end === 'number' ? lastWord.end * 1_000 : null
      observations.push({
        transcript, isFinal, receivedMs: round(receivedMs), lastRecognizedWordEndMs: lastEnd === null ? null : round(lastEnd),
        arrivalAfterLastRecognizedWordMs: lastEnd === null ? null : round(receivedMs - lastEnd),
        matchingMs: round(performance.now() - start), quotes, passage: candidate?.ref ?? null,
      })
    })
    try {
      await opened
      const padded = Buffer.concat([pcm, Buffer.alloc(BYTES_PER_MS * 1_500)])
      started = performance.now()
      for (let offset = 0; offset < padded.length; offset += BYTES_PER_MS * FRAME_MS) {
        if (connectionFailed || closed) throw new Error('Deepgram connection closed during synthetic speech')
        const targetTime = offset / BYTES_PER_MS
        await delay(Math.max(0, started + targetTime - performance.now()))
        const frame = padded.subarray(offset, Math.min(offset + BYTES_PER_MS * FRAME_MS, padded.length))
        connection.send(Uint8Array.from(frame).buffer)
      }
      await delay(600)
    } finally {
      connection.requestClose()
      await delay(100)
    }
    const candidates = observations.filter(o => o.quotes.length || o.passage)
    const firstCorrect = observations.find(o => [...o.quotes, ...(o.passage ? [o.passage] : [])].some(ref => fixture.expected.some(expected => ref.startsWith(expected))))
    const passed = fixture.expected.length ? Boolean(firstCorrect) : candidates.length === 0
    const result = { id: fixture.id, speech: fixture.speech, expected: fixture.expected, audioFile: file, audioDurationMs: round(pcm.length / BYTES_PER_MS), passed,
      firstCandidate: candidates[0] ?? null, firstCorrect: firstCorrect ?? null, observations }
    report.cases.push(result)
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ id: fixture.id, passed, firstCorrectMs: firstCorrect?.receivedMs ?? null, firstCorrectWasInterim: firstCorrect ? !firstCorrect.isFinal : null, afterLastWordMs: firstCorrect?.arrivalAfterLastRecognizedWordMs ?? null, candidateRefs: candidates.flatMap(o => [...o.quotes, ...(o.passage ? [o.passage] : [])]) }))
  }
  console.log(`Report: ${path.join(directory, 'report.json')}`)
}

main().catch(error => {
  // Never print SDK objects, request headers, or configured credentials.
  const safe = error instanceof Error && !/key|token|authorization/i.test(error.message) ? error.message : 'Synthetic speech check could not run; credential details withheld'
  console.error(safe)
  process.exitCode = 1
})
