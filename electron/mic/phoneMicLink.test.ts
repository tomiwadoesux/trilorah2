import { describe, expect, it, vi } from 'vitest'
import { PhoneMicLink, type MicChannel } from './phoneMicLink'
import type { PhoneMicMessage, PhoneMicStatus } from '../../shared/phoneMic'

function rig(pairingMs = 1000) {
  const sent: PhoneMicMessage[] = []
  const statuses: PhoneMicStatus[] = []
  const signals: PhoneMicMessage[] = []
  let deliver: ((raw: unknown) => void) | null = null
  let closed = 0
  const channel: MicChannel = { send: async (m) => { sent.push(m) }, close: async () => { closed++ } }
  let now = 1_000_000
  const link = new PhoneMicLink({
    openChannel: async (_name, onMessage) => { deliver = onMessage; return channel },
    qr: async (url) => `data:qr,${url}`,
    laptopName: 'Booth laptop',
    onStatus: (s) => statuses.push(s),
    onSignal: (m) => signals.push(m),
    now: () => now,
    pairingMs,
  })
  return { link, sent, statuses, signals, closed: () => closed, phone: (raw: unknown) => deliver?.(raw), tick: (ms: number) => { now += ms } }
}

describe('PhoneMicLink', () => {
  it('makes a code, a link and a QR, and waits', async () => {
    const r = rig()
    const s = await r.link.start('https://trilorah.com')
    expect(s.state).toBe('waiting')
    expect(s.url).toMatch(/^https:\/\/trilorah\.com\/mic\?c=[A-Z2-9]{10}$/)
    expect(s.qr).toContain('data:qr,')
    expect(s.expiresAt).toBe(1_001_000)
  })

  it('refuses without an https site', async () => {
    const r = rig()
    const s = await r.link.start('http://localhost:3003')
    expect(s.state).toBe('error')
    expect(s.error).toContain('public web address')
  })

  it('asks the operator before a phone becomes the microphone, then relays the call', async () => {
    const r = rig()
    await r.link.start('https://trilorah.com')
    r.phone({ kind: 'hello', phoneId: 'p1', name: 'Ayo’s phone' })
    expect(r.link.status()).toMatchObject({ state: 'pending', phoneName: 'Ayo’s phone' })
    // Nothing from the phone counts until it is approved.
    r.phone({ kind: 'offer', phoneId: 'p1', sdp: 'v=0' })
    expect(r.signals).toHaveLength(0)

    await r.link.approve(true)
    expect(r.sent.at(-1)).toEqual({ kind: 'approved', phoneId: 'p1', laptop: 'Booth laptop' })
    expect(r.link.status().state).toBe('connecting')

    r.phone({ kind: 'offer', phoneId: 'p1', sdp: 'v=0' })
    r.phone({ kind: 'ice', from: 'phone', candidate: { candidate: 'candidate:1' } })
    expect(r.signals.map((m) => m.kind)).toEqual(['offer', 'ice'])

    await r.link.signal({ kind: 'answer', sdp: 'v=0 answer' })
    await r.link.signal({ kind: 'ice', from: 'desktop', candidate: { candidate: 'candidate:2' } })
    expect(r.sent.slice(-2).map((m) => m.kind)).toEqual(['answer', 'ice'])

    r.link.peerState('connected')
    expect(r.link.status()).toMatchObject({ state: 'connected', expiresAt: null })
  })

  it('declines and goes back to waiting for another phone', async () => {
    const r = rig()
    await r.link.start('https://trilorah.com')
    r.phone({ kind: 'hello', phoneId: 'p1', name: 'Stranger' })
    await r.link.approve(false)
    expect(r.sent.at(-1)).toMatchObject({ kind: 'declined', phoneId: 'p1' })
    expect(r.link.status()).toMatchObject({ state: 'waiting', phoneName: null })
  })

  it('turns a second phone away while one is in', async () => {
    const r = rig()
    await r.link.start('https://trilorah.com')
    r.phone({ kind: 'hello', phoneId: 'p1', name: 'First' })
    await r.link.approve(true)
    r.phone({ kind: 'hello', phoneId: 'p2', name: 'Second' })
    expect(r.sent.at(-1)).toMatchObject({ kind: 'declined', phoneId: 'p2' })
    expect(r.link.status().phoneName).toBe('First')
  })

  it('throws the code away after the pairing window', async () => {
    vi.useFakeTimers()
    try {
      const r = rig(1000)
      await r.link.start('https://trilorah.com')
      vi.advanceTimersByTime(1001)
      expect(r.link.status()).toMatchObject({ state: 'expired', code: null })
      expect(r.closed()).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a connected phone past the pairing window', async () => {
    vi.useFakeTimers()
    try {
      const r = rig(1000)
      await r.link.start('https://trilorah.com')
      r.phone({ kind: 'hello', phoneId: 'p1', name: 'Ayo’s phone' })
      await r.link.approve(true)
      r.link.peerState('connected')
      vi.advanceTimersByTime(5000)
      expect(r.link.status().state).toBe('connected')
    } finally {
      vi.useRealTimers()
    }
  })

  it('ends cleanly when the phone leaves, and tells the phone when the laptop does', async () => {
    const r = rig()
    await r.link.start('https://trilorah.com')
    r.phone({ kind: 'hello', phoneId: 'p1', name: 'Ayo’s phone' })
    await r.link.approve(true)
    r.phone({ kind: 'bye', from: 'phone' })
    expect(r.link.status().state).toBe('ended')
    expect(r.signals.at(-1)).toMatchObject({ kind: 'bye', from: 'phone' })

    await r.link.start('https://trilorah.com')
    r.phone({ kind: 'hello', phoneId: 'p1', name: 'Ayo’s phone' })
    await r.link.approve(true)
    await r.link.stop()
    expect(r.sent.at(-1)).toMatchObject({ kind: 'bye', from: 'desktop' })
    expect(r.link.status().state).toBe('idle')
  })

  it('drops garbage off the wire', async () => {
    const r = rig()
    await r.link.start('https://trilorah.com')
    r.phone('hello')
    r.phone({ kind: 'offer', phoneId: 'p9', sdp: 'v=0' })
    r.phone({ kind: 'bye', from: 'phone' })
    expect(r.link.status().state).toBe('waiting')
    expect(r.signals).toHaveLength(0)
  })
})
