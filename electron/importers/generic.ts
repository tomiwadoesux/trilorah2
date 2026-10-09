/**
 * Layer 1 and 2 of the any-app importer: tell what a file is by its structure,
 * and harvest song-shaped records from databases, JSON, XML and text that no
 * dedicated reader understands. Anything uncertain becomes a ForeignQuestion
 * for the operator instead of a guess. Structure signatures never include content.
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { ForeignChoice, ForeignColumnChoice, ForeignQuestion } from '../../shared/foreignImport'
import { isColumnChoice } from '../../shared/foreignImport'
import { MEDIA_TYPES } from '../media/mediaImport'
import { IMPORT_LIMITS, readSmall, type SourceFile } from './archive'
import type { ForeignPresentation, ForeignSlide } from './propresenter'
import { descendants, readXml, rtfText, type XmlNode } from './text'

export type Kind = 'media' | 'other-media' | 'pro' | 'pro6' | 'proplaylist' | 'ew-main' | 'ew-songs' | 'ew-words' | 'sqlite' | 'theme' | 'json' | 'songxml' | 'xml' | 'text' | 'docx' | 'skip'
export interface Detected { kind: Kind; reason?: string }

const MAX_ROWS = 10_000
const SAMPLE = 400
const ext = (name: string) => path.extname(name).toLowerCase()
export const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value)

export function safeJson(text: string): unknown {
  let nodes = 0
  const parsed = JSON.parse(text)
  const check = (value: unknown, depth: number) => {
    if (++nodes > 200_000 || depth > 32) throw new Error('The JSON file is too complex.')
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid JSON key.')
      check(child, depth + 1)
    }
  }
  check(parsed, 0)
  return parsed
}

export function openDatabase(file: string): Database.Database {
  if (fs.statSync(file).size > 128 * 1024 ** 2) throw new Error('The database exceeds 128 MiB.')
  const db = new Database(file, { readonly: true, fileMustExist: true })
  try { db.pragma('trusted_schema = OFF'); db.pragma('query_only = ON'); return db }
  catch (error) { db.close(); throw error }
}
const tableNames = (db: Database.Database) => (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>).map(row => row.name)
const columnsOf = (db: Database.Database, table: string) => (db.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{ name: string; type: string }>)
const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`

export function themeShaped(data: unknown): boolean {
  const one = (theme: unknown) => object(theme) && typeof theme.name === 'string' && ['text', 'verse', 'background', 'fontSize', 'fontFamily', 'textColor', 'backgroundColor', 'backgroundImage'].some(key => key in theme)
  if (Array.isArray(data)) return data.length > 0 && data.every(one)
  if (object(data) && Array.isArray(data.themes)) return data.themes.length > 0 && data.themes.every(one)
  if (object(data) && object(data.theme)) return one(data.theme)
  return one(data)
}

/** Decide by content first, extension second. Archives are expanded before this runs. */
export async function detect(source: SourceFile): Promise<Detected> {
  const extension = ext(source.name)
  if ((MEDIA_TYPES.photo as readonly string[]).includes(extension) || (MEDIA_TYPES.video as readonly string[]).includes(extension)) return { kind: 'media' }
  if (/\.(mp3|wav|ogg|m4a|aac|flac|wmv|avi|mkv|pdf|pptx?|odp|heic)$/i.test(source.name)) return { kind: 'other-media', reason: 'this resource type is not converted by this importer. Import or convert it separately.' }
  if (extension === '.pro') return { kind: 'pro' }
  if (extension === '.pro6') return { kind: 'pro6' }
  if (extension === '.proplaylist') return { kind: 'proplaylist' }
  if (extension === '.docx') return { kind: 'docx' }
  const info = await fs.promises.stat(source.file)
  if (!info.size) return { kind: 'skip', reason: 'the file is empty.' }
  const handle = await fs.promises.open(source.file, 'r')
  let head: Buffer
  try { head = Buffer.alloc(Math.min(4096, info.size)); await handle.read(head, 0, head.length, 0) } finally { await handle.close() }
  if (head.subarray(0, 16).toString('latin1') === 'SQLite format 3\0') {
    try {
      const db = openDatabase(source.file)
      try {
        const tables = new Set(tableNames(db))
        if (['presentation', 'slide', 'element', 'resource_text'].every(name => tables.has(name))) return { kind: 'ew-main' }
        if (tables.has('song') && columnsOf(db, 'song').some(column => column.name === 'title')) return { kind: 'ew-songs' }
        if (tables.has('word') && columnsOf(db, 'word').some(column => column.name === 'song_id')) return { kind: 'ew-words' }
        return { kind: 'sqlite' }
      } finally { db.close() }
    } catch (error) { return { kind: 'skip', reason: error instanceof Error ? error.message : 'the database could not be opened.' } }
  }
  if (/[%]PDF-|^\x7fELF|^MZ|^\xca\xfe\xba\xbe/.test(head.subarray(0, 4).toString('latin1'))) return { kind: 'skip', reason: 'this is a program or document type the importer does not read.' }
  if (info.size > IMPORT_LIMITS.textBytes) return { kind: 'skip', reason: 'this file is larger than 16 MiB and is not a known export.' }
  const sample = head.toString('utf8').replace(/^﻿/, '')
  const control = [...sample].filter(char => char < ' ' && !'\t\n\r'.includes(char)).length
  if (control > sample.length / 50) return { kind: 'skip', reason: 'this is a binary file the importer does not recognise.' }
  const trimmed = sample.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return { kind: themeShaped(safeJson((await readSmall(source.file)).toString('utf8').replace(/^﻿/, ''))) ? 'theme' : 'json' } }
    catch { return { kind: 'text' } }
  }
  if (trimmed.startsWith('<')) {
    try {
      const root = readXml(xmlWithBreaks((await readSmall(source.file)).toString('utf8').replace(/^﻿/, '')))
      if (root.name === 'RVPresentationDocument') return { kind: 'pro6' }
      if (songXmlShaped(root)) return { kind: 'songxml' }
      return { kind: 'xml' }
    } catch { return { kind: 'text' } }
  }
  return { kind: 'text' }
}

