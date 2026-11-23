import type { ControlHost } from '../../electron/control/dispatcher'
import type { DirectTarget } from '../recipes/targets'
import type { FetchLike } from '../propresenter/client'
import { openLpClient, type OpenLpClient } from './client'
import { openLpHost } from './host'

/**
 * OpenLP as a target under **screen**, there whenever its API answers on this
 * computer. One cheap probe (GET /core/system) in the background every
 * `everyMs`; the port is OpenLP's default unless the church pinned another.
 */
export const OPENLP_TARGET_ID = 'app:openlp'
export const OPENLP_DEFAULT_PORT = 4316

export interface OpenLpTargetOptions {
  own: ControlHost
  settings: () => { host?: string; port?: number }
  onProblem?: (ability: string, problem: string) => void
  fetch?: FetchLike
  everyMs?: number
  autoStart?: boolean
}

export interface OpenLpTargetHandle {
  list(): DirectTarget[]
  probe(): Promise<string | null>
  stop(): void
}

export function openLpTarget(opts: OpenLpTargetOptions): OpenLpTargetHandle {
  let found: { base: string; client: OpenLpClient } | null = null
  let probing: Promise<string | null> | null = null
  let host: ControlHost | null = null

  async function probe(): Promise<string | null> {
    if (probing) return probing
    probing = (async () => {
      const s = opts.settings()
      const base = `http://${s.host || '127.0.0.1'}:${s.port && s.port > 0 ? s.port : OPENLP_DEFAULT_PORT}`
      const client = openLpClient({ base, fetch: opts.fetch, timeoutMs: 2500 })
      try {
        const sys = await client.system()
        if (sys && typeof sys.api_version === 'number') {
          if (!found || found.base !== base) { host = null; found = { base, client } }
          return base
        }
      } catch { /* not there */ }
      found = null
      host = null
      return null
    })().finally(() => { probing = null })
    return probing
  }

  let timer: NodeJS.Timeout | null = null
  if (opts.autoStart !== false) {
    void probe()
    timer = setInterval(() => { void probe() }, opts.everyMs ?? 15_000)
    timer.unref?.()
  }

  return {
    probe,
    stop: () => { if (timer) clearInterval(timer); timer = null },
    list: () => {
      if (!found) return []
      const current = found
      return [{
        id: OPENLP_TARGET_ID,
        name: 'OpenLP',
        host: () => (host ??= openLpHost({ client: current.client, own: opts.own, onProblem: opts.onProblem })),
        verify: async () => {
          try {
            const sys = await current.client.system()
            if (!sys || typeof sys.api_version !== 'number') return { ok: false, broken: [`${current.base} answered, but not as OpenLP's API`] }
            if (sys.login_required) return { ok: false, broken: ['OpenLP asks for a login on its API — turn that off under Settings › Remote, or Trilorah cannot drive it'] }
            return { ok: true, broken: [] }
          } catch (e) {
            return { ok: false, broken: [e instanceof Error ? e.message : String(e)] }
          }
        },
      }]
    },
  }
}
