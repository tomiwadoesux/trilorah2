import { describe, expect, it } from 'vitest'
import { isPhoneMicCode, newPhoneMicCode, parsePhoneMicMessage, phoneMicChannel, phoneMicUrl } from './phoneMic'

describe('phone mic codes', () => {
  it('makes ten readable characters from random bytes', () => {
    const code = newPhoneMicCode()
    expect(isPhoneMicCode(code)).toBe(true)
    expect(code).not.toMatch(/[IO01]/)
  })
  it('differs between calls', () => {
    expect(newPhoneMicCode()).not.toBe(newPhoneMicCode())
  })
  it('names the channel after the code', () => {
    expect(phoneMicChannel('ABCDEFGHJK')).toBe('mic:ABCDEFGHJK')
  })
  it('builds the page link only for an https site', () => {
    expect(phoneMicUrl('https://trilorah.com/', 'ABCDEFGHJK')).toBe('https://trilorah.com/mic?c=ABCDEFGHJK')
    expect(phoneMicUrl('http://localhost:3003', 'ABCDEFGHJK')).toBeNull()
    expect(phoneMicUrl('', 'ABCDEFGHJK')).toBeNull()
    expect(phoneMicUrl('https://trilorah.com', 'short')).toBeNull()
  })
})

describe('parsePhoneMicMessage', () => {
  it('accepts the handshake messages', () => {
    expect(parsePhoneMicMessage({ kind: 'hello', phoneId: 'p1', name: 'Ayo’s phone' })).toEqual({ kind: 'hello', phoneId: 'p1', name: 'Ayo’s phone' })
    expect(parsePhoneMicMessage({ kind: 'offer', phoneId: 'p1', sdp: 'v=0' })).toEqual({ kind: 'offer', phoneId: 'p1', sdp: 'v=0' })
    expect(parsePhoneMicMessage({ kind: 'ice', from: 'phone', candidate: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 } })).toMatchObject({ kind: 'ice', from: 'phone' })
    expect(parsePhoneMicMessage({ kind: 'bye', from: 'desktop' })).toEqual({ kind: 'bye', from: 'desktop' })
  })
  it('throws away anything malformed', () => {
    expect(parsePhoneMicMessage(null)).toBeNull()
    expect(parsePhoneMicMessage('hello')).toBeNull()
    expect(parsePhoneMicMessage({ kind: 'hello', phoneId: 'p1' })).toBeNull()
    expect(parsePhoneMicMessage({ kind: 'ice', from: 'tv', candidate: { candidate: 'x' } })).toBeNull()
    expect(parsePhoneMicMessage({ kind: 'offer', phoneId: 'p1', sdp: 'x'.repeat(30000) })).toBeNull()
    expect(parsePhoneMicMessage({ kind: 'nuke' })).toBeNull()
  })
})
