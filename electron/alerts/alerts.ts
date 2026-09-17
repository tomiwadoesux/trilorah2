/**
 * Real-time message alerts (BUILD-MAP 2.10).
 *
 * "Parent of child 42 to the nursery", "car blocking the driveway" — short
 * operator messages that ride over whatever is on screen without touching
 * the verse. One active alert at a time per target; a new one replaces the
 * old; each expires on its own timer. No Electron dependency: main.ts wires
 * `onChange` to the output windows and the WS server.
 */

export type AlertTarget = 'all' | 'projector' | 'stream' | 'stage'

export interface Alert {
  id: string
  text: string
  target: AlertTarget
  /** Epoch ms when the alert was shown. */
  shownAt: number
  /** Epoch ms when it auto-dismisses; null = until dismissed. */
  expiresAt: number | null
}

export interface ShowAlertOptions {
  target?: AlertTarget
  /** Seconds on screen; 0 or undefined = use default; null = sticky. */
  durationSec?: number | null
}

export const DEFAULT_ALERT_SECONDS = 20
export const MAX_ALERT_CHARS = 140

export class AlertManager {
  private active: Alert | null = null
  private timer: NodeJS.Timeout | null = null
  private seq = 0

  constructor(
    private readonly onChange: (alert: Alert | null) => void,
    private readonly defaultSeconds = DEFAULT_ALERT_SECONDS,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Returns the alert shown, or null when the text was empty. */
  show(text: string, opts: ShowAlertOptions = {}): Alert | null {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_ALERT_CHARS)
    if (!clean) return null
    this.clearTimer()
    const shownAt = this.now()
    const seconds =
      opts.durationSec === null ? null : opts.durationSec && opts.durationSec > 0 ? opts.durationSec : this.defaultSeconds
    const alert: Alert = {
      id: `alert-${++this.seq}`,
      text: clean,
      target: opts.target ?? 'all',
      shownAt,
      expiresAt: seconds === null ? null : shownAt + seconds * 1000
    }
    this.active = alert
    if (seconds !== null) {
      this.timer = setTimeout(() => this.dismiss(alert.id), seconds * 1000)
      // Never keep the process alive just for an alert timer.
      this.timer.unref?.()
    }
    this.onChange(alert)
    return alert
  }

  /** Dismiss the active alert (or a specific one, if it is still active). */
  dismiss(id?: string): boolean {
    if (!this.active) return false
    if (id && this.active.id !== id) return false
    this.clearTimer()
    this.active = null
    this.onChange(null)
    return true
  }

  current(): Alert | null {
    return this.active
  }

  /** Does this alert apply to an output with the given role? */
  static appliesTo(alert: Alert, role: string): boolean {
    return alert.target === 'all' || alert.target === role
  }

  dispose(): void {
    this.clearTimer()
    this.active = null
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
