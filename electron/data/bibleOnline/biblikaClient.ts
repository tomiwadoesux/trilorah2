/**
 * Biblika's passage source: https://github.com/biblika/biblika-api.
 * Its Heroku deployment is gone; api/passage.go reads this SABDA endpoint.
 * Used by the Bible builder to download NKJV/NLT into bible.db.
 */
import { CHAPTER_COUNTS } from '../../../shared/chapterCounts'
import { retryAfterMs } from './youversionClient'
import { versesFromPassageHtml, type ParsedVerse } from './youversionHtml'

export const SABDA_PASSAGE_API = 'https://alkitab.sabda.org/api/passage.php'
// Biblika's json/book.json abbreviations, in the app's zero-based book order.
export const SABDA_BOOKS = ('Gen|Exo|Lev|Num|Deu|Jos|Jdg|Rth|1 Sam|2 Sam|1 Kgs|2 Kgs|1 Chr|2 Chr|Ezr|Neh|Est|Job|Psa|Pro|Ecc|Sos|Isa|Jer|Lam|Eze|Dan|Hos|Joe|Amo|Oba|Jon|Mic|Nah|Hab|Zep|Hag|Zec|Mal|Mat|Mar|Luk|Joh|Act|Rom|1 Cor|2 Cor|Gal|Eph|Php|Col|1 The|2 The|1 Tim|2 Tim|Tit|Phm|Heb|Jam|1 Pet|2 Pet|1 Joh|2 Joh|3 Joh|Jud|Rev').split('|')

export class BiblikaError extends Error {
  constructor(readonly kind: 'not-found' | 'rate-limited' | 'timeout' | 'offline' | 'bad-response', message: string, readonly retryAfterMs = 60_000) {
    super(message)
    this.name = 'BiblikaError'
  }
}

/** SABDA includes book/chapter identity; never cache an error or a different passage. */
export function versesFromSabdaXml(xml: string, book: number, chapter: number): ParsedVerse[] {
  const bad = () => new BiblikaError('bad-response', 'SABDA returned an invalid chapter')
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || !/<bible[\s>]/.test(xml) || !/<\/bible>\s*$/.test(xml)) throw bad()
  if (Number(/<book_id>\s*(\d+)\s*<\/book_id>/.exec(xml)?.[1]) !== book + 1 ||
      Number(/<chap>\s*(\d+)\s*<\/chap>/.exec(xml)?.[1]) !== chapter ||
      (xml.match(/<chapter>/g)?.length ?? 0) !== 1) throw bad()
  const verses: ParsedVerse[] = []
  const seen = new Set<number>()
  for (const match of xml.matchAll(/<verse>([\s\S]*?)<\/verse>/g)) {
    const verse = Number(/<number>\s*(\d+)\s*<\/number>/.exec(match[1])?.[1])
    const raw = /<text>([\s\S]*?)<\/text>/.exec(match[1])?.[1]
    if (!Number.isSafeInteger(verse) || verse < 1 || verse > 176 || seen.has(verse) || raw === undefined) throw bad()
    // Reuse the main-process text walker for XML entities, HTML and footnotes.
    // SABDA also uses RTF-style inline emphasis toggles, e.g. \\i1 added\\i0.
    const text = versesFromPassageHtml(`<span class="yv-v" v="${verse}"></span>${raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')}`)[0]?.text
      .replace(/\\[ib][01]/g, '').replace(/\s+/g, ' ').trim()
    if (!text) throw bad()
    seen.add(verse)
    verses.push({ verse, text })
  }
  if (!verses.length || verses.length !== (xml.match(/<verse>/g)?.length ?? 0)) throw bad()
  return verses.sort((a, b) => a.verse - b.verse)
}

export class BiblikaClient {
  constructor(private readonly options: { fetch?: typeof fetch; timeoutMs?: number; userAgent?: string } = {}) {}

  async chapter(code: string, book: number, chapter: number): Promise<ParsedVerse[]> {
    return (await this.chapters(code, book, chapter, chapter))[0].verses
  }

  /** The upstream supports chapter ranges, avoiding a request per chapter during builds. */
  async chapters(code: string, book: number, first: number, last: number): Promise<{ chapter: number; verses: ParsedVerse[] }[]> {
    const version = code.toUpperCase()
    if (!['NKJV', 'NLT'].includes(version) || !Number.isSafeInteger(book) || book < 0 || book >= SABDA_BOOKS.length ||
        !Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last > CHAPTER_COUNTS[book]) {
      throw new BiblikaError('not-found', 'No such SABDA chapter')
    }
    const query = new URLSearchParams({ passage: `${SABDA_BOOKS[book]} ${first}${last === first ? '' : `-${last}`}`, ver: version.toLowerCase() })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10_000)
    try {
      const response = await (this.options.fetch ?? globalThis.fetch)(`${SABDA_PASSAGE_API}?${query}`, {
        signal: controller.signal,
        headers: { Accept: 'application/xml', ...(this.options.userAgent ? { 'User-Agent': this.options.userAgent } : {}) },
      })
      if (response.status === 429) throw new BiblikaError('rate-limited', 'SABDA asked us to wait', retryAfterMs(response.headers.get('retry-after')))
      if (response.status === 404) throw new BiblikaError('not-found', 'SABDA has no such chapter')
      if (!response.ok) throw new BiblikaError('offline', `SABDA returned ${response.status}`)
      const xml = await response.text()
      if (first === last) return [{ chapter: first, verses: versesFromSabdaXml(xml, book, first) }]
      const bad = () => new BiblikaError('bad-response', 'SABDA returned an invalid chapter range')
      const bookIds = [...xml.matchAll(/<book_id>\s*(\d+)\s*<\/book_id>/g)]
      if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || !/<bible[\s>]/.test(xml) || !/<\/bible>\s*$/.test(xml) ||
          !bookIds.length || bookIds.some((match) => Number(match[1]) !== book + 1)) throw bad()
      const chapters = [...xml.matchAll(/<chapter>([\s\S]*?)<\/chapter>/g)]
      if (chapters.length !== last - first + 1 || chapters.length !== (xml.match(/<chapter>/g)?.length ?? 0)) throw bad()
      return chapters.map((match, i) => {
        const chapter = first + i
        return { chapter, verses: versesFromSabdaXml(`<bible><book><book_id>${book + 1}</book_id><chapter>${match[1]}</chapter></book></bible>`, book, chapter) }
      })
    } catch (error) {
      if (error instanceof BiblikaError) throw error
      throw new BiblikaError(controller.signal.aborted ? 'timeout' : 'offline', 'Could not read the SABDA chapter')
    } finally {
      clearTimeout(timer)
    }
  }
}
