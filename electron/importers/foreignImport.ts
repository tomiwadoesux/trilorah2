import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import type { TriManifest, TriSnapshot } from '../../shared/triPackage'
import type { QueueItem, RunSegment } from '../../shared/operatorRun'
import type { ForeignAnswers, ForeignQuestion } from '../../shared/foreignImport'
import { writeTri } from '../packages/triArchive'
import { MEDIA_TYPES } from '../media/mediaImport'
import { IMPORT_LIMITS, isZip, readSmall, unpack, type SourceFile } from './archive'
import { parsePro, parsePro6, parseProPlaylist, type ForeignPresentation } from './propresenter'
import { parseEasyWorshipLibrary, parseEwsxDatabase } from './easyworship'
import { descendants, readXml, rtfText, type XmlNode } from './text'
import { allRows, assess, detect, jsonTables, lyricShaped, openDatabase, parseSongXml, safeJson, sqliteTables, tableSongs, textSong, xmlTables, xmlWithBreaks, type Kind } from './generic'
import type { Recipes } from './recipes'

export interface ConvertedImport { directory: string; file: string; manifest: TriManifest; warnings: string[]; questions: ForeignQuestion[] }
export interface ConvertOptions { answers?: ForeignAnswers; recipes?: Recipes }
type Detected = SourceFile & { kind: Kind; reason?: string }
const ext = (name: string) => path.extname(name).toLowerCase()
const base = (name: string) => path.posix.basename(name.replace(/\\/g, '/'))
const titleOf = (name: string) => base(name).replace(/\.[^.]+$/, '')
const key = () => `foreign-${randomUUID()}`
const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value)

