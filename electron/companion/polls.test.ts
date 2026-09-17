import { describe, it, expect, beforeEach } from 'vitest'
import { PollEngine, adjustCandidates, type PollCandidate, type PollEngineEvent } from './polls'

let now: number
let events: PollEngineEvent[]

function engine() {
  return new PollEngine({ now: () => now, onEvent: (e) => events.push(e) })
}

const c = (verse: number, score: number): PollCandidate => ({ book: 'John', chapter: 3, verse, score })
const midBand = () => [c(16, 60), c(17, 30), c(18, 10)]

beforeEach(() => {
  now = 1_700_000_000_000
  events = []
})

describe('band gating', () => {
  it('opens when top is 40–75 and second > 15', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())
    expect(p).not.toBeNull()
    expect(p!.candidates.map((x) => x.verse)).toEqual([16, 17])
    expect(events[0]).toMatchObject({ type: 'poll', poll: { id: p!.id } })
  })
  it('does not open when top is confident', () => {
    expect(engine().maybeOpen([c(16, 80), c(17, 30)])).toBeNull()
  })
  it('does not open when top is too weak', () => {
    expect(engine().maybeOpen([c(16, 35), c(17, 30)])).toBeNull()
  })
  it('does not open without a real runner-up', () => {
    expect(engine().maybeOpen([c(16, 60), c(17, 15)])).toBeNull()
    expect(engine().maybeOpen([c(16, 60)])).toBeNull()
  })
  it('sorts candidates and keeps a third only when it clears minSecond', () => {
    const p = engine().maybeOpen([c(18, 20), c(16, 60), c(17, 30)])!
    expect(p.candidates.map((x) => x.verse)).toEqual([16, 17, 18])
    expect(p.expiresAt - p.openedAt).toBe(45_000)
  })
})

describe('cooldown', () => {
  it('refuses a second poll while one is open and within cooldown', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    expect(e.maybeOpen(midBand())).toBeNull()
    e.close(p.id, 0, 'operator')
    now += 60_000
    expect(e.maybeOpen(midBand())).toBeNull()
    now += 120_000
    expect(e.maybeOpen(midBand())).not.toBeNull()
  })
  it('never runs two polls at once even past cooldown', () => {
    const e = engine()
    e.maybeOpen(midBand(), { ttlMs: 10 * 60_000, cooldownMs: 0 })
    expect(e.maybeOpen(midBand(), { cooldownMs: 0 })).toBeNull()
  })
})

describe('voting', () => {
  it('accepts one vote per viewer', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    expect(e.vote(p.id, 'v1', 0, 1)).toBe(true)
    expect(e.vote(p.id, 'v1', 1, 1)).toBe(false)
    expect(e.tally(p.id)).toMatchObject({ votes: [1, 0], participation: 1 })
  })
  it('rejects bad indexes, bad weights and unknown polls', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    expect(e.vote(p.id, 'v1', 2, 1)).toBe(false)
    expect(e.vote(p.id, 'v1', -1, 1)).toBe(false)
    expect(e.vote(p.id, 'v1', 0, 0)).toBe(false)
    expect(e.vote('nope', 'v1', 0, 1)).toBe(false)
  })
  it('applies weight: remote votes count half', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    e.vote(p.id, 'venue', 0, 1)
    e.vote(p.id, 'remote-a', 1, 0.5)
    e.vote(p.id, 'remote-b', 1, 0.5)
    const t = e.tally(p.id)!
    expect(t.weights).toEqual([1, 1])
    expect(t.votes).toEqual([1, 2])
    expect(t.totalWeight).toBe(2)
    expect(t.participation).toBe(3)
  })
  it('ignores votes on expired polls', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    now += 46_000
    expect(e.vote(p.id, 'v1', 0, 1)).toBe(false)
    expect(e.results()[0]).toMatchObject({ pollId: p.id, resolvedBy: 'expired', chosenIndex: null })
  })
})

