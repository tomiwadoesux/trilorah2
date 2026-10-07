import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyCloudError } from './cloudErrors'

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'tri-queue-'))
vi.mock('electron', () => ({ app: { getPath: () => userData } }))

const op = (table: string, n: number) => ({ table, op: 'insert' as const, payload: { n } })

describe('classifyCloudError', () => {
  it('treats a duplicate as already written', () => {
    expect(classifyCloudError({ code: '23505', status: 409 })).toBe('done')
  })
  it('drops writes the database will always refuse', () => {
    expect(classifyCloudError({ code: '42703', status: 400 })).toBe('drop') // undefined column
    expect(classifyCloudError({ code: '23503', status: 409 })).toBe('drop') // foreign key
    expect(classifyCloudError({ code: '42501', status: 403 })).toBe('drop') // row-level security
    expect(classifyCloudError({ code: 'PGRST204', status: 400 })).toBe('drop') // unknown column
    expect(classifyCloudError({ code: 'PGRST205', status: 404 })).toBe('drop') // unknown table
  })
  it('retries what clears on its own', () => {
    expect(classifyCloudError({ message: 'TypeError: fetch failed', code: '' })).toBe('retry')
    expect(classifyCloudError({ code: 'PGRST301', status: 401 })).toBe('retry') // expired session
    expect(classifyCloudError({ code: '', status: 429 })).toBe('retry')
    expect(classifyCloudError({ code: '', status: 503 })).toBe('retry')
    expect(classifyCloudError(new Error('Supabase client unavailable'))).toBe('retry')
    expect(classifyCloudError(undefined)).toBe('retry')
  })
})

describe('flush', () => {
  beforeEach(() => {
    vi.resetModules()
    fs.rmSync(path.join(userData, 'cloud-queue.json'), { force: true })
  })

  it('does not let one refused write block everything behind it', async () => {
    const q = await import('./offlineQueue')
    q.enqueue(op('transcript_chunks', 1))
    q.enqueue(op('transcript_chunks', 2))
    q.enqueue(op('transcript_chunks', 3))
    const applied: number[] = []
    const result = await q.flush(async (o) => {
      if (o.payload.n === 1) throw Object.assign(new Error('column "words" does not exist'), { code: '42703', status: 400 })
      applied.push(o.payload.n)
    })
    expect(applied).toEqual([2, 3])
    expect(result).toMatchObject({ flushed: 2, dropped: 1, remaining: 0 })
    expect(q.queueHealth().lastError).toContain('words')
  })

  it('keeps order and stops at a network failure', async () => {
    const q = await import('./offlineQueue')
    q.enqueue(op('transcript_chunks', 1))
    q.enqueue(op('transcript_chunks', 2))
    const result = await q.flush(async () => {
      throw Object.assign(new Error('TypeError: fetch failed'), { code: '' })
    })
    expect(result).toMatchObject({ flushed: 0, remaining: 2 })
    expect(q.size()).toBe(2)
  })

  it('moves past a write that already landed', async () => {
    const q = await import('./offlineQueue')
    q.enqueue(op('detected_verses', 1))
    q.enqueue(op('detected_verses', 2))
    const result = await q.flush(async (o) => {
      if (o.payload.n === 1) throw Object.assign(new Error('duplicate key'), { code: '23505', status: 409 })
    })
    expect(result).toMatchObject({ flushed: 2, remaining: 0 })
    expect(q.queueHealth()).toMatchObject({ pending: 0, lastError: null })
  })

  it('survives a restart with the poison op already persisted at the head', async () => {
    fs.writeFileSync(
      path.join(userData, 'cloud-queue.json'),
      JSON.stringify([
        { id: 'old', enqueuedAt: 0, attempts: 412, op: op('transcript_chunks', 0) },
        { id: 'new', enqueuedAt: 1, attempts: 0, op: op('transcript_chunks', 1) },
      ]),
    )
    const q = await import('./offlineQueue')
    const applied: number[] = []
    await q.flush(async (o) => {
      if (o.payload.n === 0) throw Object.assign(new Error('violates foreign key'), { code: '23503', status: 409 })
      applied.push(o.payload.n)
    })
    expect(applied).toEqual([1])
    expect(q.size()).toBe(0)
  })
})
