import { execFile, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import type { Inspector, InspectResult } from './runner'

/**
 * The real inspector: the platform binary, one process per call, JSON back.
 * (controller/macos/inspect.swift today; the Windows twin later.) The path is
 * found rather than assumed, because the binary lives in controller/bin in a
 * checkout and beside the app's resources when packaged.
 */
export function findInspectorBinary(candidates: string[] = defaultCandidates()): string | null {
  return candidates.find((p) => { try { return fs.statSync(p).isFile() } catch { return false } }) ?? null
}

function defaultCandidates(): string[] {
  const resources = (process as { resourcesPath?: string }).resourcesPath
  if (process.platform === 'win32') {
    // The Windows twin is a PowerShell script: UI Automation ships in Windows, nothing to compile.
    const script = 'trilorah-inspect.ps1'
    return [path.resolve(__dirname, '..', 'windows', script), ...(resources ? [path.join(resources, 'controller', script)] : [])]
  }
  const name = 'trilorah-inspect'
  return [path.resolve(__dirname, '..', 'bin', name), ...(resources ? [path.join(resources, 'controller', name)] : [])]
}

/** The command line for a tool: a .ps1 runs under Windows' built-in PowerShell. */
function commandFor(binary: string, args: string[]): { file: string; args: string[] } {
  if (binary.toLowerCase().endsWith('.ps1')) {
    return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', binary, ...args] }
  }
  return { file: binary, args }
}

export interface WatchOutcome {
  recorded: Record<string, unknown>[]
  /** The watcher failed rather than ran out of time. The operator must see this; it is never a skip. */
  error?: string
  /** The operator called it off, so nothing recorded is the expected answer. */
  cancelled?: boolean
}

/** A streamed click line, when the given line is one. The watchers print each click the moment it lands. */
export function parseClickLine(line: string): Record<string, unknown> | null {
  const t = line.trim()
  if (!t.startsWith('{"click":')) return null
  try {
    const o = JSON.parse(t) as { click?: unknown }
    return o && typeof o.click === 'object' && o.click !== null ? (o.click as Record<string, unknown>) : null
  } catch { return null }
}

/**
 * What a watcher run meant. Time running out is honest JSON with nothing
 * recorded; a crash is no JSON at all, or a `Fail` body. Those must never
 * look the same to the teaching flow, or a broken watcher reads as "the
 * operator skipped" and the next question appears before anyone clicked.
 *
 * Clicks arrive as their own `{"click":…}` lines as they land, so a trail
 * survives the operator ending it early ("that's it" kills the process
 * before the summary prints) — the collected lines ARE the answer then.
 */
export function readWatchOutput(stdout: string, stderr: string, code: number | null, cancelled: boolean): WatchOutcome {
  const clicks: Record<string, unknown>[] = []
  const rest: string[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const click = parseClickLine(line)
    if (click) clicks.push(click)
    else rest.push(line)
  }
  const blob = rest.join('\n')
  const start = blob.indexOf('{')
  let parsed: { ok?: boolean; error?: string; recorded?: unknown } | null = null
  if (start >= 0) { try { parsed = JSON.parse(blob.slice(start)) } catch { parsed = null } }
  const recorded = Array.isArray(parsed?.recorded) ? (parsed!.recorded as Record<string, unknown>[]) : clicks
  if (cancelled) return { recorded, cancelled: true }
  if (parsed) {
    if (Array.isArray(parsed.recorded)) return { recorded }
    return { recorded, error: parsed.error || 'the watcher answered without a recording' }
  }
  // No JSON summary: the process died. Its own prompts and PowerShell's position noise are not the reason.
  const said = stderr.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^(watching |recorded:|At |\+ )/.test(l))
  return { recorded, error: (said[0] ?? `the watcher stopped before it started (exit ${code ?? '?'})`).slice(0, 200) }
}

/**
 * A `watch` that can be called off: the teaching flow's "that's it" and skip
 * buttons both end it, and the clicks streamed so far come back either way.
 * `onClick` fires as each click lands, so a panel can show the trail growing.
 */
export function watchClicks(
  binary: string,
  pid: number,
  clicks: number,
  seconds: number,
  onClick?: (record: Record<string, unknown>, count: number) => void
): { done: Promise<WatchOutcome>; cancel: () => void } {
  const cmd = commandFor(binary, ['watch', String(pid), '--count', String(clicks), '--seconds', String(seconds)])
  const child = spawn(cmd.file, cmd.args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  let err = ''
  let cancelled = false
  let pending = ''
  let seen = 0
  child.stdout.on('data', (chunk) => {
    const text = String(chunk)
    out += text
    if (!onClick) return
    pending += text
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() ?? ''
    for (const line of lines) {
      const click = parseClickLine(line)
      if (click) onClick(click, ++seen)
    }
  })
  child.stderr.on('data', (chunk) => { err += String(chunk) })
  const done = new Promise<WatchOutcome>((resolve) => {
    child.on('close', (code) => resolve(readWatchOutput(out, err, code, cancelled)))
    child.on('error', (e) => resolve({ recorded: [], error: `could not start the watcher: ${e.message}` }))
  })
  return { done, cancel: () => { cancelled = true; try { child.kill('SIGTERM') } catch { /* already gone */ } } }
}

/** One call, one process: the macOS binary, and the fallback when the Windows server cannot start. */
function oneShot(binary: string, timeoutMs: number): Inspector {
  return {
    run(args) {
      return new Promise<InspectResult>((resolve) => {
        const cmd = commandFor(binary, args)
        execFile(cmd.file, cmd.args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
          const text = String(stdout ?? '').trim()
          // The tool prints JSON even when it fails; a non-JSON reply is the process itself dying.
          try {
            const parsed = JSON.parse(text.slice(text.lastIndexOf('\n{') + 1 || 0)) as InspectResult
            if (typeof parsed.ok === 'boolean') return resolve(parsed)
          } catch { /* fall through */ }
          resolve({ ok: false, error: error ? `the inspector did not answer (${error.message.split('\n')[0]})` : 'the inspector gave no answer' })
        })
      })
    },
  }
}

