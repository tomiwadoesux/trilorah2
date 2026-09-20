/**
 * Lyrics from a YouTube video's captions.
 *
 * This leans on endpoints YouTube does not document and changes without
 * notice, so it is built to fail legibly rather than to never fail: two
 * independent routes to the caption list, a typed reason for every way it
 * can come back empty, and nothing thrown across IPC. The pure half (URL
 * parsing, player-response extraction, caption cleaning) is exported so it
 * can be tested without the network; when YouTube moves, the tests say
 * whether our parsing broke or their format did.
 *
 * Two routes, in this order, from what was observed in September 2026:
 *
 *  1. The innertube player endpoint posing as the Android app. Its caption
 *     URLs download without further ceremony.
 *  2. The watch page's embedded `ytInitialPlayerResponse`. It lists the same
 *     tracks, but its caption URLs carry `exp=xpe` and answer 200 with an
 *     EMPTY body unless the request brings a proof-of-origin token that only
 *     a real browser session can mint. So today it rescues the title and the
 *     "are there captions at all" answer, rarely the words — but it is the
 *     route that survives when YouTube retires an app client version, which
 *     is the more common breakage, so it stays as the fallback.
 */

const TIMEOUT_MS = 8000
/** The watch page is over a megabyte; on church wifi 8s is not always enough for it. */
const PAGE_TIMEOUT_MS = 15000

// A pinned app version is the fragile part of route 1: YouTube eventually
// refuses versions it considers too old. When captions stop working for
// every video at once, bumping this is the first thing to try.
const ANDROID_CLIENT_VERSION = '20.10.38'
const ANDROID_USER_AGENT = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 14)`
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export type CaptionsFailureReason = 'no-captions' | 'unavailable' | 'offline' | 'error'
export type YoutubeCaptionsResult =
  | { ok: true; title: string; author: string; lines: string[]; trackKind: 'manual' | 'auto' }
  | { ok: false; reason: CaptionsFailureReason; message: string }

export interface CaptionTrack {
  baseUrl?: string
  languageCode?: string
  /** 'asr' marks YouTube's own speech recognition; absent on uploaded tracks. */
  kind?: string
}

/** One entry of a json3 caption file. Window-setup events carry no `segs`. */
export interface CaptionEvent {
  tStartMs?: number
  segs?: { utf8?: string }[]
}

interface PlayerResponse {
  playabilityStatus?: { status?: string; reason?: string }
  videoDetails?: { title?: string; author?: string }
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } }
}

/* ------------------------------------------------------------------ */
/* Pure: URL → id                                                      */
/* ------------------------------------------------------------------ */

const ID = /^[0-9A-Za-z_-]{11}$/

/**
 * Parsed as a URL rather than matched with one regex: operators paste links
 * from share sheets, playlists and the mobile site, and a pattern that reads
 * `v=` anywhere in the string also reads it out of someone else's query
 * parameter on a page that is not YouTube at all.
 */
export function parseVideoId(urlOrId: string): string | null {
  const raw = (urlOrId ?? '').trim()
  if (!raw) return null
  if (ID.test(raw)) return raw

  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '')
  const parts = url.pathname.split('/').filter(Boolean)
  const ok = (s: string | null | undefined) => (s && ID.test(s) ? s : null)

  if (host === 'youtu.be') return ok(parts[0])
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null
  if (parts[0] === 'watch' || parts.length === 0) return ok(url.searchParams.get('v'))
  if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) return ok(parts[1])
  return null
}

/* ------------------------------------------------------------------ */
/* Pure: watch page → player response                                  */
/* ------------------------------------------------------------------ */

/**
 * Cuts the `ytInitialPlayerResponse` object literal out of the watch page.
 *
 * Brace-counted rather than regex-matched to `};`: the object contains
 * video descriptions, and a description is free text that may hold any
 * sequence a terminator regex would stop on.
 */
export function extractPlayerResponse(html: string): PlayerResponse | null {
  const marker = html.search(/ytInitialPlayerResponse\s*=\s*\{/)
  if (marker < 0) return null
  const start = html.indexOf('{', marker)
  let depth = 0
  let inString = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1)) as PlayerResponse
      } catch {
        return null
      }
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Pure: which track                                                   */
/* ------------------------------------------------------------------ */

/**
 * A person's captions beat the machine's, in any language, before English
 * ASR is considered: speech recognition on congregational singing over a
 * band is poor, and a church whose video has only Yoruba captions uploaded
 * almost certainly sings it in Yoruba.
 */
export function pickTrack(tracks: CaptionTrack[]): { track: CaptionTrack; kind: 'manual' | 'auto' } | null {
  const usable = tracks.filter((t) => t?.baseUrl)
  const isAuto = (t: CaptionTrack) => t.kind === 'asr'
  const isEn = (t: CaptionTrack) => (t.languageCode ?? '').toLowerCase().startsWith('en')
  const exactEn = (t: CaptionTrack) => (t.languageCode ?? '').toLowerCase() === 'en'
  const manual = usable.filter((t) => !isAuto(t))
  const auto = usable.filter(isAuto)
  const track =
    manual.find(exactEn) ?? manual.find(isEn) ?? manual[0] ?? auto.find(exactEn) ?? auto.find(isEn) ?? auto[0]
  return track ? { track, kind: isAuto(track) ? 'auto' : 'manual' } : null
}

/* ------------------------------------------------------------------ */
/* Pure: caption text → lyric lines                                    */
/* ------------------------------------------------------------------ */

const NAMED: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/**
 * `&amp;` is resolved FIRST, on purpose. YouTube double-encodes in places
 * (`&amp;#39;` for an apostrophe), and the usual amp-last order leaves a
 * literal `&#39;` on the projector. Over-decoding a lyric that genuinely
 * contained the text "&lt;" is a price nobody will ever pay.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => codePoint(parseInt(hex, 16), m))
    .replace(/&#(\d+);/g, (m, dec) => codePoint(parseInt(dec, 10), m))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m)
}

