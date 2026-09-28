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
    // Learn the exact reviewed utterance, never a fuzzy number substitution.
    expect(ledger.correctedUtterance('p1', 'romans eight one')).toBe('Romans 8:11')
    expect(ledger.correctedUtterance('p1', 'romans eight eighteen')).toBeNull()
    expect(ledger.resolveAlias('p1', 'romans eight one')).toBeNull()
  })
})

describe('verified review lifecycle', () => {
  const candidate = (ledger: CorrectionLedger, preacherId = 'p1') => ledger.addReviewItem({
    preacherId, ts: now, kind: 'detection', heard: 'first john four eight',
    proposed: { book: 'John', chapter: 4, verse: 8 },
  })

  it('keeps unanswered examples across service end and restart without giving trust', () => {
    const ledger = makeLedger()
    const item = candidate(ledger)
    ledger.endService('p1')
    ledger.clearReview()
    const fresh = makeLedger()
    expect(fresh.getReviewItems('p1').map((r) => r.id)).toEqual([item.id])
    expect(fresh.stats('p1')).toMatchObject({ samples: 0, services: 0, autoModeEligible: false })
  })

  it('attributes a late answer to its original service and preacher, once', () => {
    const ledger = makeLedger()
    const a = candidate(ledger)
    ledger.endService('p1')
    now += 86_400_000
    const b = candidate(ledger)
    candidate(ledger, 'p2')
    expect(ledger.resolveReviewItem('p2', a.id, 'confirmed')).toBe(false)
    expect(ledger.resolveReviewItem(null, a.id, 'confirmed')).toBe(true)
    expect(ledger.resolveReviewItem(null, a.id, 'confirmed')).toBe(false)
    expect(ledger.stats('p1')).toMatchObject({ samples: 1, services: 1 })
    expect(ledger.stats('p2').samples).toBe(0)
    ledger.resolveReviewItem(null, b.id, 'rejected')
    expect(ledger.stats('p1')).toMatchObject({ samples: 2, services: 2, precision: 0.5 })
    expect(makeLedger().stats('p1').samples).toBe(2)
  })

  it('a changed passage is only a candidate, and skipping contributes no score', () => {
    const ledger = makeLedger()
    const a = candidate(ledger)
    ledger.markOperatorChange('p1', a.id)
    expect(ledger.getReviewItems('p1')[0].reason).toBe('operator-change')
    expect(ledger.stats('p1').samples).toBe(0)
    ledger.resolveReviewItem(null, a.id, 'skipped')
    expect(ledger.stats('p1').samples).toBe(0)
    expect(ledger.getReviewItems('p1')).toHaveLength(0)
  })

  it('keeps a missed-reference correction without miscounting it as a detected verse', () => {
    const ledger = makeLedger()
    const item = ledger.addReviewItem({ preacherId: 'p1', ts: now, kind: 'miss', heard: 'rome and eight one', proposed: null })
    expect(ledger.resolveReviewItem(null, item.id, 'confirmed')).toBe(false)
    ledger.resolveReviewItem(null, item.id, 'amended', { book: 'Romans', chapter: 8, verse: 1 })
    expect(ledger.stats('p1').samples).toBe(0)
    expect(ledger.correctedUtterance('p1', 'rome and eight one')).toBe('Romans 8:1')
    expect(ledger.correctedUtterance('p2', 'rome and eight one')).toBeNull()
  })

  it('preserves legacy totals but excludes silent confirmations from eligibility', () => {
    fs.writeFileSync(path.join(dir, 'old.json'), JSON.stringify({ preacherId: 'old', name: 'Old', samples: [], aliases: {}, mature: true, autoModeEnabled: true,
      services: Array.from({ length: 5 }, () => ({ date: '2025-01-01', detections: 100, confirmed: 100, corrections: 0 })) }))
    const ledger = makeLedger()
    expect(ledger.stats('old')).toMatchObject({ samples: 0, autoModeEligible: false, autoModeEnabled: false, mature: false })
    expect(ledger.legacySamples('old')).toBe(500)
    expect(ledger.load('old').services).toHaveLength(5)
  })

  it('deduplicates repeats, bounds review storage and deletes the whole ledger', () => {
    const ledger = makeLedger()
    expect(candidate(ledger).id).toBe(candidate(ledger).id)
    for (let i = 0; i < 210; i++) ledger.addReviewItem({ preacherId: 'p1', kind: 'miss', heard: `missed passage ${i}`, proposed: null, ts: now++ })
    expect(ledger.getReviewItems('p1')).toHaveLength(200)
    expect(ledger.stats('p1').samples).toBe(0)
    ledger.remove('p1')
    expect(makeLedger().getReviewItems('p1')).toHaveLength(0)
  })
})

