import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The socket is a fake; the microphone is the window path (no SoX), so the
 * audio sink is what we watch. What matters: a close after the first open
 * reconnects without asking for the mic again, silence gets KeepAlives, an
 * error before the first open is reported, and stop really stops.
 */
const sockets: FakeSocket[] = []
class FakeSocket {
  handlers = new Map<string, (p?: any) => void>()
  state = 0
  sent: unknown[] = []
  keepAlives = 0
  finished = false
  constructor() { sockets.push(this) }
  on(event: string, cb: (p?: any) => void) { this.handlers.set(event, cb) }
  getReadyState() { return this.state }
  send(chunk: unknown) { this.sent.push(chunk) }
  keepAlive() { this.keepAlives++ }
  finish() { this.finished = true; this.state = 3 }
  open() { this.state = 1; this.handlers.get('open')?.() }
  close() { this.state = 3; this.handlers.get('close')?.() }
  error(message: string) { this.handlers.get('error')?.(new Error(message)) }
}

vi.mock('@deepgram/sdk', () => ({
  createClient: () => ({ listen: { live: () => new FakeSocket() } }),
  LiveTranscriptionEvents: { Open: 'open', Close: 'close', Error: 'error', Transcript: 'Results' },
}))
vi.mock('../data/settings', () => ({ getSetting: () => undefined }))
const micRequests: unknown[] = []
let micStops = 0
vi.mock('../emitters', () => ({ emitMicRequest: (r: unknown) => micRequests.push(r), emitMicStop: () => { micStops++ } }))
let sink: ((chunk: Buffer) => void) | null = null
vi.mock('./audioBus', () => ({
  setAudioSink: (fn: (chunk: Buffer) => void) => { sink = fn },
  clearAudioSink: () => { sink = null },
  soxAvailable: () => false,
}))

describe('Deepgram reconnect', () => {
  const statuses: string[] = []
  const errors: string[] = []
  beforeEach(() => {
    /* A fresh module per test: deepgram.ts keeps lastAudioAt at module
       level, and the reconnect test's audio left it 500 fake-ms in the
       future, so the keep-alive test lost its first tick whenever the two
       ran less than half a second apart (it only passed on a slow machine). */
    vi.resetModules()
    vi.useFakeTimers()
    process.env.DEEPGRAM_API_KEY = 'test-key'
    sockets.length = 0
    micRequests.length = 0
    micStops = 0
    statuses.length = 0
    errors.length = 0
    sink = null
  })
  afterEach(() => { vi.useRealTimers() })

  async function start() {
    const mod = await import('./deepgram')
    mod.startDeepgram(() => undefined, (e) => errors.push(e.message), undefined, (s) => statuses.push(s))
    return mod
  }

  it('reopens the socket when Deepgram closes it, and keeps the same microphone', async () => {
    const mod = await start()
    sockets[0].open()
    expect(statuses).toEqual(['Listening...'])
    expect(micRequests).toHaveLength(1)

    sockets[0].close()
    expect(statuses.at(-1)).toBe('Connecting...')
    vi.advanceTimersByTime(500)
    expect(sockets).toHaveLength(2)
    sockets[1].open()
    expect(statuses.at(-1)).toBe('Listening...')
    // No second mic request: the audio already flowing now feeds the new socket.
    expect(micRequests).toHaveLength(1)
    sink?.(Buffer.from([1, 2]))
    expect(sockets[1].sent).toHaveLength(1)
    expect(sockets[0].sent).toHaveLength(0)
    mod.stopDeepgram()
  })

  it('keeps a silent socket alive', async () => {
    const mod = await start()
    sockets[0].open()
    vi.advanceTimersByTime(5000 * 3 + 10)
    expect(sockets[0].keepAlives).toBeGreaterThanOrEqual(3)
    mod.stopDeepgram()
  })

  it('does not reconnect after stop', async () => {
    const mod = await start()
    sockets[0].open()
    mod.stopDeepgram()
    expect(sockets[0].finished).toBe(true)
    expect(micStops).toBe(1)
    sockets[0].close()
    vi.advanceTimersByTime(10_000)
    expect(sockets).toHaveLength(1)
  })

  it('reports an error that happens before the first open', async () => {
    const mod = await start()
    sockets[0].error('invalid credentials')
    expect(errors).toEqual(['invalid credentials'])
    sockets[0].close()
    vi.advanceTimersByTime(10_000)
    expect(sockets).toHaveLength(1)
    mod.stopDeepgram()
  })

  it('gives up with a clear message when the network stays down', async () => {
    const mod = await start()
    sockets[0].open()
    for (let i = 0; i < 12; i++) {
      sockets.at(-1)!.close()
      vi.advanceTimersByTime(8000)
    }
    sockets.at(-1)!.close()
    expect(errors.at(-1)).toContain('lost the connection to Deepgram')
    mod.stopDeepgram()
  })
})
