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

import { matchesChristianSong, songSearchTerms } from '../../shared/christianSongs'
import { firstSungLine } from '../../shared/lyricSplit'

const BASE = 'https://lrclib.net/api'
/**
 * LRCLIB asks clients to identify themselves — name, version and homepage —
 * and anonymous traffic is the first to be throttled. The version is filled
 * in at startup (`setLyricsClientVersion`), since this file is also loaded
 * by tests where there is no Electron app to ask.
 */
let userAgent = 'Trilorah (church presentation app; https://trilorah.com)'
export function setLyricsClientVersion(version: string): void {
  const v = String(version ?? '').trim()
  if (v) userAgent = `Trilorah v${v} (church presentation app; https://trilorah.com)`
}
const TIMEOUT_MS = 8000
const MAX_HITS = 25
/** A Retry-After longer than this is not worth holding a click for. */
const RETRY_MAX_S = 2
/** Long enough for a sweep across a page of cards and back. */
const BY_ID_CAP = 60
const MAX_INPUT = 200

export interface LyricsHit {
  id: number
  title: string
  artist: string
  album: string
  /** Seconds. 0 when LRCLIB does not know. */
  duration: number
  hasLyrics: boolean
}

/** 'busy' is LRCLIB saying "overloaded, retry in a moment" (503/429) — not an error, and not "no lyrics". */
export type LyricsFailureReason = 'offline' | 'not-found' | 'busy' | 'error'
export interface LyricsFailure {
  ok: false
  reason: LyricsFailureReason
  message: string
}
export type LyricsSearchResult = { ok: true; hits: LyricsHit[] } | LyricsFailure
export type LyricsGetResult = { ok: true; title: string; artist: string; lyrics: string } | LyricsFailure
/**
 * What a song card hears back: the record the click will open, by id, and
 * its opening line. The full words stay in this process until the click.
 */
export type LyricsPreviewResult = { ok: true; id: number; firstLine: string } | LyricsFailure
export type SongLyricsResult =
  | { ok: true; id: number; title: string; artist: string; lyrics: string; firstLine: string }
  | LyricsFailure

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

const BUSY: LyricsFailure = { ok: false, reason: 'busy', message: 'The lyrics service is busy. Try again in a moment.' }
const isBusy = (status: number) => status === 503 || status === 429

interface JsonReply {
  status: number
  body: unknown
  /** Seconds, when the server sent Retry-After as a number; a date form is ignored. */
  retryAfter: number | null
}

async function getJson(url: string): Promise<JsonReply> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: ctrl.signal
    })
    // The body is read inside the timeout: a stalled download is the same
    // dead spinner to the operator as a stalled connect.
    const body = await resp.json().catch(() => null)
    const ra = resp.headers?.get?.('retry-after')?.trim() ?? ''
    return { status: resp.status, body, retryAfter: /^\d+(\.\d+)?$/.test(ra) ? Number(ra) : null }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * One retry, only when asked and only when LRCLIB names a short wait. A
 * click asks: the operator is waiting on that answer. A card's hover never
 * does, because the moments LRCLIB is overloaded are exactly when a sweep of
 * hovers doubling its traffic would hurt most.
 */
async function getJsonPolite(url: string, opts: { retry: boolean }): Promise<JsonReply> {
  const first = await getJson(url)
  if (!opts.retry || !isBusy(first.status) || first.retryAfter === null || first.retryAfter > RETRY_MAX_S) return first
  await new Promise((resolve) => setTimeout(resolve, first.retryAfter! * 1000))
  return getJson(url)
}

