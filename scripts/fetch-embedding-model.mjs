/**
 * Fetch the two small models that allusion matching runs on.
 *
 *   node scripts/fetch-embedding-model.mjs
 *
 * all-MiniLM-L6-v2 turns a sentence into a vector; ms-marco-MiniLM-L-6-v2
 * judges whether a sentence and a passage are about the same thing. Both are
 * Apache-2.0, 8-bit ONNX exports of about 23 MB. They are not source, so they
 * are downloaded into data/models/ (gitignored) and shipped beside the app by
 * electron-builder. Each file is checked against a known SHA-256; a file
 * already present and correct is left alone.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const models = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'models')
const files = [
  ['all-MiniLM-L6-v2', 'model_quantized.onnx', 'onnx/model_quantized.onnx', 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1'],
  ['all-MiniLM-L6-v2', 'tokenizer.json', 'tokenizer.json', 'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0'],
  ['ms-marco-MiniLM-L-6-v2', 'model_quantized.onnx', 'onnx/model_quantized.onnx', 'e9d8ebf845c413e981c175bfe49a3bfa9b3dcce2a3ba54875ee5df5a58639fbe'],
  ['ms-marco-MiniLM-L-6-v2', 'tokenizer.json', 'tokenizer.json', 'd241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66'],
]
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

for (const [model, name, remote, expected] of files) {
  const target = path.join(models, model, name)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (fs.existsSync(target) && sha(fs.readFileSync(target)) === expected) { console.log(`ok       ${model}/${name}`); continue }
  const response = await fetch(`https://huggingface.co/Xenova/${model}/resolve/main/${remote}`)
  if (!response.ok) throw new Error(`Could not download ${model}/${remote}: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (sha(bytes) !== expected) throw new Error(`${model}/${name} failed verification. Nothing was written.`)
  fs.writeFileSync(target, bytes)
  console.log(`fetched  ${model}/${name} (${(bytes.length / 1e6).toFixed(1)} MB)`)
}
