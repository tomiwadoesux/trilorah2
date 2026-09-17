import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CommandLog } from './commandLog'
import { loadPreacherCommandConfig } from '../engine/commandConfig'

let dir: string
let now: number

function makeLog() {
  return new CommandLog(dir, () => now, { userDataDir: dir })
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdlog-test-'))
  now = 1_700_000_000_000
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('CommandLog — recording + undo', () => {
  it('records entries with ids and persists them', () => {
    const log = makeLog()
    const e = log.record('p1', { kind: 'navigate-next', utterance: 'next verse', ts: now })
    expect(e.id).toBeTruthy()
    expect(fs.existsSync(path.join(dir, 'command-log', 'p1.json'))).toBe(true)
    const fresh = makeLog()
    expect(fresh.recent('p1')).toHaveLength(1)
    expect(fresh.recent('p1')[0].kind).toBe('navigate-next')
  })

  it('recent() is newest-first and respects limit', () => {
    const log = makeLog()
    for (let i = 0; i < 5; i++) {
      log.record('p1', { kind: 'display-dismiss', utterance: `u${i}`, ts: now + i })
    }
    const r = log.recent('p1', 2)
    expect(r.map((e) => e.utterance)).toEqual(['u4', 'u3'])
  })

  it('caps at 500 entries per preacher', () => {
    const log = makeLog()
    for (let i = 0; i < 520; i++) {
      log.record('p1', { kind: 'display-hold', utterance: `u${i}`, ts: now + i })
    }
    expect(log.recent('p1', 1000)).toHaveLength(500)
    expect(log.recent('p1', 1)[0].utterance).toBe('u519')
  })

  it('wasRecentlyFired + markUndone → falsePositives', () => {
    const log = makeLog()
    const e = log.record('p1', { kind: 'display-dismiss', utterance: 'take that down', ts: now })
    now += 5000
    const hit = log.wasRecentlyFired('display-dismiss', 10_000)
    expect(hit?.id).toBe(e.id)
    expect(log.wasRecentlyFired('display-hold', 10_000)).toBeNull()
    expect(log.markUndone(e.id)?.undone).toBe(true)
    expect(log.falsePositives('p1').map((x) => x.id)).toEqual([e.id])
    // undone entries no longer count as recently fired
    expect(log.wasRecentlyFired('display-dismiss', 10_000)).toBeNull()
    now += 10_000
    log.record('p1', { kind: 'display-dismiss', utterance: 'take it down', ts: now })
    now += 11_000
    expect(log.wasRecentlyFired('display-dismiss', 10_000)).toBeNull()
  })

  it('markUndone returns null for unknown ids', () => {
    expect(makeLog().markUndone('nope')).toBeNull()
  })
})

describe('CommandLog — suppress / teach', () => {
  it('suppress() makes isSuppressed() true for the phrase, persisted', () => {
    const log = makeLog()
    log.suppress('p1', 'Take that down!')
    expect(log.isSuppressed('p1', 'you can take that down now')).toBe(true)
    expect(log.isSuppressed('p1', 'next verse')).toBe(false)
    expect(log.isSuppressed('p2', 'take that down')).toBe(false)
    expect(makeLog().suppressed('p1')).toEqual(['take that down'])
    log.unsuppress('p1', 'take that down')
    expect(log.isSuppressed('p1', 'take that down')).toBe(false)
  })

  it('teach() appends the phrase to the preacher command file', () => {
    const log = makeLog()
    expect(log.teach('p1', 'Roll it forward', 'navigate-next')).toBe('roll it forward')
    expect(loadPreacherCommandConfig(dir, 'p1').navNext).toEqual(['roll it forward'])
    expect(log.teach('p1', 'in the king james', 'version-switch')).toBeNull()
  })

  it('teach() lifts a prior suppression of the same utterance', () => {
    const log = makeLog()
    log.suppress('p1', 'drop it')
    log.teach('p1', 'drop it', 'display-dismiss')
    expect(log.isSuppressed('p1', 'drop it')).toBe(false)
  })
})
