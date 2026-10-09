import Database from 'better-sqlite3'
import fs from 'node:fs'
import type { ForeignPresentation } from './propresenter'
import { rtfText } from './text'

const MAX_SONGS = 10_000
const MAX_SLIDES = 10_000
const MAX_LYRIC_BYTES = 16 * 1024 ** 2

function database(file: string): Database.Database {
  if (fs.statSync(file).size > 128 * 1024 ** 2) throw new Error('The EasyWorship database exceeds 128 MiB.')
  const db = new Database(file, { readonly: true, fileMustExist: true })
  try {
    db.pragma('trusted_schema = OFF')
    db.pragma('query_only = ON')
    return db
  } catch (error) { db.close(); throw error }
}
function table(db: Database.Database, name: string) {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)) throw new Error(`This EasyWorship version is not supported: ${name} is missing.`)
}
const text = (value: unknown) => Buffer.isBuffer(value) ? value.toString('utf8') : typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)
function metadata(row: Record<string, unknown>) {
  const authors = text(row.author)
  return { title: text(row.title).trim() || 'Untitled song', authors: authors.split(/[;/]/.test(authors) ? /[;/]/ : /,/).map(author => author.trim()).filter(Boolean), copyright: text(row.copyright), ccliNumber: text(row.reference_number ?? row.vendor_id) }
}

function lyrics(value: unknown): string {
  const input = Buffer.isBuffer(value) ? value : text(value)
  if (Buffer.byteLength(input) > MAX_LYRIC_BYTES) throw new Error('The song text exceeds 16 MiB.')
  return rtfText(input)
}

/** Only a complete tag line is metadata; e.g. "Chorus of angels" is a lyric. */
function slide(value: string, index: number, fallback: 'Slide' | 'Verse') {
  const lines = value.replace(/\r\n?/g, '\n').trim().split('\n')
  const heading = /^(verse|chorus|bridge|pre[- ]?chorus|intro|outro|tag|ending|end|slide|interlude|refrain|vamp|coda)(?:\s*\d+[a-z]?)?\s*(?:\([^\n()]*\))?\s*:?$/i.test(lines[0].trim())
  return { label: heading ? lines.shift()!.trim() : `${fallback} ${index + 1}`, text: lines.join('\n').trim(), media: [] }
}

function readSong(row: Record<string, unknown>, read: () => ForeignPresentation['slides']): ForeignPresentation {
  const info = metadata(row)
  try { return { ...info, slides: read(), warnings: [] } }
  catch (error) {
    return { ...info, slides: [], warnings: [`${info.title}: ${error instanceof Error ? error.message : 'The song could not be read.'}`] }
  }
}

/** EasyWorship 6/7's documented interoperability tables, read without modifying the source. */
export function parseEwsxDatabase(file: string): ForeignPresentation[] {
  const db = database(file)
  try {
    for (const name of ['presentation', 'slide', 'element', 'resource_text']) table(db, name)
    const songs = db.prepare('SELECT rowid, title, author, copyright, reference_number FROM presentation WHERE presentation_type=6 ORDER BY rowid LIMIT 10001').all() as Record<string, unknown>[]
    if (songs.length > MAX_SONGS) throw new Error('The schedule contains too many songs.')
    const read = db.prepare('SELECT rt.rtf FROM element AS e JOIN slide AS s ON e.slide_id=s.rowid JOIN resource_text AS rt ON rt.resource_id=e.foreground_resource_id WHERE e.element_type=6 AND e.element_style_type=4 AND s.presentation_id=? ORDER BY s.order_index,e.rowid LIMIT 10001')
    return songs.map(row => readSong(row, () => {
      const slides: ForeignPresentation['slides'] = []
      for (const word of read.iterate(row.rowid) as Iterable<{ rtf: unknown }>) {
        if (slides.length >= MAX_SLIDES) throw new Error('An EasyWorship song contains too many slides.')
        slides.push(slide(lyrics(word.rtf), slides.length, 'Slide'))
      }
      return slides
    }))
  } finally { db.close() }
}

export function parseEasyWorshipLibrary(songsFile: string, wordsFile: string): ForeignPresentation[] {
  const songs = database(songsFile)
  let words: Database.Database | undefined
  try {
    words = database(wordsFile)
    table(songs, 'song'); table(words, 'word')
    const rows = songs.prepare('SELECT rowid,title,author,copyright,vendor_id FROM song ORDER BY rowid LIMIT 10001').all() as Record<string, unknown>[]
    if (rows.length > MAX_SONGS) throw new Error('The library contains too many songs for one import.')
    const read = words.prepare('SELECT words FROM word WHERE song_id=? ORDER BY rowid LIMIT 10001')
    return rows.map(row => readSong(row, () => {
      const slides: ForeignPresentation['slides'] = []
      let records = 0
      for (const part of read.iterate(row.rowid) as Iterable<{ words: unknown }>) {
        if (++records > MAX_SLIDES) throw new Error('An EasyWorship song contains too many lyric records.')
        for (const block of lyrics(part.words).split(/\n[ \t]*\n(?:[ \t]*\n)*/).filter(value => value.trim())) {
          if (slides.length >= MAX_SLIDES) throw new Error('An EasyWorship song contains too many slides.')
          slides.push(slide(block, slides.length, 'Verse'))
        }
      }
      return slides
    }))
  } finally { words?.close(); songs.close() }
}
