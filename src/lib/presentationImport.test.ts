import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importAndSavePresentation, presentationImageSrc } from './presentationImport'

const makeApi = () => ({
  importPresentation: vi.fn().mockResolvedValue({ success: true, data: {
    title: 'Sunday message', slides: ['/slides/one.png', '/slides/two.png'], pptxPath: '/talks/Sunday.pptx',
  } }),
  loadPresentations: vi.fn().mockResolvedValue([]),
  savePresentations: vi.fn().mockResolvedValue({ success: true }),
})

describe('PowerPoint import persistence', () => {
  const dispatchEvent = vi.fn()
  beforeEach(() => {
    dispatchEvent.mockClear()
    vi.stubGlobal('window', { dispatchEvent })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('returns null when the file picker is cancelled, without changing the library', async () => {
    const api = makeApi()
    api.importPresentation.mockResolvedValue({ success: false, error: 'Cancelled' })
    await expect(importAndSavePresentation(api)).resolves.toBeNull()
    expect(api.loadPresentations).not.toHaveBeenCalled()
    expect(api.savePresentations).not.toHaveBeenCalled()
    expect(dispatchEvent).not.toHaveBeenCalled()
  })

  it('keeps existing decks, preserves imported fields, and notifies only after saving', async () => {
    const api = makeApi()
    const existing = { id: 'old-deck', title: 'Last Sunday', slides: ['/old/one.png'], importedAt: 10 }
    api.loadPresentations.mockResolvedValue([existing])
    api.savePresentations.mockImplementation(async () => {
      expect(dispatchEvent).not.toHaveBeenCalled()
      return { success: true }
    })
    const presentation = await importAndSavePresentation(api)
    expect(presentation).toEqual({
      id: expect.stringMatching(/^pres-[a-f\d-]{36}$/),
      title: 'Sunday message', slides: ['/slides/one.png', '/slides/two.png'], pptxPath: '/talks/Sunday.pptx',
      importedAt: expect.any(Number),
    })
    expect(api.savePresentations).toHaveBeenCalledWith([existing, presentation])
    expect(dispatchEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'presentations-updated' }))
  })

  it.each([[], [''], [null], undefined])('rejects unusable slide data: %j', async slides => {
    const api = makeApi()
    api.importPresentation.mockResolvedValue({ success: true, data: { title: 'Empty', slides } })
    await expect(importAndSavePresentation(api)).rejects.toThrow('No usable slides')
    expect(api.savePresentations).not.toHaveBeenCalled()
    expect(dispatchEvent).not.toHaveBeenCalled()
  })

  it('reports conversion errors without saving', async () => {
    const api = makeApi()
    api.importPresentation.mockResolvedValue({ success: false, error: 'Install LibreOffice to convert slides.' })
    await expect(importAndSavePresentation(api)).rejects.toThrow('Install LibreOffice')
    expect(api.savePresentations).not.toHaveBeenCalled()
  })

  it('reports save failures without announcing a successful import', async () => {
    const api = makeApi()
    api.savePresentations.mockResolvedValue({ success: false, error: 'Not enough disk space.' })
    await expect(importAndSavePresentation(api)).rejects.toThrow('Not enough disk space')
    expect(dispatchEvent).not.toHaveBeenCalled()
  })

  it('does not overwrite a library that failed to load', async () => {
    const api = makeApi()
    api.loadPresentations.mockResolvedValue(null)
    await expect(importAndSavePresentation(api)).rejects.toThrow('library could not be loaded')
    expect(api.savePresentations).not.toHaveBeenCalled()
  })

  it('uses the desktop API by default', async () => {
    const api = makeApi()
    vi.stubGlobal('window', { api, dispatchEvent })
    await expect(importAndSavePresentation()).resolves.toMatchObject({ title: 'Sunday message' })
    expect(api.importPresentation).toHaveBeenCalledOnce()
  })

  it('gives an actionable message when desktop import is unavailable', async () => {
    await expect(importAndSavePresentation()).rejects.toThrow('Open the desktop app')
  })
})

describe('presentation image URLs', () => {
  it.each([
    ['/Users/operator/Sunday #1?.png', 'local-media://file/Users/operator/Sunday%20%231%3F.png'],
    ['C:\\Users\\operator\\Sunday #1?.png', 'local-media://file/C:/Users/operator/Sunday%20%231%3F.png'],
    ['file:///Users/operator/Sunday%20%231%3F.png', 'local-media://file/Users/operator/Sunday%20%231%3F.png'],
    ['file:///C:/Users/operator/Sunday%20%231.png', 'local-media://file/C:/Users/operator/Sunday%20%231.png'],
    ['file:///Users/operator/Sunday #1?.png', 'local-media://file/Users/operator/Sunday%20%231%3F.png'],
    ['/Users/operator/100% finished.png', 'local-media://file/Users/operator/100%25%20finished.png'],
  ])('turns %s into a drawable, encoded file URL', (path, expected) => {
    expect(presentationImageSrc(path)).toBe(expected)
  })

  it.each(['data:image/png;base64,YQ==', 'https://slides.test/one.png', 'http://slides.test/one.png', 'local-media://file/slides/one%20two.png'])('preserves %s', url => {
    expect(presentationImageSrc(url)).toBe(url)
  })
})
