import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { app } from 'electron'

/*
 * Stock backgrounds — search a free photo/video library from inside the app.
 *
 * Two providers behind one shape. Pixabay is what we have a key for today;
 * Pexels is the one we want long-term (video + a raised limit on request)
 * and slots in the moment PEXELS_API_KEY exists. The renderer never sees
 * which one answered beyond the credit line.
 *
 * Every search is cached on disk for a week. The rate limits on these APIs
 * are per key per hour and Trilorah ships one key to every church, so the
 * only thing that keeps a worldwide install inside a free tier is that ten
 * thousand operators typing "mountain sunrise" cost one call. Pixabay's
 * terms in fact REQUIRE a 24h cache; this is that, with margin.
 *
 * Picking a result downloads the file into userData/backgrounds, the same
 * folder the native picker copies into — the projector must never depend on
 * the church's wifi once the service has started.
 */

export type StockKind = 'photo' | 'video'
export type StockProvider = 'pixabay' | 'pexels'

export interface StockItem {
  /** `${provider}:${id}` — stable across searches. */
  id: string
  provider: StockProvider
  kind: StockKind
  /** Small, for the grid. Video: a poster frame. */
  thumb: string
  /** ~1280 wide — a photo can be shown from this while `full` downloads. */
  preview: string
  /** What gets downloaded and kept. */
  full: string
  width: number
  height: number
  /** Seconds; video only. */
  duration?: number
  credit: string
  pageUrl: string
  tags: string
}

export interface StockSearchParams {
  query: string
  kind?: StockKind
  page?: number
  provider?: StockProvider
}

export interface StockSearchResult {
  items: StockItem[]
  page: number
  total: number
  provider: StockProvider
  cached: boolean
}

const PER_PAGE = 30
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function keyFor(provider: StockProvider): string | undefined {
  const key =
    provider === 'pexels' ? process.env.PEXELS_API_KEY : process.env.PIXABAY_API_KEY
  return key && key.trim() ? key.trim() : undefined
}

/** Which providers have a key right now — the UI's "add a key" empty state
    reads this rather than finding out by failing a search. */
export function stockProviders(): StockProvider[] {
  return (['pexels', 'pixabay'] as StockProvider[]).filter((p) => keyFor(p))
}

/* "Mountain  Sunrise" and "sunrise mountain" are the same search and must
   hit the same cache entry — the whole point of the cache is that operators
   converge on a few hundred phrasings. */
function normalise(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

function cacheDir(): string {
  const dir = path.join(app.getPath('userData'), 'stock-cache')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function cachePath(provider: StockProvider, kind: StockKind, q: string, page: number): string {
  const hash = createHash('sha1').update(`${provider}|${kind}|${q}|${page}`).digest('hex')
  return path.join(cacheDir(), `${hash}.json`)
}

function readCache(file: string): StockSearchResult | null {
  try {
    if (!fs.existsSync(file)) return null
    const { at, result } = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (Date.now() - at > CACHE_TTL_MS) return null
    return { ...result, cached: true }
  } catch {
    return null
  }
}

function writeCache(file: string, result: StockSearchResult): void {
  try {
    fs.writeFileSync(file, JSON.stringify({ at: Date.now(), result }))
  } catch {
    /* a failed cache write is not a failed search */
  }
}

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers })
  if (res.status === 429) throw new Error('stock library is busy — try again in a minute')
  if (res.status === 401 || res.status === 403) throw new Error('stock library rejected the API key')
  if (!res.ok) throw new Error(`stock library error ${res.status}`)
  return res.json()
}

async function searchPixabay(
  key: string,
  q: string,
  kind: StockKind,
  page: number
): Promise<StockSearchResult> {
  const common = `key=${key}&q=${encodeURIComponent(q)}&safesearch=true&per_page=${PER_PAGE}&page=${page}&order=popular`
  if (kind === 'photo') {
    const data = await getJson(
      `https://pixabay.com/api/?${common}&image_type=photo&orientation=horizontal&min_width=1280`
    )
    return {
      provider: 'pixabay',
      page,
      total: data.totalHits ?? 0,
      cached: false,
      items: (data.hits ?? []).map(
        (h: any): StockItem => ({
          id: `pixabay:${h.id}`,
          provider: 'pixabay',
          kind: 'photo',
          thumb: h.webformatURL,
          preview: h.largeImageURL,
          full: h.largeImageURL,
          width: h.imageWidth,
          height: h.imageHeight,
          credit: h.user ? `${h.user} · pixabay` : 'pixabay',
          pageUrl: h.pageURL,
          tags: h.tags ?? ''
        })
      )
    }
  }
  const data = await getJson(`https://pixabay.com/api/videos/?${common}&video_type=film`)
  return {
    provider: 'pixabay',
    page,
    total: data.totalHits ?? 0,
    cached: false,
    items: (data.hits ?? [])
      .map((h: any): StockItem | null => {
        const v = h.videos ?? {}
        const full = v.large?.url ? v.large : v.medium
        const preview = v.medium?.url ? v.medium : v.small
        const poster = v.tiny?.thumbnail ?? v.small?.thumbnail ?? v.medium?.thumbnail
        if (!full?.url || !poster) return null
        return {
          id: `pixabay:${h.id}`,
          provider: 'pixabay',
          kind: 'video',
          thumb: poster,
          preview: preview.url,
          full: full.url,
          width: full.width,
          height: full.height,
          duration: h.duration,
          credit: h.user ? `${h.user} · pixabay` : 'pixabay',
          pageUrl: h.pageURL,
          tags: h.tags ?? ''
        }
      })
      .filter(Boolean)
  }
}

