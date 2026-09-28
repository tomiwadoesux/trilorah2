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
import { randomUUID } from 'node:crypto'
import { bookIdMap } from '../data/books'
import type { PreacherStats, ReviewItem } from '../../shared/types'

export interface CorrectionSample {
  heard: string
  correctedTo: string
  source: 'operator' | 'voice' | 'system'
  ts: number
}

export interface ServiceRecord {
  id?: string
  verificationVersion?: number
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
  reviews?: ReviewItem[]
  activeService?: ServiceRecord
  verificationVersion?: number
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
    data.reviews ??= []
    // Old totals included silent auto-confirmations. Preserve the history,
    // but only explicitly verified v2 services can unlock automatic display.
    if (data.verificationVersion !== 2 && data.services.some((s) => s.verificationVersion !== 2)) {
      data.mature = false
      data.autoModeEnabled = false
      delete data.matureSince
    }
    data.verificationVersion = 2
    if (data.activeService) this.currentService.set(preacherId, data.activeService)
    if (name && !data.name) data.name = name
    this.cache.set(preacherId, data)
    return data
  }

  save(preacherId: string): void {
    const data = this.cache.get(preacherId)
    if (!data) return
    fs.mkdirSync(this.dir, { recursive: true })
    const file = this.filePath(preacherId)
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2))
    fs.renameSync(`${file}.tmp`, file)
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
    if (data.samples.length > 500) data.samples.splice(0, data.samples.length - 500)
    const key = phoneticKey(heard)
    if (key.length >= 2 && Object.hasOwn(bookIdMap, correctedTo)) {
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
    if (exact && Object.hasOwn(bookIdMap, exact)) return exact
    for (const [stored, canonical] of Object.entries(data.aliases)) {
      if (!Object.hasOwn(bookIdMap, canonical)) continue
      const shorter = Math.min(stored.length, key.length)
      if (shorter >= 3 && (stored.startsWith(key) || key.startsWith(stored))) {
        return canonical
      }
    }
    return null
  }

  /* ---------------- trust & auto mode ---------------- */

  /** Human-confirmed whole-utterance fixes preserve every number. No fuzzy
   * phonetic key: a correction to verse eight must never capture verse eighteen. */
  correctedUtterance(preacherId: string, heard: string): string | null {
    const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
    const key = normalise(heard)
    if (key.split(' ').length < 3) return null
    const sample = [...this.load(preacherId).samples].reverse().find((s) => s.source === 'operator' && normalise(s.heard) === key)
    return sample?.correctedTo ?? null
  }

  recordDetection(preacherId: string, confirmed: boolean): void {
    const svc = this.serviceRecord(preacherId)
    svc.detections += 1
    if (confirmed) svc.confirmed += 1
    this.save(preacherId)
  }

  /** Close out the running service; feeds the thermostat. */
  endService(preacherId: string): void {
    const data = this.load(preacherId)
    const svc = this.currentService.get(preacherId)
    if (svc) {
      svc.endedAt = this.now()
      data.services.push(svc)
      this.currentService.delete(preacherId)
      delete data.activeService
    }
    const recent = data.services.filter((s) => s.verificationVersion === 2 && s.detections > 0).slice(-this.t.matureStreak)
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
    const all = [...data.services, ...(current ? [current] : [])].filter((s) => s.verificationVersion === 2 && s.detections > 0)
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
    const data = item.preacherId ? this.load(item.preacherId) : null
    const target = data ? data.reviews! : this.reviewItems
    const service = item.preacherId ? this.serviceRecord(item.preacherId) : null
    // Repeated previews in the same service make one example, not a pile.
    const duplicate = target.find((r) => !r.resolution && r.serviceId === service?.id &&
      r.kind === item.kind && r.heard === item.heard && JSON.stringify(r.proposed) === JSON.stringify(item.proposed))
    if (duplicate) return duplicate
    const full: ReviewItem = { ...item, heard: item.heard.slice(0, 1200), serviceId: service?.id, id: randomUUID() }
    target.push(full)
    // Bounded disk/memory use. Discarded examples never become successes.
    if (target.length > 200) target.splice(0, target.length - 200)
    if (item.preacherId) this.save(item.preacherId)
    return full
  }

  getReviewItems(preacherId?: string): ReviewItem[] {
    const ids = preacherId ? [preacherId] : [...new Set([...this.listPreacherIds(), ...this.cache.keys()])]
    return [...(preacherId ? [] : this.reviewItems), ...ids.flatMap((id) => this.load(id).reviews ?? [])]
      .filter((r) => !r.resolution).sort((a, b) => b.ts - a.ts)
  }

  resolveReviewItem(
    preacherId: string | null,
    id: string,
    resolution: NonNullable<ReviewItem['resolution']>,
    amendedTo?: ReviewItem['amendedTo']
  ): boolean {
    const item = this.getReviewItems().find((r) => r.id === id)
    if (!item || (item.preacherId && preacherId && item.preacherId !== preacherId)) return false
    if (resolution === 'amended' && !amendedTo) return false
    if (resolution === 'confirmed' && !item.proposed) return false
    const pid = item.preacherId || preacherId
    item.resolution = resolution
    if (amendedTo) item.amendedTo = amendedTo
    if (!pid) return true
    const data = this.load(pid)
    const service = data.services.find((s) => s.id && s.id === item.serviceId) ?? this.serviceRecord(pid)
    if (resolution !== 'skipped') {
      // A missed reference is a recall failure, not a detected-verse sample.
      if (item.kind !== 'miss') {
        service.detections++
        if (resolution === 'confirmed') service.confirmed++
      }
      if (resolution === 'rejected' || resolution === 'amended') service.corrections++
      if (resolution === 'amended' && amendedTo) {
        data.samples.push({ heard: item.heard, correctedTo: `${amendedTo.book} ${amendedTo.chapter}:${amendedTo.verse ?? 1}`, source: 'operator', ts: this.now() })
        if (data.samples.length > 500) data.samples.splice(0, data.samples.length - 500)
      }
    }
    // Recompute on late reviews too; no new service is created for an old item.
    const recent = [...data.services, ...(data.activeService ? [data.activeService] : [])]
      .filter((s) => s.verificationVersion === 2 && s.detections > 0).slice(-this.t.matureStreak)
    const mature = recent.length === this.t.matureStreak && recent.every((s) => s.corrections < this.t.matureMaxCorrections)
    if (mature && !data.mature) data.matureSince = new Date(this.now()).toISOString()
    data.mature = mature
    if (!mature) delete data.matureSince
    if (data.autoModeEnabled && !this.stats(pid).autoModeEligible) {
      data.autoModeEnabled = false
      this.cb.onAutoModeDisabled?.(pid)
    }
    this.save(pid)
    return true
  }

  clearReview(): void {
    // Compatibility for older callers: unresolved persisted reviews survive.
    this.reviewItems = []
  }

  markOperatorChange(preacherId: string, id: string): void {
    const item = this.getReviewItems(preacherId).find((r) => r.id === id)
    if (!item) return
    item.reason = 'operator-change'
    this.save(preacherId)
  }

  history(preacherId: string) {
    let total = 0, confirmed = 0
    return this.load(preacherId).services.filter((s) => s.verificationVersion === 2 && s.detections > 0).map((s) => {
      total += s.detections
      confirmed += s.confirmed
      return { label: s.date, trust: wilsonLowerBound(confirmed, total), precision: confirmed / total }
    })
  }

  legacySamples(preacherId: string): number {
    return this.load(preacherId).services.filter((s) => s.verificationVersion !== 2).reduce((n, s) => n + s.detections, 0)
  }

  hasOpenService(preacherId: string): boolean { return !!this.load(preacherId).activeService }

  remove(preacherId: string): void {
    this.cache.delete(preacherId)
    this.currentService.delete(preacherId)
    fs.rmSync(this.filePath(preacherId), { force: true })
  }

  private serviceRecord(preacherId: string): ServiceRecord {
    const data = this.load(preacherId)
    let svc = this.currentService.get(preacherId)
    if (!svc) {
      svc = {
        id: randomUUID(),
        verificationVersion: 2,
        date: new Date(this.now()).toISOString().slice(0, 10),
        detections: 0,
        confirmed: 0,
        corrections: 0
      }
      this.currentService.set(preacherId, svc)
      data.activeService = svc
    }
    return svc
  }
}
