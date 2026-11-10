import {
  parseControlCommand,
  type ControlCommand,
  type ControlEvent,
  type ControlResult,
  type ControlSnapshot,
  type ControlVerse,
} from '../../shared/control/schema'

/**
 * Executes control commands against the running engine and keeps the event
 * order. Framework-free: main.ts supplies a ControlHost of callbacks over
 * its existing functions, so this unit-tests with a fake host, and the
 * behavior clients see is exactly what the app's own buttons do.
 *
 * Honesty rule: a host callback returns what actually happened (the staged
 * verse, the verse now live, an error) — never a bare "the function ran".
 */
export interface ControlHost {
  listening(): boolean
  /** Null when listening started (or already was); otherwise why not. */
  startListening(device?: string): string | null
  stopListening(): void
  /** The staged preview, or null when the reference could not be staged. */
  stageScripture(reference: string, version?: string): ControlVerse | null
  /** The verse now live, or null when nothing was promoted. */
  take(via: 'operator' | 'remote'): ControlVerse | null
  clearLive(): void
  next(): void
  previous(): void
  /** False when the state was refused (unknown or unchanged is fine = true). */
  setScreen(state: string): boolean
  /** Show the pop-up console window. */
  openConsole(): void
  screen(): string
  preview(): ControlVerse | null
  live(): ControlVerse | null
}

export type ControlVia = 'console' | 'socket' | 'remote'

export class ControlDispatcher {
  /** One runtime instance: clients use it to notice a restart. */
  readonly epoch = Date.now()
  private seq = 0
  private ops = 0
  private asrStatus: string | null = null
  private listeners = new Set<(event: ControlEvent) => void>()

  constructor(private readonly host: ControlHost) {}

  snapshot(): ControlSnapshot {
    return {
      epoch: this.epoch,
      seq: this.seq,
      listening: this.host.listening(),
      asrStatus: this.asrStatus,
      preview: this.host.preview(),
      live: this.host.live(),
      screen: this.host.screen(),
    }
  }

  /** Something happened in the engine; tell every subscribed client, in order. */
  event(channel: ControlEvent['channel'], payload: unknown): void {
    if (channel === 'asr') this.asrStatus = typeof payload === 'string' ? payload : null
    const event: ControlEvent = { epoch: this.epoch, seq: ++this.seq, at: Date.now(), channel, payload }
    for (const listener of this.listeners) {
      try { listener(event) } catch { /* one slow client is not everyone's problem */ }
    }
  }

  observe(listener: (event: ControlEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  execute(raw: unknown, via: ControlVia): ControlResult {
    const op = `op_${this.epoch.toString(36)}_${++this.ops}`
    const command = parseControlCommand(raw)
    if (!command) return this.fail(op, 'not a command this protocol knows')
    try {
      return this.run(op, command, via)
    } catch (e) {
      return this.fail(op, e instanceof Error ? e.message : 'the command failed')
    }
  }

  private run(op: string, command: ControlCommand, via: ControlVia): ControlResult {
    switch (command.kind) {
      case 'status':
        return this.done(op)
      case 'listen.start': {
        const refused = this.host.startListening(command.device)
        return refused ? this.fail(op, refused) : this.done(op)
      }
      case 'listen.stop':
        this.host.stopListening()
        return this.done(op)
      case 'scripture.stage': {
        const staged = this.host.stageScripture(command.reference, command.version)
        return staged ? this.done(op, { staged }) : this.fail(op, `could not find "${command.reference}"${command.version ? ` in ${command.version}` : ''}`)
      }
      case 'live.take': {
        if (command.reference) {
          const staged = this.host.stageScripture(command.reference, command.version)
          if (!staged) return this.fail(op, `could not find "${command.reference}"${command.version ? ` in ${command.version}` : ''}`)
        }
        const live = this.host.take(via === 'console' ? 'operator' : 'remote')
        return live ? this.done(op, { live }) : this.fail(op, 'nothing is staged to take live')
      }
      case 'live.clear':
        this.host.clearLive()
        return this.done(op)
      case 'live.next':
        this.host.next()
        return this.done(op)
      case 'live.previous':
        this.host.previous()
        return this.done(op)
      case 'screen.set':
        return this.host.setScreen(command.state) ? this.done(op) : this.fail(op, `the wall cannot show "${command.state}" right now`)
      case 'console.open':
        this.host.openConsole()
        return this.done(op)
    }
  }

  private done(op: string, extra: { staged?: ControlVerse; live?: ControlVerse } = {}): ControlResult {
    return { ok: true, op, snapshot: this.snapshot(), ...extra }
  }

  private fail(op: string, error: string): ControlResult {
    return { ok: false, op, error, snapshot: this.snapshot() }
  }
}
