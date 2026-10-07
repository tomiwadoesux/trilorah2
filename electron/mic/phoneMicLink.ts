import {
  PAIRING_MS,
  newPhoneMicCode,
  parsePhoneMicMessage,
  phoneMicChannel,
  phoneMicUrl,
  type PhoneMicMessage,
  type PhoneMicState,
  type PhoneMicStatus,
} from '../../shared/phoneMic'

/**
 * The laptop's half of the phone-microphone handshake.
 *
 * It owns the code, the channel and the approval; it never touches audio.
 * The WebRTC peer lives in the renderer (Chromium has the stack, Node does
 * not), so offers and candidates from the phone are handed on through
 * `onSignal`, and the renderer's answer comes back through `signal()`.
 *
 * The transport is injected so the whole flow runs under test without a
 * network — see supabaseMicChannel below for the real one.
 */
export interface MicChannel {
  send(message: PhoneMicMessage): Promise<void>
  close(): Promise<void>
}
export type MicChannelFactory = (name: string, onMessage: (raw: unknown) => void) => Promise<MicChannel>

export interface PhoneMicLinkOptions {
  openChannel: MicChannelFactory
  /** The QR for a URL, as a data URL. */
  qr: (url: string) => Promise<string>
  /** What the phone shows as "sending to …". */
  laptopName: string
  onStatus: (status: PhoneMicStatus) => void
  /** Offers and candidates from the phone, for the renderer's peer. */
  onSignal: (message: PhoneMicMessage) => void
  now?: () => number
  pairingMs?: number
}

export class PhoneMicLink {
  private state: PhoneMicState = 'idle'
  private code: string | null = null
  private url: string | null = null
  private qr: string | null = null
  private phone: { id: string; name: string } | null = null
  private expiresAt: number | null = null
  private error: string | null = null
  private channel: MicChannel | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly now: () => number
  private readonly pairingMs: number

  constructor(private readonly opts: PhoneMicLinkOptions) {
    this.now = opts.now ?? Date.now
    this.pairingMs = opts.pairingMs ?? PAIRING_MS
  }

  status(): PhoneMicStatus {
    return {
      state: this.state,
      code: this.code,
      url: this.url,
      qr: this.qr,
      phoneName: this.phone?.name ?? null,
      expiresAt: this.expiresAt,
      error: this.error,
    }
  }

  /** A fresh code and channel. Replaces whatever was there, phone included. */
  async start(publicWebUrl: string): Promise<PhoneMicStatus> {
    await this.teardown('a new code was made')
    const code = newPhoneMicCode()
    const url = phoneMicUrl(publicWebUrl, code)
    if (!url) {
      this.set('error', 'the church needs a public web address (https) under settings › companion')
      return this.status()
    }
    try {
      this.channel = await this.opts.openChannel(phoneMicChannel(code), (raw) => this.receive(raw))
      this.code = code
      this.url = url
      this.qr = await this.opts.qr(url)
      this.expiresAt = this.now() + this.pairingMs
      this.timer = setTimeout(() => this.expire(), this.pairingMs)
      this.set('waiting')
    } catch (e) {
      await this.teardown()
      this.set('error', e instanceof Error ? e.message : 'could not reach the cloud to make a code')
    }
    return this.status()
  }

  /** The operator's answer to "<phone> wants to be the microphone". */
  async approve(allow: boolean): Promise<void> {
    if (this.state !== 'pending' || !this.phone || !this.channel) return
    if (allow) {
      this.set('connecting')
      await this.channel.send({ kind: 'approved', phoneId: this.phone.id, laptop: this.opts.laptopName })
    } else {
      await this.channel.send({ kind: 'declined', phoneId: this.phone.id, reason: 'the laptop said no' })
      this.phone = null
      this.set('waiting')
    }
  }