describe('adjustedCandidates', () => {
  it('shifts by vote share, bounded to ±maxShiftPts, and can reorder', () => {
    const e = engine()
    const p = e.maybeOpen([c(16, 50), c(17, 45)])!
    for (let i = 0; i < 10; i++) e.vote(p.id, `v${i}`, 1, 1)
    const adj = e.adjustedCandidates(p.id, 15)!
    expect(adj[0]).toMatchObject({ verse: 17, score: 60, shift: 15, originalIndex: 1 })
    expect(adj[1]).toMatchObject({ verse: 16, score: 35, shift: -15, originalIndex: 0 })
  })
  it('a split vote shifts less than the bound', () => {
    const e = engine()
    const p = e.maybeOpen([c(16, 50), c(17, 45)])!
    e.vote(p.id, 'a', 0, 1)
    e.vote(p.id, 'b', 1, 1)
    e.vote(p.id, 'c', 1, 1)
    const adj = e.adjustedCandidates(p.id, 15)!
    for (const a of adj) expect(Math.abs(a.shift)).toBeLessThan(15)
    expect(adj.reduce((s, a) => s + a.shift, 0)).toBeCloseTo(0)
  })
  it('leaves scores untouched with no votes', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    const adj = e.adjustedCandidates(p.id)!
    expect(adj.map((a) => a.score)).toEqual([60, 30])
    expect(adj.every((a) => a.shift === 0)).toBe(true)
  })
  it('cannot invent a candidate', () => {
    const cands = [c(16, 50), c(17, 45), c(18, 20)]
    const adj = adjustCandidates(cands, { weights: [0, 0, 100], votes: [0, 0, 100], totalWeight: 100, participation: 100 }, 15)
    expect(adj).toHaveLength(3)
    expect(new Set(adj.map((a) => a.originalIndex))).toEqual(new Set([0, 1, 2]))
    // a candidate far behind stays behind even with unanimous support
    expect(adj[0].verse).toBe(16)
    expect(adj.find((a) => a.verse === 18)!.score).toBe(35)
  })
  it('caps the bound at the caller-provided max', () => {
    const adj = adjustCandidates([c(16, 50), c(17, 45)], { weights: [0, 5], votes: [0, 5], totalWeight: 5, participation: 5 }, 3)
    // 45 + 3 = 48 beats 50 - 3 = 47: a small bound still allows a close reorder
    expect(adj[0]).toMatchObject({ verse: 17, score: 48, shift: 3 })
    expect(adj[1]).toMatchObject({ verse: 16, score: 47, shift: -3 })
  })
})

describe('close', () => {
  it('returns the aggregate, emits poll-closed and discards individual votes', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    e.vote(p.id, 'v1', 0, 1)
    e.vote(p.id, 'v2', 1, 0.5)
    now += 5_000
    const r = e.close(p.id, 0, 'operator')!
    expect(r).toMatchObject({
      pollId: p.id,
      chosenIndex: 0,
      resolvedBy: 'operator',
      participation: 2,
      openedAt: p.openedAt,
      closedAt: now,
      tally: { weights: [1, 0.5], participation: 2 },
    })
    expect(events.at(-1)).toEqual({ type: 'poll-closed', pollId: p.id, chosenIndex: 0 })
    expect(e.get(p.id)).toBeNull()
    expect(e.vote(p.id, 'v3', 0, 1)).toBe(false)
    expect(e.tally(p.id)).toMatchObject({ participation: 2 })
    expect(e.results()).toHaveLength(1)
    expect(JSON.stringify(r)).not.toContain('v1')
  })
  it('null chosen index for auto with no winner; out-of-range becomes null', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    expect(e.close(p.id, 7, 'auto')!.chosenIndex).toBeNull()
  })
  it('expireStale closes past-TTL polls with resolvedBy expired', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    expect(e.expireStale()).toEqual([])
    now += 45_000
    const out = e.expireStale()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ pollId: p.id, resolvedBy: 'expired' })
    expect(e.current()).toBeNull()
  })
  it('reset clears results and cooldown', () => {
    const e = engine()
    const p = e.maybeOpen(midBand())!
    e.close(p.id, 0, 'operator')
    e.reset()
    expect(e.results()).toEqual([])
    expect(e.maybeOpen(midBand())).not.toBeNull()
  })
})
