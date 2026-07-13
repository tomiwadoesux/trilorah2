import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SOFFICE_CANDIDATES = [
  process.env.SOFFICE_PATH,
  process.env.LIBREOFFICE_PATH,
  '/opt/homebrew/bin/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  'soffice'
].filter((value): value is string => Boolean(value))

const PDFTOPPM_CANDIDATES = [
  '/opt/homebrew/bin/pdftoppm',
  '/usr/local/bin/pdftoppm',
  'pdftoppm'
].filter(Boolean)

async function findBinary(candidates: string[]): Promise<string> {
  for (const bin of candidates) {
    try {
      await execFileAsync(bin, ['--version'], { timeout: 5e3 })
      return bin
    } catch (err: any) {
      if (err.code !== 'ENOENT') return bin
    }
  }
  throw new Error(`Binary not found. Tried: ${candidates.join(', ')}`)
}

function ensureCleanDir(dir: string) {
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
    }
  } else {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export async function convertPptxToImages(pptxPath: string, outputDir: string): Promise<string[]> {
  ensureCleanDir(outputDir)
  const pdfDir = path.join(outputDir, '__pdf')
  ensureCleanDir(pdfDir)
  const sofficeBin = await findBinary(SOFFICE_CANDIDATES)
  await execFileAsync(
    sofficeBin,
    ['--headless', '--convert-to', 'pdf', '--outdir', pdfDir, pptxPath],
    { maxBuffer: 10 * 1024 * 1024, timeout: 12e4 }
  )
  const baseName = path.basename(pptxPath, path.extname(pptxPath))
  const pdfPath = path.join(pdfDir, `${baseName}.pdf`)
  if (!fs.existsSync(pdfPath)) {
    const pdfFiles = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith('.pdf'))
    if (pdfFiles.length === 0) {
      throw new Error(
        'LibreOffice did not produce a PDF. Ensure LibreOffice is installed and the file is a valid presentation.'
      )
    }
    const actualPdf = path.join(pdfDir, pdfFiles[0])
    fs.renameSync(actualPdf, pdfPath)
  }
  const pdftoppmBin = await findBinary(PDFTOPPM_CANDIDATES)
  const slidePrefix = path.join(outputDir, 'slide')
  await execFileAsync(
    pdftoppmBin,
    ['-png', '-r', '150', pdfPath, slidePrefix],
    { maxBuffer: 50 * 1024 * 1024, timeout: 3e5 }
  )
  const slides = fs.readdirSync(outputDir).filter((f) => f.startsWith('slide') && f.endsWith('.png')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((f) => path.join(outputDir, f))
  fs.rmSync(pdfDir, { recursive: true, force: true })
  if (slides.length === 0) {
    throw new Error(
      'pdftoppm produced no images from the PDF. Ensure poppler is installed (brew install poppler).'
    )
  }
  return slides
}
