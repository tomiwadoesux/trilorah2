/**
 * Correction ledger — per-preacher learning without ML infrastructure.
 *
 * Every correction (operator review or the preacher's own "I said verse
 * thirty-four") becomes a training pair. From these the ledger builds:
 *
 *  - a phonetic ALIAS TABLE ("rome and" → Romans) applied before detection
 *  - a TRUST METER: Wilson lower bound on detection precision. Auto mode
 *    unlocks at the configured gate (default ≥90% lower bound, ≥100
 *    samples, ≥5 services — a lucky 20/20 does not unlock it). All gates
 *    are tunable via LedgerThresholds / the app settings.
 *  - a training THERMOSTAT: fewer than `matureMaxCorrections` per service
 *    for `matureStreak` services → "mature" (stop prompting); an accuracy
 *    dip quietly reopens training.
 *
 * Pure logic + injected storage dir so it unit-tests without Electron.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { PreacherStats, ReviewItem } from '../../shared/types'

export interface CorrectionSample {
  heard: string
  correctedTo: string
  source: 'operator' | 'voice' | 'system'
  ts: number
}

export interface ServiceRecord {
  date: string
  detections: number
  confirmed: number
  corrections: number
  /** Set when the service is closed out (endService). */
  endedAt?: number
}

export interface LedgerData {
  preacherId: string
  name: string
  samples: CorrectionSample[]
  services: ServiceRecord[]
  aliases: Record<string, string>
  mature: boolean
  reopenedAt?: number
  /** ISO timestamp of the moment `mature` flipped true; cleared on reopen. */
  matureSince?: string
  /** Operator switch — only honoured while the trust gate says eligible. */
  autoModeEnabled: boolean
}

/** What the ledger reports; the two extra fields belong in shared PreacherStats. */
export interface LedgerStats extends PreacherStats {
  autoModeEnabled: boolean
  /** Services closed out since training completed (0 while not mature). */
  servicesSinceMature: number
}

export interface LedgerCallbacks {
  /** Auto mode was switched off because the preacher lost eligibility. */
  onAutoModeDisabled?: (preacherId: string) => void
}

/** All gates are tunable — churches differ. These are the defaults. */
export interface LedgerThresholds {
  /** Wilson lower bound on precision required for auto mode. */
  autoModeMinTrust: number
  autoModeMinSamples: number
  autoModeMinServices: number
  /** Corrections/service below this, for `matureStreak` services → mature. */
  matureMaxCorrections: number
  matureStreak: number
  /** Corrections in one service at/above this reopen training. */
  reopenCorrections: number
}

export const DEFAULT_THRESHOLDS: LedgerThresholds = {
  autoModeMinTrust: 0.9,
  autoModeMinSamples: 100,
  autoModeMinServices: 5,
  matureMaxCorrections: 2,
  matureStreak: 3,
  reopenCorrections: 4
}

/** Wilson score interval lower bound (z = 1.96, 95%). */
export function wilsonLowerBound(successes: number, n: number): number {
  if (n === 0) return 0
  const z = 1.96
  const p = successes / n
  const denom = 1 + (z * z) / n
  const centre = p + (z * z) / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)
  return Math.max(0, (centre - margin) / denom)
}

/** Fold a heard string to a loose phonetic key so near-misses still match:
 *  lowercase, strip non-letters, collapse doubles, drop trailing s,
 *  then drop interior vowels ("rome and" → "rmnd"). */
export function phoneticKey(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/s$/, '')
  if (cleaned.length <= 2) return cleaned
  return cleaned[0] + cleaned.slice(1).replace(/[aeiou]/g, '')
}

export class CorrectionLedger {
  private dir: string
  private cache = new Map<string, LedgerData>()
  private currentService = new Map<string, ServiceRecord>()
  private reviewItems: ReviewItem[] = []
  private nextReviewId = 1
  private now: () => number
  private t: LedgerThresholds
  private cb: LedgerCallbacks

  constructor(
    storageDir: string,
    now: () => number = Date.now,
    thresholds: Partial<LedgerThresholds> = {},
    callbacks: LedgerCallbacks = {}
  ) {
    this.dir = storageDir
    this.now = now
    this.t = { ...DEFAULT_THRESHOLDS, ...thresholds }
    this.cb = callbacks
  }

