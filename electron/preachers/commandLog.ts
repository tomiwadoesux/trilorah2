/**
 * Command event log — every voice command the engine fired, per preacher,
 * with the operator's verdict layered on top:
 *
 *   markUndone(id)   the operator reversed the effect within seconds →
 *                    the entry is a false positive (a phrase that fired
 *                    on ordinary preaching)
 *   suppress(...)    "never treat this utterance as a command" — the engine
 *                    consults isSuppressed() before matching
 *   teach(...)       "this WAS a command" (a phrase the engine missed) →
 *                    appended to the preacher's command file
 *
 * Pure module: takes a storage dir + clock, no Electron. Persists to
 * <storageDir>/command-log/<safeId>.json, capped at 500 entries.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { VoiceCommandEvent, VoiceCommandKind } from '../../shared/types'
import { addPreacherPhrase, type PhraseListKey } from '../engine/commandConfig'

export interface CommandLogEntry {
  id: string
  preacherId: string
  kind: VoiceCommandKind
  utterance: string
  ts: number
  value?: string | number
  /** Set when the operator reversed the command's effect. */
  undone?: boolean
  undoneAt?: number
}

export interface CommandLogData {
  preacherId: string
  entries: CommandLogEntry[]
  /** Normalised utterances the engine must never treat as a command. */
  neverTreatAsCommand: string[]
}

export interface CommandLogOptions {
  /** Where preacher-commands/<id>.json lives — needed by teach(). */
  userDataDir?: string
  maxEntries?: number
}

const MAX_ENTRIES = 500

/** Which phrase list a taught utterance lands in, per command kind. */
const KIND_TO_KEY: Partial<Record<VoiceCommandKind, PhraseListKey>> = {
  'navigate-next': 'navNext',
  'navigate-previous': 'navPrevious',
  'display-dismiss': 'dismiss',
  'display-hold': 'hold',
  'prayer-start': 'prayerStart',
  'prayer-end': 'prayerEnd',
  'correction-verse': 'iSaidTriggers',
  'correction-chapter': 'iSaidTriggers'
}

/** Case/punctuation-insensitive form used for suppression matching. */
export function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

export class CommandLog {
  private dir: string
  private now: () => number
  private userDataDir?: string
  private maxEntries: number
  private cache = new Map<string, CommandLogData>()
  private seq = 0

  constructor(storageDir: string, now: () => number = Date.now, opts: CommandLogOptions = {}) {
    this.dir = path.join(storageDir, 'command-log')
    this.now = now
    this.userDataDir = opts.userDataDir
    this.maxEntries = opts.maxEntries ?? MAX_ENTRIES
  }

  /* ---------------- persistence ---------------- */

  private filePath(preacherId: string): string {
    const safe = preacherId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(this.dir, `${safe}.json`)
  }

  private load(preacherId: string): CommandLogData {
    const cached = this.cache.get(preacherId)
    if (cached) return cached
    let data: CommandLogData
    try {
      data = JSON.parse(fs.readFileSync(this.filePath(preacherId), 'utf-8'))
      data.entries ??= []
      data.neverTreatAsCommand ??= []
    } catch {
      data = { preacherId, entries: [], neverTreatAsCommand: [] }
    }
    this.cache.set(preacherId, data)
    return data
  }

  private save(preacherId: string): void {
    const data = this.load(preacherId)
    try {
      fs.mkdirSync(this.dir, { recursive: true })
      fs.writeFileSync(this.filePath(preacherId), JSON.stringify(data, null, 2))
    } catch (e) {
      console.error('❌ command log save failed:', e)
    }
  }

  /* ---------------- recording ---------------- */

  record(
    preacherId: string,
    event: Pick<VoiceCommandEvent, 'kind' | 'utterance' | 'ts' | 'value'>
  ): CommandLogEntry {
    const data = this.load(preacherId)
    const entry: CommandLogEntry = {
      id: `${event.ts}-${++this.seq}`,
      preacherId,
      kind: event.kind,
      utterance: event.utterance,
      ts: event.ts
    }
    if (event.value !== undefined) entry.value = event.value
    data.entries.push(entry)
    if (data.entries.length > this.maxEntries) {
      data.entries.splice(0, data.entries.length - this.maxEntries)
    }
    this.save(preacherId)
    return entry
  }

