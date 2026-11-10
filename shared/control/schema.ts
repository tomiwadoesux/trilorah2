/**
 * The control contract: one typed command surface for every client.
 *
 * The console view, the CLI and (later) external connectors all speak these
 * commands and read these events — nothing else. The desktop app's own
 * windows keep their existing IPC; step 1 of the app-control plan
 * (docs/engineering/TRILORAH-APP-CONTROL-PLAN.md) routes new clients through
 * here first, and existing paths migrate behind it one at a time.
 *
 * Rules carried from the plan:
 * - A result says what actually happened, never that a handler merely ran.
 * - Every result carries a fresh snapshot, so clients need no second ask.
 * - Events carry an epoch (one runtime instance) and an ordered sequence,
 *   so a client can detect gaps and ask for a snapshot instead of guessing.
 */

export const CONTROL_PROTOCOL = '0.1.0'

/** The wall states an operator can ask for. */
export const SCREEN_STATES = ['live', 'clear', 'black', 'logo'] as const
export type ControlScreenState = (typeof SCREEN_STATES)[number]

export interface ControlVerse {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  version: string
  text: string
}

export type ControlCommand =
  | { kind: 'status' }
  | { kind: 'listen.start'; device?: string }
  | { kind: 'listen.stop' }
  | { kind: 'scripture.stage'; reference: string; version?: string }
  | { kind: 'live.take'; reference?: string; version?: string }
  | { kind: 'live.clear' }
  | { kind: 'live.next' }
  | { kind: 'live.previous' }
  | { kind: 'screen.set'; state: ControlScreenState }
  /** One-button remotes: pressing BLACK or LOGO again restores the screen. */
  | { kind: 'screen.toggle'; state: 'black' | 'logo' }
  /** Open the pop-up console window on the laptop (buttons, for people who don't type commands). */
  | { kind: 'console.open' }

export interface ControlSnapshot {
  epoch: number
  seq: number
  listening: boolean
  /** The engine's last status line ("Listening…", an error), if any. */
  asrStatus: string | null
  preview: ControlVerse | null
  live: ControlVerse | null
  screen: string
}

export type ControlResult =
  | { ok: true; op: string; snapshot: ControlSnapshot; staged?: ControlVerse; live?: ControlVerse }
  | { ok: false; op: string; error: string; snapshot: ControlSnapshot }

/** One thing that happened, in order. `channel` names what, `payload` carries it. */
export interface ControlEvent {
  epoch: number
  seq: number
  at: number
  channel: 'transcript' | 'preview' | 'live' | 'cleared' | 'asr' | 'screen'
  payload: unknown
}

const str = (v: unknown, max = 400): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/** A command off a wire is data from a stranger until it has been looked at. */
export function parseControlCommand(raw: unknown): ControlCommand | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  switch (m.kind) {
    case 'status':
    case 'listen.stop':
    case 'live.clear':
    case 'live.next':
    case 'live.previous':
    case 'console.open':
      return { kind: m.kind }
    case 'listen.start':
      return m.device === undefined || str(m.device, 200) ? { kind: 'listen.start', ...(str(m.device, 200) ? { device: m.device } : {}) } : null
    case 'scripture.stage':
      if (!str(m.reference)) return null
      return { kind: 'scripture.stage', reference: m.reference, ...(str(m.version, 40) ? { version: m.version } : {}) }
    case 'live.take':
      if (m.reference !== undefined && !str(m.reference)) return null
      return {
        kind: 'live.take',
        ...(str(m.reference) ? { reference: m.reference } : {}),
        ...(str(m.version, 40) ? { version: m.version } : {}),
      }
    case 'screen.set':
      return (SCREEN_STATES as readonly string[]).includes(m.state as string)
        ? { kind: 'screen.set', state: m.state as ControlScreenState }
        : null
    case 'screen.toggle':
      return m.state === 'black' || m.state === 'logo' ? { kind: 'screen.toggle', state: m.state } : null
    default:
      return null
  }
}