/** Only explicit picker files and packaged entries can satisfy a reference. Never follow paths supplied by a foreign document. */
export function resolveSource(reference: string, sources: SourceFile[]): SourceFile | undefined {
  let name = reference.replace(/\\/g, '/').replace(/^file:\/\//i, '')
  try { name = decodeURIComponent(name) } catch { /* Literal percent signs. */ }
  const candidates = sources.filter(source => source.name.toLowerCase() === name.toLowerCase() || name.toLowerCase().endsWith(`/${source.name.toLowerCase()}`))
  if (candidates.length === 1) return candidates[0]
  if (candidates.length > 1) return undefined
  const byName = sources.filter(source => base(source.name).toLowerCase() === base(name).toLowerCase())
  return byName.length === 1 ? byName[0] : undefined
}

class Content {
  snapshot: TriSnapshot = { categories: {} }
  warnings = new Set<string>()
  media = new Map<string, any>()
  songs = new Map<string, string>()
  questions: ForeignQuestion[] = []
  constructor(readonly sources: SourceFile[], readonly answers: ForeignAnswers = {}, readonly recipes: Recipes = {}) {}
  warn(message: string) { if (this.warnings.size < 300) this.warnings.add(message) }
  addMedia(source: SourceFile) {
    const prior = this.media.get(source.file)
    if (prior) return prior
    const extension = ext(source.name)
    const kind = (MEDIA_TYPES.photo as readonly string[]).includes(extension) ? 'photo' : (MEDIA_TYPES.video as readonly string[]).includes(extension) ? 'video' : undefined
    if (!kind) return undefined
    const id = key(), url = pathToFileURL(source.file).href
    const data = { id, label: titleOf(source.name), kind, source: 'local', url, seed: 0, style: 'smoke', collection: 'media', detail: 'Imported from another app' }
    ;(this.snapshot.categories.media ??= []).push({ id, label: base(source.name), data })
    this.media.set(source.file, data)
    return data
  }
  mediaRow(reference: string): QueueItem | undefined {
    const source = resolveSource(reference, this.sources)
    const item = source && this.addMedia(source)
    if (!item) { this.warn(`${base(reference)}: media is missing, ambiguous, or not a supported image/video. Select the original file alongside the export.`); return undefined }
    return { key: key(), source: 'media', label: item.label, path: item.url, ...(item.kind === 'photo' ? { preview: item.url } : {}), mediaKind: item.kind }
  }
  presentation(presentation: ForeignPresentation): QueueItem[] {
    presentation.warnings.forEach(warning => this.warn(warning))
    const hasText = presentation.slides.some(slide => slide.text.trim())
    let id: string | undefined
    if (hasText) {
      const signature = JSON.stringify([presentation.title, presentation.authors, presentation.ccliNumber, presentation.copyright, presentation.slides.map(slide => [slide.label, slide.text])])
      id = this.songs.get(signature)
      if (!id) {
        id = key()
        this.songs.set(signature, id)
        const now = Date.now()
        const data = { id, title: presentation.title, authors: presentation.authors ?? [], copyright: presentation.copyright ?? '', ccliNumber: presentation.ccliNumber ?? '', origin: 'imported', createdAt: now, updatedAt: now,
          sections: presentation.slides.map(slide => ({ label: slide.label, lines: slide.text ? slide.text.split('\n') : [''] })) }
        ;(this.snapshot.categories.songs ??= []).push({ id, label: data.title, data })
      }
    }
    const rows: QueueItem[] = []
    if (presentation.notes) rows.push({ key: key(), source: 'note', label: presentation.notes })
    presentation.slides.forEach(slide => {
      for (const reference of slide.media) { const row = this.mediaRow(reference); if (row) rows.push(row) }
      if (id) rows.push({ key: key(), source: 'song', label: `${presentation.title} · ${slide.label}`, songId: id, title: presentation.title, section: slide.label, lines: slide.text ? slide.text.split('\n') : [''] })
      if (slide.notes) rows.push({ key: key(), source: 'note', label: slide.notes })
    })
    if (!rows.length) this.warn(`${presentation.title}: no readable text or supported media was found.`)
    return rows
  }
  service(title: string, segments: RunSegment[]) {
    if (!segments.length) return
    ;(this.snapshot.categories.service ??= []).push({ id: key(), label: title, data: { segments } })
  }
}

async function proPresenter(content: Content, files: Detected[]) {
  const documents = files.filter(source => source.kind === 'pro' || source.kind === 'pro6')
  const playlists = files.filter(source => source.kind === 'proplaylist')
  const cache = new Map<string, QueueItem[]>()
  const read = async (source: SourceFile, arrangement = '') => {
    const id = `${source.file}:${arrangement}`
    let rows = cache.get(id)
    if (!rows) {
      const buffer = await readSmall(source.file)
      rows = content.presentation((source as Detected).kind === 'pro6' || ext(source.name) === '.pro6' ? parsePro6(buffer.toString('utf8'), base(source.name)) : parsePro(buffer, base(source.name), arrangement))
      cache.set(id, rows)
    }
    return structuredClone(rows).map(row => ({ ...row, key: key() }))
  }
  for (const source of playlists) {
    try {
      const playlist = parseProPlaylist(await readSmall(source.file))
      playlist.warnings.forEach(warning => content.warn(warning))
      const segments: RunSegment[] = []
      for (const item of playlist.items) {
        if (item.header || !segments.length) segments.push({ key: key(), type: 'custom', label: item.header ? item.label : playlist.title, items: [] })
        if (item.header) continue
        const segment = segments[segments.length - 1]
        const linked = item.path ? resolveSource(item.path, documents) : undefined
        if (linked) {
          try { segment.items.push(...await read(linked, item.arrangement)) }
          catch (error) { content.warn(`${item.label}: ${message(error)}`); segment.items.push({ key: key(), source: 'note', label: `${item.label} — presentation could not be read` }) }
        } else if (item.media?.length) {
          for (const reference of item.media) { const row = content.mediaRow(reference); if (row) segment.items.push(row) }
        } else {
          segment.items.push({ key: key(), source: 'note', label: `${item.label}${item.path ? ' — missing presentation' : ''}` })
          if (item.path) content.warn(`${item.label}: the playlist’s presentation was not included in the export.`)
        }
      }
      content.service(playlist.title, segments)
    } catch (error) { content.warn(`${base(source.name)}: ${message(error)}`) }
  }
  for (const source of documents) {
    if ([...cache.keys()].some(id => id.startsWith(`${source.file}:`))) continue
    try {
      const rows = await read(source)
      if (!playlists.length && rows.length) content.service(titleOf(source.name), [{ key: key(), type: 'worship', label: titleOf(source.name), items: rows }])
    } catch (error) { content.warn(`${base(source.name)}: ${message(error)}`) }
  }
  content.warn('Text slides are available as editable songs. Included media is copied separately; automatic background changes and media timing need review.')
}

async function easyWorship(content: Content, files: Detected[]) {
  const main = files.filter(source => source.kind === 'ew-main')
  const songs = files.filter(source => source.kind === 'ew-songs')
  const words = files.filter(source => source.kind === 'ew-words')
  for (const source of main) {
    try { parseEwsxDatabase(source.file).forEach(song => content.presentation(song)) }
    catch (error) { content.warn(`${base(source.name)}: ${message(error)}`) }
  }
  if (songs.length || words.length) {
    if (songs.length !== 1 || words.length !== 1) content.warn('Choose one Songs.db together with its matching SongWords.db to import a library.')
    else {
      try { parseEasyWorshipLibrary(songs[0].file, words[0].file).forEach(song => content.presentation(song)) }
      catch (error) { content.warn(`EasyWorship song library: ${message(error)}`) }
    }
  }
  content.warn('EasyWorship songs and packaged images/videos are imported. Service order, non-song presentations, media-to-slide links, and layouts are not converted; rebuild those in Trilorah.')
}

function wordText(node: XmlNode): string {
  if (node.name === 'w:t') return node.text
  if (node.name === 'w:br' || node.name === 'w:cr') return '\n'
  if (node.name === 'w:tab') return '\t'
  return node.children.map(wordText).join('')
}

async function documentText(source: Detected, directory: string, content: Content): Promise<string> {
  if (source.kind === 'docx') {
    const docDirectory = path.join(directory, key())
    try {
      const files = await unpack(source.file, docDirectory, { maxBytes: 128 * 1024 ** 2, include: new Set(['word/document.xml']) })
      const document = files.find(file => file.name === 'word/document.xml')
      if (!document) throw new Error('This Word file has no document text.')
      const root = readXml((await readSmall(document.file)).toString('utf8'))
      content.warn('Word documents are imported as text; images, formatting, and embedded objects are not converted.')
      return descendants(root, 'w:p').map(wordText).join('\n\n')
    } finally { await fs.rm(docDirectory, { recursive: true, force: true }) }
  }
  const raw = await readSmall(source.file)
  const text = raw.subarray(0, 5).toString('latin1') === '{\\rtf' ? rtfText(raw) : raw.toString('utf8').replace(/^\uFEFF/, '')
  if (!text.trim() || text.includes('\0')) throw new Error('No readable text was found.')
  return text
}

/** Text that reads like a sermon becomes notes; text that reads like lyrics is asked about. */
async function textFiles(content: Content, files: Detected[], directory: string) {
  for (const source of files) {
    try {
      const text = await documentText(source, directory, content)
      const paragraphs = text.replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim())
      if (paragraphs.length > 10_000 || text.length > 1_000_000) throw new Error('Split this document into smaller files before importing.')
      let choice = content.answers[sha(`${source.name}|text`)]
      if (choice === undefined && lyricShaped(text)) {
        content.questions.push({ id: sha(`${source.name}|text`), kind: 'text', file: base(source.name), preview: paragraphs.slice(0, 6).map(line => line.trim().slice(0, 80)), suggested: 'song' })
        continue
      }
      if (choice === 'skip') { content.questions.push({ id: sha(`${source.name}|text`), kind: 'text', file: base(source.name), preview: paragraphs.slice(0, 6).map(line => line.trim().slice(0, 80)), suggested: 'song', answer: 'skip' }); continue }
      if (choice === 'song') {
        content.questions.push({ id: sha(`${source.name}|text`), kind: 'text', file: base(source.name), preview: paragraphs.slice(0, 6).map(line => line.trim().slice(0, 80)), suggested: 'song', answer: 'song' })
        content.presentation(textSong(titleOf(source.name), text))
        continue
      }
      if (choice !== undefined) content.questions.push({ id: sha(`${source.name}|text`), kind: 'text', file: base(source.name), preview: paragraphs.slice(0, 6).map(line => line.trim().slice(0, 80)), suggested: 'song', answer: 'note' })
      // Each paragraph remains readable/editable in the run instead of one enormous input.
      content.service(titleOf(source.name), [{ key: key(), type: 'sermon', label: titleOf(source.name), items: paragraphs.map(label => ({ key: key(), source: 'note', label })) }])
      content.warn('Transcripts and sermon notes become editable notes in the run of service. They are not used as verified preacher learning.')
    } catch (error) { content.warn(`${base(source.name)}: ${message(error)}`) }
  }
}

