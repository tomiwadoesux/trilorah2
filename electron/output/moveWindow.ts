import type { DisplayLike, Placement } from './displays'

interface OutputWindow {
  isDestroyed(): boolean
  isFullScreen(): boolean
  setFullScreen(value: boolean): void
  setBounds(bounds: DisplayLike['bounds']): void
  once(event: 'leave-full-screen', listener: () => void): unknown
}

const moves = new WeakMap<OutputWindow, number>()

/** macOS must finish leaving its fullscreen Space before bounds can move. */
export function moveOutputWindow(win: OutputWindow, placement: Placement, primary: DisplayLike): void {
  const revision = (moves.get(win) ?? 0) + 1
  moves.set(win, revision)
  const apply = () => {
    if (win.isDestroyed() || moves.get(win) !== revision) return
    win.setBounds(placement.display?.bounds ?? { ...primary.bounds, width: 1280, height: 720 })
    if (placement.fullscreen) win.setFullScreen(true)
  }
  if (win.isFullScreen()) {
    win.once('leave-full-screen', apply)
    win.setFullScreen(false)
  } else apply()
}