  /** Live-update the gates (e.g. when settings change). */
  setThresholds(thresholds: Partial<LedgerThresholds>): void {
    this.t = { ...this.t, ...thresholds }
  }

  /* ---------------- persistence ---------------- */

  private filePath(preacherId: string): string {
    const safe = preacherId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(this.dir, `${safe}.json`)
  }

  load(preacherId: string, name = ''): LedgerData {
    const cached = this.cache.get(preacherId)
    if (cached) return cached
    let data: LedgerData
    try {
      data = JSON.parse(fs.readFileSync(this.filePath(preacherId), 'utf-8'))
    } catch {
      data = {
        preacherId,
        name,
        samples: [],
        services: [],
        aliases: {},
        mature: false,
        autoModeEnabled: false
      }
    }
    // Files written before the switch existed
    if (typeof data.autoModeEnabled !== 'boolean') data.autoModeEnabled = false
    if (name && !data.name) data.name = name
    this.cache.set(preacherId, data)
    return data
  }

  save(preacherId: string): void {
    const data = this.cache.get(preacherId)
    if (!data) return
    fs.mkdirSync(this.dir, { recursive: true })
    fs.writeFileSync(this.filePath(preacherId), JSON.stringify(data, null, 2))
  }

  /* ---------------- alias learning & lookup ---------------- */

  /** Record a correction; the (heard → corrected) pair joins the alias table. */
  recordCorrection(
    preacherId: string,
    heard: string,
    correctedTo: string,
    source: CorrectionSample['source']
  ): void {
    const data = this.load(preacherId)
    data.samples.push({ heard, correctedTo, source, ts: this.now() })
    const key = phoneticKey(heard)
    if (key.length >= 2) {
      data.aliases[key] = correctedTo
    }
    const svc = this.serviceRecord(preacherId)
    svc.corrections += 1
    // A dip in accuracy quietly reopens training.
    if (data.mature && svc.corrections >= this.t.reopenCorrections) {
      data.mature = false
      data.reopenedAt = this.now()
      delete data.matureSince
      console.log(`🎓 Training reopened for ${data.name || preacherId} (accuracy dip)`)
    }
    this.save(preacherId)
  }

  /** Resolve a possibly-misheard book name via the learned alias table.
   *  Prefix-tolerant: ASR often glues filler onto the mishearing
   *  ("rome and" → key "rmnd") while the clean form folds shorter
   *  ("romans" → "rmn"), so either direction may extend the other. */
  resolveAlias(preacherId: string, heard: string): string | null {
    const data = this.load(preacherId)
    const key = phoneticKey(heard)
    if (key.length < 2) return null
    const exact = data.aliases[key]
    if (exact) return exact
    for (const [stored, canonical] of Object.entries(data.aliases)) {
      const shorter = Math.min(stored.length, key.length)
      if (shorter >= 3 && (stored.startsWith(key) || key.startsWith(stored))) {
        return canonical
      }
    }
    return null
  }

  /* ---------------- trust & auto mode ---------------- */

  recordDetection(preacherId: string, confirmed: boolean): void {
    const svc = this.serviceRecord(preacherId)
    svc.detections += 1
    if (confirmed) svc.confirmed += 1
  }

  /** Close out the running service; feeds the thermostat. */
  endService(preacherId: string): void {
    const data = this.load(preacherId)
    const svc = this.currentService.get(preacherId)
    if (svc && svc.detections > 0) {
      svc.endedAt = this.now()
      data.services.push(svc)
      this.currentService.delete(preacherId)
    }
    const recent = data.services.slice(-this.t.matureStreak)
    if (
      !data.mature &&
      recent.length === this.t.matureStreak &&
      recent.every((s) => s.corrections < this.t.matureMaxCorrections)
    ) {
      data.mature = true
      data.matureSince = new Date(this.now()).toISOString()
      console.log(`🎓 Profile mature: ${data.name || preacherId} — training prompts off`)
    }
    // The switch never outlives eligibility.
    if (data.autoModeEnabled && !this.stats(preacherId).autoModeEligible) {
      data.autoModeEnabled = false
      console.log(`🔒 Auto mode off for ${data.name || preacherId} — trust dropped below the gate`)
      this.cb.onAutoModeDisabled?.(preacherId)
    }
    this.save(preacherId)
  }