async function themeFiles(content: Content, files: Detected[], directory: string) {
  for (const source of files) {
    try {
      const data = safeJson((await readSmall(source.file)).toString('utf8').replace(/^\uFEFF/, ''))
      const themes = Array.isArray(data) ? data : object(data) && Array.isArray(data.themes) ? data.themes : object(data) && object(data.theme) ? [data.theme] : [data]
      if (themes.length > 200) throw new Error('Import at most 200 themes at once.')
      for (const theme of themes) await pewTheme(content, theme, directory)
    } catch (error) { content.warn(`${base(source.name)}: ${message(error)}`) }
  }
}

/** Databases, JSON and XML nobody wrote a reader for: find song-shaped tables, ask when unsure. */
async function tableFiles(content: Content, files: Detected[]) {
  for (const source of files) {
    const name = base(source.name)
    try {
      if (source.kind === 'songxml') {
        const root = readXml(xmlWithBreaks((await readSmall(source.file)).toString('utf8').replace(/^\uFEFF/, '')))
        const songs = parseSongXml(root, name)
        songs.forEach(song => content.presentation(song))
        if (songs.length) content.warn(`${name}: ${songs.length} song(s) read from an OpenLyrics/OpenSong document.`)
        continue
      }
      let found = 0, asked = 0
      const consider = (table: ReturnType<typeof sqliteTables>[number] | ReturnType<typeof jsonTables>[number], read: (limit: number) => Record<string, unknown>[]) => {
        const assessed = assess(table, name, content.recipes[table.signature], table.signature ? content.answers[sha(`${name}|${table.signature}`)] : undefined)
        if (!assessed.question) return
        content.questions.push(assessed.question)
        if (!assessed.choice) { asked++; return }
        if (assessed.choice === 'skip') return
        const songs = tableSongs(table, assessed.choice, read)
        songs.forEach(song => content.presentation(song))
        found += songs.length
        if (assessed.question.answer && !assessed.question.remembered && content.answers[assessed.question.id] === undefined) content.warn(`${name} › ${table.name}: ${songs.length} song(s) read by guessing the title and lyrics columns. Check a few before importing.`)
      }
      if (source.kind === 'sqlite') {
        const db = openDatabase(source.file)
        try { for (const table of sqliteTables(db)) consider(table, table.read) } finally { db.close() }
      } else if (source.kind === 'json') {
        for (const table of jsonTables(safeJson((await readSmall(source.file)).toString('utf8').replace(/^\uFEFF/, '')))) consider(table, () => allRows(table))
      } else {
        for (const table of xmlTables(readXml(xmlWithBreaks((await readSmall(source.file)).toString('utf8').replace(/^\uFEFF/, ''))))) consider(table, () => allRows(table))
      }
      if (!found && !asked) content.warn(`${name}: no song-shaped records were found in this file.`)
    } catch (error) { content.warn(`${name}: ${message(error)}`) }
  }
}

