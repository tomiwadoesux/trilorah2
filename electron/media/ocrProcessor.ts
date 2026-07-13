import * as fs from 'node:fs'
import * as path from 'node:path'
import Tesseract from 'tesseract.js'

export async function extractTextFromImage(imagePath: string): Promise<string> {
  try {
    const absPath = path.isAbsolute(imagePath) ? imagePath : path.resolve(imagePath)
    if (!fs.existsSync(absPath)) {
      console.error(`❌ OCR skipped — file not found: ${absPath}`)
      return ''
    }
    console.log(`🔍 OCR processing: ${absPath}`)
    const result = await Tesseract.recognize(absPath, 'eng', {
      logger: () => {} // Suppress progress logs
    })
    return result.data.text.trim()
  } catch (error) {
    console.error(`❌ OCR failed for ${imagePath}:`, error)
    return ''
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
