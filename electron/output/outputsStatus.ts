/**
 * What the outputs card and the Settings display map are drawn from.
 *
 * Both used to be drawn from specimens: "Epson EB-2247U", "BlackMagic HDMI"
 * and "Dell P2419H" on the dashboard, "Epson EB-L200" in Settings, on every
 * machine, whatever was actually plugged in. The engine always knew the
 * truth — Electron's screen module has the displays, placeOutput decides
 * where each output lands, roleFor says what job it has — and nothing ever
 * handed that truth to the screens that describe it. This joins it into the
 * one answer they draw.
 *
 * Pure: the caller reads Electron's screen once and passes the list in, the
 * same way placeOutput is called, so this stays testable.
 */

import { placeOutput } from './displays'
import { roleFor, type OutputRole, type ScreenState } from './outputState'

/** The fields of Electron's Display this needs. A real Display satisfies it. */
export interface DisplaySource {
  id: number
  /** The monitor's own name where the OS gives one. Empty on some Linux setups. */
  label: string
  /** The laptop's built-in panel. */
  internal: boolean
  scaleFactor: number
  bounds: { x: number; y: number; width: number; height: number }
}

export interface DisplayStatus {
  id: number
  /** What the operator calls it. Unique within the list, so a picker can use it. */
  name: string
  /** Resolution, the way the operating system's own display settings say it. */
  w: number
  h: number
  /** The primary display — where the operator's app is. */
  primary: boolean
}

export interface OutputStatus {
  id: string
  role: OutputRole
  /** Its window is open right now. */
  open: boolean
  /** The display it is on when open, or opens on when not. Null means a
   *  window on the primary, because no external display was left for it. */
  displayId: number | null
  /** Full screen on a display of its own. False is a window on the
   *  operator's screen — placeOutput's fallback, and the case to catch
   *  before a service rather than during one. */
  fullscreen: boolean
  /** The operator's pinned display, while it is connected. Null means the
   *  externals are handed out in order. */
  chosenDisplayId: number | null
}

export interface OutputsStatus {
  displays: DisplayStatus[]
  outputs: OutputStatus[]
  /** One state for every output: main.ts runs a single ScreenStateMachine. */
  screenState: ScreenState
}

/** The outputs the operator can open from the app, in the order they are listed. */
export const LISTED_OUTPUTS = ['main', 'alternate', 'third', 'timer'] as const

/**
 * A display's resolution as its own OS reports it. macOS talks in points
 * ("looks like 1512 × 982" on a Retina laptop) and Electron's bounds are
 * already points there. Windows and Linux talk in device pixels — a 1080p
 * panel at 125% is "1920 × 1080" in Windows settings but 1536 × 864 in
 * Electron's bounds — so there the bounds are scaled back up.
 */
export function pixelsOf(d: DisplaySource, platform: string): { w: number; h: number } {
  const k = platform === 'darwin' ? 1 : d.scaleFactor || 1
  return { w: Math.round(d.bounds.width * k), h: Math.round(d.bounds.height * k) }
}

/**
 * A name per display, in list order. The OS label where there is one;
 * otherwise "built-in display" or "display 2". Two identical projectors
 * share a label, so the second becomes "EPSON PJ (2)" — the names fill a
 * picker, and a picker cannot hold the same entry twice.
 */
export function displayNames(displays: readonly DisplaySource[]): string[] {
  const base = displays.map((d, i) => d.label.trim() || (d.internal ? 'built-in display' : `display ${i + 1}`))
  const seen = new Map<string, number>()
  return base.map((name) => {
    const n = (seen.get(name) ?? 0) + 1
    seen.set(name, n)
    return n === 1 ? name : `${name} (${n})`
  })
}

export function describeOutputs(input: {
  displays: readonly DisplaySource[]
  primaryId: number
  /** settings.outputRoles */
  roleOverrides?: Partial<Record<string, unknown>> | null
  /** settings.outputDisplays */
  displayOverrides?: Partial<Record<string, number>> | null
  /** Output ids whose window is open. */
  openIds: readonly string[]
  screenState: ScreenState
  platform: string
}): OutputsStatus {
  const { displays, primaryId, openIds, screenState, platform } = input
  /* Straight out of the settings store, which can hold anything. */
  const roleOverrides = input.roleOverrides ?? {}
  const displayOverrides = input.displayOverrides ?? {}
  const names = displayNames(displays)
  const connected = new Set(displays.map((d) => d.id))
  /* An output opened some other way than the four buttons is still an
     output this machine drives, so it is listed too. */
  const ids = [...LISTED_OUTPUTS, ...openIds.filter((id) => !(LISTED_OUTPUTS as readonly string[]).includes(id))]
  return {
    displays: displays.map((d, i) => ({ id: d.id, name: names[i], ...pixelsOf(d, platform), primary: d.id === primaryId })),
    outputs: ids.map((id) => {
      const placement = placeOutput(id, displays, primaryId, displayOverrides)
      const chosen = displayOverrides[id]
      return {
        id,
        role: roleFor(id, roleOverrides),
        open: openIds.includes(id),
        displayId: placement.display?.id ?? null,
        fullscreen: placement.fullscreen,
        chosenDisplayId: typeof chosen === 'number' && connected.has(chosen) ? chosen : null
      }
    }),
    screenState
  }
}
