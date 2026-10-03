import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function binaryCandidates() {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const windows = process.platform === 'win32'
  return {
    soffice: [
      process.env.SOFFICE_PATH,
      process.env.LIBREOFFICE_PATH,
      ...(windows ? [
        path.win32.join(programFiles, 'LibreOffice', 'program', 'soffice.exe'),
        path.win32.join(programFilesX86, 'LibreOffice', 'program', 'soffice.exe'),
      ] : [
        '/opt/homebrew/bin/soffice',
        '/usr/local/bin/soffice',
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
        '/usr/bin/soffice',
        '/usr/bin/libreoffice',
        '/snap/bin/libreoffice',
      ]),
      'soffice',
      'libreoffice',
    ],
    pdftoppm: [
      process.env.PDFTOPPM_PATH,
      ...(windows ? [
        path.win32.join(programFiles, 'poppler', 'Library', 'bin', 'pdftoppm.exe'),
        path.win32.join(programFiles, 'poppler', 'bin', 'pdftoppm.exe'),
        path.win32.join(process.env.ChocolateyInstall || 'C:\\ProgramData\\chocolatey', 'bin', 'pdftoppm.exe'),
        process.env.USERPROFILE && path.win32.join(process.env.USERPROFILE, 'scoop', 'apps', 'poppler', 'current', 'Library', 'bin', 'pdftoppm.exe'),
      ] : [
        '/opt/homebrew/bin/pdftoppm',
        '/usr/local/bin/pdftoppm',
        '/usr/bin/pdftoppm',
      ]),
      'pdftoppm',
    ],
  }
}

async function findBinary(candidates: (string | undefined)[], versionArg: string, dependency: string): Promise<string> {
  for (const bin of new Set(candidates.filter((value): value is string => Boolean(value)))) {
    try {
      await execFileAsync(bin, [versionArg], { timeout: 5e3 })
      return bin
    } catch {
      // An inaccessible, broken, or unresponsive executable is not usable.
    }
  }
  throw Object.assign(new Error(
    `PowerPoint import could not start ${dependency}. Install or repair ${dependency}, then try again.`
  ), { code: 'POWERPOINT_DEPENDENCY_UNAVAILABLE', dependency })
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
  const candidates = binaryCandidates()
  const sofficeBin = await findBinary(candidates.soffice, '--version', 'LibreOffice')
  const pdftoppmBin = await findBinary(candidates.pdftoppm, '-v', 'Poppler (pdftoppm)')
  ensureCleanDir(outputDir)
  const pdfDir = path.join(outputDir, '__pdf')
  ensureCleanDir(pdfDir)
  try {
    try {
      await execFileAsync(
        sofficeBin,
        ['--headless', '--convert-to', 'pdf', '--outdir', pdfDir, pptxPath],
        { maxBuffer: 10 * 1024 * 1024, timeout: 12e4 }
      )
    } catch (cause) {
      throw new Error('PowerPoint could not be opened. Check that the presentation opens in PowerPoint or LibreOffice, then upload it again.', { cause })
    }
    const baseName = path.basename(pptxPath, path.extname(pptxPath))
    const pdfPath = path.join(pdfDir, `${baseName}.pdf`)
    if (!fs.existsSync(pdfPath)) {
      const pdfFiles = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith('.pdf'))
      if (pdfFiles.length === 0) {
        throw new Error('LibreOffice could not read this presentation. Check that the file opens correctly, then upload it again.')
      }
      const actualPdf = path.join(pdfDir, pdfFiles[0])
      fs.renameSync(actualPdf, pdfPath)
    }
    const slidePrefix = path.join(outputDir, 'slide')
    try {
      await execFileAsync(
        pdftoppmBin,
        ['-png', '-r', '150', pdfPath, slidePrefix],
        { maxBuffer: 50 * 1024 * 1024, timeout: 3e5 }
      )
    } catch (cause) {
      throw new Error('The presentation could not be turned into slides. Try uploading it again, or export its slides as images.', { cause })
    }
    const slides = fs.readdirSync(outputDir)
      .filter((f) => /^slide-\d+\.png$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((f) => path.join(outputDir, f))
    if (slides.length === 0) {
      throw new Error('No slides were found in this presentation. Add slides in PowerPoint, save the file, then upload it again.')
    }
    return slides
  } finally {
    fs.rmSync(pdfDir, { recursive: true, force: true })
  }
}