/** Conservative mapping of readable theme properties. No raw JSON/CSS/URLs reach the renderer. */
async function pewTheme(content: Content, theme: unknown, directory: string) {
  if (!object(theme) || typeof theme.name !== 'string' || !theme.name.trim()) throw new Error('The theme needs a name and recognized display settings. This export structure is not supported yet.')
  const text = object(theme.text) ? theme.text : object(theme.verse) ? theme.verse : theme
  const background = object(theme.background) ? theme.background : {}
  const display: Record<string, unknown> = {}
  const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i.test(value) ? value : undefined
  const numeric = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined
  const size = numeric(text.fontSize, 8, 200)
  const ink = color(text.color ?? theme.textColor)
  const font = text.fontFamily
  if (size !== undefined) display.defaultFontSize = size
  if (ink) display.defaultTextColor = ink
  if (typeof font === 'string' && font.length < 120 && /^[\p{L}\p{N} _-]+$/u.test(font)) display.defaultFontFamily = font
  const weight = numeric(text.fontWeight, 100, 900)
  if (weight !== undefined) display.defaultFontWeight = weight
  const backgroundColor = color(background.color ?? theme.backgroundColor)
  const image = background.image ?? background.imageUrl ?? theme.backgroundImage
  if (typeof image === 'string' && image) {
    let resolved = resolveSource(image, content.sources)
    const embedded = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(image)
    if (embedded) {
      const bytes = Buffer.from(embedded[2], 'base64')
      if (bytes.length > 8 * 1024 ** 2) throw new Error(`${theme.name}: embedded image exceeds 8 MiB.`)
      const file = path.join(directory, `${key()}.${embedded[1] === 'jpeg' ? 'jpg' : embedded[1]}`)
      await fs.writeFile(file, bytes)
      resolved = { name: `${theme.name}.${ext(file).slice(1)}`, file }
    }
    const media = resolved && content.addMedia(resolved)
    if (media) display.defaultBackgroundUrl = media.url
    else content.warn(`${theme.name}: background image is missing or unsupported. Select the original image alongside the theme.`)
  } else if (backgroundColor) {
    const file = path.join(directory, `${key()}.svg`)
    await fs.writeFile(file, `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><path fill="${backgroundColor}" d="M0 0h1920v1080H0z"/></svg>`)
    display.defaultBackgroundUrl = pathToFileURL(file).href
  }
  if (!Object.keys(display).length) throw new Error(`${theme.name}: no recognized display properties. Export the theme again or provide a sample of this version’s format.`)
  ;(content.snapshot.categories.themes ??= []).push({ id: key(), label: theme.name, data: display })
  content.warn('PewBeam theme import maps recognized font, text color, and background properties only. Choose one theme per import. Positioning, gradients, shadows, and other effects need review; missing fonts need a replacement.')
}

