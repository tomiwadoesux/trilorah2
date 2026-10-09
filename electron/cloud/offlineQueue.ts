import * as path from 'node:path'
import * as fs from 'node:fs'
import { app } from 'electron'
import { classifyCloudError } from './cloudErrors'
import { publishServiceNotice, notifyCloudHealth } from '../serviceNotices'

/** A single write destined for Supabase. */
export interface CloudOp {
  table: string
  op: 'insert' | 'update' | 'upsert'
  payload: any
}

interface QueuedOp {
  id: string
  enqueuedAt: number
  attempts: number
  op: CloudOp
}

export interface FlushResult {
  flushed: number
  remaining: number
  /** Writes the server refused outright and that were removed — see cloudErrors. */
  dropped?: number
  lastError?: string
}

/** The last failure, kept for the operator's status line. Cleared by a clean flush. */
let lastFailure: { message: string; at: number; kind: 'rejected' | 'retryable' } | null = null
let rejectedUpdates = 0

export function queueHealth(): { pending: number; lastError: string | null; lastErrorAt: number | null; lastErrorKind: 'rejected' | 'retryable' | null } {
  ensureLoaded()
  return { pending: memQueue.length, lastError: lastFailure?.message ?? null, lastErrorAt: lastFailure?.at ?? null, lastErrorKind: lastFailure?.kind ?? null }
}

let queueFile = ''
let memQueue: QueuedOp[] = []
let loaded = false
let flushing = false
let queueWriteFailed = false

function ensureLoaded(): void {
  if (loaded) return
  try {
    queueFile = path.join(app.getPath('userData'), 'cloud-queue.json')
    if (fs.existsSync(queueFile)) {
      const raw = fs.readFileSync(queueFile, 'utf-8')
      memQueue = JSON.parse(raw)
    }
  } catch (e) {
    console.warn('offlineQueue load failed:', e)
    publishServiceNotice({ id: 'cloud-queue-storage', title: 'Saved online updates could not be read', detail: 'The app could not restore queued online updates from disk. Check storage before closing the service.', severity: 'error', target: 'storage' })
    memQueue = []
  }
  loaded = true
}

function persist(): void {
  if (!queueFile) return
  try {
    fs.writeFileSync(queueFile, JSON.stringify(memQueue), 'utf-8')
    if (queueWriteFailed) publishServiceNotice({ id: 'cloud-queue-write', title: 'Online queue saved', detail: 'Pending online updates are saved on this computer.', severity: 'info', target: 'storage', status: 'resolved' })
    queueWriteFailed = false
  } catch (e) {
    console.warn('offlineQueue persist failed:', e)
    if (!queueWriteFailed) publishServiceNotice({ id: 'cloud-queue-write', title: 'Pending online updates could not be saved', detail: 'Updates are still in memory. Check available storage and keep the app open until publishing catches up.', severity: 'error', target: 'storage' })
    queueWriteFailed = true
  }
}

export function enqueue(op: CloudOp): void {
  ensureLoaded()
  memQueue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enqueuedAt: Date.now(),
    attempts: 0,
    op
  })
  persist()
}

export function size(): number {
  ensureLoaded()
  return memQueue.length
}

export async function flush(apply: (op: CloudOp) => Promise<void>): Promise<FlushResult> {
  ensureLoaded()
  if (flushing) return { flushed: 0, remaining: memQueue.length }
  flushing = true
  let flushed = 0
  let dropped = 0
  try {
    while (memQueue.length > 0) {
      const head = memQueue[0]
      try {
        await apply(head.op)
        memQueue.shift()
        flushed++
        if (flushed % 25 === 0) persist()
      } catch (e: any) {
        const message = e?.message ?? String(e)
        const verdict = classifyCloudError(e)
        if (verdict === 'done') {
          memQueue.shift()
          flushed++
          continue
        }
        if (verdict === 'drop') {
          // Never let one write the server will always refuse hold up every
          // write behind it — that is how a whole service failed to publish.
          console.warn(`☁️  Dropped a ${head.op.op} on ${head.op.table} the server refused (${e?.code || e?.status || 'error'}): ${message}`)
          lastFailure = { message: `${head.op.table}: ${message}`, at: Date.now(), kind: 'rejected' }
          rejectedUpdates++
          publishServiceNotice({ id: 'publishing-rejected', title: 'Some online updates were rejected', detail: `${rejectedUpdates} updates could not be published and are no longer queued for retry. Open Account & cloud to review the server error. Later successful uploads do not restore these updates.`, severity: 'error', target: 'cloud' })
          memQueue.shift()
          dropped++
          persist()
          continue
        }
        head.attempts += 1
        lastFailure = { message, at: Date.now(), kind: 'retryable' }
        persist()
        return { flushed, dropped, remaining: memQueue.length, lastError: message }
      }
    }
    if (dropped === 0) lastFailure = null
    persist()
    return { flushed, dropped, remaining: 0 }
  } finally {
    flushing = false
    notifyCloudHealth()
  }
}
