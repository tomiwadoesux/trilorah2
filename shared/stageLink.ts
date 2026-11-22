/**
 * Stage link — how Trilorah tells a Trilorah Stage Timer on the same Wi-Fi
 * what the preacher just named (owner, 2026-11-22).
 *
 * The timer is a separate little download (electron/timerapp). On a church
 * network it should find Trilorah by itself — nobody types an IP address at
 * 9am on a Sunday — so Trilorah, when the setting is on, shouts a small UDP
 * beacon every couple of seconds and runs a read-only TCP line server. The
 * timer listens for the beacon and connects.
 *
 * Only references the preacher SAID travel ("Genesis chapter one verse
 * five"): never verse text, never the engine's guesses from a story or a
 * quote — the same rule as the gold sweep (src/lib/catchSignal.ts). A
 * correction ("no, verse seventeen") arrives as a fresh reference for the
 * timer to replace the one it is showing.
 *
 * Plain TCP with one JSON object per line, not WebSockets: both ends are
 * Electron main processes, and a dependency-free protocol cannot rot.
 */

/** Where the beacon shouts, and the timer listens. */
export const STAGE_LINK_BEACON_PORT = 53127

export const STAGE_LINK_PROTOCOL = 1

/** How often Trilorah announces itself, while the setting is on. */
export const STAGE_LINK_BEACON_MS = 2000

/** The timer forgets a Trilorah it has not heard from in this long. */
export const STAGE_LINK_BEACON_TIMEOUT_MS = 8000

/** How long a named reference stays on the timer screen. */
export const STAGE_REFERENCE_HOLD_MS = 5000

/** The UDP shout: enough to find the TCP server and name it in the UI. */
export interface StageBeacon {
  t: 'trilorah'
  v: number
  /** The TCP line server's port on the machine the beacon came from. */
  port: number
  /** What the timer's status row calls this Trilorah (church or computer name). */
  name: string
}

/** First line the server sends on connect. */
export interface StageHello {
  t: 'hello'
  v: number
  name: string
}

/** A reference the preacher named, the moment it was staged to preview. */
export interface StageReference {
  t: 'reference'
  /** 'Exodus 11:6-8' — the reference alone, never the verse's words. */
  ref: string
  at: number
}

export type StageMessage = StageHello | StageReference

export function isStageBeacon(v: unknown): v is StageBeacon {
  const b = v as StageBeacon
  return (
    !!b && b.t === 'trilorah' && b.v === STAGE_LINK_PROTOCOL &&
    typeof b.port === 'number' && b.port > 0 && b.port < 65536 &&
    typeof b.name === 'string'
  )
}

export function isStageMessage(v: unknown): v is StageMessage {
  const m = v as StageMessage
  if (!m) return false
  if (m.t === 'hello') return typeof m.name === 'string'
  if (m.t === 'reference') return typeof m.ref === 'string' && m.ref.length > 0
  return false
}

/**
 * The reference as the timer shows it, from a detection's fields.
 * Mirrors referenceOf in src/design/screens/engine.tsx, so the timer and the
 * catches card spell the same catch the same way.
 */
export function stageReferenceText(d: {
  book?: string
  chapter?: number
  verse?: number | null
  endVerse?: number | null
}): string | null {
  if (!d.book || !d.chapter) return null
  const verse = d.verse == null ? '' : `:${d.verse}${d.endVerse && d.endVerse !== d.verse ? `-${d.endVerse}` : ''}`
  return `${d.book} ${d.chapter}${verse}`
}
