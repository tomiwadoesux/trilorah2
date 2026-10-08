/**
 * Public-domain Bibles from bible.helloao.org (eBible's own API): WEB, BSB, ASV.
 *
 * Kept apart from the build script so the text cleaning and the per-version
 * checks can be tested without the network (electron/data/bibleSources.test.ts),
 * and apart from the KJV USFM parser on purpose: that parser is guarded by
 * validateKjvRows and must keep producing a byte-identical KJV, so nothing a
 * modern translation needs is allowed to change it.
 *
 * A verse arrives as SEGMENTS: pieces of text, footnote references
 * (`{noteId}`), line breaks and formatting objects. The text is joined and
 * everything else dropped; a footnote number is a scholar's apparatus and has
 * no business on a wall in front of a congregation. A verse whose only content
 * is a footnote (ASV Matthew 17:21, "omitted in the best manuscripts") comes
 * out empty and is skipped, so the version simply has no row for it.
 */

import { createHash } from 'node:crypto'
import { CANON, CHAPTER_COUNTS } from './usfm-bible.mjs'

export const HELLOAO = 'https://bible.helloao.org/api'

/**
 * What the app ships from helloao, keyed by the code the app stores.
 * `expectedVerses` is the exact number of non-empty verses the build must
 * produce; a different count means the source changed and a person should
 * look before it reaches a church.
 */
export const HELLOAO_SOURCES = {
  WEB: {
    id: 'ENGWEBP',
    name: 'World English Bible',
    rights: 'Public domain (no copyright).',
    licenseUrl: 'https://ebible.org/Scriptures/details.php?id=engwebp',
    // 31,103 markers at the source; Luke 17:36, Acts 8:37, 15:34, 24:7 and Romans 16:25 carry only a footnote.
    expectedVerses: 31098,
  },
  BSB: {
    id: 'BSB',
    name: 'Berean Standard Bible',
    rights: 'Dedicated to the public domain on 30 April 2023; all uses freely permitted. Only the verbatim text may carry the Berean name.',
    licenseUrl: 'https://berean.bible/terms.htm',
    attribution: 'The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee. This text of God\'s Word has been dedicated to the public domain.',
    // 16 textual-variant verses are not numbered at all (Mt 17:21, 18:11, 23:14; Mk 7:16, 9:44, 9:46, 11:26, 15:28; Lk 17:36, 23:17; Jn 5:4; Acts 8:37, 15:34, 24:7, 28:29; Rom 16:24).
    expectedVerses: 31086,
  },
  ASV: {
    id: 'eng_asv',
    name: 'American Standard Version (1901)',
    rights: 'Public domain.',
    licenseUrl: 'https://ebible.org/Scriptures/details.php?id=eng-asv',
    // Every KJV number is present as a marker, but the same 16 verses BSB leaves out carry only a footnote here.
    expectedVerses: 31086,
  },
}

/** Join a verse's text segments; drop footnotes, line breaks and formatting. */
export function verseText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join(' ')
}

/*
 * Psalm 119 is an acrostic: a Hebrew letter heads each stanza of eight
 * verses. The sources set that heading as text, and the API glues it onto the
 * END of the verse before it — the shipped WEB read "Don't utterly forsake
 * me. BETH" on the wall, and ASV "...utterly. ב BETH." Only the names, in
 * capitals, and only in Psalm 119: an ordinary "he" is never touched.
 * Both spellings each source uses are listed (HHETH/HETH, KAPH/KAPF,
 * TSADHE/TZADHE, "SIN AND SHIN").
 */
const ACROSTIC_NAMES = [
  'ALEPH', 'BETH', 'GIMEL', 'DALETH', 'HE', 'VAV', 'WAW', 'ZAYIN', 'HHETH', 'HETH', 'CHETH', 'TETH',
  'YODH', 'YOD', 'KAPH', 'KAPF', 'LAMEDH', 'LAMED', 'MEM', 'NUN', 'SAMEKH', 'AYIN', 'PE',
  'TSADHE', 'TZADHE', 'TSADDI', 'QOPH', 'RESH', 'SIN AND SHIN', 'SHIN', 'SIN', 'TAV', 'TAW',
].sort((a, b) => b.length - a.length)
const ACROSTIC_TAIL = new RegExp(`\\s*(?:[\\u05D0-\\u05EA]\\s*)?\\b(?:${ACROSTIC_NAMES.join('|')})\\.?$`)
const PSALMS = CANON.indexOf('PSA')
/* ASV sets the Psalms' musical notes as "[Selah" — an opening bracket that
   never closes, which reads as a mistake on a wall. The word stays. A
   bracket that does close (John 7:53-8:11) is left alone. */
