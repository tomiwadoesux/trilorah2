import { describe, expect, it, vi } from 'vitest'
import { moveOutputWindow } from './moveWindow'

const laptop = { id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 } }
const dell = { id: 2, bounds: { x: 1440, y: 0, width: 1920, height: 1080 } }
function fakeWindow(fullscreen = true) {
  const listeners: (() => void)[] = []
  return {
    isDestroyed: () => false, isFullScreen: () => fullscreen,
    setFullScreen: vi.fn(), setBounds: vi.fn(),
    once: (_event: string, fn: () => void) => { listeners.push(fn) },
    leave: () => { fullscreen = false; listeners.splice(0).forEach(fn => fn()) },
  }
}
describe('moving a fullscreen output', () => {
  it('waits for macOS to leave fullscreen before moving and entering fullscreen again', () => {
    const win = fakeWindow()
    moveOutputWindow(win, { display: dell, fullscreen: true }, laptop)
    expect(win.setBounds).not.toHaveBeenCalled()
    expect(win.setFullScreen.mock.calls).toEqual([[false]])
    win.leave()
    expect(win.setBounds).toHaveBeenCalledWith(dell.bounds)
    expect(win.setFullScreen.mock.calls).toEqual([[false], [true]])
  })
  it('honours the latest choice when screens are switched during the transition', () => {
    const win = fakeWindow()
    moveOutputWindow(win, { display: dell, fullscreen: true }, laptop)
    moveOutputWindow(win, { display: laptop, fullscreen: false }, laptop)
    win.leave()
    expect(win.setBounds.mock.calls).toEqual([[laptop.bounds]])
    expect(win.setFullScreen).not.toHaveBeenCalledWith(true)
  })
  it('returns an unplugged output to the laptop rather than leaving it offscreen', () => {
    const win = fakeWindow(false)
    moveOutputWindow(win, { display: null, fullscreen: false }, laptop)
    expect(win.setBounds).toHaveBeenCalledWith({ ...laptop.bounds, width: 1280, height: 720 })
  })
})
