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
  /** Whose screen the commands move: Trilorah's own wall, or a taught app. */
  | { kind: 'target.list' }
  | { kind: 'target.set'; id: string }
  /** The ♪ press: match the last words heard (or these words) against the song library. */
  | { kind: 'song.search'; words?: string }
  /** Stage a song by title on the current target — a taught app types it into its search. */
  | { kind: 'song.stage'; title: string }
  /** Put back what Trilorah's verse replaced: the song, the slide, or the reading before it. */
  | { kind: 'live.restore' }
  /** Type spoken references into the target app as they are heard. Off at every start; quotes never. */
  | { kind: 'target.follow'; on: boolean }
  /**
   * Words fed in as if the preacher said them, through the same path the microphone's
   * words take: a rehearsal without a microphone, and the way a question like "does a
   * quote reach EasyWorship?" is answered with evidence. `final: false` is a partial.
   */
  | { kind: 'transcript.hear'; text: string; final?: boolean }

/** One song the words heard could be, ranked. */
export interface ControlSongMatch {
  id: string
  title: string
  /** The section whose line matched: "chorus", "verse 2". */
  section: string
  /** 0–1: how much of the heard phrase that section's line covered. */
  score: number
  /** On today's run of service — ranked ahead of library-only matches. */
  scheduled?: boolean
}

/** One place the commands can land. 'trilorah' is always there. */
export interface ControlTarget {
  id: string
  name: string
  /** For a taught app: whether every taught control was found at the last check. */
  verified?: boolean
}

export interface ControlSnapshot {
  epoch: number
  seq: number
  /** Whose screen the commands move right now. */
  target: string
  listening: boolean
  /** The engine's last status line ("Listening…", an error), if any. */
  asrStatus: string | null
  preview: ControlVerse | null
  live: ControlVerse | null
  screen: string
  /** Spoken references are typed into the target app as they are heard (see target.follow). */
  follow?: boolean
}

export type ControlResult =
  | { ok: true; op: string; snapshot: ControlSnapshot; staged?: ControlVerse; live?: ControlVerse; targets?: ControlTarget[]; songs?: { heard: string; matches: ControlSongMatch[] } }
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
    case 'target.list':
    case 'live.restore':
      return { kind: m.kind }
    case 'target.follow':
      return typeof m.on === 'boolean' ? { kind: 'target.follow', on: m.on } : null
    case 'transcript.hear':
      return str(m.text, 2000) ? { kind: 'transcript.hear', text: m.text, ...(m.final === false ? { final: false } : {}) } : null
    case 'target.set':
      return str(m.id, 200) ? { kind: 'target.set', id: m.id } : null
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
    case 'song.search':
      if (m.words !== undefined && !str(m.words)) return null
      return { kind: 'song.search', ...(str(m.words) ? { words: m.words } : {}) }
    case 'song.stage':
      return str(m.title, 200) ? { kind: 'song.stage', title: m.title } : null
    default:
      return null
  }
}
