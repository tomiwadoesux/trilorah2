import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { nativeImage } from 'electron'
import Tesseract from 'tesseract.js'

/*
 * Where the English model is read from.
 *
 * Left alone, tesseract.js downloads eng.traineddata from a CDN on first use
 * and caches it in the working directory — so an installed copy could not
 * scan without internet. The installer ships the file beside the app
 * (electron-builder.yml, extraResources); a development checkout has it in
 * the repo root, where the library itself once cached it. With neither, the
 * download still happens, cached somewhere that is always writable.
 */
function workerOptions(): Partial<Tesseract.WorkerOptions> {
  const quiet = { logger: () => {} }
  const dirs = [process.resourcesPath, process.cwd()].filter(Boolean) as string[]
  const local = dirs.find((dir) => fs.existsSync(path.join(dir, 'eng.traineddata')))
  if (local) return { ...quiet, langPath: local, gzip: false, cacheMethod: 'none' }
  return { ...quiet, cachePath: os.tmpdir() }
}

function resolveImage(imagePath: string): string | null {
  const absPath = path.isAbsolute(imagePath) ? imagePath : path.resolve(imagePath)
  if (fs.existsSync(absPath)) return absPath
  console.error(`❌ OCR skipped — file not found: ${absPath}`)
  return null
}

export async function extractTextFromImage(imagePath: string): Promise<string> {
  const absPath = resolveImage(imagePath)
  if (!absPath) return ''
  let worker: Tesseract.Worker | undefined
  try {
    console.log(`🔍 OCR processing: ${absPath}`)
    worker = await Tesseract.createWorker('eng', undefined, workerOptions())
    const result = await worker.recognize(absPath)
    return result.data.text.trim()
  } catch (error) {
    console.error(`❌ OCR failed for ${imagePath}:`, error)
    return ''
  } finally {
    await worker?.terminate().catch(() => undefined)
  }
}

/** A phone photo is far larger than reading needs, and every pass pays for it. */
const LONG_SIDE = 2200
/** A reading this sure is the right way up; no need to try the others. */
const SURE = 80
/** Below this the page is probably crooked as well, so small tilts are tried. */
const STRAIGHT = 75
const DEG = Math.PI / 180

/** One quarter turn clockwise of a 4-bytes-per-pixel bitmap. */
function quarterTurn(src: Uint32Array, w: number, h: number): Uint32Array {
  const out = new Uint32Array(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[x * h + (h - 1 - y)] = src[y * w + x]
  }
  return out
}

/*
 * The picture at 0°, 90°, 180° and 270°, as PNGs.
 *
 * Turned here rather than with Tesseract's own rotateRadians, which spins
 * the page inside its original frame: a portrait sheet turned a quarter
 * loses whatever no longer fits, and the first letters of every row went
 * with it. Null when Electron cannot decode the file (TIFF, some BMPs).
 */
function quarterTurns(absPath: string): Buffer[] | null {
  if (!nativeImage) return null
  let image = nativeImage.createFromPath(absPath)
  if (image.isEmpty()) return null
  const size = image.getSize()
  const long = Math.max(size.width, size.height)
  if (long > LONG_SIDE) {
    image = image.resize({ width: Math.round((size.width * LONG_SIDE) / long), quality: 'best' })
  }
  let { width, height } = image.getSize()
  const raw = image.toBitmap({ scaleFactor: 1 })
  if (raw.length !== width * height * 4) return null
  let pixels: Uint32Array = new Uint32Array(raw.buffer, raw.byteOffset, width * height).slice()
  const turns: Buffer[] = []
  for (let i = 0; i < 4; i++) {
    const bitmap = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength)
    turns.push(nativeImage.createFromBitmap(bitmap, { width, height }).toPNG())
    pixels = quarterTurn(pixels, width, height)
    ;[width, height] = [height, width]
  }
  return turns
}

interface Reading {
  text: string
  score: number
}

async function read(worker: Tesseract.Worker, image: Buffer | string, radians = 0): Promise<Reading> {
  const { data } = await worker.recognize(image, radians ? { rotateRadians: radians } : {})
  const text = data.text.trim()
  /* Two stray marks read with certainty are not a page. */
  const words = text.split(/\s+/).filter((word) => /[a-z0-9]{2,}/i.test(word)).length
  return { text, score: words >= 3 ? data.confidence : data.confidence / 2 }
}

/**
 * Text from a photograph taken any way up.
 *
 * Tesseract reads a page only when it is upright; sideways or upside down it
 * returns confident-looking noise. So the page is read upright first, and if
 * that reading is unsure it is read at the three other quarter turns and the
 * surest one wins. If even that one is unsure the sheet was probably held
 * crooked, and a few small tilts either way are tried on top of it.
 */
export async function extractTextAnyOrientation(imagePath: string): Promise<string> {
  const absPath = resolveImage(imagePath)
  if (!absPath) return ''
  let worker: Tesseract.Worker | undefined
  try {
    console.log(`🔍 OCR processing (any orientation): ${absPath}`)
    worker = await Tesseract.createWorker('eng', undefined, workerOptions())
    const turns = quarterTurns(absPath)
    const pages: (Buffer | string)[] = turns ?? [absPath]

    let page = pages[0]
    let best = await read(worker, page)
    for (let i = 1; i < 4 && best.score < SURE; i++) {
      /* Without our own turns, Tesseract's in-frame rotation is the fallback:
         a half turn is exact, a quarter turn may clip a tall page. */
      const reading = turns ? await read(worker, turns[i]) : await read(worker, absPath, (i * Math.PI) / 2)
      if (reading.score > best.score) {
        best = reading
        if (turns) page = turns[i]
      }
    }

    if (turns && best.score < STRAIGHT) {
      let centre = 0
      for (const step of [10, 5]) {
        const from = centre
        for (const tilt of [from - step, from + step]) {
          const reading = await read(worker, page, tilt * DEG)
          if (reading.score > best.score) {
            best = reading
            centre = tilt
          }
        }
      }
    }
    return best.text
  } catch (error) {
    console.error(`❌ OCR failed for ${imagePath}:`, error)
    return ''
  } finally {
    await worker?.terminate().catch(() => undefined)
  }
}

export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
    'shall',
    'it',
    'its',
    'this',
    'that',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'we',
    'they',
    'me',
    'him',
    'her',
    'us',
    'them',
    'my',
    'your',
    'his',
    'our',
    'their',
    'not',
    'no',
    'so',
    'if',
    'as'
  ])
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w))
  return [...new Set(words)]
}

export async function processSlides(
  slidePaths: string[]
): Promise<{ path: string; text: string; keywords: string[] }[]> {
  const results: { path: string; text: string; keywords: string[] }[] = []
  for (const slidePath of slidePaths) {
    const text = await extractTextFromImage(slidePath)
    const keywords = extractKeywords(text)
    results.push({ path: slidePath, text, keywords })
  }
  return results
}