  /** Operator switch. Refuses (returns false) to turn on while not eligible. */
  setAutoModeEnabled(preacherId: string, on: boolean): boolean {
    const data = this.load(preacherId)
    if (on && !this.stats(preacherId).autoModeEligible) {
      console.log(`🔒 Auto mode refused for ${data.name || preacherId} — not yet eligible`)
      return false
    }
    data.autoModeEnabled = on
    this.save(preacherId)
    console.log(`${on ? '🤖' : '🙋'} Auto mode ${on ? 'ON' : 'OFF'} for ${data.name || preacherId}`)
    return true
  }

  isAutoModeEnabled(preacherId: string): boolean {
    return this.load(preacherId).autoModeEnabled
  }

  stats(preacherId: string): LedgerStats {
    const data = this.load(preacherId)
    const current = this.currentService.get(preacherId)
    const all = [...data.services, ...(current ? [current] : [])]
    const matureAt = data.mature && data.matureSince ? Date.parse(data.matureSince) : null
    const servicesSinceMature =
      matureAt === null
        ? 0
        : data.services.filter((s) => (s.endedAt ?? 0) > matureAt).length +
          (current && current.detections > 0 ? 1 : 0)
    const detections = all.reduce((n, s) => n + s.detections, 0)
    const confirmed = all.reduce((n, s) => n + s.confirmed, 0)
    const trustLowerBound = wilsonLowerBound(confirmed, detections)
    const services = all.length
    const lastService = all[all.length - 1]
    return {
      id: preacherId,
      name: data.name,
      samples: detections,
      services,
      precision: detections > 0 ? confirmed / detections : 0,
      trustLowerBound,
      autoModeEligible:
        trustLowerBound >= this.t.autoModeMinTrust &&
        detections >= this.t.autoModeMinSamples &&
        services >= this.t.autoModeMinServices,
      mature: data.mature,
      correctionsLastService: lastService?.corrections ?? 0,
      autoModeEnabled: data.autoModeEnabled,
      servicesSinceMature
    }
  }

  listPreacherIds(): string[] {
    try {
      return fs
        .readdirSync(this.dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''))
    } catch {
      return []
    }
  }

  /* ---------------- end-of-service review ---------------- */

  addReviewItem(item: Omit<ReviewItem, 'id'>): ReviewItem {
    const full: ReviewItem = { ...item, id: String(this.nextReviewId++) }
    this.reviewItems.push(full)
    return full
  }

  getReviewItems(): ReviewItem[] {
    return this.reviewItems.filter((r) => !r.resolution)
  }

  resolveReviewItem(
    preacherId: string | null,
    id: string,
    resolution: NonNullable<ReviewItem['resolution']>,
    amendedTo?: ReviewItem['amendedTo']
  ): void {
    const item = this.reviewItems.find((r) => r.id === id)
    if (!item) return
    item.resolution = resolution
    if (amendedTo) item.amendedTo = amendedTo
    if (!preacherId) return
    if (resolution === 'confirmed') {
      this.recordDetection(preacherId, true)
    } else if (resolution === 'rejected') {
      this.recordDetection(preacherId, false)
    } else if (resolution === 'amended' && amendedTo) {
      this.recordDetection(preacherId, false)
      this.recordCorrection(
        preacherId,
        item.heard,
        `${amendedTo.book} ${amendedTo.chapter}:${amendedTo.verse ?? 1}`,
        'operator'
      )
    }
  }

  clearReview(): void {
    this.reviewItems = []
  }

  private serviceRecord(preacherId: string): ServiceRecord {
    let svc = this.currentService.get(preacherId)
    if (!svc) {
      svc = {
        date: new Date(this.now()).toISOString().slice(0, 10),
        detections: 0,
        confirmed: 0,
        corrections: 0
      }
      this.currentService.set(preacherId, svc)
    }
    return svc
  }
}
