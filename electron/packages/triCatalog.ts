import fs from 'node:fs'
import path from 'node:path'
import type { TriRendererState } from '../../shared/triBridge'
import { TRI_CATEGORIES } from '../../shared/triPackage'
import type { TriCategory, TriItem, TriSelection, TriSnapshot } from '../../shared/triPackage'

/** Portable appearance only: never output device IDs, credentials or engine gates. */
export const DISPLAY_KEYS = [
  'textTransition', 'textTransitionMs', 'defaultFontSize', 'defaultFontFamily',
  'defaultFontWeight', 'defaultTextColor', 'overlayOpacity', 'defaultBackgroundUrl',
  'backgroundBlur', 'backgroundFit', 'backgroundPosition', 'accentId', 'colorMode',
  'uiFont', 'scriptureFontPreset', 'displayVersion', 'secondaryVersion',
  'streamLayout', 'verseLayout', 'safeMargin', 'refScale', 'refGap', 'stageShowClock',
  'stageShowNext', 'stageShowVerseText', 'stageShowTimer', 'stageShowElapsed',
  'breakOnVerse', 'showVerseNumbers', 'referenceMode', 'showTranslation', 'maxCharsPerSlide',
] as const

export const CHURCH_KEYS = [
  'churchName', 'churchLogoUrl', 'churchBrandColor', 'givingZelle', 'givingVenmo',
  'givingCashApp', 'givingPaypal', 'givingBankInfo', 'givingCustomUrl', 'givingNote',
  'publicWebUrl', 'streamUrl', 'qrCompanionCaption', 'qrBackgroundPath',
] as const

export const TOOL_KEYS = [
  'timers', 'alertPresets', 'alertDefaultSeconds', 'scheduleTemplates',
  'serviceSchedule', 'serviceStartTime', 'serviceEndTime',
] as const

const PREACHER_FILES = {
  teaching: 'preacher-teaching',
  ledger: 'preacher-ledgers',
  vocabulary: 'vocabulary',
  commands: 'preacher-commands',
  commandLog: 'command-log',
} as const

function object(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function invalid(file: string): never {
  throw new Error(`Could not read saved content in ${file}. Repair the file before exporting.`)
}

/** A missing optional store is normal; an unreadable or malformed store is not. */
function readJson(file: string): unknown | undefined {
  let text: string
  try { text = fs.readFileSync(file, 'utf8') }
  catch (error: any) {
    if (error.code === 'ENOENT') return undefined
    return invalid(file)
  }
  try { return JSON.parse(text) }
  catch { return invalid(file) }
}

function readObject(file: string): Record<string, any> | undefined {
  const value = readJson(file)
  if (value === undefined) return undefined
  if (!object(value)) return invalid(file)
  return value
}

function jsonFiles(dir: string): string[] {
  try { return fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort() }
  catch (error: any) {
    if (error.code === 'ENOENT') return []
    return invalid(dir)
  }
}

function safeId(id: string): string { return id.replace(/[^a-zA-Z0-9_-]/g, '_') }

function pick(settings: Record<string, any>, keys: readonly string[]): Record<string, any> {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(settings, key) && settings[key] !== undefined)
    .map(key => [key, settings[key]]))
}

function libraryItems(values: unknown, labelKey: string, source: string): TriItem[] {
  if (!Array.isArray(values)) return invalid(source)
  const seen = new Set<string>()
  return values.map(value => {
    if (!object(value) || !nonempty(value.id) || !nonempty(value[labelKey]) || seen.has(value.id)) return invalid(source)
    seen.add(value.id)
    return { id: value.id, label: value[labelKey], data: value }
  })
}

