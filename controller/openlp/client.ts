/**
 * OpenLP's own door — door 1 of the three in controller/README.md.
 *
 * OpenLP 3 serves an HTTP API on the laptop (port 4316 unless the church
 * changed it under Settings › Remote; no login unless they turned one on).
 * It searches its own songs and Bibles, puts an item live, steps slides and
 * blanks the screen — everything the five abilities need, in milliseconds,
 * with none of the window-finding that its UI Automation makes so slow.
 *
 * Checked against OpenLP 3.1.7 on Windows, 2026-11-23. Its UI Automation
 * tree also went dark for whole minutes at a time that day; the API never did.
 */
import type { FetchLike } from '../propresenter/client'

export interface OpenLpSystem { api_version: number; api_revision: number; login_required: boolean; websocket_port: number }

/** A song search hit: `[id, title, alternate title]`. */
export type OpenLpSongHit = [number, string, string]
/** A Bible search hit: `[reference as OpenLP spells it, verse text]`. The reference is its id. */
export type OpenLpBibleHit = [string, string]

export interface OpenLpLiveItem {
  title: string
  name: string
  slides: Array<{ tag: string; title: string; selected: boolean; text: string }>
  id: string
}

export interface OpenLpClientOptions {
  /** `http://127.0.0.1:4316` — no trailing slash, no /api path. */
  base: string
  fetch?: FetchLike
  timeoutMs?: number
}

export function openLpClient(opts: OpenLpClientOptions) {
  const base = opts.base.replace(/\/+$/, '') + '/api/v2'
  const fetchFn: FetchLike = opts.fetch ?? (globalThis.fetch as unknown as FetchLike)
  const timeoutMs = opts.timeoutMs ?? 6000

  async function call<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetchFn(base + path, {
        method,
        ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
        signal: ctl.signal,
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`OpenLP answered ${res.status} to ${method} ${path}${text ? `: ${text.replace(/<[^>]+>/g, ' ').trim().slice(0, 120)}` : ''}`)
      if (!text.trim()) return undefined as T
      return JSON.parse(text) as T
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw new Error(`OpenLP did not answer ${path} within ${timeoutMs} ms`)
      if (e instanceof Error && /answered \d+/.test(e.message)) throw e
      throw new Error(`could not reach OpenLP at ${opts.base} — is it open, with its Remote plugin on?`)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    base: opts.base,
    system: () => call<OpenLpSystem>('/core/system'),
    searchSongs: (text: string) => call<OpenLpSongHit[]>(`/plugins/songs/search?text=${encodeURIComponent(text)}`),
    searchBibles: (text: string) => call<OpenLpBibleHit[]>(`/plugins/bibles/search?text=${encodeURIComponent(text)}`),
    songLive: (id: number) => call<void>('/plugins/songs/live', 'POST', { id }),
    bibleLive: (id: string) => call<void>('/plugins/bibles/live', 'POST', { id }),
    /** Steps the live item's slides. */
    progress: (action: 'next' | 'previous') => call<void>('/controller/progress', 'POST', { action }),
    /** blank = black, theme = theme only, desktop = hide, show = back on. */
    display: (display: 'blank' | 'theme' | 'desktop' | 'show') => call<void>('/core/display', 'POST', { display }),
    liveItem: () => call<OpenLpLiveItem | Record<string, never>>('/controller/live-items'),
  }
}

export type OpenLpClient = ReturnType<typeof openLpClient>
