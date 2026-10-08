/**
 * One chapter of YouVersion passage HTML → the verses in it.
 *
 * The Platform's `format=text` gives a whole chapter as one run of words with
 * no verse numbers, so a chapter has to come as HTML, where each verse starts
 * at an empty marker — `<span class="yv-v" v="16"></span>` — followed by its
 * printed number (`<span class="yv-vlbl">16</span>`). Everything from one
 * marker to the next is that verse, across paragraph and poetry-line breaks.
 *
 * Dropped, because none of it is the verse a congregation reads:
 * - the printed numbers themselves (yv-vlbl, va, vp);
 * - footnotes and cross references (yv-n, note, f, x), which can nest;
 * - headings, psalm titles, speaker and acrostic lines (yv-h, s1…, ms…, d,
 *   qa, sp, r…) — the same Psalm 119 "BETH" class of artefact the bundled
 *   cleaner removes from WEB and ASV;
 * - anything before the first marker (a chapter label or a psalm title).
 *
 * A tiny tag walker rather than a DOM: the main process has no DOMParser,
 * and an entity-expanding parser is not wanted on text from the network
 * (electron/songs/import.ts reads XML the same way, for the same reason).
 */

export interface ParsedVerse {
  verse: number
  text: string
}

/** Classes whose whole element (children included) is not verse text. */
const SKIP_CLASSES = new Set([
  'yv-vlbl', 'va', 'vp',
  'yv-n', 'note', 'f', 'fe', 'x', 'ft', 'fr', 'xo', 'xt',
  'yv-h', 'heading', 'd', 'qa', 'sp', 'cl', 'cp', 'c', 'h', 'rem',
  's', 's1', 's2', 's3', 's4', 'ms', 'ms1', 'ms2', 'ms3', 'ms4', 'mr', 'sr', 'r',
  'mt', 'mt1', 'mt2', 'mt3', 'mt4', 'toc1', 'toc2', 'toc3',
])
const SKIP_TAGS = new Set(['script', 'style', 'sup', 'template', 'noscript'])
const VOID_TAGS = new Set(['br', 'hr', 'img', 'wbr', 'input', 'meta', 'link', 'col', 'source'])
/** Tags whose edges are a word boundary (a poetry line, a paragraph). */
const BLOCK_TAGS = new Set(['div', 'p', 'br', 'li', 'tr', 'td', 'th', 'table', 'section', 'hr'])

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„',
  mdash: '—', ndash: '–', hellip: '…', middot: '·', thinsp: ' ', ensp: ' ', emsp: ' ',
  laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›', shy: '', zwj: '', zwnj: '',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(attrs)
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null
}

/** The words of one verse as a congregation reads them: single spaces, no space before punctuation. */
function tidy(text: string): string {
  return text
    .replace(/[\s  -   　]+/g, ' ')
    .replace(/ ([,.;:!?)\]])/g, '$1')
    .trim()
}

export function versesFromPassageHtml(html: string): ParsedVerse[] {
  const buffers = new Map<number, string[]>()
  let current: number | null = null
  /** Open elements, each remembering whether it (or an ancestor) is skipped. */
  const stack: { tag: string; skip: boolean }[] = []
  const skipping = () => stack.length > 0 && stack[stack.length - 1].skip
  const append = (text: string) => {
    if (current === null || skipping()) return
    let parts = buffers.get(current)
    if (!parts) buffers.set(current, (parts = []))
    parts.push(text)
  }

  const token = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^>]*)?)\s*(\/?)>|([^<]+)|</g
  let m: RegExpExecArray | null
  while ((m = token.exec(html))) {
    const [whole, closing, rawTag, attrs = '', selfClosing, text] = m
    if (text !== undefined) {
      append(decodeEntities(text))
      continue
    }
    if (!rawTag) {
      if (whole === '<') append('<')
      continue // a comment or CDATA
    }
    const tag = rawTag.toLowerCase()
    if (closing) {
      // Pop to the matching element; stray closers are ignored.
      const at = stack.map((e) => e.tag).lastIndexOf(tag)
      if (at >= 0) stack.length = at
      if (BLOCK_TAGS.has(tag)) append(' ')
      continue
    }
    if (BLOCK_TAGS.has(tag)) append(' ')
    const classes = (attr(attrs, 'class') ?? '').split(/\s+/).filter(Boolean)
    /* A verse marker. "16-17" (a verse a translation joins with the next)
       counts as its first number; the other is simply absent, the way a
       verse a version omits is. */
    if (classes.includes('yv-v')) {
      const v = Number.parseInt(attr(attrs, 'v') ?? '', 10)
      if (Number.isSafeInteger(v) && v > 0 && !skipping()) current = v
    }
    if (VOID_TAGS.has(tag) || selfClosing || attrs.trimEnd().endsWith('/')) continue
    const skip = skipping() || SKIP_TAGS.has(tag) || classes.some((c) => SKIP_CLASSES.has(c))
    stack.push({ tag, skip })
  }

  return [...buffers.entries()]
    .map(([verse, parts]) => ({ verse, text: tidy(parts.join('')) }))
    .filter((row) => row.text.length > 0)
    .sort((a, b) => a.verse - b.verse)
}
