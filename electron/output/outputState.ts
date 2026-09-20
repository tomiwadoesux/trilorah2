/**
 * What each output window is, and what the screen is doing right now.
 *
 * Roles (BUILD-MAP 2.11): the three windows main.ts already opens are
 * given a job instead of just a title —
 *   projector  full-screen verse over the theme background (the congregation)
 *   stream     transparent lower-third for OBS / vMix window capture
 *   stage      confidence monitor: verse, clock, what's queued next
 *
 * Screen state (EasyWorship's cut / clear / brand):
 *   live   whatever the engine last pushed
 *   clear  no verse, theme background only
 *   black  opaque black — "kill the screen"
 *   logo   church logo on black
 *
 * Pure module; main.ts owns the instance and fans changes out over IPC.
 */

export type OutputRole = 'projector' | 'stream' | 'stage' | 'timer'
export type ScreenState = 'live' | 'clear' | 'black' | 'logo'

export const OUTPUT_IDS = ['main', 'alternate', 'third', 'fourth', 'fifth', 'timer'] as const
export type OutputId = (typeof OUTPUT_IDS)[number]

export const DEFAULT_ROLES: Record<string, OutputRole> = {
  main: 'projector',
  alternate: 'stream',
  third: 'stage',
  fourth: 'projector',
  fifth: 'projector',
  timer: 'timer'
}

export const ROLE_TITLES: Record<OutputRole, string> = {
  projector: 'Main Display Output',
  stream: 'Livestream Output',
  stage: 'Stage Confidence Monitor',
  timer: 'Stage Timer Display'
}

export function isOutputRole(v: unknown): v is OutputRole {
  return v === 'projector' || v === 'stream' || v === 'stage' || v === 'timer'
}

export function isScreenState(v: unknown): v is ScreenState {
  return v === 'live' || v === 'clear' || v === 'black' || v === 'logo'
}

/** Resolve an output id to its role, honouring per-church overrides. */
export function roleFor(id: string, overrides: Partial<Record<string, unknown>> = {}): OutputRole {
  const o = overrides[id]
  if (isOutputRole(o)) return o
  return (DEFAULT_ROLES as Record<string, OutputRole>)[id] ?? 'projector'
}

export class ScreenStateMachine {
  private state: ScreenState = 'live'

  constructor(private readonly onChange: (state: ScreenState) => void) {}

  get(): ScreenState {
    return this.state
  }

  set(next: ScreenState): boolean {
    if (!isScreenState(next) || next === this.state) return false
    this.state = next
    this.onChange(next)
    return true
  }

  /** Toggle helpers for one-button remotes: pressing BLACK again restores. */
  toggle(target: Exclude<ScreenState, 'live'>): ScreenState {
    this.set(this.state === target ? 'live' : target)
    return this.state
  }

  /**
   * A verse being pushed lifts a CLEAR, but never a BLACK or LOGO — those
   * are deliberate operator holds (a baptism, a video on another source),
   * and auto mode must not undo them.
   */
  onContentPushed(): void {
    if (this.state === 'clear') this.set('live')
  }
}
