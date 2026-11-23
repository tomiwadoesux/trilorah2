/** What electron/timerapp/preload.ts puts on the window. */

export interface TimerSnapshot {
  id: string
  name: string
  kind: 'countdown' | 'to-time' | 'elapsed'
  state: 'stopped' | 'running' | 'paused'
  remainingMs: number
  overrunning: boolean
  display: string
  durationSec?: number
  extraSec?: number
  inExtension?: boolean
  phaseTotalMs?: number
  /** Ten minutes past zero: remainingMs holds at the cap and the face says so. */
  pastCap?: boolean
}

export interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  primary: boolean
  showing: boolean
}

export interface TimerAppSettings {
  timerName?: string
  durationSec?: number
  showVerses?: boolean
  displayId?: number
}

export interface LinkState {
  connected: boolean
  name: string
}

type Unsubscribe = () => void

export interface TimerApi {
  getSettings(): Promise<TimerAppSettings>
  setSetting(key: string, value: unknown): Promise<boolean>

  listTimers(): Promise<TimerSnapshot[]>
  createTimer(input: { name?: string; kind: 'countdown' | 'to-time' | 'elapsed'; durationSec?: number; targetTime?: string; overrun?: boolean }): Promise<TimerSnapshot | null>
  updateTimer(id: string, patch: Record<string, unknown>): Promise<TimerSnapshot | null>
  startTimer(id: string): Promise<TimerSnapshot | null>
  pauseTimer(id: string): Promise<TimerSnapshot | null>
  resetTimer(id: string): Promise<TimerSnapshot | null>
  removeTimer(id: string): Promise<boolean>
  onTimers(callback: (timers: TimerSnapshot[]) => void): Unsubscribe

  listDisplays(): Promise<DisplayInfo[]>
  onDisplays(callback: (displays: DisplayInfo[]) => void): Unsubscribe
  openScreen(displayId: number): Promise<boolean>
  closeScreen(): Promise<boolean>
  screenState(): Promise<{ open: boolean; displayId?: number }>
  onScreenState(callback: (state: { open: boolean; displayId?: number }) => void): Unsubscribe

  linkState(): Promise<LinkState>
  onLink(callback: (link: LinkState) => void): Unsubscribe
  onStageReference(callback: (payload: { ref: string; at: number }) => void): Unsubscribe
  onShowVerses(callback: (on: boolean) => void): Unsubscribe
}

declare global {
  interface Window {
    timerApi?: TimerApi
  }
}
