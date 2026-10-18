import { BrowserWindow, screen } from 'electron'
import { SIGNAL_MS, type CatchSignal } from '../../shared/catchSignal'
import { pickSignalDisplay } from './signalDisplay'

/**
 * The light a catch raises over the whole screen, for an operator who is in
 * another app when the preacher names a verse (owner, 2026-10-17).
 *
 * One see-through window, made the first time it is needed and kept hidden
 * between signals. It never takes the keyboard, lets every click through to
 * whatever is under it, floats over full-screen apps, and is left out of
 * screen sharing and recording where the system allows. It goes only on the
 * screen pickSignalDisplay chooses — never one an output is on.
 *
 * The drawing is signal.html, the same code the app window draws with.
 */
export interface CatchSignalOverlayDeps {
  /** Load signal.html into the window (the dev server, or dist). */
  load: (win: BrowserWindow) => Promise<void>
  /** Screens an output is on, or is meant for. */
  outputDisplayIds: () => ReadonlySet<number>
  /** The operator's window, for its screen when the pointer is on no usable one. */
  appWindow: () => BrowserWindow | null
}

export class CatchSignalOverlay {
  private win: BrowserWindow | null = null
  private ready: Promise<void> = Promise.resolve()
  /** Bumped by every signal, so only the latest one hides the window. */
  private run = 0
  private deps: CatchSignalOverlayDeps

  constructor(deps: CatchSignalOverlayDeps) {
    this.deps = deps
  }

  /** Light the operator's screen. False when there is no screen it may light. */
  async play(signal: CatchSignal): Promise<boolean> {
    const app = this.deps.appWindow()
    const display = pickSignalDisplay(
      screen.getAllDisplays(),
      screen.getCursorScreenPoint(),
      app && !app.isDestroyed() ? app.getBounds() : null,
      this.deps.outputDisplayIds()
    )
    if (!display) return false
    const win = this.window()
    await this.ready
    if (win.isDestroyed()) return false
    const run = ++this.run
    win.setBounds(display.bounds)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.showInactive()
    void (async () => {
      /* The page answers when its last frame has gone; the timer is for a
         page that never answers. */
      await Promise.race([
        win.webContents.executeJavaScript(`window.__trilorahSignal?.(${JSON.stringify(signal)})`, false).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, SIGNAL_MS[signal] + 600)),
      ])
      if (run === this.run && !win.isDestroyed()) win.hide()
    })()
    return true
  }

  /** Close the window — with the app's, so the app can quit. */
  dispose(): void {
    this.run++
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  private window(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win
    const win = new BrowserWindow({
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      roundedCorners: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      enableLargerThanScreen: true,
      /* A non-activating panel on macOS: it floats over full-screen apps and
         on every desktop without taking focus. A tool window on Windows:
         no taskbar button, not in Alt-Tab. */
      ...(process.platform === 'darwin' ? { type: 'panel' } : process.platform === 'win32' ? { type: 'toolbar' } : {}),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        spellcheck: false,
        // A hidden window must still be ready to draw the moment it is shown.
        backgroundThrottling: false
      }
    })
    win.setIgnoreMouseEvents(true)
    win.setAlwaysOnTop(true, 'screen-saver')
    /* skipTransformProcessType: without it macOS hides the app's windows
       and Dock icon for a moment, mid-service. */
    if (process.platform !== 'win32') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
    win.setContentProtection(true)
    win.on('closed', () => {
      if (this.win === win) this.win = null
    })
    this.win = win
    this.ready = this.deps.load(win).catch((error) => {
      console.warn('⚠️ Catch signal window did not load:', error)
    })
    return win
  }
}
