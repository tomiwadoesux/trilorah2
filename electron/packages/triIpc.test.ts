import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TriRendererState } from '../../shared/triBridge'
import type { TriSnapshot } from '../../shared/triPackage'
import { inspectTri, writeTri } from './triArchive'
import { registerTriPackages } from './triIpc'
import { pro6Fixture, zipFixture } from '../importers/fixtures'

const electron = vi.hoisted(() => ({
  paths: {} as Record<string, string>,
  handlers: new Map<string, (event: any, argument?: any) => Promise<any>>(),
  save: vi.fn(),
  open: vi.fn(),
  on: vi.fn(),
}))

vi.mock('electron', () => ({
  app: { getPath: (name: string) => electron.paths[name], on: electron.on },
  dialog: { showSaveDialog: electron.save, showOpenDialog: electron.open },
  ipcMain: { handle: (channel: string, handler: (event: any, argument?: any) => Promise<any>) => electron.handlers.set(channel, handler) },
}))

let dir: string
let settings: Record<string, any>
let imported: ReturnType<typeof vi.fn>
let replaceSettings: ReturnType<typeof vi.fn>

function call(channel: string, argument?: any, sender = 71) {
  return electron.handlers.get(channel)!({ sender: { id: sender } }, argument)
}

function state(): TriRendererState {
  return { run: [{ key: 'opening', type: 'worship', label: 'Opening worship', items: [] }], media: [], customDecks: [] }
}

function service(): TriSnapshot {
  return { categories: { service: [{ id: 'current', label: 'Sunday', data: { segments: state().run, updatedAt: 1 } }] } }
}

function all(snapshot: TriSnapshot) {
  return Object.fromEntries(Object.entries(snapshot.categories).map(([category, items]) => [category, items?.map(item => item.id) ?? []]))
}

async function preview(snapshot: TriSnapshot, filename = 'source.tri') {
  const file = path.join(dir, filename)
  await writeTri(file, snapshot, 'Sunday')
  electron.open.mockResolvedValueOnce({ canceled: false, filePaths: [file] })
  const result = await call('tri-inspect')
  expect(result.error).toBeUndefined()
  return { ...result, file }
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-tri-ipc-'))
  electron.paths = { userData: path.join(dir, 'data'), documents: path.join(dir, 'Documents') }
  fs.mkdirSync(electron.paths.userData, { recursive: true })
  electron.handlers.clear()
  electron.save.mockReset().mockResolvedValue({ canceled: true })
  electron.open.mockReset().mockResolvedValue({ canceled: true, filePaths: [] })
  electron.on.mockReset()
  settings = { triActiveFile: { title: 'Untitled service' } }
  imported = vi.fn()
  replaceSettings = vi.fn(values => { settings = structuredClone(values) })
  registerTriPackages({
    window: () => ({ webContents: { id: 71, send: vi.fn() }, show: vi.fn(), focus: vi.fn() }) as any,
    settings: () => settings,
    replaceSettings,
    songs: () => {
      const file = path.join(electron.paths.userData, 'songs.json')
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).songs : []
    },
    records: () => [],
    imported,
  })
})

afterEach(() => {
  const resolved = path.resolve(dir)
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('trilorah-tri-ipc-')) throw new Error('Unexpected test directory')
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
})

