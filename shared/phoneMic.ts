/**
 * The phone microphone: a phone on the church Wi-Fi as the audio input.
 *
 * Phones only open a microphone on an https page, and the LAN remote is
 * plain http, so the mic page lives on the public site (web/src/app/mic).
 * The two devices find each other through a Supabase Realtime broadcast
 * channel named by a one-time code from a QR on the laptop; the audio itself
 * is a WebRTC call straight across the Wi-Fi and never leaves the building.
 *
 * MIRRORED in web/src/lib/phoneMicProtocol.ts (the web app cannot import
 * ../shared — see the note in web/src/lib/wordTimings.ts). Change both.
 */

/** The audio-input label that means "the connected phone". Never a real device name. */
export const PHONE_MIC_DEVICE = 'Phone microphone (over Wi-Fi)'

/** How long a code waits for a phone before it is thrown away. */
export const PAIRING_MS = 2 * 60 * 1000

/** No I/O/0/1: a code is read off a screen and sometimes typed. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 10

export function newPhoneMicCode(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(CODE_LENGTH)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

function defaultRandom(n: number): Uint8Array {
  const bytes = new Uint8Array(n)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

export function isPhoneMicCode(v: unknown): v is string {
  return typeof v === 'string' && v.length === CODE_LENGTH && [...v].every((c) => ALPHABET.includes(c))
}

/** The channel both sides join. The code IS the secret; nothing else gates it. */
export function phoneMicChannel(code: string): string {
  return `mic:${code}`
}

/** The page the QR opens. Null when the church has no public address set. */
export function phoneMicUrl(publicWebUrl: string, code: string): string | null {
  const base = String(publicWebUrl ?? '').trim().replace(/\/+$/, '')
  if (!/^https:\/\//i.test(base) || !isPhoneMicCode(code)) return null
  return `${base}/mic?c=${code}`
}

export interface IceCandidate {
  candidate: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
}

export type PhoneMicMessage =
  | { kind: 'hello'; phoneId: string; name: string }
  | { kind: 'approved'; phoneId: string; laptop: string }
  | { kind: 'declined'; phoneId: string; reason: string }
  | { kind: 'offer'; phoneId: string; sdp: string }
  | { kind: 'answer'; sdp: string }
  | { kind: 'ice'; from: 'phone' | 'desktop'; candidate: IceCandidate }
  | { kind: 'bye'; from: 'phone' | 'desktop'; reason?: string }

const str = (v: unknown, max = 4000): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/** A message off the wire is data from a stranger until it has been looked at. */
export function parsePhoneMicMessage(raw: unknown): PhoneMicMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  switch (m.kind) {
    case 'hello':
      return str(m.phoneId, 64) && str(m.name, 80) ? { kind: 'hello', phoneId: m.phoneId, name: m.name } : null
    case 'approved':
      return str(m.phoneId, 64) && str(m.laptop, 80) ? { kind: 'approved', phoneId: m.phoneId, laptop: m.laptop } : null
    case 'declined':
      return str(m.phoneId, 64) && str(m.reason, 200) ? { kind: 'declined', phoneId: m.phoneId, reason: m.reason } : null
    case 'offer':
      return str(m.phoneId, 64) && str(m.sdp, 20000) ? { kind: 'offer', phoneId: m.phoneId, sdp: m.sdp } : null
    case 'answer':
      return str(m.sdp, 20000) ? { kind: 'answer', sdp: m.sdp } : null
    case 'ice': {
      const c = m.candidate as Record<string, unknown> | undefined
      if ((m.from !== 'phone' && m.from !== 'desktop') || !c || typeof c !== 'object' || !str(c.candidate, 1000)) return null
      return {
        kind: 'ice',
        from: m.from,
        candidate: {
          candidate: c.candidate,
          sdpMid: typeof c.sdpMid === 'string' ? c.sdpMid : null,
          sdpMLineIndex: typeof c.sdpMLineIndex === 'number' ? c.sdpMLineIndex : null,
        },
      }
    }
    case 'bye':
      return m.from === 'phone' || m.from === 'desktop'
        ? { kind: 'bye', from: m.from, ...(str(m.reason, 200) ? { reason: m.reason } : {}) }
        : null
    default:
      return null
  }
}

export type PhoneMicState =
  | 'idle'
  | 'waiting'
  | 'pending'
  | 'connecting'
  | 'connected'
  | 'expired'
  | 'declined'
  | 'ended'
  | 'error'

export interface PhoneMicStatus {
  state: PhoneMicState
  code: string | null
  url: string | null
  /** The QR as a data URL, drawn by the laptop. */
  qr: string | null
  phoneName: string | null
  expiresAt: number | null
  error: string | null
}