function codePoint(n: number, fallback: string): string {
  try {
    return String.fromCodePoint(n)
  } catch {
    return fallback
  }
}

/**
 * One caption line → one lyric line, or '' when nothing singable is left.
 *
 * Bracketed text is always a cue ([Music], [Applause], [♪♪♪]). Parenthesised
 * text is only dropped when it is a known cue word, because "(Holy, holy)"
 * is how lyric sheets write an echo and the congregation sings it.
 */
export function cleanCaptionLine(line: string): string {
  return decodeEntities(line)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?:music|applause|laughter|cheering|instrumental|singing|silence)[^)]*\)/gi, ' ')
    .replace(/[♪♫♬♩🎵🎶]/gu, ' ')
    .replace(/^\s*(?:>>+|-)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Removes the roll-up repetition in auto-captions.
 *
 * Auto-captions are authored for a two-line scrolling window, so successive
 * events re-show what is already on screen: "A", then "A / B", then "B",
 * then "B / C". Working per EVENT is what lets this tell that apart from a
 * chorus: a line is dropped only when it re-states the tail of the event
 * immediately before it (or grows it word by word), never because it
 * appeared somewhere earlier, and never within a single event — so
 * "Holy / Holy / Holy" inside one caption survives. What it cannot save is
 * a line genuinely sung twice across two consecutive auto-caption windows;
 * that reads identically to a roll-up, which is why this is applied to
 * auto tracks only.
 */
export function removeRollingRepeats(eventLines: string[][]): string[] {
  const out: string[] = []
  let prev: string[] = []
  for (const lines of eventLines) {
    if (lines.length === 0) continue
    // The longest run at the head of this event that repeats the tail of the last.
    let overlap = 0
    for (let n = Math.min(prev.length, lines.length); n > 0; n--) {
      if (prev.slice(-n).every((p, i) => same(p, lines[i]))) {
        overlap = n
        break
      }
    }
    let fresh = lines.slice(overlap)
    // Word-by-word growth: "you are" → "you are the word". Replace, don't append.
    if (overlap === 0 && out.length > 0 && prev.length > 0) {
      const last = out[out.length - 1]
      if (same(last, prev[prev.length - 1]) && lines[0].toLowerCase().startsWith(last.toLowerCase() + ' ')) {
        out[out.length - 1] = lines[0]
        fresh = lines.slice(1)
      }
    }
    out.push(...fresh)
    prev = lines
  }
  return out
}

/** Auto-captions break wherever the window filled, stranding words like "high" on their own line. */
const ORPHAN_WORDS = 2
const MERGED_MAX_WORDS = 12
const words = (s: string) => s.split(' ').filter(Boolean).length

/**
 * json3 events → lyric lines.
 *
 * Manual tracks are trusted as written: someone chose those line breaks.
 * Auto tracks get roll-up removal and their one- and two-word orphans folded
 * back into the line before. That is as far as this goes — the result for
 * an auto track is still caption-window chunks, not poetry, and the operator
 * is expected to tidy it in the editor. A cue such as [Music] is a real
 * pause, so nothing is folded across one.
 */
export function eventsToLines(events: CaptionEvent[], trackKind: 'manual' | 'auto'): string[] {
  const BREAK = '\u0000'
  const perEvent: string[][] = []
  for (const ev of events ?? []) {
    if (!Array.isArray(ev?.segs)) continue
    const text = ev.segs.map((s) => s?.utf8 ?? '').join('')
    const rawLines = text.split(/\r?\n/)
    const lines: string[] = []
    for (const raw of rawLines) {
      const cleaned = cleanCaptionLine(raw)
      if (cleaned) lines.push(cleaned)
      else if (raw.trim()) lines.push(BREAK)
    }
    if (lines.length) perEvent.push(lines)
  }

  if (trackKind === 'manual') return perEvent.flat().filter((l) => l !== BREAK)

  const merged: string[] = []
  let afterBreak = true
  for (const line of removeRollingRepeats(perEvent)) {
    if (line === BREAK) {
      afterBreak = true
      continue
    }
    const last = merged[merged.length - 1]
    if (!afterBreak && last && words(line) <= ORPHAN_WORDS && words(last) + words(line) <= MERGED_MAX_WORDS) {
      merged[merged.length - 1] = `${last} ${line}`
    } else {
      merged.push(line)
    }
    afterBreak = false
  }
  return merged
}

/** "Way Maker (Official Lyric Video)" is the video's name, not the song's. */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*\b(?:official|lyrics?|video|audio|live|hd|4k|visualizer)\b[^)\]]*[)\]]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Auto-generated artist channels are named "Sinach - Topic"; label channels end in VEVO. */
export function cleanAuthor(author: string): string {
  return author.replace(/\s+-\s+Topic$/i, '').replace(/VEVO$/i, '').trim()
}