const OPEN_SELAH = /\[(?=(?:Higgaion\.\s+)?Selah\b)/g

/** True when a Psalm 119 verse still ends in a stanza heading. */
export function hasAcrosticTail(book, chapter, text) {
  return book === PSALMS && chapter === 119 && ACROSTIC_TAIL.test(text)
}

/** One verse's text, as the wall should show it. */
export function cleanVerseText(raw, book, chapter) {
  let text = String(raw)
    .replace(/\s+/g, ' ')
    // A footnote between a word and its comma left "I am he ," on the wall.
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(OPEN_SELAH, '')
    .trim()
  if (book === PSALMS && chapter === 119) text = text.replace(ACROSTIC_TAIL, '').trim()
  return text
}

/** [bookIndex, chapter, verse, text] rows for one helloao chapter; empty verses skipped. */
export function chapterRows(chapter, book, chapterNumber) {
  const rows = []
  for (const item of chapter?.content ?? []) {
    if (item?.type !== 'verse' || typeof item.number !== 'number') continue
    const text = cleanVerseText(verseText(item.content), book, chapterNumber)
    if (text) rows.push([book, chapterNumber, item.number, text])
  }
  return rows
}

/**
 * Every check a version must pass before it may replace what is installed:
 * the app's 66-book canon, every one of its 1,189 chapters, unique and
 * clean rows, the exact expected count, verses every church will look up,
 * and no Psalm 119 heading left behind.
 */
export function validateBibleRows(rows, { version, expectedVerses = null } = {}) {
  const name = version ?? 'Bible'
  const seen = new Set()
  const chapters = new Set()
  for (const row of rows) {
    const [book, chapter, verse, text] = row
    if (!Number.isInteger(book) || book < 0 || book >= 66 || !Number.isInteger(chapter) || chapter < 1 ||
      chapter > CHAPTER_COUNTS[book] || !Number.isInteger(verse) || verse < 1 || typeof text !== 'string' || !text.trim()) {
      throw new Error(`${name}: invalid row ${JSON.stringify(row).slice(0, 120)}`)
    }
    if (/[\\{}|]|\bnoteId\b/.test(text)) throw new Error(`${name}: unclean text at ${CANON[book]} ${chapter}:${verse}`)
    if (hasAcrosticTail(book, chapter, text)) throw new Error(`${name}: Psalm 119:${verse} still ends in a stanza heading`)
    const ref = `${book}:${chapter}:${verse}`
    if (seen.has(ref)) throw new Error(`${name}: duplicate verse ${CANON[book]} ${chapter}:${verse}`)
    seen.add(ref)
    chapters.add(`${book}:${chapter}`)
  }
  if (chapters.size !== 1189) throw new Error(`${name}: expected 1,189 chapters, got ${chapters.size}`)
  if (expectedVerses != null && rows.length !== expectedVerses) {
    throw new Error(`${name}: expected ${expectedVerses} verses, got ${rows.length}`)
  }
  for (const [ref, label] of [
    ['0:1:1', 'Genesis 1:1'], ['18:23:1', 'Psalm 23:1'], ['37:12:1', 'Zechariah 12:1'],
    ['42:3:16', 'John 3:16'], ['65:22:21', 'Revelation 22:21'],
  ]) {
    if (!seen.has(ref)) throw new Error(`${name}: ${label} is missing`)
  }
  return rows
}

/** Order-independent fingerprint of a version's rows, recorded as provenance. */
export function rowsSha256(rows) {
  const sorted = [...rows].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  return createHash('sha256').update(sorted.map((row) => row.join('\t')).join('\n')).digest('hex')
}
