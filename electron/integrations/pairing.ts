/**
 * Remote pairing — who is allowed to drive Trilorah over the local
 * WebSocket control server.
 *
 * Flow: the operator asks the app for a 6-digit code (shown on screen),
 * types it into a phone / Stream Deck / Companion within two minutes, and
 * the device receives a long-lived random token. Tokens persist in
 * <storageDir>/remote-pairing.json so a paired device survives restarts;
 * the operator can revoke any device (or all) from settings.
 *
 * Pure logic + injected storage dir / clock so it unit-tests without Electron.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface PairedDevice {
  deviceId: string
  deviceName: string
  token: string
  pairedAt: number
  lastSeenAt: number
}

/** What we hand back to the UI — never the token itself. */
export interface PairedDeviceInfo {
  deviceId: string
  deviceName: string
  pairedAt: number
  lastSeenAt: number
}

interface PairingFile {
  devices: PairedDevice[]
}

interface ActiveCode {
  code: string
  expiresAt: number
}

export const DEFAULT_CODE_TTL_MS = 120_000

export class PairingStore {
  private readonly file: string
  private devices: PairedDevice[] = []
  private activeCode: ActiveCode | null = null

  constructor(
    private readonly storageDir: string,
    private readonly now: () => number = () => Date.now()
  ) {
    this.file = path.join(storageDir, 'remote-pairing.json')
    this.load()
  }

  /** One active code at a time — a new one replaces the previous. */
  generateCode(ttlMs = DEFAULT_CODE_TTL_MS): string {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    this.activeCode = { code, expiresAt: this.now() + ttlMs }
    return code
  }

  /** The current code if still valid (for showing a countdown in the UI). */
  currentCode(): { code: string; expiresAt: number } | null {
    if (!this.activeCode) return null
    if (this.now() >= this.activeCode.expiresAt) {
      this.activeCode = null
      return null
    }
    return { ...this.activeCode }
  }

  clearCode(): void {
    this.activeCode = null
  }

  /** Exchange a live code for a device token. Single-use. */
  redeem(code: string, deviceName: string): { token: string; deviceId: string } | null {
    const active = this.currentCode()
    if (!active) return null
    if (!safeEqual(String(code ?? '').trim(), active.code)) return null
    this.activeCode = null
    const ts = this.now()
    const device: PairedDevice = {
      deviceId: crypto.randomUUID(),
      deviceName: (deviceName || 'Remote').toString().slice(0, 80),
      token: crypto.randomBytes(32).toString('hex'),
      pairedAt: ts,
      lastSeenAt: ts
    }
    this.devices.push(device)
    this.save()
    console.log(`📱 Remote paired: ${device.deviceName}`)
    return { token: device.token, deviceId: device.deviceId }
  }

  verify(token: string): PairedDeviceInfo | null {
    if (typeof token !== 'string' || token.length === 0) return null
    const device = this.devices.find((d) => safeEqual(d.token, token))
    if (!device) return null
    device.lastSeenAt = this.now()
    this.save()
    return toInfo(device)
  }

  listDevices(): PairedDeviceInfo[] {
    return this.devices.map(toInfo)
  }

  revoke(deviceId: string): boolean {
    const before = this.devices.length
    this.devices = this.devices.filter((d) => d.deviceId !== deviceId)
    if (this.devices.length === before) return false
    this.save()
    return true
  }

  revokeAll(): void {
    this.devices = []
    this.activeCode = null
    this.save()
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.file)) return
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as PairingFile
      this.devices = Array.isArray(parsed?.devices) ? parsed.devices.filter(isDevice) : []
    } catch (e) {
      console.warn('⚠️ Could not read remote-pairing.json — starting empty', e)
      this.devices = []
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(this.storageDir, { recursive: true })
      const data: PairingFile = { devices: this.devices }
      fs.writeFileSync(this.file, JSON.stringify(data, null, 2))
    } catch (e) {
      console.error('❌ Could not write remote-pairing.json', e)
    }
  }
}

function toInfo(d: PairedDevice): PairedDeviceInfo {
  return { deviceId: d.deviceId, deviceName: d.deviceName, pairedAt: d.pairedAt, lastSeenAt: d.lastSeenAt }
}

function isDevice(d: any): d is PairedDevice {
  return d && typeof d.deviceId === 'string' && typeof d.token === 'string'
}

/** Constant-time compare so tokens can't be sniffed char by char. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}
