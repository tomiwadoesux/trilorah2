/**
 * Companion wire protocol — the events the laptop pushes to congregation
 * phones (downstream) and the messages phones send back (upstream).
 *
 * Pure types + runtime guards so the relay client, the web page and the
 * main process all agree on shape. No Electron imports.
 */

export interface VerseRef {
  book: string
  chapter: number
  verse: number
  endVerse?: number
}

export interface PollCandidate extends VerseRef {
  score: number
}

export interface PollWire {
  id: string
  candidates: PollCandidate[]
  openedAt: number
  expiresAt: number
}

// ---- downstream: laptop → phones ------------------------------------------

export interface VerseEvent {
  type: 'verse'
  ref: VerseRef
  text?: string
  version?: string
  ts: number
}

export interface TranscriptEvent {
  type: 'transcript'
  text: string
  ts: number
}

export interface PollEvent {
  type: 'poll'
  poll: PollWire
}

export interface PollClosedEvent {
  type: 'poll-closed'
  pollId: string
  chosenIndex: number | null
}

export interface ViewerCountEvent {
  type: 'viewer-count'
  total: number
  inVenue: number
  remote: number
}

export interface SegmentEvent {
  type: 'segment'
  segment: string
  ts: number
}

export interface ServiceStartedEvent {
  type: 'service-started'
  sessionId: string
  ts: number
}

export interface ServiceEndedEvent {
  type: 'service-ended'
  sessionId: string
  ts: number
}

export type CompanionEvent =
  | VerseEvent
  | TranscriptEvent
  | PollEvent
  | PollClosedEvent
  | ViewerCountEvent
  | SegmentEvent
  | ServiceStartedEvent
  | ServiceEndedEvent

export const COMPANION_EVENT_TYPES = [
  'verse',
  'transcript',
  'poll',
  'poll-closed',
  'viewer-count',
  'segment',
  'service-started',
  'service-ended',
] as const

// ---- upstream: phones → laptop ---------------------------------------------

export interface VoteMessage {
  type: 'vote'
  pollId: string
  viewerId: string
  candidateIndex: number
}

export interface HelloMessage {
  type: 'hello'
  viewerId: string
  sessionId: string
}

export interface ByeMessage {
  type: 'bye'
  viewerId: string
}

export type CompanionMessage = VoteMessage | HelloMessage | ByeMessage

export const COMPANION_MESSAGE_TYPES = ['vote', 'hello', 'bye'] as const

// ---- guards ------------------------------------------------------------------

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function isVerseRef(v: unknown): v is VerseRef {
  return (
    isObj(v) &&
    isStr(v.book) &&
    isNum(v.chapter) &&
    isNum(v.verse) &&
    (v.endVerse === undefined || isNum(v.endVerse))
  )
}

export function isPollCandidate(v: unknown): v is PollCandidate {
  return isVerseRef(v) && isNum((v as any).score)
}

export function isPollWire(v: unknown): v is PollWire {
  return (
    isObj(v) &&
    isStr(v.id) &&
    Array.isArray(v.candidates) &&
    v.candidates.every(isPollCandidate) &&
    isNum(v.openedAt) &&
    isNum(v.expiresAt)
  )
}

export function isCompanionEvent(v: unknown): v is CompanionEvent {
  if (!isObj(v) || !isStr(v.type)) return false
  switch (v.type) {
    case 'verse':
      return isVerseRef(v.ref) && isNum(v.ts)
    case 'transcript':
      return isStr(v.text) && isNum(v.ts)
    case 'poll':
      return isPollWire(v.poll)
    case 'poll-closed':
      return isStr(v.pollId) && (v.chosenIndex === null || isNum(v.chosenIndex))
    case 'viewer-count':
      return isNum(v.total) && isNum(v.inVenue) && isNum(v.remote)
    case 'segment':
      return isStr(v.segment) && isNum(v.ts)
    case 'service-started':
    case 'service-ended':
      return isStr(v.sessionId) && isNum(v.ts)
    default:
      return false
  }
}

export function isCompanionMessage(v: unknown): v is CompanionMessage {
  if (!isObj(v) || !isStr(v.type)) return false
  switch (v.type) {
    case 'vote':
      return (
        isStr(v.pollId) &&
        isStr(v.viewerId) &&
        isNum(v.candidateIndex) &&
        Number.isInteger(v.candidateIndex) &&
        v.candidateIndex >= 0
      )
    case 'hello':
      return isStr(v.viewerId) && isStr(v.sessionId)
    case 'bye':
      return isStr(v.viewerId)
    default:
      return false
  }
}

/** Parse a raw relay frame (string or object) into a message, or null. */
export function parseCompanionMessage(raw: unknown): CompanionMessage | null {
  let v: unknown = raw
  if (isStr(raw)) {
    try {
      v = JSON.parse(raw)
    } catch {
      return null
    }
  }
  return isCompanionMessage(v) ? v : null
}

// ---- helpers ----------------------------------------------------------------

export type ShareMode = 'anyone' | 'wifi-only'

/** Build the congregation link: `${publicWebUrl}/live/${slug}`. */
export function shareLink(publicWebUrl: string, slug: string): string {
  const base = String(publicWebUrl ?? '').trim().replace(/\/+$/, '')
  const s = encodeURIComponent(String(slug ?? '').trim().replace(/^\/+/, ''))
  if (!base || !s) return ''
  return `${base}/live/${s}`
}

/** Normalise a settings value into a ShareMode; unknown → 'anyone'. */
export function parseShareMode(v: unknown): ShareMode {
  const s = String(v ?? '').trim().toLowerCase().replace(/_/g, '-')
  return s === 'wifi-only' || s === 'wifi' || s === 'venue' ? 'wifi-only' : 'anyone'
}
