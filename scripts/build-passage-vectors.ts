/**
 * Turn every run of verses into a vector, once, for allusion matching.
 *
 *   npm run passages:vectors
 *
 * Reads the bundled BSB sections, embeds each unit with the same model the
 * app ships, and writes electron/data/passages/bsb-vectors.bin (8-bit, about
 * 6 MB). Rerun whenever bsb-sections.json or the model changes: the app
 * refuses a vector file whose length does not match its corpus. No network.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEmbedder, semanticUnits, writeVectorFile } from '../electron/engine/semanticMatcher'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const embed = await loadEmbedder(path.join(root, 'data', 'models', 'all-MiniLM-L6-v2'))
  const units = semanticUnits()
  const vectors: Float32Array[] = []
  const started = Date.now()
  for (const [i, unit] of units.entries()) {
    vectors.push(await embed(unit.text))
    if (i % 2000 === 0) console.log(`${i}/${units.length}  ${Math.round((Date.now() - started) / 1000)}s`)
  }
  const out = path.join(root, 'electron', 'data', 'passages', 'bsb-vectors.bin')
  writeVectorFile(out, vectors)
  console.log(`wrote ${units.length} vectors to ${out}`)
}

void main()