  /** The renderer's answer and candidates, on their way to the phone. */
  async signal(message: PhoneMicMessage): Promise<void> {
    if (!this.channel) return
    if (message.kind !== 'answer' && !(message.kind === 'ice' && message.from === 'desktop')) return
    await this.channel.send(message)
  }

  /** What the renderer's peer reports. */
  peerState(state: 'connected' | 'failed', detail?: string): void {
    if (state === 'connected' && (this.state === 'connecting' || this.state === 'connected')) {
      this.clearTimer()
      this.expiresAt = null
      this.set('connected')
    } else if (state === 'failed' && this.state !== 'idle') {
      this.set('error', detail || 'the phone dropped off — is it still on the church Wi-Fi?')
    }
  }

  async stop(): Promise<void> {
    await this.teardown('the laptop stopped it')
    this.set('idle')
  }

  private receive(raw: unknown): void {
    const m = parsePhoneMicMessage(raw)
    if (!m || !this.channel) return
    switch (m.kind) {
      case 'hello':
        // One phone per code. A second one knocking while the first is in
        // is told so; it does not get to wait in the wings.
        if (this.state === 'waiting') {
          this.phone = { id: m.phoneId, name: m.name }
          this.set('pending')
        } else if (this.phone && m.phoneId !== this.phone.id) {
          void this.channel.send({ kind: 'declined', phoneId: m.phoneId, reason: 'another phone is already the microphone' })
        }
        return
      case 'offer':
        if (this.phone?.id === m.phoneId && (this.state === 'connecting' || this.state === 'connected')) this.opts.onSignal(m)
        return
      case 'ice':
        if (m.from === 'phone' && (this.state === 'connecting' || this.state === 'connected')) this.opts.onSignal(m)
        return
      case 'bye':
        if (m.from === 'phone' && this.phone) {
          this.opts.onSignal(m)
          void this.teardown()
          this.set('ended')
        }
        return
      default:
        return
    }
  }

  private expire(): void {
    if (this.state !== 'waiting' && this.state !== 'pending') return
    void this.teardown()
    this.set('expired')
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private async teardown(reason?: string): Promise<void> {
    this.clearTimer()
    const channel = this.channel
    const hadPhone = !!this.phone
    // Forget everything first, then say goodbye: a status read while the
    // close is still in flight must already show the code gone.
    this.channel = null
    this.code = null
    this.url = null
    this.qr = null
    this.phone = null
    this.expiresAt = null
    if (channel) {
      if (reason && hadPhone) await channel.send({ kind: 'bye', from: 'desktop', reason }).catch(() => undefined)
      await channel.close().catch(() => undefined)
    }
  }

  private set(state: PhoneMicState, error: string | null = null): void {
    this.state = state
    this.error = error
    this.opts.onStatus(this.status())
  }
}

/**
 * The real transport: a Supabase Realtime broadcast channel. Public, as
 * channels are by default — the code in its name is the only key, which is
 * the point: a ten-character code, two minutes, one phone.
 */
export function supabaseMicChannel(supa: {
  channel: (name: string, opts?: any) => any
  removeChannel: (ch: any) => Promise<unknown>
}): MicChannelFactory {
  return (name, onMessage) =>
    new Promise<MicChannel>((resolve, reject) => {
      const ch = supa.channel(name, { config: { broadcast: { self: false } } })
      let settled = false
      ch.on('broadcast', { event: 'mic' }, (p: { payload?: unknown }) => onMessage(p?.payload))
      ch.subscribe((status: string, err?: Error) => {
        if (settled) return
        if (status === 'SUBSCRIBED') {
          settled = true
          resolve({
            send: async (message) => {
              const r = await ch.send({ type: 'broadcast', event: 'mic', payload: message })
              if (r !== 'ok') throw new Error(`the cloud did not take the message (${r})`)
            },
            close: async () => {
              await supa.removeChannel(ch)
            },
          })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          settled = true
          void supa.removeChannel(ch)
          reject(new Error(err?.message || `could not open the channel (${status.toLowerCase()})`))
        }
      })
    })
}
