import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CorrectionLedger, wilsonLowerBound, phoneticKey } from './correctionLedger'

let dir: string
let now: number

function makeLedger() {
  return new CorrectionLedger(dir, () => now)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'))
  now = 1_700_000_000_000
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('wilsonLowerBound', () => {
  it('punishes small samples: 20/20 stays below the 95% gate', () => {
    expect(wilsonLowerBound(20, 20)).toBeLessThan(0.95)
  })
  it('rewards large samples: 198/200 clears the gate', () => {
    expect(wilsonLowerBound(198, 200)).toBeGreaterThan(0.95)
  })
  it('is 0 for empty samples', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0)
  })
})

describe('phoneticKey', () => {
  it('folds ASR mishearings into prefix-compatible keys', () => {
    // "rome and" carries glued filler → its key extends the clean form's key
    expect(phoneticKey('rome and').startsWith(phoneticKey('romans'))).toBe(true)
    expect(phoneticKey('philippians')).toBe(phoneticKey('phillippians'))
  })
})

describe('CorrectionLedger', () => {
  it('learns aliases from corrections and resolves them', () => {
    const ledger = makeLedger()
    ledger.recordCorrection('p1', 'rome and', 'Romans', 'voice')
    expect(ledger.resolveAlias('p1', 'romans')).toBe('Romans')
    expect(ledger.resolveAlias('p1', 'rome and')).toBe('Romans')
    expect(ledger.resolveAlias('p1', 'galatians')).toBeNull()
  })

  it('persists across instances', () => {
    makeLedger().recordCorrection('p1', 'a beck a click', 'Habakkuk', 'operator')
    const fresh = makeLedger()
    expect(fresh.resolveAlias('p1', 'a beck a click')).toBe('Habakkuk')
  })

  it('auto-mode requires volume, services, AND precision', () => {
    const ledger = makeLedger()
    // 5 services × 24 detections, all confirmed = 120 samples, perfect record
    for (let s = 0; s < 5; s++) {
      for (let d = 0; d < 24; d++) ledger.recordDetection('p1', true)
      ledger.endService('p1')
      now += 86_400_000
    }
    const stats = ledger.stats('p1')
    expect(stats.samples).toBe(120)
    expect(stats.services).toBe(5)
    expect(stats.autoModeEligible).toBe(true)

    // Same volume but sloppier: ~90% precision must NOT unlock auto mode
    const ledger2 = makeLedger()
    for (let s = 0; s < 5; s++) {
      for (let d = 0; d < 24; d++) ledger2.recordDetection('p2', d % 10 !== 0)
      ledger2.endService('p2')
      now += 86_400_000
    }
    expect(ledger2.stats('p2').autoModeEligible).toBe(false)
  })

  it('thermostat: matures after 3 quiet services, reopens on a bad one', () => {
    const ledger = makeLedger()
    for (let s = 0; s < 3; s++) {
      ledger.recordDetection('p1', true)
      ledger.recordCorrection('p1', 'x', 'Y', 'operator') // 1 correction < 2
      ledger.endService('p1')
      now += 86_400_000
    }
    expect(ledger.stats('p1').mature).toBe(true)
    // A rough service (4+ corrections) reopens training
    ledger.recordDetection('p1', false)
    for (let i = 0; i < 4; i++) ledger.recordCorrection('p1', `m${i}`, 'Z', 'voice')
    expect(ledger.stats('p1').mature).toBe(false)
  })

  it('review resolution feeds the trust meter', () => {
    const ledger = makeLedger()
    const a = ledger.addReviewItem({
      ts: now,
      kind: 'detection',
      heard: 'john three sixteen',
      proposed: { book: 'John', chapter: 3, verse: 16 }
    })
    const b = ledger.addReviewItem({
      ts: now,
      kind: 'detection',
      heard: 'romans eight one',
      proposed: { book: 'Romans', chapter: 8, verse: 1 }
    })
    expect(ledger.getReviewItems()).toHaveLength(2)
    ledger.resolveReviewItem('p1', a.id, 'confirmed')
    ledger.resolveReviewItem('p1', b.id, 'amended', { book: 'Romans', chapter: 8, verse: 11 })
    expect(ledger.getReviewItems()).toHaveLength(0)
    const stats = ledger.stats('p1')
    expect(stats.samples).toBe(2)
    expect(stats.precision).toBe(0.5)
    // the amended pair became an alias sample
    expect(ledger.resolveAlias('p1', 'romans eight one')).toBe('Romans 8:11')
  })
})
