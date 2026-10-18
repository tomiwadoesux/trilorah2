import fs from 'node:fs'
import path from 'node:path'
import { bookIdMap } from '../data/books'
import { parseSpokenNumber } from '../../shared/spokenNumbers'
import type { PreacherTeaching } from '../../shared/preacherLearning'

const empty = (): PreacherTeaching => ({ soundsLike: [], vocabulary: [], ignoreTails: [], voiceCommands: true })
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)

/** Exact, approved book aliases only, followed by a chapter/number cue.
 * Never rewrite arbitrary sermon prose, fuzzy-match numbers, or invent verses. */
export function applyBookAliases(text: string, aliases: PreacherTeaching['soundsLike']): string {
  const tokens = text.match(/[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+/gu) ?? []
  const positions = tokens.flatMap((s, i) => /^[\p{L}\p{M}\p{N}]+$/u.test(s) ? [i] : [])
  const plain = positions.map((i) => tokens[i].toLowerCase())
  const replacements: { start: number; end: number; value: string }[] = []
  for (let i = 0; i < plain.length; i++) {
    for (const alias of [...aliases].sort((a, b) => b.heard.length - a.heard.length)) {
      const from = words(alias.heard)
      if (!from.length || !from.every((w, j) => plain[i + j] === w)) continue
      const after = i + from.length
      if (plain[after] !== 'chapter' && !parseSpokenNumber(plain, after)) continue
      replacements.push({ start: positions[i], end: positions[after - 1], value: alias.means })
      i = after - 1
      break
    }
  }
  for (const r of replacements.reverse()) tokens.splice(r.start, r.end - r.start + 1, r.value)
  return tokens.join('')
}

export function validateTeaching(patch: Partial<PreacherTeaching>): Partial<PreacherTeaching> {
  const out: Partial<PreacherTeaching> = {}
  for (const key of ['vocabulary', 'ignoreTails'] as const) {
    if (patch[key] === undefined) continue
    if (!Array.isArray(patch[key]) || patch[key]!.length > 100) throw new Error('Use at most 100 words or phrases.')
    out[key] = [...new Set(patch[key]!.map((t) => {
      if (typeof t !== 'string' || !t.trim() || t.length > 120) throw new Error('Use a phrase between 1 and 120 characters.')
      return t.trim()
    }))]
  }
  if (patch.voiceCommands !== undefined) {
    if (typeof patch.voiceCommands !== 'boolean') throw new Error('Choose whether voice commands are on or off.')
    out.voiceCommands = patch.voiceCommands
  }
  if (patch.soundsLike !== undefined) {
    if (!Array.isArray(patch.soundsLike) || patch.soundsLike.length > 100) throw new Error('Use at most 100 book corrections.')
    const seen = new Set<string>()
    out.soundsLike = patch.soundsLike.map((a) => {
      if (typeof a?.heard !== 'string' || typeof a.means !== 'string' || !a.heard.trim() || a.heard.length > 120) throw new Error('Enter the misheard book name.')
      const means = Object.keys(bookIdMap).find((b) => b.toLowerCase() === a.means.trim().toLowerCase())
      if (!means) throw new Error('The correction must be a Bible book name, such as Romans or 1 John.')
      const heard = words(a.heard).join(' ')
      if (!heard || seen.has(heard)) throw new Error('Each misheard phrase needs one correction.')
      seen.add(heard)
      /* Voice training saves its fixes as `learned` so the page can say
         which ones the app worked out and which a person typed. */
      return { heard, means, source: a.source === 'learned' ? 'learned' as const : 'taught' as const, hits: 0 }
    })
  }
  return out
}

/** Small local files; no training job, network call or audio storage. */
export class TeachingStore {
  private cache = new Map<string, PreacherTeaching>()
  constructor(private dir: string) {}
  private file(id: string) { return path.join(this.dir, `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`) }
  has(id: string) { return fs.existsSync(this.file(id)) }
  get(id: string): PreacherTeaching {
    if (!this.cache.has(id)) {
      let data = empty()
      try { data = { ...data, ...validateTeaching(JSON.parse(fs.readFileSync(this.file(id), 'utf8'))) } }
      catch (error: any) { if (error.code !== 'ENOENT') throw new Error('Could not read this preacher’s teaching file. It has been left unchanged.') }
      this.cache.set(id, data)
    }
    return structuredClone(this.cache.get(id)!)
  }
  patch(id: string, patch: Partial<PreacherTeaching>): PreacherTeaching {
    const data = { ...this.get(id), ...validateTeaching(patch) }
    fs.mkdirSync(this.dir, { recursive: true })
    const file = this.file(id)
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2))
    fs.renameSync(`${file}.tmp`, file)
    this.cache.set(id, data)
    return structuredClone(data)
  }
  /** Save one fix from voice training. A phrase already fixed to another book is refused. */
  addAlias(id: string, alias: { heard: string; means: string }): PreacherTeaching {
    const current = this.get(id).soundsLike
    const heard = words(alias.heard).join(' ')
    const clash = current.find((a) => a.heard === heard)
    if (clash && clash.means !== alias.means) throw new Error(`“${heard}” already means ${clash.means}.`)
    if (clash) return this.get(id)
    return this.patch(id, { soundsLike: [{ heard, means: alias.means, source: 'learned', hits: 0 }, ...current] })
  }

  removeAlias(id: string, heard: string): PreacherTeaching {
    const key = words(heard).join(' ')
    return this.patch(id, { soundsLike: this.get(id).soundsLike.filter((a) => a.heard !== key) })
  }

  remove(id: string) {
    fs.rmSync(this.file(id), { force: true })
    this.cache.delete(id)
  }
}
