import fs from 'node:fs'
import path from 'node:path'
import corpus from '../data/passages/bsb-sections.json'
import { WordPiece } from './wordpiece'

/**
 * Allusions — "when God told Abraham that his only son should be sacrificed".
 *
 * PassageMatcher counts the Bible's own words, so it hears nothing when the
 * preacher uses his: the account says "burnt offering", not "sacrificed".
 * This matcher compares meaning instead. Every short run of verses was turned
 * into a vector once, at build time; one spoken sentence becomes a vector
 * here and the nearest runs are the candidates.
 *
 * Meaning alone cannot tell an allusion from a theme: any talk of
 * forgiveness sits near the Prodigal Son. So the vector score is blended with
 * plain word overlap, and `confident` is only set when both agree. The auto
 * path takes confident results only. A press of the button shows the nearest
 * four whatever their score, because a person asked and will choose.
 *
 * Runs on the machine. Nothing is sent anywhere.
 */

export interface SemanticCandidate {
  passageId: string
  ref: string
  book: string
  chapter: number
  verse: number
  endVerse: number
  title: string
  /** The heading and verses the model compared against. */
  text: string
  /** Words shared with the passage, rarest first. */
  evidence: string[]
  /** Cosine similarity of meaning, roughly 0..1. Not a probability. */
  meaning: number
  /** Share of the sentence's distinctive words found in the passage. */
  overlap: number
  score: number
  /** Meaning and wording both agree — safe to suggest unasked. */
  confident: boolean
}

export type Embedder = (text: string) => Promise<Float32Array>

interface Section {
  id: string
  book: string
  chapter: number
  title: string
  verses: { verse: number; text: string }[]
}

export interface SemanticUnit {
  passageId: string
  book: string
  chapter: number
  verse: number
  endVerse: number
  title: string
  /** What the model reads: the printed heading, then the verses. */
  text: string
}

export const VECTOR_DIM = 384
const MAGIC = 0x56495254 // "TRIV"
const HEADER_BYTES = 16
/** How much word overlap counts beside meaning. Measured, see the README. */
const OVERLAP_WEIGHT = 0.5

/**
 * Three verses at a time, stepping two, each under its section heading. A
 * whole section is too long to mean one thing; a single verse is too short
 * to carry the scene. The build script and the runtime must agree on this
 * list exactly — the vector file is checked against its length.
 */
export function semanticUnits(): SemanticUnit[] {
  const units: SemanticUnit[] = []
  for (const section of corpus.sections as Section[]) {
    for (let i = 0; i < section.verses.length; i += 2) {
      const verses = section.verses.slice(i, i + 3)
      units.push({
        passageId: section.id, book: section.book, chapter: section.chapter,
        verse: verses[0].verse, endVerse: verses[verses.length - 1].verse, title: section.title,
        text: `${section.title}. ${verses.map(verse => verse.text).join(' ')}`,
      })
      if (i + 3 >= section.verses.length) break
    }
  }
  return units
}

const STOP = new Set(('a an and are as at be been being but by can could did do does for from had has have he her here hers him his how i if in into is it its just let like me more my no not of on one or our ours out said say says she so some than that the their them then there these they this those through to too up us was we were what when where which who why will with would you your god lord jesus christ man men people thing things now came come went go told tell all also any because before after again about every very shall should may might must thus indeed even only own other over under away whom whose am dont').split(' '))
const stem = (word: string) => word.length > 4 ? word.replace(/(ing|ed|es|s)$/, '') : word
function words(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[’']s\b/g, '').replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(word => word.length > 1 && !STOP.has(word)).map(stem))
}

export function writeVectorFile(file: string, vectors: Float32Array[]): void {
  const out = Buffer.alloc(HEADER_BYTES + vectors.length * VECTOR_DIM)
  out.writeUInt32LE(MAGIC, 0)
  out.writeUInt32LE(1, 4)
  out.writeUInt32LE(vectors.length, 8)
  out.writeUInt32LE(VECTOR_DIM, 12)
  vectors.forEach((vector, row) => {
    for (let d = 0; d < VECTOR_DIM; d++) out.writeInt8(Math.max(-127, Math.min(127, Math.round(vector[d] * 127))), HEADER_BYTES + row * VECTOR_DIM + d)
  })
  fs.writeFileSync(file, out)
}

/** The sentence model, loaded from a folder holding the two bundled files. */
export async function loadEmbedder(modelDir: string): Promise<Embedder> {
  const tokenizer = WordPiece.fromTokenizerJson(fs.readFileSync(path.join(modelDir, 'tokenizer.json'), 'utf8'))
  // The runtime is CommonJS: bundled, it arrives under `default`.
  const loaded = await import('onnxruntime-node')
  const ort = loaded.InferenceSession ? loaded : (loaded as unknown as { default: typeof loaded }).default
  const session = await ort.InferenceSession.create(path.join(modelDir, 'model_quantized.onnx'), { intraOpNumThreads: 2 })
  return async (text: string) => {
    const ids = tokenizer.encode(text)
    const shape = [1, ids.length]
    const output = await session.run({
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), shape),
      attention_mask: new ort.Tensor('int64', new BigInt64Array(ids.length).fill(1n), shape),
      token_type_ids: new ort.Tensor('int64', new BigInt64Array(ids.length), shape),
    })
    const hidden = output.last_hidden_state.data as Float32Array
    // Mean of the token vectors, then unit length, as the model was trained.
    const vector = new Float32Array(VECTOR_DIM)
    for (let t = 0; t < ids.length; t++) for (let d = 0; d < VECTOR_DIM; d++) vector[d] += hidden[t * VECTOR_DIM + d]
    let norm = 0
    for (let d = 0; d < VECTOR_DIM; d++) norm += vector[d] * vector[d]
    norm = Math.sqrt(norm) || 1
    for (let d = 0; d < VECTOR_DIM; d++) vector[d] /= norm
    return vector
  }
}

