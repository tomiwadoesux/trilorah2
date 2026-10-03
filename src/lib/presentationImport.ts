import { fileToDisplayUrl } from '../../shared/mediaUrl'

export interface ImportedPresentation {
  id: string
  title: string
  slides: string[]
  pptxPath?: string
  importedAt: number
}

type PresentationImportApi = Pick<NonNullable<Window['api']>, 'importPresentation' | 'loadPresentations' | 'savePresentations'>

/** Keep every import entry point consistent, and notify the library only after saving. */
export async function importAndSavePresentation(api: PresentationImportApi | undefined = window.api): Promise<ImportedPresentation | null> {
  if (!api?.importPresentation || !api.loadPresentations || !api.savePresentations) {
    throw new Error('Open the desktop app to import PowerPoint slides.')
  }

  const result = await api.importPresentation()
  if (!result?.success) {
    if (result?.error === 'Cancelled') return null
    throw new Error(result?.error || 'PowerPoint import failed. Try choosing the file again.')
  }
  const data = result.data
  if (!Array.isArray(data?.slides) || data.slides.length === 0 || data.slides.some((slide: unknown) => typeof slide !== 'string' || !slide.trim())) {
    throw new Error('No usable slides were found. Try another PowerPoint file.')
  }
  if (typeof data.title !== 'string' || !data.title.trim() || (data.pptxPath !== undefined && typeof data.pptxPath !== 'string')) {
    throw new Error('The presentation could not be read. Try choosing the file again.')
  }

  const presentation: ImportedPresentation = {
    id: `pres-${crypto.randomUUID()}`,
    title: data.title,
    slides: [...data.slides],
    ...(data.pptxPath === undefined ? {} : { pptxPath: data.pptxPath }),
    importedAt: Date.now(),
  }
  const existing = await api.loadPresentations()
  if (!Array.isArray(existing)) {
    throw new Error('The presentation library could not be loaded. Restart the app and try again.')
  }
  const saved = await api.savePresentations([...existing, presentation])
  if (!saved?.success) {
    throw new Error(saved?.error || 'The presentation could not be saved. Try importing it again.')
  }
  window.dispatchEvent(new Event('presentations-updated'))
  return presentation
}

/** Imported slide paths may be bare filesystem paths or already-encoded file URLs. */
export function presentationImageSrc(path: string | null | undefined): string {
  if (!path || !/^file:\/\//i.test(path)) return fileToDisplayUrl(path)
  let localPath = path.replace(/^file:\/+/i, '/')
  // Decode once before the shared encoder so a URL's %20 does not become %2520.
  // Keep malformed literal percent signs intact; bare filesystem paths may contain them.
  localPath = localPath.split('/').map(part => {
    try { return decodeURIComponent(part) } catch { return part }
  }).join('/')
  return fileToDisplayUrl(localPath)
}
