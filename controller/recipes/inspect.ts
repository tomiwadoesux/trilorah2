import { execFile } from 'node:child_process'
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