function preacherItems(userData: string): TriItem[] {
  const profiles = new Map<string, Record<string, any>>()
  const profileDir = path.join(userData, 'preacher-profiles')
  for (const filename of jsonFiles(profileDir)) {
    const file = path.join(profileDir, filename)
    const profile = readObject(file)
    if (!profile || !nonempty(profile.id) || !nonempty(profile.name) || filename !== `${safeId(profile.id)}.json` || profiles.has(profile.id)) return invalid(file)
    profiles.set(profile.id, profile)
  }

  // Older installations can have verified learning before a profile was saved.
  // Recover only when the ledger itself provides a consistent identity and name.
  const ledgerDir = path.join(userData, 'preacher-ledgers')
  for (const filename of jsonFiles(ledgerDir)) {
    const file = path.join(ledgerDir, filename)
    const ledger = readObject(file)
    if (!ledger || !nonempty(ledger.preacherId) || filename !== `${safeId(ledger.preacherId)}.json`) return invalid(file)
    if (profiles.has(ledger.preacherId) || !nonempty(ledger.name)) continue
    const timestamp = fs.statSync(file).mtime.toISOString()
    profiles.set(ledger.preacherId, {
      id: ledger.preacherId, name: ledger.name, favoriteVerses: [], commonTopics: [],
      speechPatterns: [], sermonHistory: [], createdAt: timestamp, updatedAt: timestamp,
    })
  }

  return [...profiles.values()].map(profile => {
    const data: Record<string, any> = { profile }
    for (const [key, directory] of Object.entries(PREACHER_FILES)) {
      const file = path.join(userData, directory, `${safeId(profile.id)}.json`)
      const saved = readObject(file)
      if (!saved) continue
      if (saved.preacherId !== undefined && saved.preacherId !== profile.id) return invalid(file)
      data[key] = saved
    }
    return { id: profile.id, label: profile.name, data }
  })
}

export function buildTriCatalog(
  userData: string,
  settings: Record<string, any>,
  renderer: TriRendererState,
  songs: any[],
  extraRecords: TriItem[] = [],
): TriSnapshot {
  const categories: TriSnapshot['categories'] = {
    service: [{ id: 'current', label: 'Current run of service', data: { segments: renderer.run, updatedAt: Date.now() } }],
    songs: libraryItems(songs, 'title', 'song library'),
    media: libraryItems(renderer.media, 'label', 'media library'),
    preachers: preacherItems(userData),
  }
  const presentationFile = path.join(userData, 'presentations.json')
  const imported = libraryItems(readJson(presentationFile) ?? [], 'title', presentationFile)
    .map(item => ({ ...item, data: { kind: 'imported', value: item.data } }))
  const custom = libraryItems(renderer.customDecks, 'title', 'custom presentations')
    .map(item => ({ ...item, data: { kind: 'custom', value: item.data } }))
  const presentationIds = new Set(imported.map(item => item.id))
  if (custom.some(item => presentationIds.has(item.id))) return invalid('presentation library (duplicate IDs)')
  categories.presentations = [...imported, ...custom]

  categories.themes = []
  if (renderer.theme !== undefined) {
    if (!object(renderer.theme)) return invalid('theme layout')
    categories.themes.push({ id: 'layout', label: 'Theme layout', data: renderer.theme })
  }
  const display = pick({ ...settings, ...(object(settings.triThemeDisplay) ? settings.triThemeDisplay : {}) }, DISPLAY_KEYS)
  if (Object.keys(display).length) categories.themes.push({ id: 'display', label: 'Display appearance', data: display })
  const church = pick(settings, CHURCH_KEYS)
  categories.church = Object.keys(church).length ? [{ id: 'identity', label: church.churchName || 'Church information', data: church }] : []
  const tools = pick(settings, TOOL_KEYS)
  categories.tools = Object.keys(tools).length ? [{ id: 'settings', label: 'Timers, templates and alerts', data: tools }] : []

  categories.folders = []
  for (const libraryId of ['songs', 'media', 'presentations']) {
    const file = path.join(userData, 'library-folders', `${libraryId}.json`)
    const saved = readObject(file)
    if (!saved) continue
    if (!Array.isArray(saved.folders) || !object(saved.items)) return invalid(file)
    categories.folders.push({ id: libraryId, label: `${libraryId[0].toUpperCase()}${libraryId.slice(1)} folders`, data: { ...saved, libraryId } })
  }

  const logDir = path.join(userData, 'service-logs')
  categories.records = jsonFiles(logDir).map(filename => {
    const file = path.join(logDir, filename)
    const value = readObject(file)
    if (!value) return invalid(file)
    return { id: `service-log:${filename}`, label: `Service record — ${value.date || filename}`, data: { kind: 'service-log', filename, value } }
  })
  const recordIds = new Set(categories.records.map(item => item.id))
  for (const record of extraRecords) {
    if (!nonempty(record.id) || !nonempty(record.label) || recordIds.has(record.id)) return invalid('saved service records (invalid or duplicate IDs)')
    recordIds.add(record.id)
    categories.records.push(record)
  }
  return structuredClone({ categories })
}

