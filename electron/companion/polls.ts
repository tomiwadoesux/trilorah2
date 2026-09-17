/**
 * Congregation polls — when verse detection lands in the "unsure" band the
 * laptop asks the phones which reading they heard. Votes nudge candidate
 * scores by a bounded amount (they can reorder, never invent a candidate)
 * and the aggregate is written back to the preacher's profile on close.
 *
 * Privacy: individual votes live only while a poll is open; on close only
 * the per-candidate tally + participation count survive.
 *
 * Pure logic, injected clock, no Electron imports.
 */

export interface PollCandidate {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  score: number
}

export interface Poll {
  id: string
  candidates: PollCandidate[]
  openedAt: number
  expiresAt: number
  status: 'open' | 'closed'
}

export interface PollTally {
  /** weighted vote sum per candidate (same index as poll.candidates) */
  weights: number[]
  /** raw vote count per candidate */
  votes: number[]
  totalWeight: number
  /** unique viewers who voted */
  participation: number
}

export interface AdjustedCandidate extends PollCandidate {
  originalIndex: number
  shift: number
}

export type PollResolvedBy = 'operator' | 'auto' | 'expired'

export interface PollResult {
  pollId: string
  candidates: PollCandidate[]
  tally: PollTally
  participation: number
  chosenIndex: number | null
  resolvedBy: PollResolvedBy
  openedAt: number
  closedAt: number
}

export type PollEngineEvent =
  | { type: 'poll'; poll: Poll }
  | { type: 'poll-closed'; pollId: string; chosenIndex: number | null }

export interface MaybeOpenOptions {
  minTop?: number
  maxTop?: number
  minSecond?: number
  ttlMs?: number
  cooldownMs?: number
  /** how many candidates to put on the card (2–3) */
  maxCandidates?: number
}

export const DEFAULT_POLL_OPTIONS: Required<MaybeOpenOptions> = {
  minTop: 40,
  maxTop: 75,
  minSecond: 15,
  ttlMs: 45_000,
  cooldownMs: 180_000,
  maxCandidates: 3,
}

export const VOTE_WEIGHT_IN_VENUE = 1.0
export const VOTE_WEIGHT_REMOTE = 0.5

interface OpenPoll {
  poll: Poll
  votes: Map<string, { index: number; weight: number }>
}

export class PollEngine {
  private now: () => number
  private onEvent: (e: PollEngineEvent) => void
  private open = new Map<string, OpenPoll>()
  private closed: PollResult[] = []
  private lastOpenedAt = -Infinity
  private seq = 0

  constructor(opts: { now?: () => number; onEvent?: (e: PollEngineEvent) => void } = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.onEvent = opts.onEvent ?? (() => {})
  }

  /** The currently open poll, if any (at most one at a time). */
  current(): Poll | null {
    this.expireStale()
    for (const o of this.open.values()) return o.poll
    return null
  }

  get(pollId: string): Poll | null {
    return this.open.get(pollId)?.poll ?? null
  }

  /**
   * Open a poll if detection is in the middle band: top score within
   * [minTop, maxTop] and a runner-up above minSecond. Respects the global
   * cooldown and never opens a second poll while one is live.
   */
  maybeOpen(candidates: PollCandidate[], opts: MaybeOpenOptions = {}): Poll | null {
    const o = { ...DEFAULT_POLL_OPTIONS, ...opts }
    const now = this.now()
    this.expireStale()

    if (this.open.size > 0) return null
    if (now - this.lastOpenedAt < o.cooldownMs) return null

    const sorted = [...candidates]
      .filter((c) => Number.isFinite(c.score))
      .sort((a, b) => b.score - a.score)
    if (sorted.length < 2) return null
    const top = sorted[0].score
    const second = sorted[1].score
    if (top < o.minTop || top > o.maxTop) return null
    if (second <= o.minSecond) return null

    const picked = sorted
      .slice(0, Math.max(2, Math.min(3, o.maxCandidates)))
      .filter((c, i) => i < 2 || c.score > o.minSecond)
      .map((c) => ({ ...c }))

    const poll: Poll = {
      id: `poll-${now}-${++this.seq}`,
      candidates: picked,
      openedAt: now,
      expiresAt: now + o.ttlMs,
      status: 'open',
    }
    this.open.set(poll.id, { poll, votes: new Map() })
    this.lastOpenedAt = now
    this.onEvent({ type: 'poll', poll: { ...poll, candidates: picked.map((c) => ({ ...c })) } })
    return poll
  }

