import { describe, it, expect } from 'vitest'
import {
  isCompanionEvent,
  isCompanionMessage,
  parseCompanionMessage,
  shareLink,
  parseShareMode,
} from './events'

describe('isCompanionEvent', () => {
  it('accepts every downstream event shape', () => {
    const ref = { book: 'John', chapter: 3, verse: 16 }
    const ok = [
      { type: 'verse', ref, ts: 1 },
      { type: 'transcript', text: 'hi', ts: 1 },
      {
        type: 'poll',
        poll: { id: 'p', candidates: [{ ...ref, score: 50 }], openedAt: 1, expiresAt: 2 },
      },
      { type: 'poll-closed', pollId: 'p', chosenIndex: null },
      { type: 'poll-closed', pollId: 'p', chosenIndex: 1 },
      { type: 'viewer-count', total: 3, inVenue: 2, remote: 1 },
      { type: 'segment', segment: 'sermon', ts: 1 },
      { type: 'service-started', sessionId: 's', ts: 1 },
      { type: 'service-ended', sessionId: 's', ts: 1 },
    ]
    for (const e of ok) expect(isCompanionEvent(e), JSON.stringify(e)).toBe(true)
  })
  it('rejects malformed events', () => {
    const bad = [
      null,
      'verse',
      { type: 'verse', ts: 1 },
      { type: 'verse', ref: { book: 'John', chapter: '3', verse: 16 }, ts: 1 },
      { type: 'poll', poll: { id: 'p', candidates: [{ book: 'x' }], openedAt: 1, expiresAt: 2 } },
      { type: 'viewer-count', total: 3 },
      { type: 'nope' },
    ]
    for (const e of bad) expect(isCompanionEvent(e), JSON.stringify(e)).toBe(false)
  })
})

describe('isCompanionMessage / parseCompanionMessage', () => {
  it('accepts vote, hello and bye', () => {
    expect(isCompanionMessage({ type: 'vote', pollId: 'p', viewerId: 'v', candidateIndex: 0 })).toBe(true)
    expect(isCompanionMessage({ type: 'hello', viewerId: 'v', sessionId: 's' })).toBe(true)
    expect(isCompanionMessage({ type: 'bye', viewerId: 'v' })).toBe(true)
  })
  it('rejects negative or fractional candidate indexes and unknown types', () => {
    expect(isCompanionMessage({ type: 'vote', pollId: 'p', viewerId: 'v', candidateIndex: -1 })).toBe(false)
    expect(isCompanionMessage({ type: 'vote', pollId: 'p', viewerId: 'v', candidateIndex: 0.5 })).toBe(false)
    expect(isCompanionMessage({ type: 'hello', viewerId: 'v' })).toBe(false)
    expect(isCompanionMessage({ type: 'verse' })).toBe(false)
  })
  it('parses JSON frames and returns null on garbage', () => {
    expect(parseCompanionMessage('{"type":"bye","viewerId":"v"}')).toEqual({ type: 'bye', viewerId: 'v' })
    expect(parseCompanionMessage('{not json')).toBeNull()
    expect(parseCompanionMessage('{"type":"vote"}')).toBeNull()
  })
})

describe('helpers', () => {
  it('shareLink joins url and slug cleanly', () => {
    expect(shareLink('https://trilorah.app/', 'grace-chapel')).toBe('https://trilorah.app/live/grace-chapel')
    expect(shareLink('https://trilorah.app', '/grace chapel')).toBe('https://trilorah.app/live/grace%20chapel')
    expect(shareLink('', 'x')).toBe('')
    expect(shareLink('https://trilorah.app', '')).toBe('')
  })
  it('parseShareMode defaults to anyone', () => {
    expect(parseShareMode('wifi-only')).toBe('wifi-only')
    expect(parseShareMode('WIFI_ONLY')).toBe('wifi-only')
    expect(parseShareMode('anyone')).toBe('anyone')
    expect(parseShareMode(undefined)).toBe('anyone')
    expect(parseShareMode('garbage')).toBe('anyone')
  })
})