/** Compare the same local asset in bare-path, file:// and display-URL form. */
function assetKey(value: unknown): string | undefined {
  if (!nonempty(value)) return undefined
  const embedded = /^tri-asset:([a-f0-9]{64}):(path|url)$/.exec(value)
  if (embedded) return `tri-asset:${embedded[1]}`
  let text = value
  const local = /^(?:file:\/\/|local-media:\/\/file\/)/i.test(text) || /^[a-z]:[\\/]/i.test(text)
  if (/^file:\/\//i.test(text)) {
    text = text.replace(/^file:\/\//i, '')
    if (!text.startsWith('/')) text = `//${text}`
  } else text = text.replace(/^local-media:\/\/file\//i, '/')
  try { text = decodeURIComponent(text) } catch { /* Keep valid literal percent signs. */ }
  text = text.replace(/\\/g, '/')
  if (/^\/+[a-z]:\//i.test(text)) text = text.replace(/^\/+/, '')
  return local && /^[a-z]:\//i.test(text) ? text.toLowerCase() : text
}

const ASSET_FIELDS = new Set(['path', 'url', 'preview', 'poster', 'pptxPath', 'sourcePptx', 'sourcePath', 'backgroundUrl', 'defaultBackgroundUrl', 'churchLogoUrl', 'qrBackgroundPath'])
const ASSET_ARRAY_FIELDS = new Set(['slides', 'paths', 'deckPaths'])

function assetKeys(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach(item => assetKeys(item, result))
  } else if (object(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (ASSET_FIELDS.has(key)) {
        const asset = assetKey(child)
        if (asset) result.add(asset)
      } else if (ASSET_ARRAY_FIELDS.has(key) && Array.isArray(child)) {
        child.forEach(item => { const asset = assetKey(item); if (asset) result.add(asset) })
      }
      if (child && typeof child === 'object') assetKeys(child, result)
    }
  }
  return result
}

function titleKey(value: unknown): string { return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '' }

/** Recompute dependencies against the current catalog on every save. */
export function selectTriContent(snapshot: TriSnapshot, selection: TriSelection): TriSnapshot {
  const selected = new Map<TriCategory, Set<string>>()
  const add = (category: TriCategory, id: string): boolean => {
    if (!TRI_CATEGORIES.includes(category)) return false
    if (!snapshot.categories[category]?.some(item => item.id === id)) return false
    let ids = selected.get(category)
    if (!ids) { ids = new Set(); selected.set(category, ids) }
    if (ids.has(id)) return false
    ids.add(id)
    return true
  }
  for (const [category, ids] of Object.entries(selection)) {
    if (Array.isArray(ids)) ids.forEach(id => add(category as TriCategory, id))
  }
  const chosen = (category: TriCategory) => (snapshot.categories[category] ?? []).filter(item => selected.get(category)?.has(item.id))
  const presentations = (snapshot.categories.presentations ?? []).map(item => ({ item, paths: assetKeys(item.data?.value) }))
  const media = (snapshot.categories.media ?? []).map(item => ({ item, paths: assetKeys(item.data) }))

  let changed = true
  while (changed) {
    changed = false
    const include = (category: TriCategory, id: string) => { if (add(category, id)) changed = true }
    for (const service of chosen('service')) {
      for (const segment of service.data?.segments ?? []) {
        for (const row of segment.items ?? []) {
          if (row.source === 'song') {
            if (nonempty(row.songId)) include('songs', row.songId)
            else {
              const title = titleKey(row.title || row.label)
              if (title) for (const song of snapshot.categories.songs ?? []) if (titleKey(song.data?.title) === title) include('songs', song.id)
            }
          }
          const paths = assetKeys(row)
          for (const entry of media) if ([...entry.paths].some(asset => paths.has(asset))) include('media', entry.item.id)
          if (row.source === 'presentation') {
            const direct = presentations.filter(entry => entry.item.id === row.deckId || [...entry.paths].some(asset => paths.has(asset)))
            const title = titleKey(row.title || row.label)
            const matches = direct.length ? direct : presentations.filter(entry => title && titleKey(entry.item.data?.value?.title) === title)
            for (const entry of matches) include('presentations', entry.item.id)
          }
        }
      }
    }
    for (const theme of chosen('themes')) {
      if (theme.id === 'layout' && nonempty(theme.data?.backgroundId)) include('media', theme.data.backgroundId)
    }
    for (const item of [...chosen('themes'), ...chosen('presentations'), ...chosen('church')]) {
      const paths = assetKeys(item.data)
      for (const entry of media) if ([...entry.paths].some(asset => paths.has(asset))) include('media', entry.item.id)
    }
    for (const libraryId of ['songs', 'media', 'presentations'] as const) {
      if (chosen(libraryId).length) include('folders', libraryId)
    }
  }
  const categories: TriSnapshot['categories'] = {}
  for (const category of selected.keys()) categories[category] = chosen(category)
  return structuredClone({ ...snapshot, categories })
}