// ---------------------------------------------------------------- text files

/** Short lines in several stanzas read like lyrics; paragraphs read like notes. */
export function lyricShaped(text: string): boolean {
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/).map(block => block.split('\n').map(line => line.trim()).filter(Boolean)).filter(block => block.length)
  const stanzas = blocks.filter(block => block.length >= 2)
  if (stanzas.length < 2) return false
  const lines = stanzas.flat()
  const average = lines.reduce((sum, line) => sum + line.length, 0) / lines.length
  return average < 50 && lines.every(line => line.length <= 90) && lines.filter(line => /[.!?]$/.test(line)).length < lines.length / 2
}

const SECTION = /^\[?\s*(verse|chorus|bridge|pre-?chorus|tag|ending|outro|intro|refrain|v|c|b|p|t|e)\s*(\d*)\s*\]?:?$/i
const LABELS: Record<string, string> = { v: 'Verse', c: 'Chorus', b: 'Bridge', p: 'Pre-Chorus', t: 'Tag', e: 'Ending', verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge', prechorus: 'Pre-Chorus', 'pre-chorus': 'Pre-Chorus', tag: 'Tag', ending: 'Ending', outro: 'Ending', intro: 'Intro', refrain: 'Chorus' }
export function label(marker: string, index: number): string {
  const match = SECTION.exec(marker.trim())
  if (!match) return `Verse ${index + 1}`
  const name = LABELS[match[1].toLowerCase()] ?? 'Verse'
  return match[2] ? `${name} ${match[2]}` : name
}

/** Blank-line stanzas become slides. A lone first line becomes the title. */
export function textSong(title: string, text: string, authors: string[] = []): ForeignPresentation {
  const clean = (text.startsWith('{\\rtf') ? rtfText(text) : text).replace(/\r\n?/g, '\n')
  const blocks = clean.split(/\n[ \t]*\n+/).map(block => block.split('\n').map(line => line.trimEnd()).filter(line => line.trim())).filter(block => block.length)
  if (blocks[0]?.length === 1 && blocks.length > 1 && blocks[0][0].length <= 80 && !SECTION.test(blocks[0][0])) title = blocks.shift()![0].replace(/^#+\s*/, '')
  const slides: ForeignSlide[] = []
  let verses = 0
  for (const block of blocks.slice(0, MAX_ROWS)) {
    let name = `Verse ${++verses}`
    if (SECTION.test(block[0])) { name = label(block[0], verses - 1); block.shift(); if (!/^verse/i.test(name)) verses-- }
    if (!block.length) continue
    slides.push({ label: name, text: block.join('\n'), media: [] })
  }
  return { title: title.trim() || 'Untitled song', slides, authors, warnings: [] }
}

// ---------------------------------------------------------------- tables

export interface Table { name: string; columns: string[]; rows: Record<string, unknown>[]; signature: string; total: number }
interface Scored { lyrics: string[]; titles: string[] }

const str = (value: unknown) => Buffer.isBuffer(value) ? value.toString('utf8') : typeof value === 'string' ? value : value === null || value === undefined ? '' : typeof value === 'object' ? '' : String(value)

function score(table: Table): Scored {
  const lyrics: Array<[string, number]> = [], titles: Array<[string, number]> = []
  for (const column of table.columns) {
    const values = table.rows.map(row => str(row[column]).trim()).filter(Boolean)
    if (values.length < Math.max(1, table.rows.length / 4)) continue
    const average = values.reduce((sum, value) => sum + value.length, 0) / values.length
    const breaks = values.reduce((sum, value) => sum + (value.match(/\n|\\par|\\line/g)?.length ?? 0), 0) / values.length
    const distinct = new Set(values.map(value => value.toLowerCase())).size / values.length
    const name = column.toLowerCase()
    if (breaks >= 0.5 || average >= 80 || /lyric|words|text|body|content|verse/.test(name)) lyrics.push([column, breaks * 2 + average / 100 + (/lyric|words|text|body|content/.test(name) ? 3 : 0)])
    else if (average >= 2 && average <= 80 && breaks < 0.05 && distinct > 0.5) titles.push([column, distinct + (/title|name|song/.test(name) ? 3 : 0) + (/id|guid|uuid|key|date|time|path|url|file/.test(name) ? -2 : 0)])
  }
  const order = (list: Array<[string, number]>) => list.sort((a, b) => b[1] - a[1]).map(([column]) => column)
  return { lyrics: order(lyrics), titles: order(titles) }
}

/** Decide whether a table can be imported silently or needs the operator. */
export function assess(table: Table, file: string, recipe?: ForeignColumnChoice | 'skip', answer?: ForeignChoice): { question?: ForeignQuestion; choice?: ForeignColumnChoice | 'skip' } {
  const scored = score(table)
  if (!scored.lyrics.length) return {}
  const suggested: ForeignColumnChoice | undefined = scored.titles.length ? { title: scored.titles[0], lyrics: scored.lyrics[0] } : undefined
  const preview = table.rows.slice(0, 2).map(row => table.columns.map(column => `${column}: ${str(row[column]).replace(/\s+/g, ' ').trim().slice(0, 60)}`).join(' · '))
  const question: ForeignQuestion = { id: sha(`${file}|${table.signature}`), kind: 'table', file: `${file} › ${table.name}`, preview, columns: table.columns, signature: table.signature, rows: table.total, suggested }
  const confident = scored.lyrics.length === 1 && scored.titles.length === 1 && suggested
  const choice = answer !== undefined ? (isColumnChoice(answer) ? answer : 'skip') : recipe !== undefined ? recipe : confident ? suggested : undefined
  if (choice) {
    if (choice !== 'skip' && (!table.columns.includes(choice.title) || !table.columns.includes(choice.lyrics))) return { question: { ...question, suggested } }
    question.answer = choice
    question.remembered = answer === undefined && recipe !== undefined
    return { question, choice }
  }
  return { question }
}

export function tableSongs(table: Table, choice: ForeignColumnChoice, read: (limit: number) => Record<string, unknown>[]): ForeignPresentation[] {
  const rows = read(MAX_ROWS)
  const songs: ForeignPresentation[] = []
  for (const row of rows) {
    const text = str(row[choice.lyrics])
    if (!text.trim()) continue
    if (Buffer.byteLength(text) > IMPORT_LIMITS.textBytes) throw new Error(`${table.name}: a song text exceeds 16 MiB.`)
    const song = textSong(str(row[choice.title]), text)
    if (song.slides.length) songs.push(song)
  }
  return songs
}

export function sqliteTables(db: Database.Database): Array<Table & { read: (limit: number) => Record<string, unknown>[] }> {
  const tables: Array<Table & { read: (limit: number) => Record<string, unknown>[] }> = []
  for (const name of tableNames(db).slice(0, 200)) {
    const info = columnsOf(db, name)
    const columns = info.map(column => column.name).filter(column => /^[\w .-]+$/.test(column))
    if (!columns.length) continue
    const total = (db.prepare(`SELECT COUNT(*) AS count FROM ${quote(name)}`).get() as { count: number }).count
    if (!total) continue
    const select = (limit: number) => db.prepare(`SELECT ${columns.map(quote).join(', ')} FROM ${quote(name)} LIMIT ${limit}`).all() as Record<string, unknown>[]
    const signature = `sqlite:${sha(info.map(column => `${name}|${column.name}:${column.type}`).sort().join(','))}`
    tables.push({ name, columns, rows: select(SAMPLE), signature, total, read: select })
  }
  return tables
}

/** Arrays of similar objects, anywhere in the document, read as tables. */
export function jsonTables(data: unknown): Table[] {
  const tables: Table[] = []
  const walk = (value: unknown, trail: string, depth: number) => {
    if (depth > 12 || tables.length >= 20) return
    if (Array.isArray(value)) {
      const records = value.filter(object)
      if (records.length && records.length >= value.length / 2) {
        const keys = [...new Set(records.flatMap(record => Object.keys(record)))].filter(key => records.some(record => ['string', 'number'].includes(typeof record[key]) || Array.isArray(record[key]))).slice(0, 60)
        const rows = records.slice(0, MAX_ROWS).map(record => Object.fromEntries(keys.map(key => [key, Array.isArray(record[key]) ? record[key].filter((item: unknown) => typeof item === 'string').join('\n') : record[key]])))
        if (keys.length >= 2) tables.push({ name: trail || 'records', columns: keys, rows: rows.slice(0, SAMPLE), signature: `json:${sha([...keys].sort().join(','))}`, total: rows.length, ...({ all: rows } as any) })
      }
      value.forEach((item, index) => walk(item, `${trail}[${index}]`, depth + 1))
    } else if (object(value)) for (const [key, child] of Object.entries(value)) walk(child, trail ? `${trail}.${key}` : key, depth + 1)
  }
  walk(data, '', 0)
  return tables
}

/** Repeated sibling elements whose children carry text read as tables. */
export function xmlTables(root: XmlNode): Table[] {
  const tables: Table[] = []
  const walk = (node: XmlNode, depth: number) => {
    if (depth > 12 || tables.length >= 20) return
    const groups = new Map<string, XmlNode[]>()
    for (const child of node.children) groups.set(child.name, [...(groups.get(child.name) ?? []), child])
    for (const [name, group] of groups) {
      const keys = [...new Set(group.flatMap(item => item.children.filter(child => child.text.trim() || child.children.some(grand => grand.text.trim())).map(child => child.name)))].slice(0, 60)
      const attrs = [...new Set(group.flatMap(item => Object.keys(item.attrs)))].slice(0, 20)
      const columns = [...keys, ...attrs.map(attr => `@${attr}`)]
      if (columns.length >= 2 && group.some(item => item.children.length)) {
        const rows = group.slice(0, MAX_ROWS).map(item => Object.fromEntries(columns.map(column => [column, column.startsWith('@') ? item.attrs[column.slice(1)] : item.children.filter(child => child.name === column).map(deepText).join('\n')])))
        tables.push({ name, columns, rows: rows.slice(0, SAMPLE), signature: `xml:${sha(`${name}|${[...columns].sort().join(',')}`)}`, total: rows.length, ...({ all: rows } as any) })
      }
      group.forEach(item => walk(item, depth + 1))
    }
  }
  walk(root, 0)
  return tables
}
const deepText = (node: XmlNode): string => node.children.length ? [node.text, ...node.children.map(deepText)].filter(Boolean).join('\n') : node.text
export const allRows = (table: Table) => ((table as any).all as Record<string, unknown>[] | undefined) ?? table.rows

// ---------------------------------------------------------------- open song formats

/** `<br/>` inside lyric lines must survive as line breaks before the reader flattens text. */
export const xmlWithBreaks = (xml: string) => xml.replace(/<br\s*\/>/gi, '\n')

function songXmlShaped(root: XmlNode): boolean {
  const songs = root.name === 'song' ? [root] : descendants(root, 'song')
  return songs.length > 0 && songs.every(song => song.children.some(child => child.name === 'lyrics'))
}

/** OpenLyrics (OpenLP, Quelea, others) and OpenSong `<song>` documents. */
export function parseSongXml(root: XmlNode, filename: string): ForeignPresentation[] {
  const songs = root.name === 'song' ? [root] : descendants(root, 'song')
  return songs.slice(0, MAX_ROWS).map(song => {
    const properties = song.children.find(child => child.name === 'properties')
    const lyrics = song.children.find(child => child.name === 'lyrics')!
    const authors = descendants(properties ?? song, 'author').map(node => node.text.trim()).filter(Boolean)
    const copyright = descendants(properties ?? song, 'copyright')[0]?.text.trim()
    const ccli = descendants(properties ?? song, 'ccliNo')[0]?.text.trim() ?? song.children.find(child => child.name === 'ccli')?.text.trim()
    const title = descendants(properties ?? song, 'title')[0]?.text.trim() || song.children.find(child => child.name === 'title')?.text.trim() || filename.replace(/\.[^.]+$/, '')
    const verses = lyrics.children.filter(child => child.name === 'verse')
    const slides: ForeignSlide[] = verses.length
      ? verses.map((verse, index) => ({ label: label(verse.attrs.name ?? '', index), text: verse.children.filter(child => child.name === 'lines').map(lines => deepText(lines).split('\n').map(line => line.trim()).filter(Boolean).join('\n')).filter(Boolean).join('\n'), media: [] }))
      : openSongSlides(lyrics.text)
    return { title, authors, copyright, ccliNumber: ccli, slides: slides.filter(slide => slide.text.trim()), warnings: [] }
  })
}

/** OpenSong marks sections as `[V1]`, chord lines with `.` and lyric lines with a leading space. */
function openSongSlides(text: string): ForeignSlide[] {
  const slides: ForeignSlide[] = []
  let current: ForeignSlide | undefined
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = /^\[([^\]]+)\]\s*$/.exec(raw.trim())
    if (marker) { current = { label: label(marker[1], slides.length), text: '', media: [] }; slides.push(current); continue }
    if (/^[.;|]/.test(raw) || !raw.trim()) continue
    if (!current) { current = { label: 'Verse 1', text: '', media: [] }; slides.push(current) }
    current.text += (current.text ? '\n' : '') + raw.replace(/^ /, '').replace(/_/g, '').trimEnd()
  }
  return slides
}