async function searchPexels(
  key: string,
  q: string,
  kind: StockKind,
  page: number
): Promise<StockSearchResult> {
  const headers = { Authorization: key }
  const common = `query=${encodeURIComponent(q)}&orientation=landscape&per_page=${PER_PAGE}&page=${page}`
  if (kind === 'photo') {
    const data = await getJson(`https://api.pexels.com/v1/search?${common}`, headers)
    return {
      provider: 'pexels',
      page,
      total: data.total_results ?? 0,
      cached: false,
      items: (data.photos ?? []).map(
        (p: any): StockItem => ({
          id: `pexels:${p.id}`,
          provider: 'pexels',
          kind: 'photo',
          thumb: p.src.medium,
          preview: p.src.large,
          full: p.src.large2x,
          width: p.width,
          height: p.height,
          credit: p.photographer ? `${p.photographer} · pexels` : 'pexels',
          pageUrl: p.url,
          tags: p.alt ?? ''
        })
      )
    }
  }
  const data = await getJson(`https://api.pexels.com/videos/search?${common}`, headers)
  return {
    provider: 'pexels',
    page,
    total: data.total_results ?? 0,
    cached: false,
    items: (data.videos ?? [])
      .map((v: any): StockItem | null => {
        const files = (v.video_files ?? [])
          .filter((f: any) => f.file_type === 'video/mp4' && f.width)
          .sort((a: any, b: any) => b.width - a.width)
        const full = files.find((f: any) => f.width <= 1920) ?? files[files.length - 1]
        const preview = files.find((f: any) => f.width <= 1280) ?? full
        if (!full) return null
        return {
          id: `pexels:${v.id}`,
          provider: 'pexels',
          kind: 'video',
          thumb: v.image,
          preview: preview.link,
          full: full.link,
          width: full.width,
          height: full.height,
          duration: v.duration,
          credit: v.user?.name ? `${v.user.name} · pexels` : 'pexels',
          pageUrl: v.url,
          tags: ''
        }
      })
      .filter(Boolean)
  }
}

/* ------------------------------------------------------------------ */
/* Public                                                              */
/* ------------------------------------------------------------------ */

export async function searchStock(params: StockSearchParams): Promise<StockSearchResult> {
  const kind = params.kind ?? 'photo'
  const page = Math.max(1, params.page ?? 1)
  const q = normalise(params.query)
  if (!q) return { items: [], page, total: 0, provider: 'pixabay', cached: false }

  const available = stockProviders()
  const provider = params.provider && available.includes(params.provider) ? params.provider : available[0]
  if (!provider) throw new Error('no stock library key — add a Pixabay or Pexels key in settings')

  const file = cachePath(provider, kind, q, page)
  const hit = readCache(file)
  if (hit) return hit

  const key = keyFor(provider)!
  const result =
    provider === 'pexels'
      ? await searchPexels(key, q, kind, page)
      : await searchPixabay(key, q, kind, page)
  writeCache(file, result)
  return result
}

function extFor(item: StockItem): string {
  if (item.kind === 'video') return '.mp4'
  const m = /\.(jpe?g|png|webp)(?:$|\?)/i.exec(item.full)
  return m ? `.${m[1].toLowerCase()}` : '.jpg'
}

/**
 * Keep a copy. Same folder and same file:// `url` as the native picker, so
 * whatever consumes `defaultBackgroundUrl` cannot tell the two apart.
 */
export async function downloadStock(
  item: StockItem
): Promise<{ url: string; src: string; path: string }> {
  const dir = path.join(app.getPath('userData'), 'backgrounds')
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `stock-${item.id.replace(':', '-')}${extFor(item)}`)
  if (!fs.existsSync(dest)) {
    const res = await fetch(item.full)
    if (!res.ok) throw new Error(`could not download (${res.status})`)
    const buf = Buffer.from(await res.arrayBuffer())
    const tmp = `${dest}.part`
    fs.writeFileSync(tmp, buf)
    fs.renameSync(tmp, dest)
  }
  const posix = dest.split(path.sep).join('/')
  /* `src` is what an <img> in a window served from http:// can load — a
     file:// URL is blocked there; the app's own local-media scheme is not. */
  return { url: `file://${posix}`, src: `local-media://file${posix.startsWith('/') ? '' : '/'}${posix}`, path: dest }
}