function message(error: unknown) { return error instanceof Error ? error.message : 'The file could not be read.' }

/** Convert into an immutable temporary .tri package; preview and commit then reuse the existing transaction. */
export async function convertForeign(paths: string[], options: ConvertOptions = {}): Promise<ConvertedImport> {
  if (!paths.length || paths.length > IMPORT_LIMITS.files) throw new Error('Choose between 1 and 200 export files.')
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'trilorah-foreign-'))
  try {
    const sources: SourceFile[] = []
    let total = 0, expanded = 0, entries = 0
    const expand = async (entry: SourceFile, depth = 0) => {
      const extension = ext(entry.name)
      if (await isZip(entry.file)) {
        if (depth >= 4) throw new Error('The export contains too many nested archives. Select the presentation bundle directly.')
        const added = await unpack(entry.file, path.join(directory, key()), {
          maxBytes: IMPORT_LIMITS.bytes - expanded, maxEntries: IMPORT_LIMITS.entries - entries,
          easyWorshipCrc: extension === '.ewsx',
        })
        entries += added.length
        for (const child of added) {
          expanded += (await fs.stat(child.file)).size
          if (expanded > IMPORT_LIMITS.bytes) throw new Error('The selected exports expand to more than 2 GiB.')
        }
        // Office documents are ZIPs too, but they are read whole by the Word reader.
        if (extension === '.docx') { sources.push(entry); return }
        for (const child of added) await expand(child, depth + 1)
      } else {
        // Nested entries have already consumed the extraction budget above.
        if (depth === 0) { entries++; expanded += (await fs.stat(entry.file)).size }
        if (entries > IMPORT_LIMITS.entries) throw new Error('Too many files were found in the exports.')
        if (expanded > IMPORT_LIMITS.bytes) throw new Error('The selected exports expand to more than 2 GiB.')
        sources.push(entry)
      }
    }
    for (const file of paths) {
      const info = await fs.lstat(file)
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('Choose regular export files, not folders or links.')
      total += info.size
      if (total > IMPORT_LIMITS.bytes) throw new Error('Choose less than 2 GiB of files per import.')
      await expand({ name: base(file), file })
    }
    const content = new Content(sources, options.answers, options.recipes)
    const detected: Detected[] = []
    for (const entry of sources) {
      const result = await detect(entry)
      detected.push({ ...entry, ...result })
      if (result.kind === 'media') content.addMedia(entry)
      else if (result.kind === 'other-media' || result.kind === 'skip') content.warn(`${base(entry.name)}: ${result.reason}`)
    }
    const of = (...kinds: Kind[]) => detected.filter(entry => kinds.includes(entry.kind))
    if (of('pro', 'pro6', 'proplaylist').length) await proPresenter(content, of('pro', 'pro6', 'proplaylist'))
    if (of('ew-main', 'ew-songs', 'ew-words').length) await easyWorship(content, of('ew-main', 'ew-songs', 'ew-words'))
    if (of('theme').length) await themeFiles(content, of('theme'), directory)
    if (of('text', 'docx').length) await textFiles(content, of('text', 'docx'), directory)
    if (of('songxml', 'sqlite', 'json', 'xml').length) await tableFiles(content, of('songxml', 'sqlite', 'json', 'xml'))
    // The existing run loader accepts a single service item; combine chosen source order into one.
    const services = content.snapshot.categories.service
    if (services && services.length > 1) content.snapshot.categories.service = [{ id: 'current', label: 'Imported run of service', data: { segments: services.flatMap(service => service.data.segments) } }]
    const pending = content.questions.filter(question => question.answer === undefined)
    if (!Object.values(content.snapshot.categories).some(items => items?.length) && !pending.length) throw new Error([...content.warnings, 'No supported content was found.'].join('\n'))
    const title = (paths.length === 1 ? titleOf(paths[0]) : 'Imported from another app').slice(0, 200)
    const file = path.join(directory, 'converted.tri')
    const manifest = await writeTri(file, content.snapshot, title)
    // Only the snapshot archive is needed after this point. Original exports remain untouched.
    for (const entry of await fs.readdir(directory)) if (entry !== 'converted.tri') await fs.rm(path.join(directory, entry), { recursive: true, force: true })
    return { directory, file, manifest, warnings: [...content.warnings], questions: content.questions }
  } catch (error) { await fs.rm(directory, { recursive: true, force: true }); throw error }
}
