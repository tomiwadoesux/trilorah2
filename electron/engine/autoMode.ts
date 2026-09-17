/**
 * Auto mode controller — decides what happens to a detection.
 *
 * Auto mode is a per-preacher operator SWITCH that only works while the
 * ledger says the preacher is eligible (both are injected). Even then a
 * detection whose candidate list is a CLASH is held for the operator
 * instead of going live. Every auto-push emits a ping so the operator
 * hears that the screen changed without them.
 *
 * Pure: no Electron, no timers; the caller wires events to IPC.
 */

import { isClash, type Candidate } from './candidates'

export type AutoModeAction = 'auto-push' | 'hold-clash' | 'preview' | 'arm-grace'

export interface AutoModeDecision {
  action: AutoModeAction
  reason: string
  candidates: Candidate[]
}

export type AutoModeEvent =
  | { type: 'clash'; preacherId: string; candidates: Candidate[] }
  | { type: 'auto-push'; preacherId: string; ref: Candidate; ping: true }
  | { type: 'clash-resolved'; preacherId: string; chosen: Candidate }
  | { type: 'clash-dismissed'; preacherId: string }

export interface AutoModeDeps {
  isEligible: (preacherId: string) => boolean
  isEnabled: (preacherId: string) => boolean
  onEvent: (evt: AutoModeEvent) => void
  now?: () => number
}

export interface DecideOptions {
  /** Grace window on: hold as preview until the preacher starts reading. */
  graceWindow?: boolean
  clashMarginPts?: number
}

interface PendingClash {
  preacherId: string
  candidates: Candidate[]
  at: number
}

export class AutoModeController {
  private deps: AutoModeDeps
  private now: () => number
  private pending: PendingClash | null = null

  constructor(deps: AutoModeDeps) {
    this.deps = deps
    this.now = deps.now ?? Date.now
  }

  /** Switch on AND ledger eligible. */
  isActive(preacherId: string): boolean {
    return !!preacherId && this.deps.isEnabled(preacherId) && this.deps.isEligible(preacherId)
  }

  decide(preacherId: string, candidates: Candidate[], opts: DecideOptions = {}): AutoModeDecision {
    const list = [...candidates]
    if (list.length === 0) {
      return { action: 'preview', reason: 'no candidates', candidates: list }
    }
    if (!this.isActive(preacherId)) {
      const why = !this.deps.isEnabled(preacherId)
        ? 'auto mode off'
        : 'auto mode not yet eligible'
      return opts.graceWindow
        ? { action: 'arm-grace', reason: why, candidates: list }
        : { action: 'preview', reason: why, candidates: list }
    }
    if (isClash(list, opts.clashMarginPts)) {
      this.pending = { preacherId, candidates: list, at: this.now() }
      this.deps.onEvent({ type: 'clash', preacherId, candidates: list })
      console.log(`⚖️ Clash held: ${list[0].score} vs ${list[1].score}`)
      return { action: 'hold-clash', reason: 'top candidates too close', candidates: list }
    }
    // A new clear detection supersedes any stale clash.
    this.pending = null
    if (opts.graceWindow) {
      return { action: 'arm-grace', reason: 'grace window', candidates: list }
    }
    this.deps.onEvent({ type: 'auto-push', preacherId, ref: list[0], ping: true })
    return { action: 'auto-push', reason: 'clear winner', candidates: list }
  }

  /** Grace window fired: push only when active and nothing is being held. */
  shouldAutoPushOnReadingStarted(preacherId: string): boolean {
    return this.isActive(preacherId) && !this.pending
  }

  hasPendingClash(): boolean {
    return this.pending !== null
  }

  pendingClash(): PendingClash | null {
    return this.pending
  }

  /** Operator picked one of the held candidates. Returns it, or null if none pending. */
  resolveClash(chosenIndex: number): Candidate | null {
    const p = this.pending
    if (!p) return null
    const chosen = p.candidates[chosenIndex]
    if (!chosen) return null
    this.pending = null
    this.deps.onEvent({ type: 'clash-resolved', preacherId: p.preacherId, chosen })
    console.log(`✅ Clash resolved: ${chosen.book} ${chosen.chapter}:${chosen.verse}`)
    return chosen
  }

  /** Operator dismissed the clash without choosing. */
  dismissClash(): void {
    const p = this.pending
    if (!p) return
    this.pending = null
    this.deps.onEvent({ type: 'clash-dismissed', preacherId: p.preacherId })
  }
}