describe('native .tri workflow', () => {
  it('leaves the current file and recent list unchanged when native Save or Open is canceled', async () => {
    settings.triActiveFile = { path: path.join(dir, 'current.tri'), title: 'Current' }
    const before = structuredClone(settings)
    expect(await call('tri-save', { title: 'New copy', state: state(), selection: { service: ['current'] }, saveAs: true })).toEqual({ canceled: true })
    expect(await call('tri-inspect')).toEqual({ canceled: true })
    expect(settings).toEqual(before)
    expect(imported).not.toHaveBeenCalled()
  })

  it('uses Documents/Trilorah/Services and saves again to the active file without another dialog', async () => {
    const file = path.join(dir, 'Sunday')
    electron.save.mockResolvedValueOnce({ canceled: false, filePath: file })
    const first = await call('tri-save', { title: 'Sunday', state: state(), selection: { service: ['current'] } })
    expect(first.error).toBeUndefined()
    expect(first.path).toBe(`${file}.tri`)
    expect(electron.save.mock.calls[0][1].defaultPath).toBe(path.join(electron.paths.documents, 'Trilorah', 'Services', 'Sunday.tri'))
    const changed = state()
    changed.run[0].label = 'Changed worship'
    const second = await call('tri-save', { title: 'Sunday', state: changed, selection: settings.triActiveFile.selection })
    expect(second.error).toBeUndefined()
    expect(electron.save).toHaveBeenCalledTimes(1)
    expect((await inspectTri(first.path)).categories.service![0].data.segments[0].label).toBe('Changed worship')
    expect(settings.triRecentFiles).toEqual([{ path: first.path, title: 'Sunday' }])
  })

  it('exports a copy without changing or overwriting the active service', async () => {
    const active = path.join(dir, 'active.tri')
    await writeTri(active, service(), 'Active')
    const original = fs.readFileSync(active)
    settings.triActiveFile = { path: active, title: 'Active', selection: { service: ['current'] } }
    const target = path.join(dir, 'export.tri')
    electron.save.mockResolvedValueOnce({ canceled: false, filePath: target })
    const result = await call('tri-save', { title: 'Export', state: state(), selection: { service: ['current'] }, exportOnly: true })
    expect(result.path).toBe(target)
    expect(settings.triActiveFile).toEqual({ path: active, title: 'Active', selection: { service: ['current'] } })
    expect(fs.readFileSync(active)).toEqual(original)
    expect((await inspectTri(target)).title).toBe('Export')
  })

  it('opens a partial package without binding Save to the original source', async () => {
    const snapshot = service()
    snapshot.categories.records = [{ id: 'private-notes', label: 'Private notes', data: { text: 'Keep the original notes' } }]
    const opened = await preview(snapshot)
    const original = fs.readFileSync(opened.file)
    const result = await call('tri-import', { token: opened.token, selection: { service: ['current'] }, openService: true })
    expect(result.error).toBeUndefined()
    expect(settings.triActiveFile.path).toBeUndefined()
    expect(result.warnings.join(' ')).toContain('part of this package')
    const target = path.join(dir, 'partial-copy.tri')
    electron.save.mockResolvedValueOnce({ canceled: false, filePath: target })
    const saved = await call('tri-save', { title: 'Partial', state: { ...state(), run: result.snapshot.categories.service[0].data.segments }, selection: settings.triActiveFile.selection })
    expect(saved.path).toBe(target)
    expect(fs.readFileSync(opened.file)).toEqual(original)
    expect((await inspectTri(target)).categories.records).toBeUndefined()
  })

  it('keeps imported record selections resolvable when a fully opened package is saved again', async () => {
    const snapshot = service()
    snapshot.categories.records = [{ id: 'service-log:old.json', label: 'Prior service', data: { kind: 'service-log', filename: 'old.json', value: { date: '2026-10-03', segments: [], notes: 'Retain these notes' } } }]
    const opened = await preview(snapshot)
    const result = await call('tri-import', { token: opened.token, selection: all(opened.manifest), openService: true })
    expect(result.error).toBeUndefined()
    expect(settings.triActiveFile.path).toBe(opened.file)
    const saved = await call('tri-save', { title: 'Sunday', state: { ...state(), run: result.snapshot.categories.service[0].data.segments }, selection: settings.triActiveFile.selection })
    expect(saved.error).toBeUndefined()
    const records = (await inspectTri(opened.file)).categories.records!
    expect(records).toHaveLength(1)
    expect(records[0].data.value.notes).toBe('Retain these notes')
  })

  it('retains all selected services when opening a package and saving it again', async () => {
    const snapshot = service()
    snapshot.categories.service!.push({ id: 'second', label: 'Evening', data: { segments: [{ key: 'evening', type: 'custom', label: 'Evening service', items: [] }] } })
    const opened = await preview(snapshot)
    const result = await call('tri-import', { token: opened.token, selection: all(opened.manifest), openService: true })
    expect(result.error).toBeUndefined()
    expect(result.snapshot.categories.service).toHaveLength(1)
    const run = result.snapshot.categories.service[0].data.segments
    expect(run.map((segment: any) => segment.label)).toEqual(['Opening worship', 'Evening service'])
    expect(settings.operatorRunV1.segments).toEqual(run)
    expect(settings.triActiveFile.selection.service).toEqual(['current'])
    const saved = await call('tri-save', { title: 'Sunday', state: { ...state(), run }, selection: settings.triActiveFile.selection })
    expect(saved.error).toBeUndefined()
    expect((await inspectTri(saved.path)).categories.service![0].data.segments).toEqual(run)
  })

  it('imports chosen songs without extracting unselected media or changing the active file', async () => {
    const photo = path.join(dir, 'unused.png')
    fs.writeFileSync(photo, 'unused media bytes')
    const opened = await preview({ categories: {
      songs: [{ id: 'song', label: 'Grace', data: { id: 'song', title: 'Grace', sections: [{ label: 'Verse', lines: ['Amazing grace'] }], origin: 'manual' } }],
      media: [{ id: 'photo', label: 'Unused photo', data: { id: 'photo', label: 'Unused photo', url: photo } }],
    } })
    settings.triActiveFile = { path: path.join(dir, 'current.tri'), title: 'Current' }
    const result = await call('tri-import', { token: opened.token, selection: { songs: ['song'] }, openService: false })
    expect(result.error).toBeUndefined()
    expect(Object.keys(result.snapshot.categories)).toEqual(['songs'])
    expect(settings.triRendererState?.media ?? []).toEqual([])
    expect(settings.triActiveFile.title).toBe('Current')
    const assetDir = path.join(electron.paths.userData, 'packages')
    const files = fs.existsSync(assetDir) ? fs.readdirSync(assetDir, { recursive: true }) : []
    expect(files.some(file => String(file).endsWith('.png'))).toBe(false)
  })

  it('reconnects a selected service to its media library entry across embedded URL/path forms', async () => {
    const photo = path.join(dir, 'welcome.png')
    fs.writeFileSync(photo, 'welcome media bytes')
    const snapshot = service()
    snapshot.categories.service![0].data.segments[0].items.push({ key: 'welcome', source: 'media', label: 'Welcome', path: photo })
    snapshot.categories.media = [{ id: 'photo', label: 'Welcome', data: { id: 'photo', label: 'Welcome', url: pathToFileURL(photo).href } }]
    const opened = await preview(snapshot)
    const result = await call('tri-import', { token: opened.token, selection: { service: ['current'] }, openService: true })
    expect(result.error).toBeUndefined()
    expect(result.snapshot.categories.media).toHaveLength(1)
    expect(settings.triRendererState.media[0].id).toBe(result.snapshot.categories.media[0].id)
    expect(settings.triActiveFile.path).toBe(opened.file)
  })

  it('leaves the active file and libraries untouched if selected content is invalid', async () => {
    const opened = await preview({ categories: { songs: [{ id: 'bad', label: 'Bad song', data: { title: 'Bad song', sections: 'invalid' } }] } })
    settings.triActiveFile = { path: path.join(dir, 'current.tri'), title: 'Current' }
    const before = structuredClone(settings)
    const result = await call('tri-import', { token: opened.token, selection: { songs: ['bad'] }, openService: false })
    expect(result.error).toContain('song sections')
    expect(settings).toEqual(before)
    expect(fs.existsSync(path.join(electron.paths.userData, 'songs.json'))).toBe(false)
    expect(imported).not.toHaveBeenCalled()
  })

  it('rejects a changed package or another window before changing local state', async () => {
    const opened = await preview(service())
    await writeTri(opened.file, service(), 'Changed after inspection')
    const before = structuredClone(settings)
    const result = await call('tri-import', { token: opened.token, selection: { service: ['current'] }, openService: true })
    expect(result.error).toContain('changed after you opened')
    expect(settings).toEqual(before)
    await expect(call('tri-new', undefined, 999)).rejects.toThrow('main Trilorah window')
    expect(settings).toEqual(before)
  })

  it('removes only this import\'s extracted media if persistence fails after extraction', async () => {
    const photo = path.join(dir, 'welcome.png')
    fs.writeFileSync(photo, 'welcome media bytes')
    const opened = await preview({ categories: {
      media: [{ id: 'photo', label: 'Welcome', data: { id: 'photo', label: 'Welcome', url: pathToFileURL(photo).href } }],
    } })
    const packages = path.join(electron.paths.userData, 'packages')
    const existing = path.join(packages, 'tri-existing')
    fs.mkdirSync(existing, { recursive: true })
    fs.writeFileSync(path.join(existing, 'keep.png'), 'existing library media')
    const before = structuredClone(settings)
    replaceSettings.mockImplementationOnce(() => { throw new Error('simulated settings failure') })
    const result = await call('tri-import', { token: opened.token, selection: { media: ['photo'] }, openService: false })
    expect(result.error).toContain('simulated settings failure')
    expect(settings).toEqual(before)
    expect(imported).not.toHaveBeenCalled()
    expect(fs.readdirSync(packages)).toEqual(['tri-existing'])
    expect(fs.readFileSync(path.join(existing, 'keep.png'), 'utf8')).toBe('existing library media')
  })

  it('retains committed media if a subsequent refresh hook fails', async () => {
    const photo = path.join(dir, 'welcome.png')
    fs.writeFileSync(photo, 'welcome media bytes')
    const opened = await preview({ categories: {
      media: [{ id: 'photo', label: 'Welcome', data: { id: 'photo', label: 'Welcome', url: pathToFileURL(photo).href } }],
    } })
    imported.mockImplementationOnce(() => { throw new Error('simulated refresh failure') })
    const result = await call('tri-import', { token: opened.token, selection: { media: ['photo'] }, openService: false })
    expect(result.error).toBeUndefined()
    expect(result.warnings.join(' ')).toContain('simulated refresh failure')
    expect(result.snapshot.categories.media).toHaveLength(1)
    expect(settings.triRendererState.media).toHaveLength(1)
    const packages = path.join(electron.paths.userData, 'packages')
    const directory = fs.readdirSync(packages)[0]!
    const asset = fs.readdirSync(path.join(packages, directory))[0]!
    expect(fs.readFileSync(path.join(packages, directory, asset), 'utf8')).toBe('welcome media bytes')
  })

  it('previews a foreign file, flags existing titles, and imports from the frozen preview without activating a temp path', async () => {
    const file = path.join(dir, 'Sunday.pro6')
    fs.writeFileSync(file, pro6Fixture)
    fs.writeFileSync(path.join(electron.paths.userData, 'songs.json'), JSON.stringify({ version: 1, songs: [{ id: 'existing', title: 'Sunday song', sections: [] }], deletedSeeds: [] }))
    electron.open.mockResolvedValueOnce({ canceled: false, filePaths: [file] })
    const opened = await call('tri-inspect-foreign', 'propresenter')
    expect(opened.error).toBeUndefined()
    expect(opened.suggestedSelection.songs).toEqual([])
    expect(opened.suggestedSelection.service).toEqual([])
    expect(opened.warnings.join(' ')).toContain('already exist')
    expect(imported).not.toHaveBeenCalled()
    fs.writeFileSync(file, 'source changed after preview')
    const result = await call('tri-import', { token: opened.token, selection: all(opened.manifest), openService: true })
    expect(result.error).toBeUndefined()
    expect(result.path).toBeUndefined()
    expect(settings.triActiveFile.path).toBeUndefined()
    expect(settings.triRecentFiles).toBeUndefined()
    expect(result.snapshot.categories.songs[0].data.sections[0].lines).toEqual(['First line', 'Second line'])
    const library = JSON.parse(fs.readFileSync(path.join(electron.paths.userData, 'songs.json'), 'utf8'))
    expect(library.songs).toHaveLength(2)
    expect(library.songs[0].id).toBe('existing')
    expect((await call('tri-import', { token: opened.token, selection: all(opened.manifest), openService: false })).error).toContain('Open the package again')
  })

  it('stages only one imported theme and rejects using a discarded preview', async () => {
    const file = path.join(dir, 'themes.json')
    fs.writeFileSync(file, JSON.stringify({ themes: [{ name: 'White', textColor: '#ffffff' }, { name: 'Gold', textColor: '#ffcc00' }] }))
    electron.open.mockResolvedValueOnce({ canceled: false, filePaths: [file] })
    const opened = await call('tri-inspect-foreign', 'pewbeam')
    expect(opened.error).toBeUndefined()
    expect(opened.suggestedSelection.themes).toHaveLength(1)
    const invalid = await call('tri-import', { token: opened.token, selection: all(opened.manifest), openService: false })
    expect(invalid.error).toContain('one imported theme')
    expect(settings.triThemeDisplay).toBeUndefined()
    const result = await call('tri-import', { token: opened.token, selection: opened.suggestedSelection, openService: false })
    expect(result.error).toBeUndefined()
    expect(settings.triThemeDisplay).toEqual({ defaultTextColor: '#ffffff' })
    expect(settings.defaultTextColor).toBeUndefined()
    electron.open.mockResolvedValueOnce({ canceled: false, filePaths: [file] })
    const next = await call('tri-inspect-foreign', 'pewbeam')
    await call('tri-discard-preview', next.token)
    expect((await call('tri-import', { token: next.token, selection: next.suggestedSelection, openService: false })).error).toContain('Open the package again')
  })

  it('allows a supported ProPresenter 6 playlist bundle through the native picker', async () => {
    const file = path.join(dir, 'Sunday.pro6plx')
    fs.writeFileSync(file, zipFixture([{ name: 'Sunday.pro6', data: Buffer.from(pro6Fixture) }]))
    electron.open.mockResolvedValueOnce({ canceled: false, filePaths: [file] })
    const opened = await call('tri-inspect-foreign', 'propresenter')
    expect(opened.error).toBeUndefined()
    // The picker no longer asks which app the files came from; structure decides.
    expect(electron.open.mock.calls[0][1].filters[0].extensions).toEqual(['*'])
    const result = await call('tri-import', { token: opened.token, selection: opened.suggestedSelection, openService: false })
    expect(result.error).toBeUndefined()
    expect(result.snapshot.categories.songs[0].data.title).toBe('Sunday song')
    expect(fs.existsSync(file)).toBe(true)
  })

  it('asks about a lyric-shaped text file, applies the operator’s answer under the same token, and skips the rest on request', async () => {
    const lyric = path.join(dir, 'Hymn.txt'), other = path.join(dir, 'Second hymn.txt')
    const words = 'Line one of a hymn\nLine two of it\n\nLine three here\nLine four as well'
    fs.writeFileSync(lyric, words); fs.writeFileSync(other, words)
    electron.open.mockResolvedValueOnce({ canceled: false, filePaths: [lyric, other] })
    const opened = await call('tri-inspect-foreign')
    expect(opened.error).toBeUndefined()
    expect(opened.questions).toHaveLength(2)
    expect(opened.questions.every((question: any) => question.answer === undefined)).toBe(true)
    expect(opened.manifest.categories.songs).toBeUndefined()
    const answered = await call('tri-answer-foreign', { token: opened.token, answers: { [opened.questions[0].id]: 'song' } })
    expect(answered.error).toBeUndefined()
    expect(answered.token).toBe(opened.token)
    expect(answered.manifest.categories.songs.map((song: any) => song.data.title)).toEqual(['Hymn'])
    expect(answered.questions.find((question: any) => question.id === opened.questions[0].id).answer).toBe('song')
    const skipped = await call('tri-answer-foreign', { token: opened.token, answers: { [opened.questions[1].id]: 'skip' } })
    expect(skipped.questions.every((question: any) => question.answer !== undefined)).toBe(true)
    expect(skipped.manifest.categories.songs).toHaveLength(1)
    const result = await call('tri-import', { token: opened.token, selection: skipped.suggestedSelection, openService: false })
    expect(result.error).toBeUndefined()
    expect(result.snapshot.categories.songs[0].data.sections).toHaveLength(2)
    // Text answers are per file; nothing is written to the recipe book for them.
    expect(fs.existsSync(path.join(electron.paths.userData, 'import-recipes.json'))).toBe(true)
    expect(JSON.parse(fs.readFileSync(path.join(electron.paths.userData, 'import-recipes.json'), 'utf8'))).toEqual({})
  })

  it('remembers a table answer by structure signature for the next import', async () => {
    const json = path.join(dir, 'songs.json')
    fs.writeFileSync(json, JSON.stringify([{ heading: 'Alpha', label: 'Beta', body: 'a\nb', extra: 'c\nd\ne' }, { heading: 'Gamma', label: 'Delta', body: 'e\nf', extra: 'g\nh\ni' }]))
    electron.open.mockResolvedValueOnce({ canceled: false, filePaths: [json] })
    const opened = await call('tri-inspect-foreign')
    const question = opened.questions.find((item: any) => item.kind === 'table' && item.answer === undefined)
    expect(question.signature).toMatch(/^json:/)
    const answered = await call('tri-answer-foreign', { token: opened.token, answers: { [question.id]: { title: 'label', lyrics: 'body' } } })
    expect(answered.manifest.categories.songs.map((song: any) => song.data.title)).toEqual(['Beta', 'Delta'])
    expect(JSON.parse(fs.readFileSync(path.join(electron.paths.userData, 'import-recipes.json'), 'utf8'))).toEqual({ [question.signature]: { title: 'label', lyrics: 'body' } })
    await call('tri-discard-preview', opened.token)
    const again = path.join(dir, 'more-songs.json')
    fs.writeFileSync(again, JSON.stringify([{ heading: 'x', label: 'Remembered', body: 'p\nq', extra: 'r\ns\nt' }]))
    electron.open.mockResolvedValueOnce({ canceled: false, filePaths: [again] })
    const second = await call('tri-inspect-foreign')
    expect(second.questions[0]).toMatchObject({ answer: { title: 'label', lyrics: 'body' }, remembered: true })
    expect(second.manifest.categories.songs.map((song: any) => song.data.title)).toEqual(['Remembered'])
  })
})