/* ------------------------------------------------------------------ */
/* Network                                                             */
/* ------------------------------------------------------------------ */

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const resp = await fetch(url, { ...init, signal: ctrl.signal })
    return { status: resp.status, text: await resp.text() }
  } finally {
    clearTimeout(timer)
  }
}

async function playerViaInnertube(videoId: string): Promise<PlayerResponse | null> {
  const { status, text } = await timedFetch(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_USER_AGENT },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: ANDROID_CLIENT_VERSION, hl: 'en' } },
        videoId
      })
    },
    TIMEOUT_MS
  )
  if (status >= 400) return null
  try {
    return JSON.parse(text) as PlayerResponse
  } catch {
    return null
  }
}

async function playerViaWatchPage(videoId: string): Promise<PlayerResponse | null> {
  const { status, text } = await timedFetch(
    `https://www.youtube.com/watch?v=${videoId}&hl=en`,
    {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        // In the EU/UK a cookieless request is redirected to the consent
        // interstitial, which has no player response in it. This is the
        // "already answered" cookie; it grants nothing else.
        Cookie: 'SOCS=CAI; CONSENT=YES+1'
      }
    },
    PAGE_TIMEOUT_MS
  )
  return status >= 400 ? null : extractPlayerResponse(text)
}

/** Null means "YouTube answered but gave us nothing" — see the file header on `exp=xpe`. */
async function fetchEvents(track: CaptionTrack): Promise<CaptionEvent[] | null> {
  // `set`, not append: innertube URLs already carry fmt=srv3, and with two
  // fmt parameters YouTube honours the first and sends XML.
  const url = new URL(track.baseUrl as string)
  url.searchParams.set('fmt', 'json3')
  const { status, text } = await timedFetch(url.toString(), { headers: { 'User-Agent': BROWSER_USER_AGENT } }, TIMEOUT_MS)
  if (status >= 400 || !text.trim()) return null
  try {
    const parsed = JSON.parse(text) as { events?: CaptionEvent[] }
    return Array.isArray(parsed.events) ? parsed.events : null
  } catch {
    return null
  }
}

const fail = (reason: CaptionsFailureReason, message: string): YoutubeCaptionsResult => ({ ok: false, reason, message })

const UNAVAILABLE = 'YouTube would not give us this video. It may be private, age-restricted, removed, or blocked in this country.'
const NO_CAPTIONS = 'This video has no captions. Try an official lyric video, search for the lyrics, or paste them in.'

export async function youtubeCaptions(urlOrId: string): Promise<YoutubeCaptionsResult> {
  const videoId = parseVideoId(urlOrId)
  if (!videoId) return fail('error', 'That does not look like a YouTube link.')

  // The most specific thing learned along the way. A later route may only
  // improve on it, never overwrite "no captions" with a vaguer complaint.
  let verdict: YoutubeCaptionsResult = fail('error', 'YouTube did not answer in a form we understand. It may have changed; pasting the lyrics still works.')

  try {
    for (const route of [playerViaInnertube, playerViaWatchPage]) {
      const player = await route(videoId)
      if (!player) continue

      const status = player.playabilityStatus?.status
      if (status && status !== 'OK') {
        // Not final: LOGIN_REQUIRED is also how YouTube turns away an app
        // client it has decided is a bot, and the watch page may still open.
        verdict = fail('unavailable', player.playabilityStatus?.reason ? `${UNAVAILABLE} (YouTube says: ${player.playabilityStatus.reason})` : UNAVAILABLE)
        continue
      }

      const picked = pickTrack(player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [])
      // Final: a playable video with no tracks has none on the other route either.
      if (!picked) return fail('no-captions', NO_CAPTIONS)

      const events = await fetchEvents(picked.track)
      if (!events) {
        verdict = fail('error', 'This video has captions, but YouTube refused to hand them over. Search for the lyrics or paste them instead.')
        continue
      }

      const lines = eventsToLines(events, picked.kind)
      // A caption file of nothing but [Music] is an instrumental, as far as lyrics go.
      if (lines.length === 0) return fail('no-captions', NO_CAPTIONS)

      return {
        ok: true,
        title: cleanTitle(player.videoDetails?.title ?? '') || 'YouTube song',
        author: cleanAuthor(player.videoDetails?.author ?? ''),
        lines,
        trackKind: picked.kind
      }
    }
    return verdict
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') return fail('offline', 'YouTube took too long to answer. Check the internet connection.')
    if (e?.name === 'TypeError') return fail('offline', 'Could not reach YouTube. Check the internet connection.')
    return fail('error', e?.message ?? 'Could not read captions from YouTube.')
  }
}