/**
 * The Windows inspector kept alive: one PowerShell running `serve`, asked one
 * request at a time over its stdin, answering one JSON line each. Starting
 * PowerShell and loading UI Automation is five or six seconds on an ordinary
 * PC; paid once here instead of before every click. A server that dies or
 * stops answering within the budget is killed and started again for the next
 * call, and the call it failed gets a plain error — never a hang.
 */
function served(binary: string, timeoutMs: number): Inspector & { stop(): void } {
  type Pending = { id: number; resolve: (r: InspectResult) => void; args: string[]; background: boolean }
  let child: ChildProcess | null = null
  let ready: Promise<boolean> | null = null
  let nextId = 1
  const queue: Pending[] = []
  const waiting = new Map<number, Pending>()
  const serverMs = new Map<number, { ms: number; trace: Record<string, number> }>()
  let inflight: Pending | null = null
  let timer: NodeJS.Timeout | null = null

  const failAll = (why: string) => {
    if (timer) { clearTimeout(timer); timer = null }
    const all = [...(inflight ? [inflight] : []), ...queue]
    inflight = null; queue.length = 0; waiting.clear()
    for (const p of all) p.resolve({ ok: false, error: why })
  }

  const start = (): Promise<boolean> => {
    if (ready) return ready
    const cmd = commandFor(binary, ['serve'])
    const proc = spawn(cmd.file, cmd.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    child = proc
    ready = new Promise<boolean>((resolve) => {
      let up = false
      const lines = readline.createInterface({ input: proc.stdout! })
      lines.on('line', (line) => {
        const text = line.trim()
        if (!text.startsWith('{')) return
        let msg: { id?: number; ms?: number; trace?: Record<string, number>; result?: InspectResult; serving?: boolean }
        try { msg = JSON.parse(text) as typeof msg } catch { return }
        if (msg.serving) { up = true; resolve(true); return }
        if (typeof msg.id !== 'number') return
        const p = waiting.get(msg.id)
        if (!p) return
        waiting.delete(msg.id)
        if (inflight === p) { inflight = null; if (timer) { clearTimeout(timer); timer = null } }
        if (typeof msg.ms === 'number') serverMs.set(p.id, { ms: msg.ms, trace: msg.trace ?? {} })
        p.resolve(msg.result && typeof msg.result.ok === 'boolean' ? msg.result : { ok: false, error: 'the inspector gave no answer' })
        pump()
      })
      proc.on('error', () => { resolve(false) })
      proc.on('exit', (code) => {
        if (child === proc) { child = null; ready = null }
        if (!up) resolve(false)
        failAll(`the inspector stopped (exit ${code ?? '?'})`)
      })
    })
    return ready
  }

  const pump = () => {
    if (inflight || queue.length === 0 || !child?.stdin?.writable) return
    const p = queue.shift()!
    inflight = p
    waiting.set(p.id, p)
    timer = setTimeout(() => {
      if (inflight !== p) return
      const proc = child
      child = null; ready = null
      failAll(`the inspector did not answer within ${Math.round(timeoutMs / 1000)} s`)
      try { proc?.kill() } catch { /* already gone */ }
    }, timeoutMs)
    // The next request leaves when this one is answered: the server is one thread, and a
    // budget per request only means something when the clock starts as it is sent.
    child.stdin.write(JSON.stringify({ id: p.id, args: p.args }) + '\n')
  }

  return {
    async run(args, opts) {
      const up = await start()
      if (!up) return oneShot(binary, timeoutMs).run(args)
      const started = Date.now()
      const p: Pending = { id: nextId++, resolve: () => undefined, args, background: !!opts?.background }
      const result = await new Promise<InspectResult>((resolve) => {
        p.resolve = resolve
        // The service's own calls go to the front, behind only what is already being
        // answered and the service calls before them; a verification's looks wait at the back.
        const firstLook = queue.findIndex((q) => q.background)
        if (p.background || firstLook < 0) queue.push(p)
        else queue.splice(firstLook, 0, p)
        pump()
      })
      // A slow answer is worth a line: it is the number the room feels, and the step it names -
      // with how much of it was the inspector's own work, the rest being its turn in the queue.
      const ms = Date.now() - started
      const inside = serverMs.get(p.id); serverMs.delete(p.id)
      if (ms > 4000) {
        const where = inside ? Object.entries(inside.trace).map(([k, v]) => `${k} ${v}`).join(', ') : ''
        console.warn(`🐢 inspector ${args.slice(0, 4).join(' ')} took ${(ms / 1000).toFixed(1)} s${inside ? ` (${(inside.ms / 1000).toFixed(1)} s of it working: ${where})` : ''}`)
      }
      return result
    },
    stop() {
      const proc = child
      child = null; ready = null
      failAll('the inspector was stopped')
      try { proc?.stdin?.end() } catch { /* already gone */ }
      setTimeout(() => { try { proc?.kill() } catch { /* already gone */ } }, 500).unref()
    },
  }
}

/**
 * The real inspector. On Windows it is a server kept alive for the session
 * (see `served`); the macOS binary runs once per call.
 */
export function spawnInspector(binary: string, timeoutMs = 15_000): Inspector & { stop?: () => void } {
  if (binary.toLowerCase().endsWith('.ps1')) return served(binary, timeoutMs)
  return oneShot(binary, timeoutMs)
}