export async function searchLyrics(query: string): Promise<LyricsSearchResult> {
  const q = (query ?? '').trim()
  if (!q) return { ok: true, hits: [] }
  try {
    const { status, body } = await getJsonPolite(`${BASE}/search?q=${encodeURIComponent(q)}`, { retry: true })
    if (isBusy(status)) return BUSY
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
  // A card that was hovered, or clicked, already brought these words back
  // with its search: the click opens them without asking LRCLIB twice.
  const kept = BY_ID.get(id)
  if (kept) {
    BY_ID.delete(id)
    BY_ID.set(id, kept)
    return { ok: true, ...kept }
  }
  try {
    const { status, body } = await getJsonPolite(`${BASE}/get/${encodeURIComponent(String(id))}`, { retry: true })
    if (status === 404) return { ok: false, reason: 'not-found', message: 'That song is no longer in the lyrics catalogue.' }
    if (isBusy(status)) return BUSY
    if (status >= 400) return { ok: false, reason: 'error', message: `The lyrics service answered with an error (${status}).` }
    const r = body as LrclibRecord | null
    const lyrics = r?.plainLyrics?.trim()
    if (!r || !lyrics) return { ok: false, reason: 'not-found', message: 'That entry has no lyrics.' }
    return { ok: true, title: r.trackName ?? '', artist: r.artistName ?? '', lyrics }
  } catch (err) {
    return failureFrom(err)
  }
}

/* ------------------------------------------------------------------ */
/* One song, one request                                               */
/* ------------------------------------------------------------------ */

/**
 * Words found by a card's search, by LRCLIB id, newest last. A click on the
 * card asks `getLyrics(id)` and is answered from here, so a hover followed
 * by a click is one request, not three. Capped: a session of browsing should
 * not hold two hundred songs' words in memory.
 */
const BY_ID = new Map<number, { title: string; artist: string; lyrics: string }>()
/** Identical searches already on the wire, joined rather than repeated. */
const PENDING = new Map<string, Promise<SongLyricsResult>>()

/** Forget everything kept above. For tests, which must not depend on run order. */
export function clearLyricsCache(): void {
  BY_ID.clear()
  PENDING.clear()
}

/**
 * The record a song card stands for: the first, in LRCLIB's own best-match
 * order, that has words and passes the same title/artist check the card
 * would. Unlike `toHits` there is no folding of duplicates — folding keys on
 * the title with every bracket stripped, so "Song" would swallow a later
 * "Song (Subtitle)" and the card that IS "Song (Subtitle)" would find
 * nothing.
 *
 * A match whose text has no sung line in it (labels only, "[Instrumental]")
 * is passed over for the next one: it would open in the editor as "no words
 * in that", while a later record of the same song may be whole.
 */
export function pickRecord(
  records: LrclibRecord[],
  song: { title: string; artist: string }
): (LrclibRecord & { id: number; trackName: string; plainLyrics: string; firstLine: string }) | null {
  for (const r of records) {
    if (typeof r?.id !== 'number' || !r.trackName) continue
    if (r.instrumental || !r.plainLyrics?.trim()) continue
    if (!matchesChristianSong({ title: r.trackName, artist: r.artistName ?? '' }, song)) continue
    const firstLine = firstSungLine(r.plainLyrics)
    if (!firstLine) continue
    return { ...(r as LrclibRecord & { id: number; trackName: string; plainLyrics: string }), firstLine }
  }
  return null
}

/**
 * The words for one song card, in a single LRCLIB request. Hover and click
 * both come through here, with the same query and the same pick, so the
 * line a card shows is from the record its click opens.
 */
export function findSongLyrics(title: string, artist: string, opts: { retry?: boolean } = {}): Promise<SongLyricsResult> {
  const song = { title: String(title ?? '').trim().slice(0, MAX_INPUT), artist: String(artist ?? '').trim().slice(0, MAX_INPUT) }
  const q = songSearchTerms(song)
  const retry = !!opts.retry
  if (!song.title) return Promise.resolve({ ok: false, reason: 'not-found', message: 'No song was chosen.' })
  const key = `${retry ? 'r' : '-'}|${q.toLowerCase()}|${song.title.toLowerCase()}|${song.artist.toLowerCase()}`
  const pending = PENDING.get(key)
  if (pending) return pending
  const run = (async (): Promise<SongLyricsResult> => {
    try {
      const { status, body } = await getJsonPolite(`${BASE}/search?q=${encodeURIComponent(q)}`, { retry })
      if (isBusy(status)) return BUSY
      if (status >= 400) return { ok: false, reason: 'error', message: `The lyrics service answered with an error (${status}).` }
      if (!Array.isArray(body)) return { ok: false, reason: 'error', message: 'The lyrics service sent something unreadable.' }
      const r = pickRecord(body as LrclibRecord[], song)
      // Nothing that is this song with words to sing: say so now, rather than
      // let the click open "no words in that".
      if (!r) return { ok: false, reason: 'not-found', message: `No lyrics found for ${song.title}.` }
      const kept = { title: r.trackName, artist: r.artistName ?? '', lyrics: r.plainLyrics.trim() }
      BY_ID.delete(r.id)
      BY_ID.set(r.id, kept)
      while (BY_ID.size > BY_ID_CAP) BY_ID.delete(BY_ID.keys().next().value as number)
      return { ok: true, id: r.id, ...kept, firstLine: r.firstLine }
    } catch (err) {
      return failureFrom(err)
    } finally {
      PENDING.delete(key)
    }
  })()
  PENDING.set(key, run)
  return run
}

/** `findSongLyrics` trimmed to what crosses IPC: the id and one line, never the whole song. */
export async function lyricsPreview(title: string, artist: string, opts: { retry?: boolean } = {}): Promise<LyricsPreviewResult> {
  const r = await findSongLyrics(title, artist, opts)
  return r.ok ? { ok: true, id: r.id, firstLine: r.firstLine } : r
}
