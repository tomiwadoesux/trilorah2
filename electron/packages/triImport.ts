import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { TriSnapshot, TriItem } from '../../shared/triPackage'
import { CHURCH_KEYS, TOOL_KEYS, DISPLAY_KEYS } from './triCatalog'
import { validateTeaching } from '../preachers/teaching'

export interface ImportPlan {
  snapshot: TriSnapshot
  files: Map<string, unknown>
  settings: Record<string, unknown>
}
const object = (v: any): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const array = (v: any, name: string): any[] => { if (!Array.isArray(v)) throw new Error(`Invalid ${name} in this package.`); return v }
const strings = (v: any, name: string) => { if (array(v, name).some(item => typeof item !== 'string')) throw new Error(`Invalid ${name} in this package.`) }
const count = (v: any) => Number.isSafeInteger(v) && v >= 0
function read(file: string, fallback: any) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback
}
function plain(value: any): any {
  if (Array.isArray(value)) return value.map(plain)
  if (object(value)) {
    const out: Record<string, any> = {}
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid object key in package.')
      out[key] = plain(child)
    }
    return out
  }
  return value
}

/** Build all changes before writing. Imported records receive fresh identities:
 * existing songs, profiles and learning are never overwritten by a shared file. */
export function planTriImport(userData: string, incoming: TriSnapshot, currentSettings: Record<string, any>, openService: boolean): ImportPlan {
  const snapshot: TriSnapshot = plain(incoming)
  const files = new Map<string, unknown>()
  const settings: Record<string, unknown> = {}
  const categories = snapshot.categories
  const maps = { songs: new Map<string, string>(), media: new Map<string, string>(), presentations: new Map<string, string>(), preachers: new Map<string, string>() }
  for (const category of Object.keys(maps) as Array<keyof typeof maps>) {
    for (const item of categories[category] ?? []) maps[category].set(item.id, `tri-${randomUUID()}`)
  }
  const remap = (value: any): any => {
    if (Array.isArray(value)) return value.map(remap)
    if (!object(value)) return value
    const result: Record<string, any> = {}
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string' && key === 'songId') result[key] = maps.songs.get(child) ?? child
      else if (typeof child === 'string' && key === 'backgroundId') result[key] = maps.media.get(child) ?? child
      else if (typeof child === 'string' && key === 'deckId') result[key] = maps.presentations.get(child) ?? child
      else if (typeof child === 'string' && key === 'preacherId') result[key] = maps.preachers.get(child) ?? child
      else result[key] = remap(child)
    }
    return result
  }
  for (const items of Object.values(categories)) for (const item of items ?? []) item.data = remap(item.data)

  if (categories.songs?.length) {
    const target = path.join(userData, 'songs.json')
    const saved = read(target, { version: 1, songs: [], deletedSeeds: [] })
    array(saved.songs, 'existing song library')
    for (const item of categories.songs) {
      const song = item.data
      if (!object(song) || typeof song.title !== 'string' || !song.title.trim()) throw new Error('A song is missing its title.')
      for (const section of array(song.sections, 'song sections')) {
        if (!object(section) || typeof section.label !== 'string' || array(section.lines, 'song lyrics').some(line => typeof line !== 'string')) throw new Error('Invalid song lyrics.')
      }
      item.id = maps.songs.get(item.id)!
      song.id = item.id
      song.source = 'imported'
      delete song.seedKey
      saved.songs.push(song)
    }
    files.set(target, saved)
  }

  const storedRenderer = object(currentSettings.triRendererState) ? currentSettings.triRendererState : {}
  const renderer = { ...storedRenderer, media: [...(storedRenderer.media ?? [])], customDecks: [...(storedRenderer.customDecks ?? [])] }
  for (const item of categories.media ?? []) {
    if (!object(item.data) || typeof item.data.label !== 'string') throw new Error('Invalid media library item.')
    item.id = maps.media.get(item.id)!
    item.data.id = item.id
    renderer.media.push(item.data)
  }
  if (categories.presentations?.length) {
    const target = path.join(userData, 'presentations.json')
    const saved = array(read(target, []), 'existing presentations')
    for (const item of categories.presentations) {
      const { kind, value } = item.data ?? {}
      if (!object(value) || typeof value.title !== 'string' || !['imported', 'custom'].includes(kind)) throw new Error('Invalid presentation.')
      if (kind === 'imported' && array(value.slides, 'presentation slides').some(slide => typeof slide !== 'string')) throw new Error('Invalid presentation slides.')
      if (kind === 'custom' && (!object(value.spec) || !Array.isArray(value.spec.sections))) throw new Error('Invalid custom slide.')
      item.id = maps.presentations.get(item.id)!
      value.id = item.id
      if (kind === 'imported') saved.push(value)
      else renderer.customDecks.push(value)
    }
    files.set(target, saved)
  }
  if (categories.media?.length || categories.presentations?.length) settings.triRendererState = renderer

  const preacherFiles: Record<string, string> = { profile: 'preacher-profiles', teaching: 'preacher-teaching', ledger: 'preacher-ledgers', vocabulary: 'vocabulary', commands: 'preacher-commands', commandLog: 'command-log' }
  for (const item of categories.preachers ?? []) {
    const data = item.data
    if (!object(data) || !object(data.profile) || typeof data.profile.name !== 'string') throw new Error('Invalid preacher profile.')
    const oldId = item.id
    item.id = maps.preachers.get(oldId)!
    data.profile.id = item.id
    data.profile.favoriteVerses = array(data.profile.favoriteVerses ?? [], 'favourite verses')
    data.profile.commonTopics = array(data.profile.commonTopics ?? [], 'preacher topics')
    data.profile.sermonHistory = array(data.profile.sermonHistory ?? [], 'sermon history')
    if (data.profile.favoriteVerses.some((v: any) => !object(v) || typeof v.ref !== 'string' || !count(v.frequency))) throw new Error('Invalid favourite-verse history.')
    strings(data.profile.commonTopics, 'preacher topics')
    if (data.teaching) validateTeaching(data.teaching)
    if (data.vocabulary) strings(data.vocabulary.terms, 'preacher vocabulary')
    if (data.commands) {
      for (const [key, value] of Object.entries(data.commands)) {
        if (key === 'versionPhrases') {
          for (const version of array(value, 'translation commands')) {
            if (!object(version) || typeof version.code !== 'string') throw new Error('Invalid translation command.')
            strings(version.phrases, 'translation command phrases')
          }
        } else strings(value, 'voice command phrases')
      }
    }
    if (data.ledger) {
      for (const field of ['samples', 'services']) array(data.ledger[field], `preacher ${field}`)
      if (!object(data.ledger.aliases)) throw new Error('Invalid learned book aliases.')
      if (Object.values(data.ledger.aliases).some(value => typeof value !== 'string')) throw new Error('Invalid learned book alias.')
      for (const sample of data.ledger.samples) {
        if (!object(sample) || typeof sample.heard !== 'string' || typeof sample.correctedTo !== 'string' || !['operator', 'voice', 'system'].includes(sample.source) || !count(sample.ts)) throw new Error('Invalid preacher correction evidence.')
      }
      for (const service of data.ledger.services) {
        if (!object(service) || typeof service.date !== 'string' || !['detections', 'confirmed', 'corrections'].every(key => count(service[key]))) throw new Error('Invalid preacher service evidence.')
      }
      data.ledger.preacherId = item.id
      data.ledger.autoModeEnabled = false
      delete data.ledger.activeService
      for (const review of array(data.ledger.reviews ?? [], 'preacher reviews')) {
        if (!object(review)) throw new Error('Invalid preacher review.')
        review.preacherId = item.id
      }
    }
    if (data.commandLog) {
      data.commandLog.preacherId = item.id
      strings(data.commandLog.neverTreatAsCommand ?? [], 'ignored commands')
      for (const entry of array(data.commandLog.entries ?? [], 'command history')) {
        if (!object(entry) || typeof entry.utterance !== 'string' || typeof entry.kind !== 'string' || !count(entry.ts)) throw new Error('Invalid command history.')
        entry.preacherId = item.id
      }
    }
    for (const [key, folder] of Object.entries(preacherFiles)) {
      if (data[key] !== undefined) {
        if (!object(data[key])) throw new Error(`Invalid preacher ${key}.`)
        files.set(path.join(userData, folder, `${item.id}.json`), data[key])
      }
    }
  }

  const layout = categories.themes?.find(item => item.id === 'layout')?.data
  if (layout) {
    if (!object(layout)) throw new Error('Invalid theme layout.')
    settings.triThemeLayout = layout
  }
  const display = categories.themes?.find(item => item.id === 'display')?.data
  if (display) {
    if (!object(display)) throw new Error('Invalid display settings.')
    const allowed = Object.fromEntries(DISPLAY_KEYS.filter(key => Object.hasOwn(display, key)).map(key => [key, display[key]]))
    settings.triThemeDisplay = allowed // stage the theme; never change a live wall during import
    categories.themes!.find(item => item.id === 'display')!.data = allowed
  }
  for (const [category, allowed] of [['church', CHURCH_KEYS], ['tools', TOOL_KEYS]] as const) {
    for (const item of categories[category] ?? []) {
      if (!object(item.data)) throw new Error(`Invalid ${category} settings.`)
      for (const key of allowed) if (Object.hasOwn(item.data, key)) {
        const value = item.data[key]
        if (['timers', 'alertPresets', 'scheduleTemplates', 'serviceSchedule'].includes(key)) array(value, key)
        else if (typeof value !== (key === 'alertDefaultSeconds' ? 'number' : 'string')) throw new Error(`Invalid ${key} in this package.`)
        if (key === 'alertPresets') strings(value, 'alert messages')
        // Library-like tool lists merge as copies, keeping this church's existing definitions.
        if (key === 'timers' || key === 'scheduleTemplates') {
          item.data[key] = value.map((entry: any) => {
            if (!object(entry)) throw new Error(`Invalid ${key} entry.`)
            if (key === 'timers' && (typeof entry.name !== 'string' || !['countdown', 'to-time', 'elapsed'].includes(entry.kind)
              || (entry.kind === 'countdown' && !(typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec) && entry.durationSec > 0))
              || (entry.kind === 'to-time' && !(typeof entry.targetTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.targetTime))))) throw new Error('Invalid timer definition.')
            return { ...entry, id: `tri-${randomUUID()}` }
          })
          settings[key] = [...(Array.isArray(currentSettings[key]) ? currentSettings[key] : []), ...item.data[key]]
        } else if (key === 'alertPresets') settings[key] = [...new Set([...(Array.isArray(currentSettings[key]) ? currentSettings[key] : []), ...value])]
        else settings[key] = value
      }
    }
  }
  for (const item of categories.records ?? []) {
    const filename = `tri-${randomUUID()}.json`
    item.id = `service-log:${filename}`
    const record = item.data?.kind === 'service-log' ? item.data.value : item.data
    if (!object(record)) throw new Error('Invalid service record.')
    files.set(path.join(userData, 'service-logs', filename), record)
  }
  for (const item of categories.folders ?? []) {
    const data = item.data
    if (!object(data) || !['songs', 'media', 'presentations'].includes(data.libraryId)) throw new Error('Invalid library folder index.')
    const libraryId = data.libraryId as 'songs' | 'media' | 'presentations'
    const target = path.join(userData, 'library-folders', `${libraryId}.json`)
    const saved = read(target, { version: 1, folders: [], items: {} })
    array(saved.folders, 'existing folders')
    if (!object(saved.items) || !object(data.items)) throw new Error('Invalid folder memberships.')
    const folderIds = new Map<string, string>()
    for (const folder of array(data.folders, 'folders')) {
      if (!object(folder) || typeof folder.id !== 'string' || typeof folder.name !== 'string') throw new Error('Invalid folder.')
      const id = `tri-${randomUUID()}`
      folderIds.set(folder.id, id)
      saved.folders.push({ ...folder, id, order: saved.folders.length })
    }
    for (const [oldItem, oldFolder] of Object.entries(data.items)) {
      const newItem = maps[libraryId].get(oldItem)
      const newFolder = folderIds.get(String(oldFolder))
      if (newItem && newFolder) saved.items[newItem] = newFolder
    }
    files.set(target, saved)
  }
  const services = categories.service ?? []
  const serviceSegments: any[] = []
  for (const item of services) {
    const segments = array(item.data?.segments, 'run of service')
    for (const segment of segments) {
      if (!object(segment) || typeof segment.type !== 'string' || typeof segment.label !== 'string') throw new Error('Invalid service segment.')
      segment.key = `tri-${randomUUID()}`
      for (const queued of array(segment.items, 'service items')) {
        if (!object(queued) || !['song', 'scripture', 'presentation', 'media', 'note'].includes(queued.source) || typeof queued.label !== 'string') throw new Error('Invalid queued item.')
        queued.key = `tri-${randomUUID()}`
      }
    }
    serviceSegments.push(...segments)
  }
  if (services.length) {
    const existing = currentSettings.operatorRunV1
    const before = Array.isArray(existing) ? existing : existing?.segments ?? []
    settings.operatorRunV1 = { segments: openService ? serviceSegments : [...before, ...serviceSegments], updatedAt: Date.now() }
    // The renderer consumes the incoming portion and appends/replaces its own store.
    // Keep one current-run identity so a subsequent save retains every selection.
    categories.service = [{
      ...services[0], id: 'current',
      label: services.length === 1 ? services[0].label : 'Imported run of service',
      data: { ...services[0].data, segments: serviceSegments },
    }]
  }
  return { snapshot, files, settings }
}

