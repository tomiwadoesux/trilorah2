import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { TriItem, TriManifest, TriSelection, TriSnapshot } from '../../shared/triPackage'
import type { TriApi, TriRendererState } from '../../shared/triBridge'
import { writeTri, inspectTri, extractTri } from './triArchive'
import { buildTriCatalog, selectTriContent } from './triCatalog'
import { planTriImport, commitTriImport } from './triImport'
import { convertForeign, type ConvertedImport } from '../importers/foreignImport'
import { readRecipes, writeRecipes } from '../importers/recipes'
import { isColumnChoice, type ForeignAnswers, type ForeignQuestion } from '../../shared/foreignImport'

interface Hooks {
  window: () => BrowserWindow | null
  settings: () => Record<string, any>
  replaceSettings: (values: Record<string, any>) => void
  songs: () => any[]
  records: () => TriItem[]
  imported: (snapshot: TriSnapshot) => void
}
type Active = { path?: string; title: string; selection?: TriSelection }
const selectedIds = (snapshot: TriSnapshot): TriSelection => Object.fromEntries(Object.entries(snapshot.categories).map(([category, items]) => [category, items?.map(item => item.id) ?? []]))

export function registerTriPackages(hooks: Hooks) {
  let pendingOpen: string | undefined = process.argv.find(arg => /\.tri$/i.test(arg) && fs.existsSync(arg))
  const previews = new Map<string, { file: string; manifest: TriManifest; directory?: string; warnings?: string[]; paths?: string[]; questions?: ForeignQuestion[]; answers?: ForeignAnswers }>()
  const discard = (token: string) => {
    const preview = previews.get(token)
    previews.delete(token)
    if (preview?.directory) fs.rmSync(preview.directory, { recursive: true, force: true })
  }
  const makeRoom = () => { if (previews.size >= 4) discard(previews.keys().next().value!) }
  app.on('will-quit', () => { for (const token of previews.keys()) { try { discard(token) } catch { /* OS temp cleanup remains available. */ } } })
  let operation = Promise.resolve<unknown>(undefined)
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const result = operation.then(run, run)
    operation = result.catch(() => undefined)
    return result
  }
  const update = (patch: Record<string, any>) => hooks.replaceSettings({ ...hooks.settings(), ...patch })
  const active = (): Active => hooks.settings().triActiveFile ?? { title: 'Untitled service' }
  const recent = (): Array<{ path: string; title: string }> => {
    const value = hooks.settings().triRecentFiles
    return Array.isArray(value) ? value.filter(v => v && typeof v.path === 'string' && typeof v.title === 'string').slice(0, 12) : []
  }
  const remember = (file: string, title: string) => update({ triRecentFiles: [{ path: file, title }, ...recent().filter(item => item.path !== file)].slice(0, 12) })
  const rendererState = (state: TriRendererState) => {
    if (!state || !Array.isArray(state.run) || !Array.isArray(state.media) || !Array.isArray(state.customDecks)) throw new Error('The current service could not be read.')
    return state
  }
  const catalog = (state: TriRendererState) => buildTriCatalog(app.getPath('userData'), hooks.settings(), rendererState(state), hooks.songs(), hooks.records())

  /** Register a converted preview and work out which items start checked. */
  const stage = (converted: ConvertedImport, paths: string[], answers: ForeignAnswers, token: string) => {
    try {
      makeRoom()
      const warnings = [...converted.warnings]
      const existing = new Set(hooks.songs().map(song => song.title.trim().toLocaleLowerCase()))
      const duplicateIds = new Set((converted.manifest.categories.songs ?? []).filter(song => existing.has(song.data.title.trim().toLocaleLowerCase())).map(song => song.id))
      if (duplicateIds.size) warnings.push(`${duplicateIds.size} song title(s) already exist in your library and are unchecked. Select them to keep another copy. Selecting the run of service also includes its required songs.`)
      const suggestedSelection = selectedIds(converted.manifest)
      suggestedSelection.songs = suggestedSelection.songs?.filter(id => !duplicateIds.has(id))
      if (duplicateIds.size) suggestedSelection.service = []
      const storedMedia = hooks.settings().triRendererState?.media
      const mediaHashes = new Set((Array.isArray(storedMedia) ? storedMedia : []).map((item: any) => typeof item.url === 'string' ? /(?:\/|:)([a-f0-9]{64})(?:\.|:)/i.exec(item.url)?.[1] : undefined).filter(Boolean))
      const duplicateMedia = new Set((converted.manifest.categories.media ?? []).filter(item => mediaHashes.has(/^tri-asset:([a-f0-9]{64}):/.exec(item.data.url)?.[1])).map(item => item.id))
      if (duplicateMedia.size) {
        suggestedSelection.media = suggestedSelection.media?.filter(id => !duplicateMedia.has(id))
        suggestedSelection.service = []
        warnings.push(`${duplicateMedia.size} media file(s) match a previous package import and are unchecked. Selecting a run or theme also includes the media it needs.`)
      }
      if (suggestedSelection.themes) suggestedSelection.themes = suggestedSelection.themes.slice(0, 1)
      previews.set(token, { ...converted, warnings, paths, answers })
      return { token, manifest: converted.manifest, title: converted.manifest.title, warnings, suggestedSelection, questions: converted.questions }
    } catch (error) { fs.rmSync(converted.directory, { recursive: true, force: true }); throw error }
  }

  const api: Omit<TriApi, 'onTriOpenRequested'> = {
    triCatalog: async state => catalog(state),
    triStatus: async () => ({ ...active(), pendingOpen: !!pendingOpen }),
    triRecent: async () => recent(),
    triNew: async () => { update({ triActiveFile: { title: 'Untitled service' } }); },
    triSave: request => serial(async () => {
      const title = request.title?.trim() || 'Untitled service'
      if (title.length > 200) throw new Error('Use a service name shorter than 200 characters.')
      const snapshot = selectTriContent(catalog(request.state), request.selection)
      if (!Object.values(snapshot.categories).some(items => items?.length)) throw new Error('Choose something to save.')
      let file = request.saveAs || request.exportOnly ? undefined : active().path
      if (!file) {
        const directory = path.join(app.getPath('documents'), 'Trilorah', 'Services')
        fs.mkdirSync(directory, { recursive: true })
        const safeTitle = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/, '') || 'service'
        const window = hooks.window()
        const options = { title: request.exportOnly ? 'Export Trilorah package' : 'Save service', defaultPath: path.join(directory, `${safeTitle}.tri`), filters: [{ name: 'Trilorah package', extensions: ['tri'] }] }
        const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options)
        if (result.canceled || !result.filePath) return { canceled: true }
        file = /\.tri$/i.test(result.filePath) ? result.filePath : `${result.filePath}.tri`
      }
      const manifest = await writeTri(file, snapshot, title)
      update({ triRendererState: { media: request.state.media, customDecks: request.state.customDecks }, ...(request.state.theme ? { triThemeLayout: request.state.theme } : {}) })
      if (!request.exportOnly) update({ triActiveFile: { path: file, title, selection: selectedIds(snapshot) } })
      remember(file, title)
      return { path: file, title, warnings: manifest.warnings }
    }),
    triInspect: async recentPath => {
      let file = pendingOpen
      pendingOpen = undefined
      if (recentPath) {
        if (!recent().some(item => item.path === recentPath)) throw new Error('Choose that package using Open.')
        file = recentPath
      }
      if (!file) {
        const window = hooks.window()
        const options = { title: 'Open Trilorah package', filters: [{ name: 'Trilorah package', extensions: ['tri'] }], properties: ['openFile'] as Array<'openFile'> }
        const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
        if (result.canceled || !result.filePaths[0]) return { canceled: true }
        file = result.filePaths[0]
      }
      const manifest = await inspectTri(file)
      makeRoom()
      const token = randomUUID()
      previews.set(token, { file, manifest })
      return { token, manifest, path: file, title: manifest.title, warnings: manifest.warnings }
    },
    triDiscardPreview: token => serial(async () => { discard(token) }),
    triInspectForeign: () => serial(async () => {
      const options = { title: 'Import from another app', filters: [{ name: 'Exports, databases, songs and media', extensions: ['*'] }], properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'> }
      const window = hooks.window()
      const picked = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
      if (picked.canceled || !picked.filePaths.length) return { canceled: true }
      const converted = await convertForeign(picked.filePaths, { recipes: readRecipes(app.getPath('userData')) })
      return stage(converted, picked.filePaths, {}, randomUUID())
    }),
    triAnswerForeign: request => serial(async () => {
      const preview = previews.get(request.token)
      if (!preview?.paths) throw new Error('Choose the files again before answering.')
      const answers: ForeignAnswers = { ...(preview.answers ?? {}) }
      for (const [id, choice] of Object.entries(request.answers ?? {})) {
        if (!/^[a-f0-9]{64}$/.test(id)) continue
        if (choice === 'song' || choice === 'note' || choice === 'skip') answers[id] = choice
        else if (isColumnChoice(choice) && typeof choice.title === 'string' && typeof choice.lyrics === 'string') answers[id] = { title: choice.title.slice(0, 200), lyrics: choice.lyrics.slice(0, 200) }
      }
      const userData = app.getPath('userData')
      const recipes = readRecipes(userData)
      // Table answers teach this laptop. The structure signature is stored, never any content.
      for (const question of preview.questions ?? []) {
        const choice = answers[question.id]
        if (question.signature && choice !== undefined && choice !== 'note' && (choice === 'skip' || isColumnChoice(choice))) recipes[question.signature] = choice
      }
      try { writeRecipes(userData, recipes) } catch { /* Remembering is a convenience; the import still proceeds. */ }
      const converted = await convertForeign(preview.paths, { answers, recipes })
      const paths = preview.paths
      discard(request.token)
      return stage(converted, paths, answers, request.token)
    }),
    triImport: request => serial(async () => {
      const preview = previews.get(request.token)
      if (!preview) throw new Error('Open the package again before importing.')
      const inspected = await inspectTri(preview.file)
      if (JSON.stringify(inspected) !== JSON.stringify(preview.manifest)) throw new Error('This package changed after you opened it. Open it again to review its contents.')
      const selected = selectTriContent(inspected, request.selection)
      if (!Object.values(selected.categories).some(items => items?.length)) throw new Error('Choose something to import.')
      const incoming = (snapshot: TriSnapshot): TriSnapshot => {
        if (!preview.directory || !snapshot.categories.themes?.length) return snapshot
        if (snapshot.categories.themes.length > 1) throw new Error('Choose one imported theme at a time. Import the other themes separately.')
        return { ...snapshot, categories: { ...snapshot.categories, themes: [{ ...snapshot.categories.themes[0], id: 'display' }] } }
      }
      // Validate all selected data before extracting any assets or changing a library.
      planTriImport(app.getPath('userData'), incoming(selected), hooks.settings(), request.openService)
      const packageRoot = path.resolve(app.getPath('userData'), 'packages')
      let extractedDirectory: string | undefined
      let plan: ReturnType<typeof planTriImport>
      try {
        const snapshot = await extractTri(preview.file, packageRoot, {
          snapshot: selected, expectedManifest: inspected,
          onExtracted: directory => { extractedDirectory = directory },
        })
        plan = planTriImport(app.getPath('userData'), incoming(snapshot), hooks.settings(), request.openService)
        commitTriImport(plan, hooks.settings, hooks.replaceSettings)
      } catch (error) {
        if (extractedDirectory) {
          const owned = path.resolve(extractedDirectory)
          if (path.dirname(owned) === packageRoot && /^tri-[0-9a-f-]+$/.test(path.basename(owned))) {
            try { fs.rmSync(owned, { recursive: true, force: true }) }
            catch { throw new Error(`${error instanceof Error ? error.message : 'Import failed'}. The extracted media could not be removed from ${owned}.`) }
          }
        }
        throw error
      }
      // Invalidate only libraries. New preacher IDs avoid touching any live preacher's caches.
      const warnings = [...(inspected.warnings ?? []), ...(preview.warnings ?? [])]
      try { hooks.imported(plan.snapshot) }
      catch (error) { warnings.push(`Content was imported, but a library refresh failed: ${error instanceof Error ? error.message : 'reopen the app to refresh libraries'}`) }
      try {
        if (request.openService && plan.snapshot.categories.service?.length) {
          const complete = Object.entries(inspected.categories).every(([category, items]) => (items ?? []).every(item => selected.categories[category as keyof typeof selected.categories]?.some(chosen => chosen.id === item.id)))
          update({ triActiveFile: { ...(complete && !preview.directory ? { path: preview.file } : {}), title: inspected.title, selection: selectedIds(plan.snapshot) } })
          if (preview.directory) warnings.push('Save this imported service as a .tri file to make a portable copy.')
          else if (!complete) warnings.push('You opened part of this package. Save it as a new .tri file to preserve the original package.')
        }
        if (!preview.directory) remember(preview.file, inspected.title)
      } catch { warnings.push('Content was imported, but file history could not be saved. Use Save As for this service.') }
      try { discard(request.token) } catch { warnings.push('Imported successfully, but the temporary preview could not be removed.') }
      return { snapshot: plan.snapshot, ...(!preview.directory ? { path: preview.file } : {}), title: inspected.title, warnings }
    }),
  }
  const channels: Record<keyof typeof api, string> = { triCatalog: 'tri-catalog', triSave: 'tri-save', triInspect: 'tri-inspect', triInspectForeign: 'tri-inspect-foreign', triAnswerForeign: 'tri-answer-foreign', triDiscardPreview: 'tri-discard-preview', triImport: 'tri-import', triRecent: 'tri-recent', triStatus: 'tri-status', triNew: 'tri-new' }
  for (const [method, channel] of Object.entries(channels)) ipcMain.handle(channel, async (event, argument) => {
    if (event.sender.id !== hooks.window()?.webContents.id) throw new Error('Open packages from the main Trilorah window.')
    try { return await (api[method as keyof typeof api] as (arg?: any) => Promise<any>)(argument) }
    catch (error) {
      if (method === 'triCatalog' || method === 'triRecent' || method === 'triStatus' || method === 'triNew') throw error
      return { error: error instanceof Error ? error.message : 'The package could not be read or saved.' }
    }
  })
  const requestOpen = (file: string) => {
    if (!/\.tri$/i.test(file)) return
    pendingOpen = file
    const window = hooks.window()
    if (window) { window.show(); window.focus(); window.webContents.send('tri-open-requested') }
  }
  app.on('open-file', (event, file) => { event.preventDefault(); requestOpen(file) })
  app.on('second-instance', (_event, argv) => { const file = argv.find(arg => /\.tri$/i.test(arg)); if (file) requestOpen(file) })
}