  /**
   * Record one vote. Returns false when the poll is closed/expired/unknown,
   * the index is out of range, the weight is not positive, or the viewer
   * already voted (first vote wins).
   */
  vote(pollId: string, viewerId: string, candidateIndex: number, weight = VOTE_WEIGHT_IN_VENUE): boolean {
    this.expireStale()
    const o = this.open.get(pollId)
    if (!o || o.poll.status !== 'open') return false
    if (!viewerId) return false
    if (!Number.isInteger(candidateIndex) || candidateIndex < 0 || candidateIndex >= o.poll.candidates.length) {
      return false
    }
    if (!Number.isFinite(weight) || weight <= 0) return false
    if (o.votes.has(viewerId)) return false
    o.votes.set(viewerId, { index: candidateIndex, weight })
    return true
  }

  /** Per-candidate weighted sums + participation; works on open and closed polls. */
  tally(pollId: string): PollTally | null {
    const o = this.open.get(pollId)
    if (o) return tallyVotes(o.poll.candidates.length, o.votes)
    const r = this.closed.find((x) => x.pollId === pollId)
    return r ? { ...r.tally, weights: [...r.tally.weights], votes: [...r.tally.votes] } : null
  }

  /**
   * Candidates with scores nudged by vote share. A candidate's shift is
   * `maxShiftPts * (share - 1/n) / (1 - 1/n)`, clamped to ±maxShiftPts,
   * so a unanimous vote adds exactly +maxShiftPts and no votes at all
   * leaves every score untouched. Re-sorted by adjusted score; the
   * original index is kept on each entry. Never adds or drops a candidate.
   */
  adjustedCandidates(pollId: string, maxShiftPts = 15): AdjustedCandidate[] | null {
    const poll = this.open.get(pollId)?.poll ?? this.closed.find((x) => x.pollId === pollId)
    const tally = this.tally(pollId)
    if (!poll || !tally) return null
    return adjustCandidates(poll.candidates, tally, maxShiftPts)
  }

  /**
   * Close a poll, keep only the aggregate, drop individual votes, and emit
   * `poll-closed`. Closing an already-closed poll returns the stored result.
   */
  close(pollId: string, chosenIndex: number | null, resolvedBy: PollResolvedBy): PollResult | null {
    const o = this.open.get(pollId)
    if (!o) return this.closed.find((x) => x.pollId === pollId) ?? null
    const tally = tallyVotes(o.poll.candidates.length, o.votes)
    const chosen =
      chosenIndex !== null && Number.isInteger(chosenIndex) && chosenIndex >= 0 && chosenIndex < o.poll.candidates.length
        ? chosenIndex
        : null
    const result: PollResult = {
      pollId,
      candidates: o.poll.candidates.map((c) => ({ ...c })),
      tally,
      participation: tally.participation,
      chosenIndex: chosen,
      resolvedBy,
      openedAt: o.poll.openedAt,
      closedAt: this.now(),
    }
    o.poll.status = 'closed'
    o.votes.clear()
    this.open.delete(pollId)
    this.closed.push(result)
    this.onEvent({ type: 'poll-closed', pollId, chosenIndex: chosen })
    return result
  }

  /** Close every open poll whose TTL has passed. Call from a timer. */
  expireStale(): PollResult[] {
    const now = this.now()
    const out: PollResult[] = []
    for (const [id, o] of [...this.open]) {
      if (now >= o.poll.expiresAt) {
        const r = this.close(id, null, 'expired')
        if (r) out.push(r)
      }
    }
    return out
  }

  /** Aggregates of every closed poll this service, for the recap. */
  results(): PollResult[] {
    return this.closed.map((r) => ({
      ...r,
      candidates: r.candidates.map((c) => ({ ...c })),
      tally: { ...r.tally, weights: [...r.tally.weights], votes: [...r.tally.votes] },
    }))
  }

  /** Forget everything (new service). */
  reset(): void {
    this.open.clear()
    this.closed = []
    this.lastOpenedAt = -Infinity
  }
}

function tallyVotes(n: number, votes: Map<string, { index: number; weight: number }>): PollTally {
  const weights = new Array<number>(n).fill(0)
  const counts = new Array<number>(n).fill(0)
  let total = 0
  for (const v of votes.values()) {
    weights[v.index] += v.weight
    counts[v.index] += 1
    total += v.weight
  }
  return { weights, votes: counts, totalWeight: total, participation: votes.size }
}

export function adjustCandidates(
  candidates: PollCandidate[],
  tally: PollTally,
  maxShiftPts = 15,
): AdjustedCandidate[] {
  const n = candidates.length
  const max = Math.max(0, maxShiftPts)
  const base = n > 0 ? 1 / n : 0
  const out = candidates.map((c, i) => {
    let shift = 0
    if (tally.totalWeight > 0 && n > 1) {
      const share = (tally.weights[i] ?? 0) / tally.totalWeight
      shift = (max * (share - base)) / (1 - base)
      shift = Math.max(-max, Math.min(max, shift))
    }
    return { ...c, score: c.score + shift, shift, originalIndex: i }
  })
  // stable: ties keep original order
  return out.sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
}
