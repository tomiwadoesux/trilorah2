/**
 * ProPresenter's own door — door 1 of the three in controller/README.md.
 *
 * ProPresenter 7+ serves an HTTP API on the laptop (Preferences › Network ›
 * Enable Network). Where it exists it beats pressing buttons: no window to
 * find, no control that can be renamed, an answer in milliseconds, and the
 * app tells us what it is showing. This is the thin, typed slice of that API
 * Trilorah uses; everything else in the spec stays out until a Sunday needs it.
 *
 * Public spec: https://openapi.propresenter.com/swagger.json (API v1).
 * Checked against ProPresenter 22.0.1 on Windows, 2026-11-23.
 */

export interface ProId { uuid: string; name: string; index: number }

export interface ProMessageToken { name: string; uuid?: string; text?: { text: string } }

export interface ProMessage {
  id: ProId
  message: string
  tokens?: ProMessageToken[]
  theme: ProId
  visible_on_network: boolean
  is_active: boolean
}

export interface ProThemeSlide { id: ProId }
export interface ProTheme { id: ProId; slides?: ProThemeSlide[] }
/** The root 22.0.1 returns is a bare `{ groups }` with no id of its own. */
export interface ProThemeGroup { id?: ProId; groups?: ProThemeGroup[]; themes?: ProTheme[] }

export interface ProLayers {
  video_input: boolean; media: boolean; slide: boolean; announcements: boolean; props: boolean; messages: boolean; audio: boolean
}

export interface ProSlideStatus { current: { text: string; notes: string; uuid: string }; next: { text: string; notes: string; uuid: string } }

export interface ProVersion { name: string; platform: 'win' | 'mac' | 'unknown'; os_version: string; host_description: string; api_version: string }

export type ProLayer = 'audio' | 'props' | 'messages' | 'announcements' | 'slide' | 'media' | 'video_input'

/** The slice of fetch this client needs, so tests hand in a fake and the app hands in the real one. */
export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export interface ProClientOptions {
  /** `http://127.0.0.1:56094` — no trailing slash. */
  base: string
  fetch?: FetchLike
  /** One call's budget; ProPresenter answers in milliseconds when it answers at all. */
  timeoutMs?: number
}

const enc = (s: string) => encodeURIComponent(s)

export function proClient(opts: ProClientOptions) {
  const base = opts.base.replace(/\/+$/, '')
  const fetchFn: FetchLike = opts.fetch ?? (globalThis.fetch as unknown as FetchLike)
  const timeoutMs = opts.timeoutMs ?? 4000

  async function call<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetchFn(base + path, {
        method,
        ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
        signal: ctl.signal,
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`ProPresenter answered ${res.status} to ${method} ${path}${text ? `: ${text.slice(0, 120)}` : ''}`)
      if (!text.trim()) return undefined as T
      return JSON.parse(text) as T
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw new Error(`ProPresenter did not answer ${path} within ${timeoutMs} ms`)
      if (e instanceof Error && /answered \d+/.test(e.message)) throw e
      throw new Error(`could not reach ProPresenter at ${base} — is Enable Network on in its Preferences?`)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    base,
    version: () => call<ProVersion>('/version'),
    libraries: () => call<ProId[]>('/v1/libraries'),
    /** Every presentation in a library, by its UUID, name or index. */
    library: async (library: string) => (await call<{ items?: ProId[] }>(`/v1/library/${enc(library)}`))?.items ?? [],
    /** Puts one cue of one presentation on screen: index 0 is its first slide. */
    triggerCue: (library: string, presentation: string, index = 0) => call<void>(`/v1/library/${enc(library)}/${enc(presentation)}/${index}/trigger`),
    messages: () => call<ProMessage[]>('/v1/messages'),
    themes: () => call<ProThemeGroup | ProThemeGroup[]>('/v1/themes'),
    createMessage: (message: Omit<ProMessage, 'id'> & { id: Partial<ProId> & { name: string } }) => call<ProMessage>('/v1/messages', 'POST', message),
    /** Shows a message with these token values. Address it by UUID: by name, 22.0.1 says 204 and shows nothing. */
    triggerMessage: (uuid: string, tokens: ProMessageToken[]) => call<void>(`/v1/message/${enc(uuid)}/trigger`, 'POST', tokens),
    clearMessage: (uuid: string) => call<void>(`/v1/message/${enc(uuid)}/clear`),
    clearLayer: (layer: ProLayer) => call<void>(`/v1/clear/layer/${layer}`),
    next: () => call<void>('/v1/trigger/next'),
    previous: () => call<void>('/v1/trigger/previous'),
    layers: () => call<ProLayers>('/v1/status/layers'),
    slide: () => call<ProSlideStatus>('/v1/status/slide'),
  }
}

export type ProClient = ReturnType<typeof proClient>

/** Walks the theme tree for the first theme slide whose name matches, else the first slide at all. */
export function pickThemeSlide(tree: ProThemeGroup | ProThemeGroup[] | undefined, prefer: RegExp): ProId | null {
  const groups = Array.isArray(tree) ? tree : tree ? [tree] : []
  let first: ProId | null = null
  const walk = (g: ProThemeGroup): ProId | null => {
    for (const theme of g.themes ?? []) {
      for (const slide of theme.slides ?? []) {
        first ??= slide.id
        if (prefer.test(slide.id.name) || prefer.test(theme.id.name)) return slide.id
      }
    }
    for (const child of g.groups ?? []) { const hit = walk(child); if (hit) return hit }
    return null
  }
  for (const g of groups) { const hit = walk(g); if (hit) return hit }
  return first
}