export type Judge = (said: string, passage: string) => Promise<number>

/**
 * A second, small model that reads the sentence and ONE passage together and
 * scores whether they are about the same thing. Used as the yes/no on the
 * automatic path: it separates an allusion from ordinary talk better than
 * thresholds on the two scores above (see the passages README for numbers).
 * It was no better at choosing between passages, so it does not reorder.
 */
export async function loadJudge(modelDir: string): Promise<Judge> {
  const tokenizer = WordPiece.fromTokenizerJson(fs.readFileSync(path.join(modelDir, 'tokenizer.json'), 'utf8'))
  const loaded = await import('onnxruntime-node')
  const ort = loaded.InferenceSession ? loaded : (loaded as unknown as { default: typeof loaded }).default
  const session = await ort.InferenceSession.create(path.join(modelDir, 'model_quantized.onnx'), { intraOpNumThreads: 2 })
  return async (said: string, passage: string) => {
    const { ids, types } = tokenizer.encodePair(said, passage)
    const shape = [1, ids.length]
    const output = await session.run({
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), shape),
      attention_mask: new ort.Tensor('int64', new BigInt64Array(ids.length).fill(1n), shape),
      token_type_ids: new ort.Tensor('int64', BigInt64Array.from(types.map(BigInt)), shape),
    })
    return (output.logits.data as Float32Array)[0]
  }
}

export class SemanticMatcher {
  private units = semanticUnits()
  private unitWords = this.units.map(unit => words(unit.text))
  private rarity = new Map<string, number>()
  private vectors: Int8Array | null = null
  private embed: Embedder | null = null

  constructor() {
    const counts = new Map<string, number>()
    for (const set of this.unitWords) for (const word of set) counts.set(word, (counts.get(word) ?? 0) + 1)
    for (const [word, count] of counts) this.rarity.set(word, Math.log(1 + this.units.length / count))
  }

  get ready(): boolean { return !!this.vectors && !!this.embed }

  /** False, with nothing loaded, when the vector file does not fit this corpus. */
  loadVectors(file: string): boolean {
    const bytes = fs.readFileSync(file)
    if (bytes.length < HEADER_BYTES || bytes.readUInt32LE(0) !== MAGIC || bytes.readUInt32LE(4) !== 1) return false
    if (bytes.readUInt32LE(8) !== this.units.length || bytes.readUInt32LE(12) !== VECTOR_DIM) return false
    if (bytes.length !== HEADER_BYTES + this.units.length * VECTOR_DIM) return false
    this.vectors = new Int8Array(bytes.buffer, bytes.byteOffset + HEADER_BYTES, this.units.length * VECTOR_DIM)
    return true
  }

  setEmbedder(embed: Embedder): void { this.embed = embed }

  /**
   * The nearest passages, one per printed section, best first. `boost` adds
   * to a passage's score by where it is; it reorders, it does not change
   * `confident`.
   */
  async search(text: string, limit = 4, boost?: (book: string, chapter: number) => number): Promise<SemanticCandidate[]> {
    if (!this.vectors || !this.embed) return []
    if (text.trim().split(/\s+/).length < 3) return []
    // "where you go I will go" is all small words; meaning still finds it.
    const said = [...words(text)]
    const query = await this.embed(text)
    // A word the Bible never uses still counts against the match.
    const saidWeight = said.reduce((sum, word) => sum + (this.rarity.get(word) ?? 6), 0) || 1
    const vectors = this.vectors
    const rows = this.units.map((_, row) => {
      let dot = 0
      const offset = row * VECTOR_DIM
      for (let d = 0; d < VECTOR_DIM; d++) dot += query[d] * vectors[offset + d]
      const meaning = dot / 127
      const shared = said.filter(word => this.unitWords[row].has(word))
      const overlap = shared.reduce((sum, word) => sum + (this.rarity.get(word) ?? 0), 0) / saidWeight
      const unit = this.units[row]
      return { row, meaning, overlap, shared, score: meaning + OVERLAP_WEIGHT * overlap + (boost ? boost(unit.book, unit.chapter) : 0) }
    }).sort((a, b) => b.score - a.score)
    const seen = new Set<string>()
    const out: SemanticCandidate[] = []
    for (const hit of rows.slice(0, 60)) {
      const unit = this.units[hit.row]
      if (seen.has(unit.passageId)) continue
      seen.add(unit.passageId)
      out.push({
        passageId: unit.passageId, book: unit.book, chapter: unit.chapter, verse: unit.verse, endVerse: unit.endVerse, title: unit.title, text: unit.text,
        ref: `${unit.book} ${unit.chapter}:${unit.verse}${unit.endVerse > unit.verse ? `-${unit.endVerse}` : ''}`,
        evidence: hit.shared.sort((a, b) => (this.rarity.get(b) ?? 0) - (this.rarity.get(a) ?? 0)).slice(0, 6),
        meaning: hit.meaning, overlap: hit.overlap, score: hit.score,
        confident: hit.meaning >= 0.6 && hit.overlap >= 0.4 && hit.shared.length >= 3,
      })
      if (out.length === limit) break
    }
    return out
  }
}
