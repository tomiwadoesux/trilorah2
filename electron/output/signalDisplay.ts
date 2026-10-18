import type { DisplayLike } from './displays'

/**
 * Which screen a catch's signal lights (owner, 2026-10-17: "over other apps
 * too, never on the projector").
 *
 * The screen the operator is working on: the one under the pointer, or
 * failing that the one the app's window is on. Never a screen an output is
 * on, or is meant for — light there is light in front of the congregation.
 * When both candidates are such a screen, nothing is lit.
 *
 * Pure: the caller reads Electron's screen module and the output windows.
 */
export function pickSignalDisplay<T extends DisplayLike>(
  displays: readonly T[],
  pointer: { x: number; y: number },
  appWindow: DisplayLike['bounds'] | null,
  outputs: ReadonlySet<number>
): T | null {
  const allowed = displays.filter((d) => !outputs.has(d.id))
  const under = (p: { x: number; y: number }) =>
    allowed.find(({ bounds: b }) => p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height)
  const atPointer = under(pointer)
  if (atPointer) return atPointer
  if (!appWindow) return null
  return under({ x: appWindow.x + appWindow.width / 2, y: appWindow.y + appWindow.height / 2 }) ?? null
}
