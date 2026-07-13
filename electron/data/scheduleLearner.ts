import { app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ScheduleEntry } from '../../shared/types'

const DEFAULT_LOOKBACK = 8
const MIN_SERVICES_FOR_SUGGESTION = 3

interface LoggedSegment {
  type: string
  duration: number
}

interface ServiceSummary {
  segments: LoggedSegment[]
}

export interface SuggestedSegment {
  type: string
  avgDurationMinutes: number
  occurrenceCount: number
}

export interface ScheduleSuggestion {
  segments: SuggestedSegment[]
  basedOnServices: number
  confidence: number
  modalMatch: boolean
}

function loadServiceSummaries(): ServiceSummary[] {
  let dir: string
  try {
    dir = path.join(app.getPath('userData'), 'service-logs')
  } catch {
    return []
  }
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({
    name: f,
    mtime: fs.statSync(path.join(dir, f)).mtimeMs
  })).sort((a, b) => a.mtime - b.mtime)
  const out: ServiceSummary[] = []
  for (const { name } of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, name), 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.segments)) out.push(parsed)
    } catch {
    }
  }
  return out
}

function modalSequence(summaries: ServiceSummary[]) {
  const counts = new Map<string, number>()
  for (const s of summaries) {
    if (s.segments.length === 0) continue
    const key = s.segments.map((seg) => seg.type).join('|')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  let bestKey = ''
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key
      bestCount = count
    }
  }
  return { sequence: bestKey.split('|'), matchingCount: bestCount }
}

function averageDurations(summaries: ServiceSummary[], sequence: string[]) {
  const stats = new Map<string, { sum: number; count: number }>()
  for (const s of summaries) {
    if (s.segments.map((seg) => seg.type).join('|') !== sequence.join('|'))
      continue
    for (const seg of s.segments) {
      const e = stats.get(seg.type) ?? { sum: 0, count: 0 }
      e.sum += seg.duration
      e.count += 1
      stats.set(seg.type, e)
    }
  }
  return stats
}

function fallbackOrdering(summaries: ServiceSummary[]) {
  const positions = new Map<string, number[]>()
  const durations = new Map<string, number[]>()
  for (const s of summaries) {
    s.segments.forEach((seg, idx) => {
      if (!positions.has(seg.type)) positions.set(seg.type, [])
      if (!durations.has(seg.type)) durations.set(seg.type, [])
      positions.get(seg.type)!.push(idx)
      durations.get(seg.type)!.push(seg.duration)
    })
  }
  const entries = [...positions.entries()].map(([type, idxs]) => {
    const sortedIdxs = [...idxs].sort((a, b) => a - b)
    const median = sortedIdxs[Math.floor(sortedIdxs.length / 2)]
    const ds = durations.get(type) ?? []
    const avg = ds.length > 0 ? ds.reduce((a, b) => a + b, 0) / ds.length : 0
    return {
      type,
      median,
      occurrenceCount: idxs.length,
      avgDurationMinutes: Math.round(avg * 10) / 10
    }
  })
  const threshold = Math.max(1, Math.floor(summaries.length / 2))
  const kept = entries.filter((e) => e.occurrenceCount >= threshold)
  kept.sort((a, b) => a.median - b.median)
  return {
    segments: kept.map(({ type, occurrenceCount, avgDurationMinutes }) => ({
      type,
      occurrenceCount,
      avgDurationMinutes
    })),
    total: summaries.length
  }
}

export function suggestSchedule(lookback = DEFAULT_LOOKBACK): ScheduleSuggestion | null {
  const all = loadServiceSummaries()
  if (all.length < MIN_SERVICES_FOR_SUGGESTION) return null
  const recent = all.slice(-lookback)
  const modal = modalSequence(recent)
  if (modal && modal.matchingCount >= Math.ceil(recent.length / 2)) {
    const stats = averageDurations(recent, modal.sequence)
    const segments = modal.sequence.map((type) => {
      const e = stats.get(type) ?? { sum: 0, count: 0 }
      const avg = e.count > 0 ? e.sum / e.count : 0
      return {
        type,
        avgDurationMinutes: Math.round(avg * 10) / 10,
        occurrenceCount: e.count
      }
    })
    return {
      segments,
      basedOnServices: recent.length,
      confidence: modal.matchingCount / recent.length,
      modalMatch: true
    }
  }
  const fallback = fallbackOrdering(recent)
  if (fallback.segments.length === 0) return null
  return {
    segments: fallback.segments,
    basedOnServices: fallback.total,
    confidence: 0.4,
    // explicit "we're guessing" marker
    modalMatch: false
  }
}

export function suggestionToEntries(s: ScheduleSuggestion): ScheduleEntry[] {
  return s.segments.map((seg) => ({ type: seg.type }))
}