/** Stage every JSON file first; restore original bytes and settings on failure. */
export function commitTriImport(plan: ImportPlan, getSettings: () => Record<string, any>, setSettings: (values: Record<string, unknown>) => void): void {
  const originals = new Map<string, Buffer | null>()
  const tempFiles: string[] = []
  const originalSettings = getSettings()
  const token = randomUUID()
  try {
    for (const [file, value] of plan.files) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      originals.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null)
      const temp = `${file}.${token}.tmp`
      tempFiles.push(temp)
      fs.writeFileSync(temp, JSON.stringify(value, null, 2), { flag: 'wx' })
    }
    let at = 0
    for (const file of plan.files.keys()) fs.renameSync(tempFiles[at++], file)
    setSettings({ ...originalSettings, ...plan.settings })
  } catch (error) {
    const restoreErrors: string[] = []
    for (const [file, bytes] of originals) {
      try { if (bytes) fs.writeFileSync(file, bytes); else fs.rmSync(file, { force: true }) } catch { restoreErrors.push(path.basename(file)) }
    }
    try { setSettings(originalSettings) } catch { restoreErrors.push('settings') }
    if (restoreErrors.length) throw new Error(`Import failed; could not restore ${restoreErrors.join(', ')}. ${error instanceof Error ? error.message : error}`)
    throw error
  } finally {
    for (const temp of tempFiles) { try { fs.rmSync(temp, { force: true }) } catch { /* committed temp no longer exists */ } }
  }
}
