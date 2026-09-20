/**
 * Lyrics lookup against LRCLIB (https://lrclib.net/docs).
 *
 * LRCLIB is the source because it is free and keyless: a church on the free
 * tier gets lyric search without signing up for anything. The price is that
 * it is a volunteer-run catalogue built for music players — coverage of
 * mainstream worship is good, of a local choir's own songs nil — so every
 * failure here is an ordinary outcome the operator must be able to read, not
 * an exception. Nothing in this file throws across IPC.
 */

const BASE = 'https://lrclib.net/api'
/** LRCLIB asks clients to identify themselves; anonymous traffic is the first to be throttled. */
export const USER_AGENT = 'Trilorah (church presentation app)'
const TIMEOUT_MS = 8000
const MAX_HITS = 25

export interface LyricsHit {
  id: number
  title: string
  artist: string
  album: string
  /** Seconds. 0 when LRCLIB does not know. */
  duration: number
  hasLyrics: boolean
}

export type LyricsFailureReason = 'offline' | 'not-found' | 'error'
export interface LyricsFailure {
  ok: false
  reason: LyricsFailureReason
  message: string
}
export type LyricsSearchResult = { ok: true; hits: LyricsHit[] } | LyricsFailure
export type LyricsGetResult = { ok: true; title: string; artist: string; lyrics: string } | LyricsFailure

/** The slice of an LRCLIB record this file reads. Everything is optional because it is someone else's JSON. */
export interface LrclibRecord {
  id?: number
  trackName?: string
  artistName?: string
  albumName?: string
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

/**
 * Title+artist reduced to what a person would call "the same song".
 * Parentheticals go because LRCLIB holds "(Live)", "(Radio Edit)" and
 * "(Remastered 2014)" as separate records whose lyrics are word-for-word
 * identical, and twelve rows of one song bury the second song entirely.
 */
export function hitKey(title: string, artist: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[([][^)\]]*[)\]]/g, ' ')
      .replace(/\s+-\s+(live|remaster(ed)?|radio edit|acoustic)\b.*$/i, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  return `${norm(title)}|${norm(artist)}`
}

/**
 * Raw LRCLIB records → the list the operator picks from.
 *
 * Instrumentals and records without plain lyrics are dropped rather than
 * shown disabled: a row that cannot become slides is only a way to waste a
 * click mid-rehearsal. The first record of a duplicate group wins because
 * LRCLIB already returns results best-match first.
 */
export function toHits(records: LrclibRecord[], cap = MAX_HITS): LyricsHit[] {
  const seen = new Set<string>()
  const hits: LyricsHit[] = []
  for (const r of records) {
    if (typeof r?.id !== 'number' || !r.trackName) continue
    if (r.instrumental || !r.plainLyrics?.trim()) continue
    const key = hitKey(r.trackName, r.artistName ?? '')
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({
      id: r.id,
      title: r.trackName,
      artist: r.artistName ?? '',
      album: r.albumName ?? '',
      duration: typeof r.duration === 'number' ? r.duration : 0,
      hasLyrics: true
    })
    if (hits.length >= cap) break
  }
  return hits
}

/**
 * A fetch failure is 'offline' unless there is evidence otherwise. Node's
 * fetch reports DNS failure, refused connections and our own timeout all as
 * a bare TypeError/AbortError, and on a church laptop the honest reading of
 * every one of them is "check the internet".
 */
export function failureFrom(err: unknown): LyricsFailure {
  const e = err as { name?: string; message?: string } | null
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
    return { ok: false, reason: 'offline', message: 'The lyrics service took too long to answer. Check the internet connection.' }
  }
  if (e?.name === 'TypeError') {
    return { ok: false, reason: 'offline', message: 'Could not reach the lyrics service. Check the internet connection.' }
  }
  return { ok: false, reason: 'error', message: e?.message ?? 'Lyrics lookup failed.' }
}

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal
    })
    // The body is read inside the timeout: a stalled download is the same
    // dead spinner to the operator as a stalled connect.
    const body = await resp.json().catch(() => null)
    return { status: resp.status, body }
  } finally {
    clearTimeout(timer)
  }
}

export async function searchLyrics(query: string): Promise<LyricsSearchResult> {
  const q = (query ?? '').trim()
  if (!q) return { ok: true, hits: [] }
  try {
    const { status, body } = await getJson(`${BASE}/search?q=${encodeURIComponent(q)}`)
    if (status >= 400) return { ok: false, reason: 'error', message: `The lyrics service answered with an error (${status}).` }
    if (!Array.isArray(body)) return { ok: false, reason: 'error', message: 'The lyrics service sent something unreadable.' }
    const hits = toHits(body as LrclibRecord[])
    if (hits.length === 0) {
      return { ok: false, reason: 'not-found', message: `No lyrics found for "${q}". Try the title with the artist, or paste the words instead.` }
    }
    return { ok: true, hits }
  } catch (err) {
    return failureFrom(err)
  }
}

export async function getLyrics(id: number): Promise<LyricsGetResult> {
  if (!Number.isFinite(id)) return { ok: false, reason: 'error', message: 'No song was chosen.' }
  try {
    const { status, body } = await getJson(`${BASE}/get/${encodeURIComponent(String(id))}`)
    if (status === 404) return { ok: false, reason: 'not-found', message: 'That song is no longer in the lyrics catalogue.' }
    if (status >= 400) return { ok: false, reason: 'error', message: `The lyrics service answered with an error (${status}).` }
    const r = body as LrclibRecord | null
    const lyrics = r?.plainLyrics?.trim()
    if (!r || !lyrics) return { ok: false, reason: 'not-found', message: 'That entry has no lyrics.' }
    return { ok: true, title: r.trackName ?? '', artist: r.artistName ?? '', lyrics }
  } catch (err) {
    return failureFrom(err)
  }
}