  /** The operator reversed the effect — flag the entry as a false positive. */
  markUndone(entryId: string): CommandLogEntry | null {
    for (const [preacherId, data] of this.cache) {
      const entry = data.entries.find((e) => e.id === entryId)
      if (entry) {
        entry.undone = true
        entry.undoneAt = this.now()
        this.save(preacherId)
        console.log(`↩️ Command undone: ${entry.kind} "${entry.utterance}"`)
        return entry
      }
    }
    return null
  }

  /**
   * The most recent entry of `kind` fired within `withinMs` (any preacher
   * unless one is given) — main.ts uses this to pair an operator's manual
   * reversal with the command that caused it.
   */
  wasRecentlyFired(kind: VoiceCommandKind, withinMs: number, preacherId?: string): CommandLogEntry | null {
    const now = this.now()
    const sources = preacherId ? [this.load(preacherId)] : [...this.cache.values()]
    let best: CommandLogEntry | null = null
    for (const data of sources) {
      for (let i = data.entries.length - 1; i >= 0; i--) {
        const e = data.entries[i]
        if (now - e.ts > withinMs) break
        if (e.kind === kind && !e.undone && (!best || e.ts > best.ts)) {
          best = e
          break
        }
      }
    }
    return best
  }

  /* ---------------- queries ---------------- */

  recent(preacherId: string, limit = 50): CommandLogEntry[] {
    const entries = this.load(preacherId).entries
    return entries.slice(Math.max(0, entries.length - limit)).reverse()
  }

  /** Entries the operator undone — the phrases that fire wrongly. */
  falsePositives(preacherId: string): CommandLogEntry[] {
    return this.load(preacherId).entries.filter((e) => e.undone)
  }

  /* ---------------- verdicts ---------------- */

  suppress(preacherId: string, utterance: string): void {
    const data = this.load(preacherId)
    const n = normalizeUtterance(utterance)
    if (!n || data.neverTreatAsCommand.includes(n)) return
    data.neverTreatAsCommand.push(n)
    this.save(preacherId)
    console.log(`🚫 Preacher ${preacherId}: never a command → "${n}"`)
  }

  unsuppress(preacherId: string, utterance: string): void {
    const data = this.load(preacherId)
    const n = normalizeUtterance(utterance)
    const next = data.neverTreatAsCommand.filter((x) => x !== n)
    if (next.length === data.neverTreatAsCommand.length) return
    data.neverTreatAsCommand = next
    this.save(preacherId)
  }

  suppressed(preacherId: string): string[] {
    return [...this.load(preacherId).neverTreatAsCommand]
  }

  /**
   * True when the utterance IS (or contains) a suppressed phrase — the
   * engine skips matching entirely for that chunk.
   */
  isSuppressed(preacherId: string, utterance: string): boolean {
    if (!preacherId) return false
    const list = this.load(preacherId).neverTreatAsCommand
    if (list.length === 0) return false
    const n = ' ' + normalizeUtterance(utterance) + ' '
    return list.some((s) => n.includes(' ' + s + ' '))
  }

  /**
   * "That WAS a command" — derive a phrase from the utterance, append it to
   * the preacher's command file (task-2 layer) and return it. Returns null
   * for kinds that are not phrase-driven (version-switch).
   */
  teach(preacherId: string, utterance: string, kind: VoiceCommandKind, phrase?: string): string | null {
    const key = KIND_TO_KEY[kind]
    if (!key) return null
    const p = normalizeUtterance(phrase ?? utterance)
    if (!p) return null
    if (!this.userDataDir) {
      console.error('❌ CommandLog.teach: no userDataDir — phrase not persisted')
      return p
    }
    this.unsuppress(preacherId, utterance)
    addPreacherPhrase(this.userDataDir, preacherId, key, p)
    return p
  }

  listPreacherIds(): string[] {
    try {
      return fs
        .readdirSync(this.dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5))
    } catch {
      return []
    }
  }
}
