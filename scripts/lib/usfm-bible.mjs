import { inflateRawSync } from 'node:zlib'

export const KJV_USFM_URL = 'https://ebible.org/Scriptures/eng-kjv2006_usfm.zip'
// Explicit IDs preserve the application's existing 66-book canon/order.
export const CANON = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ')
export const CHAPTER_COUNTS = [50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22]

/** Read ordinary stored/deflated ZIPs in memory; never extract archive paths. */
export function readZipEntries(input) {
  const bytes = Buffer.from(input)
  let end = -1
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65_557); at--) {
    if (bytes.readUInt32LE(at) === 0x06054b50) { end = at; break }
  }
  if (end < 0) throw new Error('ZIP directory is missing')
  const count = bytes.readUInt16LE(end + 10)
  let at = bytes.readUInt32LE(end + 16)
  if (count > 200 || bytes.readUInt16LE(end + 4) !== 0) throw new Error('Unsupported ZIP layout')
  const entries = new Map()
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(at) !== 0x02014b50) throw new Error('Invalid ZIP entry')
    const flags = bytes.readUInt16LE(at + 8), compression = bytes.readUInt16LE(at + 10)
    const compressed = bytes.readUInt32LE(at + 20), size = bytes.readUInt32LE(at + 24)
    const nameLength = bytes.readUInt16LE(at + 28), extra = bytes.readUInt16LE(at + 30), comment = bytes.readUInt16LE(at + 32)
    const local = bytes.readUInt32LE(at + 42)
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    if ((flags & 1) || ![0, 8].includes(compression) || size > 20_000_000) throw new Error(`Unsupported ZIP entry ${name}`)
    if (bytes.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid ZIP local header')
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    if (start + compressed > bytes.length) throw new Error('Truncated ZIP entry')
    const payload = bytes.subarray(start, start + compressed)
    const data = compression === 8 ? inflateRawSync(payload, { maxOutputLength: 20_000_000 }) : payload
    if (data.length !== size) throw new Error(`ZIP size mismatch for ${name}`)
    if (entries.has(name)) throw new Error(`Duplicate ZIP entry ${name}`)
    entries.set(name, data.toString('utf8').replace(/^\uFEFF/, ''))
    at += 46 + nameLength + extra + comment
  }
  return entries
}

function plainUsfm(text) {
  return text
    .replace(/\\\+?w\s+([^|\\]+)(?:\|[^\\]*)?\\\+?w\*/g, '$1')
    .replace(/\\\+?[a-z]+\d*\*?\s*/g, ' ')
    .replace(/¶/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

/** Return [bookId, chapter, EXPLICIT verse number, text] rows. */
export function parseUsfmBook(input) {
  const code = input.match(/\\id\s+(\w+)/)?.[1]
  const bookId = CANON.indexOf(code)
  if (bookId < 0) return []
  const text = input
    .replace(/\\f\s[\s\S]*?\\f\*|\\x\s[\s\S]*?\\x\*/g, '')
    /* A heading line, with or without words after it. `\s` here once let a
       bare `\d` swallow the newline and the `\v 1` under it (BSB Zechariah
       12:1 vanished). Spaces and tabs only; the KJV parses byte-identical. */
    .replace(/^\\(?:s\d*|d|r|mr|ms\d*|mt\d*|qa|sp|toc\d*|h|id|ide|rem)(?:[ \t].*)?$/gm, '')
  const markers = [...text.matchAll(/\\(c|v)\s+(\d+)(?=\s)/g)]
  const rows = []
  let chapter = 0
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]
    if (marker[1] === 'c') { chapter = Number(marker[2]); continue }
    if (!chapter) throw new Error(`Verse before first chapter in ${code}`)
    const verse = Number(marker[2])
    const start = marker.index + marker[0].length
    const content = plainUsfm(text.slice(start, markers[i + 1]?.index ?? text.length))
    if (!content || /\\|strong=|\|/.test(content)) throw new Error(`Unclean or empty text at ${code} ${chapter}:${verse}`)
    rows.push([bookId, chapter, verse, content])
  }
  return rows
}

export function validateKjvRows(rows) {
  if (rows.length !== 31_102) throw new Error(`KJV must have 31,102 explicitly numbered verses; got ${rows.length}`)
  const chapters = new Map()
  const byReference = new Map()
  for (const [book, chapter, verse, text] of rows) {
    if (!Number.isInteger(book) || !Number.isInteger(chapter) || !Number.isInteger(verse)
      || book < 0 || book >= 66 || chapter < 1 || chapter > CHAPTER_COUNTS[book] || verse < 1 || !text.trim()) throw new Error('Invalid KJV row')
    const ref = `${book}:${chapter}:${verse}`
    if (byReference.has(ref)) throw new Error(`Duplicate KJV verse ${ref}`)
    byReference.set(ref, text)
    const chapterId = `${book}:${chapter}`
    const verses = chapters.get(chapterId) ?? []
    verses.push(verse)
    chapters.set(chapterId, verses)
  }
  if (chapters.size !== 1189) throw new Error(`KJV must have 1,189 chapters; got ${chapters.size}`)
  for (let book = 0; book < 66; book++) {
    for (let chapter = 1; chapter <= CHAPTER_COUNTS[book]; chapter++) {
      const verses = chapters.get(`${book}:${chapter}`)?.sort((a, b) => a - b)
      if (!verses || verses.some((verse, i) => verse !== i + 1)) throw new Error(`Missing KJV number in ${CANON[book]} ${chapter}`)
    }
  }
  for (const [ref, expected] of [
    ['39:26:40', 'And he cometh unto the disciples'],
    ['39:26:41', 'Watch and pray, that ye enter not into temptation'],
    ['40:4:40', 'Why are ye so fearful'],
    ['40:4:41', 'And they feared exceedingly'],
    ['42:3:16', 'For God so loved the world'],
  ]) {
    if (!byReference.get(ref)?.includes(expected)) throw new Error(`KJV numbering regression at ${ref}`)
  }
  return rows
}

export function parseKjvArchive(bytes) {
  const rows = [...readZipEntries(bytes)].flatMap(([name, text]) => name.endsWith('.usfm') ? parseUsfmBook(text) : [])
  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  return validateKjvRows(rows)
}
