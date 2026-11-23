import type { ControlHost } from '../../electron/control/dispatcher'
import type { DirectTarget } from '../recipes/targets'
import { proClient, type FetchLike, type ProClient } from './client'
import { discoverProPresenter } from './discover'
import { proPresenterHost } from './host'

/**
 * ProPresenter as a target under **screen**, appearing by itself when its API
 * answers on this computer and leaving when it stops.
 *
 * targets() is synchronous and discovery is not, so this keeps a probe going
 * in the background (every `everyMs`, cheap: one GET /version) and lists what
 * the last probe found. Choosing the target verifies it again at once, so the
 * list can say "ProPresenter ✓" before anyone leans on it.
 */
export const PROPRESENTER_TARGET_ID = 'app:propresenter'

export interface ProPresenterTargetOptions {
  own: ControlHost
  settings: () => { host?: string; port?: number }
  onProblem?: (ability: string, problem: string) => void
  fetch?: FetchLike
  /** Injected for tests; the real one asks the OS. */
  discover?: (opts: { host?: string; port?: number }) => Promise<string[]>
  everyMs?: number
  /** Start the background probe straight away (the app does; tests call probe() themselves). */
  autoStart?: boolean
}

export interface ProPresenterTargetHandle {
  /** The direct targets to hand switchableHost: one when ProPresenter answers, none otherwise. */
  list(): DirectTarget[]
  /** Look now; resolves to the base URL found, or null. */
  probe(): Promise<string | null>
  stop(): void
}

export function proPresenterTarget(opts: ProPresenterTargetOptions): ProPresenterTargetHandle {
  const discover = opts.discover ?? discoverProPresenter
  let found: { base: string; client: ProClient; description: string } | null = null
  let probing: Promise<string | null> | null = null
  let host: ControlHost | null = null

  async function probe(): Promise<string | null> {
    if (probing) return probing
    probing = (async () => {
      const { host: h, port } = opts.settings()
      // A pinned port is tried alone; otherwise every open port at once, and the one that speaks the API wins.
      const candidates = await discover({ host: h, port })
      const answers = await Promise.all(candidates.map(async (base) => {
        const client = proClient({ base, fetch: opts.fetch, timeoutMs: 2500 })
        try {
          const v = await client.version()
          return v && typeof v.api_version === 'string' ? { base, client, description: v.host_description || 'ProPresenter' } : null
        } catch { return null }
      }))
      const hit = answers.find((a) => a !== null) ?? null
      if (hit) {
        if (!found || found.base !== hit.base) { host = null; found = hit }
        return hit.base
      }
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
        id: PROPRESENTER_TARGET_ID,
        name: 'ProPresenter',
        host: () => (host ??= proPresenterHost({ client: current.client, own: opts.own, onProblem: opts.onProblem })),
        verify: async () => {
          try {
            const v = await current.client.version()
            return v && typeof v.api_version === 'string' ? { ok: true, broken: [] } : { ok: false, broken: [`${current.base} answered, but not as ProPresenter's API`] }
          } catch (e) {
            return { ok: false, broken: [e instanceof Error ? e.message : String(e)] }
          }
        },
      }]
    },
  }
}
