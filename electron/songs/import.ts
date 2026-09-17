/**
 * Song import parsers — ChordPro (incl. SongSelect exports), plain text and
 * OpenLyrics XML → one common shape. Pure string logic, no dependencies.
 */

export interface SongSection {
  label: string
  lines: string[]
}

export interface ImportedSong {
  title: string
  ccliNumber?: string
  authors?: string[]
  copyright?: string
  sections: SongSection[]
}

export type SongFormat = 'chordpro' | 'openlyrics' | 'plaintext'

/* ------------------------------------------------------------------ */
/* ChordPro                                                            */
/* ------------------------------------------------------------------ */

const SECTION_STARTS: Record<string, string> = {
  soc: 'Chorus',
  start_of_chorus: 'Chorus',
  sov: 'Verse',
  start_of_verse: 'Verse',
  sob: 'Bridge',
  start_of_bridge: 'Bridge',
  sot: 'Tab',
  start_of_tab: 'Tab',
  sop: 'Pre-Chorus',
  start_of_prechorus: 'Pre-Chorus',
  start_of_pre_chorus: 'Pre-Chorus',
  start_of_part: 'Part'
}
const SECTION_ENDS = new Set([
  'eoc', 'end_of_chorus', 'eov', 'end_of_verse', 'eob', 'end_of_bridge',
  'eot', 'end_of_tab', 'eop', 'end_of_prechorus', 'end_of_pre_chorus', 'end_of_part'
])

/** Strip `[G]`, `[Am7/C]` chord brackets and collapse leftover spacing. */
export function stripChords(line: string): string {
  return line.replace(/\[[^\]]*\]/g, '').replace(/[ \t]{2,}/g, ' ').trim()
}

/** "Verse 1", "Chorus", "Bridge 2", "Pre-Chorus" style labels on their own line. */
const LABEL_LINE = /^\s*(verse|chorus|bridge|pre[- ]?chorus|intro|outro|tag|ending|interlude|refrain|vamp|coda)\s*(\d+[a-z]?)?\s*:?\s*$/i

function normaliseLabel(m: RegExpMatchArray): string {
  const kind = m[1].toLowerCase().replace(/pre[- ]?chorus/, 'pre-chorus')
  const name = kind.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('-')
  return m[2] ? `${name} ${m[2]}` : name
}

export function parseChordPro(text: string): ImportedSong {
  const song: ImportedSong = { title: '', sections: [] }
  const authors: string[] = []
  const sections: SongSection[] = []
  let current: SongSection | null = null
  let pendingLabel: string | null = null
  let inTab = false
  let explicit = false
  const counters: Record<string, number> = {}

  const open = (label: string, isExplicit = false) => {
    current = { label, lines: [] }
    explicit = isExplicit
    sections.push(current)
  }
  const close = () => {
    current = null
    explicit = false
    pendingLabel = null
  }
  const autoLabel = (base: string) => {
    counters[base] = (counters[base] ?? 0) + 1
    return `${base} ${counters[base]}`
  }

  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    // Comments (# at column 0) are ignored.
    if (/^#/.test(line)) continue

    const directive = trimmed.match(/^\{\s*([a-zA-Z_]+)\s*(?::\s*(.*?))?\s*\}$/)
    if (directive) {
      const key = directive[1].toLowerCase()
      const value = (directive[2] ?? '').trim()
      switch (key) {
        case 'title':
        case 't':
          song.title = value
          break
        case 'subtitle':
        case 'st':
        case 'artist':
        case 'author':
        case 'composer':
        case 'lyricist':
          for (const a of value.split(/\s*[,;|]\s*|\s+\/\s+/)) if (a && !authors.includes(a)) authors.push(a)
          break
        case 'ccli':
        case 'ccli_number':
        case 'ccli_license':
          if (key !== 'ccli_license') song.ccliNumber = value.replace(/^#/, '')
          break
        case 'copyright':
          song.copyright = value
          break
        case 'comment':
        case 'c':
        case 'comment_italic':
        case 'ci':
        case 'comment_box':
        case 'cb': {
          // SongSelect writes "{c:Verse 1}" as a section marker.
          const m = value.match(LABEL_LINE)
          if (m) {
            pendingLabel = normaliseLabel(m)
            current = null
          }
          break
        }
        default:
          if (key in SECTION_STARTS) {
            const base = SECTION_STARTS[key]
            inTab = base === 'Tab'
            open(value || (base === 'Chorus' && !counters.Chorus ? (counters.Chorus = 1, 'Chorus') : autoLabel(base)), true)
          } else if (SECTION_ENDS.has(key)) {
            inTab = false
            close()
          }
          // key/tempo/time/capo/etc. — ignored.
      }
      continue
    }

    if (inTab) continue

    if (!trimmed) {
      // Blank line ends an implicit section (explicit ones end on {eoX}).
      if (current && !explicit) close()
      continue
    }

    const labelMatch = trimmed.match(LABEL_LINE)
    if (labelMatch) {
      pendingLabel = normaliseLabel(labelMatch)
      current = null
      continue
    }

    const lyric = stripChords(line)
    if (!lyric) continue
    if (!current) open(pendingLabel ?? autoLabel('Verse'))
    pendingLabel = null
    current!.lines.push(lyric)
  }

  song.sections = sections.filter((s) => s.lines.length > 0)
  if (authors.length) song.authors = authors
  if (!song.title) song.title = song.sections[0]?.lines[0] ?? 'Untitled'
  return song
}

/* ------------------------------------------------------------------ */
/* Plain text                                                          */
/* ------------------------------------------------------------------ */

/** A first line reads as a title when it's short, has no sentence punctuation
 *  and is followed by a blank line (or is the only line of its block). */
function looksLikeTitle(first: string, block: string[]): boolean {
  if (block.length !== 1) return false
  if (first.length > 60) return false
  if (/[.,;!?]$/.test(first)) return false
  return true
}

export function parsePlainText(text: string): ImportedSong {
  const blocks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length > 0)

  let title = ''
  if (blocks.length > 1 && looksLikeTitle(blocks[0][0], blocks[0])) {
    title = blocks.shift()![0]
  }

  const counters: Record<string, number> = {}
  const sections: SongSection[] = []
  for (const block of blocks) {
    let label: string | null = null
    const m = block[0].match(LABEL_LINE)
    if (m) {
      label = normaliseLabel(m)
      block.shift()
    }
    if (!block.length) continue
    if (!label) {
      counters.Verse = (counters.Verse ?? 0) + 1
      label = `Verse ${counters.Verse}`
    }
    sections.push({ label, lines: block })
  }
  if (!title) title = sections[0]?.lines[0] ?? 'Untitled'
  return { title, sections }
}

