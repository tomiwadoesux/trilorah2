import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { TriItem, TriManifest, TriSelection, TriSnapshot } from '../../shared/triPackage'
import type { TriApi, TriRendererState } from '../../shared/triBridge'
import { writeTri, inspectTri, extractTri } from './triArchive'
import { buildTriCatalog, selectTriContent } from './triCatalog'
import { planTriImport, commitTriImport } from './triImport'

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
  const previews = new Map<string, { file: string; manifest: TriManifest }>()
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
      if (previews.size >= 4) previews.delete(previews.keys().next().value!)
      const token = randomUUID()
      previews.set(token, { file, manifest })
      return { token, manifest, path: file, title: manifest.title, warnings: manifest.warnings }
    },
    triImport: request => serial(async () => {
      const preview = previews.get(request.token)
      if (!preview) throw new Error('Open the package again before importing.')
      const inspected = await inspectTri(preview.file)
      if (JSON.stringify(inspected) !== JSON.stringify(preview.manifest)) throw new Error('This package changed after you opened it. Open it again to review its contents.')
      const selected = selectTriContent(inspected, request.selection)
      if (!Object.values(selected.categories).some(items => items?.length)) throw new Error('Choose something to import.')
      // Validate all selected data before extracting any assets or changing a library.
      planTriImport(app.getPath('userData'), selected, hooks.settings(), request.openService)
      const packageRoot = path.resolve(app.getPath('userData'), 'packages')
      let extractedDirectory: string | undefined
      let plan: ReturnType<typeof planTriImport>
      try {
        const snapshot = await extractTri(preview.file, packageRoot, {
          snapshot: selected, expectedManifest: inspected,
          onExtracted: directory => { extractedDirectory = directory },
        })
        plan = planTriImport(app.getPath('userData'), snapshot, hooks.settings(), request.openService)
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
      const warnings = [...(inspected.warnings ?? [])]
      try { hooks.imported(plan.snapshot) }
      catch (error) { warnings.push(`Content was imported, but a library refresh failed: ${error instanceof Error ? error.message : 'reopen the app to refresh libraries'}`) }
      try {
        if (request.openService && plan.snapshot.categories.service?.length) {
          const complete = Object.entries(inspected.categories).every(([category, items]) => (items ?? []).every(item => selected.categories[category as keyof typeof selected.categories]?.some(chosen => chosen.id === item.id)))
          update({ triActiveFile: { ...(complete ? { path: preview.file } : {}), title: inspected.title, selection: selectedIds(plan.snapshot) } })
          if (!complete) warnings.push('You opened part of this package. Save it as a new .tri file to preserve the original package.')
        }
        remember(preview.file, inspected.title)
      } catch { warnings.push('Content was imported, but file history could not be saved. Use Save As for this service.') }
      previews.delete(request.token)
      return { snapshot: plan.snapshot, path: preview.file, title: inspected.title, warnings }
    }),
  }
  const channels: Record<keyof typeof api, string> = { triCatalog: 'tri-catalog', triSave: 'tri-save', triInspect: 'tri-inspect', triImport: 'tri-import', triRecent: 'tri-recent', triStatus: 'tri-status', triNew: 'tri-new' }
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
