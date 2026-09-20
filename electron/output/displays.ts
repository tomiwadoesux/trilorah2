/**
 * Which physical display each output window lands on.
 *
 * Until now every output opened as a 1280×720 frameless window on the primary
 * display — on top of the operator's own app — and, being frameless, had no
 * green button to fullscreen it. In a church that meant dragging a borderless
 * window to the projector by hand and never quite filling it.
 *
 * The rule here is the one a volunteer would guess: the projector gets the
 * external screen. Outputs are handed the non-primary displays in order —
 * main → first external, alternate → second, third → third — and an output
 * with no external display left over stays windowed on the primary, where the
 * operator can at least see it. An output is fullscreened ONLY when it has a
 * display of its own; fullscreening over the operator's laptop would hide the
 * app.
 *
 * Pure: takes the display list, returns a placement. The Electron `screen`
 * module is read once by the caller so this stays testable.
 */

export interface DisplayLike {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
}

export interface Placement {
  /** Display the window should open on, or null for "windowed on the primary". */
  display: DisplayLike | null
  fullscreen: boolean
}

/** Output ids in the order they claim external displays. */
export const OUTPUT_ORDER = ['main', 'alternate', 'third', 'fourth', 'fifth', 'timer'] as const

export function placeOutput(
  outputId: string,
  displays: readonly DisplayLike[],
  primaryId: number,
  /** Optional operator choice per output, by display id. Wins when the
   *  display is still connected; ignored when it is not. */
  overrides: Partial<Record<string, number>> = {}
): Placement {
  const chosen = overrides[outputId]
  if (chosen !== undefined) {
    const d = displays.find((x) => x.id === chosen)
    if (d) return { display: d, fullscreen: d.id !== primaryId }
  }
  const externals = displays.filter((d) => d.id !== primaryId)
  const slot = (OUTPUT_ORDER as readonly string[]).indexOf(outputId)
  const d = slot >= 0 ? externals[slot] : undefined
  return d ? { display: d, fullscreen: true } : { display: null, fullscreen: false }
}