/* ------------------------------------------------------------------ */
/* OpenLyrics XML (regex based — no XML dependency in package.json)     */
/* ------------------------------------------------------------------ */

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

function tagText(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'))
  return m ? decodeEntities(m[1]).trim() : undefined
}

function allTags(xml: string, tag: string): { attrs: string; body: string }[] {
  const out: { attrs: string; body: string }[] = []
  const re = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push({ attrs: m[1] ?? '', body: m[2] })
  return out
}

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i')) ?? attrs.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i'))
  return m ? decodeEntities(m[1]) : undefined
}

const VERSE_NAMES: Record<string, string> = {
  v: 'Verse', c: 'Chorus', b: 'Bridge', p: 'Pre-Chorus', e: 'Ending', i: 'Intro', o: 'Outro', t: 'Tag'
}

function verseLabel(name: string | undefined): string {
  if (!name) return 'Verse'
  const m = name.match(/^([a-z])(\d*)([a-z]?)$/i)
  if (!m) return name
  const base = VERSE_NAMES[m[1].toLowerCase()] ?? name
  return m[2] ? `${base} ${m[2]}${m[3]}` : base
}

export function parseOpenLyrics(xml: string): ImportedSong {
  const song: ImportedSong = { title: '', sections: [] }
  const props = tagText(xml, 'properties') ?? ''
  song.title = allTags(props, 'title')[0] ? decodeEntities(allTags(props, 'title')[0].body).trim() : ''
  const authors = allTags(props, 'author').map((a) => decodeEntities(a.body).trim()).filter(Boolean)
  if (authors.length) song.authors = authors
  const ccli = tagText(props, 'ccliNo')
  if (ccli) song.ccliNumber = ccli
  const copyright = tagText(props, 'copyright')
  if (copyright) song.copyright = copyright

  const lyrics = tagText(xml, 'lyrics') ?? xml
  for (const verse of allTags(lyrics, 'verse')) {
    const label = verseLabel(attr(verse.attrs, 'name'))
    const lines: string[] = []
    for (const linesTag of allTags(verse.body, 'lines')) {
      const cleaned = linesTag.body
        .replace(/<chord\b[^>]*\/>/gi, '')
        .replace(/<chord\b[^>]*>[\s\S]*?<\/chord>/gi, '')
        .replace(/<comment\b[^>]*>[\s\S]*?<\/comment>/gi, '')
        .replace(/<tag\b[^>]*>([\s\S]*?)<\/tag>/gi, '$1')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
      for (const raw of cleaned.split('\n')) {
        const l = decodeEntities(raw).replace(/\s+/g, ' ').trim()
        if (l) lines.push(l)
      }
    }
    if (lines.length) song.sections.push({ label, lines })
  }
  if (!song.title) song.title = song.sections[0]?.lines[0] ?? 'Untitled'
  return song
}

/* ------------------------------------------------------------------ */

export function detectFormat(text: string, filename = ''): SongFormat {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (ext === 'xml' || /<song\b[^>]*xmlns=["']http:\/\/openlyrics\.info/i.test(text) || /<lyrics>[\s\S]*<verse\b/i.test(text)) {
    return 'openlyrics'
  }
  if (ext === 'cho' || ext === 'chopro' || ext === 'chordpro' || ext === 'crd' || ext === 'pro') return 'chordpro'
  if (/\{\s*(t|title|soc|start_of_chorus|c|comment|ccli)\s*[:}]/i.test(text) || /\[[A-G][#b]?(m|maj|min|sus|dim|aug|add)?\d*(\/[A-G][#b]?)?\]/.test(text)) {
    return 'chordpro'
  }
  return 'plaintext'
}

export function parseSong(text: string, filename = ''): ImportedSong {
  switch (detectFormat(text, filename)) {
    case 'openlyrics':
      return parseOpenLyrics(text)
    case 'chordpro':
      return parseChordPro(text)
    default:
      return parsePlainText(text)
  }
}
