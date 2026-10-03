import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }))
vi.mock('node:child_process', () => ({ execFile: execFileMock }))

import { convertPptxToImages } from './pptxConverter'

type Completion = (error: Error | null, stdout?: string, stderr?: string) => void

describe('PowerPoint import', () => {
  let tempDir: string
  let outputDir: string
  let source: string
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!

  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('SOFFICE_PATH', 'test-soffice')
    vi.stubEnv('LIBREOFFICE_PATH', '')
    vi.stubEnv('PDFTOPPM_PATH', 'test-pdftoppm')
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-import-'))
    outputDir = path.join(tempDir, 'slides')
    source = path.join(tempDir, 'Sunday service.pptx')
    fs.writeFileSync(source, 'presentation')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
    Object.defineProperty(process, 'platform', originalPlatform)
  })

  function simulateConversion(file: string, args: string[], callback: Completion) {
    if (args.includes('--convert-to')) {
      fs.writeFileSync(path.join(outputDir, '__pdf', 'Sunday service.pdf'), 'pdf')
    } else if (args.includes('-png')) {
      for (const slide of [10, 2, 1]) fs.writeFileSync(path.join(outputDir, `slide-${slide}.png`), 'image')
      fs.writeFileSync(path.join(outputDir, 'slide-not-a-page.png'), 'unrelated image')
    } else if (file !== 'test-soffice' && file !== 'test-pdftoppm') {
      callback(Object.assign(new Error('not found'), { code: 'ENOENT' }))
      return
    }
    callback(null, '', '')
  }

  function useWorkingTools() {
    execFileMock.mockImplementation((file: string, args: string[], _options: object, callback: Completion) => {
      simulateConversion(file, args, callback)
    })
  }

  it('checks both tools before converting, then returns slides in presentation order', async () => {
    useWorkingTools()
    const slides = await convertPptxToImages(source, outputDir)

    expect(slides.map((slide) => path.basename(slide))).toEqual(['slide-1.png', 'slide-2.png', 'slide-10.png'])
    expect(execFileMock.mock.calls.map(([file, args]) => [file, args])).toEqual([
      ['test-soffice', ['--version']],
      ['test-pdftoppm', ['-v']],
      ['test-soffice', ['--headless', '--convert-to', 'pdf', '--outdir', path.join(outputDir, '__pdf'), source]],
      ['test-pdftoppm', ['-png', '-r', '150', path.join(outputDir, '__pdf', 'Sunday service.pdf'), path.join(outputDir, 'slide')]],
    ])
    expect(fs.existsSync(path.join(outputDir, '__pdf'))).toBe(false)
  })

  it.each(['LibreOffice', 'Poppler (pdftoppm)'])('explains missing %s without deleting an existing import', async (dependency) => {
    fs.mkdirSync(outputDir)
    const existingSlide = path.join(outputDir, 'slide-1.png')
    fs.writeFileSync(existingSlide, 'existing slide')
    execFileMock.mockImplementation((file: string, _args: string[], _options: object, callback: Completion) => {
      callback(dependency.startsWith('Poppler') && file === 'test-soffice'
        ? null
        : Object.assign(new Error('not found'), { code: 'ENOENT' }), '', '')
    })

    await expect(convertPptxToImages(source, outputDir)).rejects.toMatchObject({
      code: 'POWERPOINT_DEPENDENCY_UNAVAILABLE',
      dependency,
      message: `PowerPoint import could not start ${dependency}. Install or repair ${dependency}, then try again.`,
    })
    expect(fs.readFileSync(existingSlide, 'utf8')).toBe('existing slide')
    expect(execFileMock.mock.calls.every(([, args]) => args.length === 1)).toBe(true)
  })

  it.each([
    { code: 'EACCES' },
    { code: 1 },
    { code: null, killed: true, signal: 'SIGTERM' },
  ])('skips an unusable executable (%j) and tries the next candidate', async (failure) => {
    vi.stubEnv('LIBREOFFICE_PATH', 'working-soffice')
    execFileMock.mockImplementation((file: string, args: string[], _options: object, callback: Completion) => {
      if (file === 'test-soffice') callback(Object.assign(new Error('unusable'), failure))
      else simulateConversion(file === 'working-soffice' ? 'test-soffice' : file, args, callback)
    })

    await expect(convertPptxToImages(source, outputDir)).resolves.toHaveLength(3)
    expect(execFileMock.mock.calls.some(([file, args]) => file === 'test-soffice' && args.includes('--headless'))).toBe(false)
    expect(execFileMock.mock.calls.some(([file, args]) => file === 'working-soffice' && args.includes('--headless'))).toBe(true)
  })

  it('finds standard Windows installations without requiring PATH configuration', async () => {
    Object.defineProperty(process, 'platform', { ...originalPlatform, value: 'win32' })
    vi.stubEnv('SOFFICE_PATH', '')
    vi.stubEnv('PDFTOPPM_PATH', '')
    vi.stubEnv('ProgramFiles', 'C:\\Program Files')
    const office = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
    const poppler = 'C:\\Program Files\\poppler\\Library\\bin\\pdftoppm.exe'
    execFileMock.mockImplementation((file: string, args: string[], _options: object, callback: Completion) => {
      simulateConversion(file === office ? 'test-soffice' : file === poppler ? 'test-pdftoppm' : file, args, callback)
    })

    await expect(convertPptxToImages(source, outputDir)).resolves.toHaveLength(3)
    expect(execFileMock.mock.calls[0][0]).toBe(office)
    expect(execFileMock.mock.calls[1][0]).toBe(poppler)
  })

  it('reports unreadable presentations and removes temporary PDFs', async () => {
    execFileMock.mockImplementation((_file: string, _args: string[], _options: object, callback: Completion) => callback(null, '', ''))

    await expect(convertPptxToImages(source, outputDir)).rejects.toThrow('Check that the file opens correctly, then upload it again.')
    expect(fs.existsSync(path.join(outputDir, '__pdf'))).toBe(false)
    expect(execFileMock.mock.calls.some(([, args]) => args.includes('-png'))).toBe(false)
  })

  it('cleans up and explains a slide rendering failure', async () => {
    execFileMock.mockImplementation((file: string, args: string[], _options: object, callback: Completion) => {
      if (args.includes('-png')) callback(new Error('renderer failed'))
      else simulateConversion(file, args, callback)
    })

    await expect(convertPptxToImages(source, outputDir)).rejects.toThrow('Try uploading it again, or export its slides as images.')
    expect(fs.existsSync(path.join(outputDir, '__pdf'))).toBe(false)
  })
})
