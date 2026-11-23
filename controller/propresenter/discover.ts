import { execFile } from 'node:child_process'

/**
 * Where ProPresenter's API might be listening on this computer.
 *
 * ProPresenter picks its own port (52273 by default, another when that one is
 * taken — "Automatically select a new port on failure" is on out of the box),
 * so a fixed number is wrong often enough to matter. A church can pin one in
 * Trilorah's settings; otherwise we list every TCP port this computer has open
 * for listening and let the caller knock on each with GET /version. Asking the
 * OS which process owns a port is the slow part (tasklist takes ten seconds on
 * an ordinary laptop; a PowerShell child, five to eight), and a dozen local
 * HTTP probes that fail in milliseconds are cheaper than any of it.
 */
export interface DiscoverOptions {
  host?: string
  /** A port the church pinned; 0 or undefined means find it. */
  port?: number
  platform?: NodeJS.Platform
  /** Runs a command and resolves its stdout; tests hand in a fake. */
  exec?: (file: string, args: string[]) => Promise<string>
}

const run = (file: string, args: string[]) => new Promise<string>((resolve) => {
  execFile(file, args, { timeout: 8000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (_err, stdout) => resolve(String(stdout ?? '')))
})

/** Ports below this are the system's (RPC, SMB, printing…), never ProPresenter's. */
const FIRST_USER_PORT = 1024

/**
 * The listening TCP ports in a Windows `netstat -ano -p tcp` print-out or a
 * macOS `lsof -nP -iTCP -sTCP:LISTEN` print-out. On macOS the command column
 * names the owner, so only ProPresenter's rows count; Windows gives a PID we
 * would have to look up, so every user-range port is a candidate there.
 */
export function portsFromListing(text: string, platform: NodeJS.Platform): number[] {
  const ports = new Set<number>()
  for (const line of text.split(/\r?\n/)) {
    let m: RegExpMatchArray | null = null
    if (platform === 'win32') {
      // "  TCP    0.0.0.0:56094    0.0.0.0:0    LISTENING    16968"
      m = line.match(/^\s*TCP\s+\S+:(\d{1,5})\s+\S+\s+LISTENING\s+\d+\s*$/i)
    } else if (/ProPresen/i.test(line) && /\(LISTEN\)/.test(line)) {
      m = line.match(/:(\d{1,5})\s+\(LISTEN\)/)
    }
    if (!m) continue
    const port = Number(m[1])
    if (port >= FIRST_USER_PORT && port < 65536) ports.add(port)
  }
  return [...ports].sort((a, b) => a - b)
}

/** Candidate base URLs, a pinned port alone or every open port worth knocking on; empty when there is nothing to try. */
export async function discoverProPresenter(opts: DiscoverOptions = {}): Promise<string[]> {
  const host = opts.host || '127.0.0.1'
  if (opts.port && opts.port > 0) return [`http://${host}:${opts.port}`]
  const platform = opts.platform ?? process.platform
  const exec = opts.exec ?? run
  let listing = ''
  if (platform === 'win32') listing = await exec('netstat.exe', ['-ano', '-p', 'tcp'])
  else if (platform === 'darwin') listing = await exec('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'])
  else return []
  return portsFromListing(listing, platform).map((p) => `http://${host}:${p}`)
}
