/** Fetch and verify the English OCR data bundled for offline programme scans. */
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'

const target = new URL('../eng.traineddata', import.meta.url)
const expected = '5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

if (fs.existsSync(target) && sha(fs.readFileSync(target)) === expected) {
  console.log('ok       eng.traineddata')
} else {
  const response = await fetch('https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz')
  if (!response.ok) throw new Error(`Could not download English OCR data: ${response.status}`)
  const bytes = gunzipSync(Buffer.from(await response.arrayBuffer()))
  if (sha(bytes) !== expected) throw new Error('English OCR data failed verification. Nothing was written.')
  fs.writeFileSync(target, bytes)
  console.log(`fetched  eng.traineddata (${(bytes.length / 1e6).toFixed(1)} MB)`)
}
