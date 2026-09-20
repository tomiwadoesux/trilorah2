/*
 * The run of service as a PLAN — the pure half of the rail.
 *
 * Everything here is what the rail needs to know and no component should be
 * deciding: what a default or scanned run looks like as segments, how a
 * segment's planned time reads in eleven characters, which rows of a scan
 * the operator has to look at, and which song in the library a queued row
 * is talking about. Imports nothing but its two neighbours in shared/, like
 * everything in shared/, so it runs under vitest without a DOM.
 */

import { DEFAULT_RUN } from './serviceAliases'
import { formatClock, type ParsedRow } from './runOfServiceParse'

/** What the rail is handed to make a segment from. `id` is the type id. */
export interface PlannedSegment {
  id: string
  label: string
  /** Minutes from midnight, when the programme printed a time. */
  startMin?: number
  durationMin?: number
}

/** The default order of service, as the rail takes it. */
export function defaultSegments(): PlannedSegment[] {
  return DEFAULT_RUN.map((s) => ({ id: s.type, label: s.label, durationMin: s.durationMin }))
}

/**
 * A reviewed scan, as the rail takes it. A row nobody typed goes in as
 * 'custom' under the church's own words — the same rule `rowsToSchedule`
 * follows for the engine, so rail and engine never disagree about a row.
 * Rows whose title was deleted down to nothing are dropped: a segment with
 * no name is a blank card nobody can tell from a rendering fault.
 */
export function rowsToSegments(rows: readonly ParsedRow[]): PlannedSegment[] {
  return rows
    .filter((r) => r.title.trim() !== '')
    .map((r) => ({
      id: r.type ?? 'custom',
      label: r.title.trim().toLowerCase(),
      ...(r.time ? { startMin: r.time.start } : {}),
      ...(r.durationMin !== undefined ? { durationMin: r.durationMin } : {}),
    }))
}

/** "9:05 am · 40 min", "40 min", "9:05 am", or '' — for the muted line on a
    card. Lowercase and no leading zero because it sits under a lowercase
    title in a 200px rail. */
export function planLine(seg: { startMin?: number; durationMin?: number }): string {
  const parts: string[] = []
  if (seg.startMin !== undefined) parts.push(formatClock(seg.startMin).toLowerCase())
  if (seg.durationMin !== undefined && seg.durationMin > 0) parts.push(formatMinutes(seg.durationMin))
  return parts.join(' · ')
}

/** 40 -> "40 min", 90 -> "1h 30", 120 -> "2h". */
export function formatMinutes(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h}h` : `${h}h ${String(rest).padStart(2, '0')}`
}

/** Total planned minutes, counting only segments that state one. */
export function totalMinutes(segs: readonly { durationMin?: number }[]): number {
  return segs.reduce((sum, s) => sum + (s.durationMin ?? 0), 0)
}

/** Below this the matcher was guessing, and the row wears a "check". */
export const CHECK_BELOW = 0.9

/** What the review popup says about a row before the operator touches it. */
export function rowFlag(row: Pick<ParsedRow, 'type' | 'confidence'>): 'pick' | 'check' | null {
  if (row.type === null) return 'pick'
  return row.confidence < CHECK_BELOW ? 'check' : null
}

/* ------------------------------------------------------------------ */
/* Which song is this row?                                             */
/* ------------------------------------------------------------------ */

export interface SongRef {
  songId?: string
  title?: string
  /** The row's label — "Amazing Grace — Verse 1" from a drag, or a bare
      title from the segment's own + menu. */
  label: string
}

const fold = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * The library song a queued row means, or null.
 *
 * Id first — it is the only thing that survives a rename. Then the carried
 * title, then the label with its " — section" tail removed. Titles compare
 * folded (case, apostrophes, punctuation) because the same hymn is typed
 * three ways in one library. Never a substring match: "Holy" must not open
 * "Holy, Holy, Holy" for editing.
 */
export function findSongForItem<T extends { id: string; title: string }>(songs: readonly T[], ref: SongRef): T | null {
  if (ref.songId) {
    const byId = songs.find((s) => s.id === ref.songId)
    if (byId) return byId
  }
  const candidates = [ref.title, ref.label.split(/\s+[—–-]\s+/)[0], ref.label]
  for (const c of candidates) {
    if (!c) continue
    const want = fold(c)
    if (!want) continue
    const hit = songs.find((s) => fold(s.title) === want)
    if (hit) return hit
  }
  return null
}
