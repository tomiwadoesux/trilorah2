import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PairingStore } from './pairing'

let dir: string
let now: number
const make = () => new PairingStore(dir, () => now)

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pairing-test-'))
  now = 1_700_000_000_000
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('PairingStore', () => {
  it('generates a 6-digit code and redeems it once', () => {
    const store = make()
    const code = store.generateCode()
    expect(code).toMatch(/^\d{6}$/)
    const result = store.redeem(code, 'iPhone')
    expect(result).not.toBeNull()
    expect(result!.token).toMatch(/^[0-9a-f]{64}$/)
    expect(store.redeem(code, 'again')).toBeNull()
  })

  it('rejects wrong and expired codes', () => {
    const store = make()
    const code = store.generateCode(1000)
    expect(store.redeem('000000' === code ? '111111' : '000000', 'x')).toBeNull()
    now += 1001
    expect(store.redeem(code, 'x')).toBeNull()
    expect(store.currentCode()).toBeNull()
  })

  it('only keeps one active code', () => {
    const store = make()
    const first = store.generateCode()
    const second = store.generateCode()
    if (first !== second) expect(store.redeem(first, 'x')).toBeNull()
    expect(store.redeem(second, 'x')).not.toBeNull()
  })

  it('verifies tokens, persists to disk and revokes', () => {
    const store = make()
    const { token, deviceId } = store.redeem(store.generateCode(), 'Stream Deck')!
    expect(store.verify(token)?.deviceName).toBe('Stream Deck')
    expect(store.verify('nope')).toBeNull()
    expect(fs.existsSync(path.join(dir, 'remote-pairing.json'))).toBe(true)

    const reloaded = make()
    expect(reloaded.listDevices().map((d) => d.deviceId)).toEqual([deviceId])
    expect(reloaded.verify(token)).not.toBeNull()

    expect(reloaded.revoke(deviceId)).toBe(true)
    expect(reloaded.revoke(deviceId)).toBe(false)
    expect(reloaded.verify(token)).toBeNull()
    expect(make().listDevices()).toEqual([])
  })

  it('revokeAll clears devices and the active code', () => {
    const store = make()
    store.redeem(store.generateCode(), 'a')
    store.generateCode()
    store.revokeAll()
    expect(store.listDevices()).toEqual([])
    expect(store.currentCode()).toBeNull()
  })
})
