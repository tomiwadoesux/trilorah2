import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { app } from 'electron'

// Pinned upstream Windows CPU build. No cloud account or AI API is used.
const VERSION = 'v1.8.3'
const SHA256 = 'd824b1e37599f882b396e73f1ee0bfd5d0529f700314c48311dcbd00b803321d'
const runtimeDir = () => path.join(app.getPath('userData'), 'offline-speech', VERSION)
export function downloadedWhisperBinary(): string | null {
  const file = path.join(runtimeDir(), 'Release', 'whisper-cli.exe')
  return process.platform === 'win32' && fs.existsSync(file) && fs.existsSync(path.join(runtimeDir(), 'ready')) ? file : null
}
let pending: Promise<string> | null = null

export function ensureOfflineRuntime(onStatus: (message: string) => void): Promise<string> {
  const ready = downloadedWhisperBinary()
  if (ready) return Promise.resolve(ready)
  if (pending) return pending
  pending = (async () => {
    if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This install needs a compatible whisper.cpp executable for offline speech.')
    onStatus('Downloading offline speech engine (one time, about 4 MB)…')
    const response = await fetch(`https://github.com/ggml-org/whisper.cpp/releases/download/${VERSION}/whisper-bin-x64.zip`, { signal: AbortSignal.timeout(120_000) })
    if (!response.ok) throw new Error('Could not download the offline speech engine. Check the internet connection and retry.')
    const bytes = Buffer.from(await response.arrayBuffer())
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) throw new Error('Offline speech download failed verification. Please retry.')
    const dir = runtimeDir()
    fs.mkdirSync(dir, { recursive: true })
    const archive = path.join(dir, 'engine.zip')
    fs.writeFileSync(archive, bytes)
    try {
      await new Promise<void>((resolve, reject) => execFile('tar.exe', ['-xf', archive, '-C', dir], { windowsHide: true, timeout: 30_000 }, (error) => error ? reject(error) : resolve()))
    } finally { fs.rmSync(archive, { force: true }) }
    const binary = path.join(dir, 'Release', 'whisper-cli.exe')
    if (!fs.existsSync(binary)) throw new Error('Offline speech could not be installed. Please retry.')
    fs.writeFileSync(path.join(dir, 'ready'), SHA256)
    return binary
  })().finally(() => { pending = null })
  return pending
}
