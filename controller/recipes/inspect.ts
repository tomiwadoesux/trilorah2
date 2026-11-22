import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
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

/**
 * What a watcher run meant. Time running out is honest JSON with nothing
 * recorded; a crash is no JSON at all, or a `Fail` body. Those must never
 * look the same to the teaching flow, or a broken watcher reads as "the
 * operator skipped" and the next question appears before anyone clicked.
 */
export function readWatchOutput(stdout: string, stderr: string, code: number | null, cancelled: boolean): WatchOutcome {
  const start = stdout.indexOf('{')
  let parsed: { ok?: boolean; error?: string; recorded?: unknown } | null = null
  if (start >= 0) { try { parsed = JSON.parse(stdout.slice(start)) } catch { parsed = null } }
  const recorded = Array.isArray(parsed?.recorded) ? (parsed!.recorded as Record<string, unknown>[]) : []
  if (cancelled) return { recorded, cancelled: true }
  if (parsed) {
    if (Array.isArray(parsed.recorded)) return { recorded }
    return { recorded, error: parsed.error || 'the watcher answered without a recording' }
  }
  // No JSON: the process died. Its own prompts and PowerShell's position noise are not the reason.
  const said = stderr.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^(watching |recorded:|At |\+ )/.test(l))
  return { recorded, error: (said[0] ?? `the watcher stopped before it started (exit ${code ?? '?'})`).slice(0, 200) }
}

/**
 * A `watch` that can be called off: the teaching flow's skip button. Resolves
 * with the records so far, or with why it could not watch at all.
 */
export function watchClicks(binary: string, pid: number, clicks: number, seconds: number): { done: Promise<WatchOutcome>; cancel: () => void } {
  const cmd = commandFor(binary, ['watch', String(pid), '--count', String(clicks), '--seconds', String(seconds)])
  const child = spawn(cmd.file, cmd.args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  let err = ''
  let cancelled = false
  child.stdout.on('data', (chunk) => { out += String(chunk) })
  child.stderr.on('data', (chunk) => { err += String(chunk) })
  const done = new Promise<WatchOutcome>((resolve) => {
    child.on('close', (code) => resolve(readWatchOutput(out, err, code, cancelled)))
    child.on('error', (e) => resolve({ recorded: [], error: `could not start the watcher: ${e.message}` }))
  })
  return { done, cancel: () => { cancelled = true; try { child.kill('SIGTERM') } catch { /* already gone */ } } }
}

export function spawnInspector(binary: string, timeoutMs = 15_000): Inspector {
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