/* ---------------- auto-mode switch & maturity stats ---------------- */

/** 5 services × 24 confirmed detections → eligible. */
function trainToEligible(ledger: CorrectionLedger, pid: string) {
  for (let s = 0; s < 5; s++) {
    for (let d = 0; d < 24; d++) ledger.recordDetection(pid, true)
    ledger.endService(pid)
    now += 86_400_000
  }
}

describe('auto-mode switch', () => {
  it('refuses to turn on while not eligible', () => {
    const ledger = makeLedger()
    expect(ledger.setAutoModeEnabled('p1', true)).toBe(false)
    expect(ledger.isAutoModeEnabled('p1')).toBe(false)
    expect(ledger.stats('p1').autoModeEnabled).toBe(false)
  })

  it('turns on once eligible and persists', () => {
    const ledger = makeLedger()
    trainToEligible(ledger, 'p1')
    expect(ledger.setAutoModeEnabled('p1', true)).toBe(true)
    expect(ledger.isAutoModeEnabled('p1')).toBe(true)
    expect(makeLedger().stats('p1').autoModeEnabled).toBe(true)
    // off always works
    expect(ledger.setAutoModeEnabled('p1', false)).toBe(true)
    expect(ledger.isAutoModeEnabled('p1')).toBe(false)
  })

  it('switches itself off (with callback) when eligibility is lost at endService', () => {
    const disabled: string[] = []
    const ledger = new CorrectionLedger(dir, () => now, {}, { onAutoModeDisabled: (p) => disabled.push(p) })
    trainToEligible(ledger, 'p1')
    ledger.setAutoModeEnabled('p1', true)
    // a disastrous service: 30 rejected detections → precision 120/150 = 0.8
    for (let d = 0; d < 30; d++) ledger.recordDetection('p1', false)
    expect(ledger.stats('p1').autoModeEnabled).toBe(true) // not yet — only at endService
    ledger.endService('p1')
    expect(ledger.stats('p1').autoModeEligible).toBe(false)
    expect(ledger.isAutoModeEnabled('p1')).toBe(false)
    expect(disabled).toEqual(['p1'])
  })
})

describe('servicesSinceMature', () => {
  it('is 0 before maturity, counts closed services after, resets on reopen', () => {
    const ledger = makeLedger()
    expect(ledger.stats('p1').servicesSinceMature).toBe(0)
    for (let s = 0; s < 3; s++) {
      ledger.recordDetection('p1', true)
      ledger.endService('p1')
      now += 86_400_000
    }
    expect(ledger.stats('p1').mature).toBe(true)
    expect(ledger.stats('p1').servicesSinceMature).toBe(0)
    // two more clean services
    for (let s = 0; s < 2; s++) {
      ledger.recordDetection('p1', true)
      ledger.endService('p1')
      now += 3_600_000 // same-day evening service still counts
    }
    expect(ledger.stats('p1').servicesSinceMature).toBe(2)
    // an in-progress service with detections counts too
    ledger.recordDetection('p1', true)
    expect(ledger.stats('p1').servicesSinceMature).toBe(3)
    // reopen → back to 0
    for (let i = 0; i < 4; i++) ledger.recordCorrection('p1', `m${i}`, 'Z', 'voice')
    expect(ledger.stats('p1').mature).toBe(false)
    expect(ledger.stats('p1').servicesSinceMature).toBe(0)
  })

  it('loads legacy files without the switch field', () => {
    fs.writeFileSync(
      path.join(dir, 'old.json'),
      JSON.stringify({ preacherId: 'old', name: 'Old', samples: [], services: [], aliases: {}, mature: false })
    )
    const ledger = makeLedger()
    expect(ledger.isAutoModeEnabled('old')).toBe(false)
    expect(ledger.stats('old').servicesSinceMature).toBe(0)
  })
})
