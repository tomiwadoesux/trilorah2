import * as path from 'node:path'
import * as fs from 'node:fs'
import { app } from 'electron'

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
  lastError?: string
}

let queueFile = ''
let memQueue: QueuedOp[] = []
let loaded = false
let flushing = false

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
    memQueue = []
  }
  loaded = true
}

function persist(): void {
  if (!queueFile) return
  try {
    fs.writeFileSync(queueFile, JSON.stringify(memQueue), 'utf-8')
  } catch (e) {
    console.warn('offlineQueue persist failed:', e)
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
  try {
    while (memQueue.length > 0) {
      const head = memQueue[0]
      try {
        await apply(head.op)
        memQueue.shift()
        flushed++
        if (flushed % 25 === 0) persist()
      } catch (e: any) {
        head.attempts += 1
        persist()
        return {
          flushed,
          remaining: memQueue.length,
          lastError: e?.message ?? String(e)
        }
      }
    }
    persist()
    return { flushed, remaining: 0 }
  } finally {
    flushing = false
  }
}
