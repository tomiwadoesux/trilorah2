import type { LanguagePack } from './types'
import { es } from './es'
import { fr } from './fr'
import { pt } from './pt'
import { hi } from './hi'
import { zh } from './zh'

export type { LanguagePack } from './types'
export { chineseNumberValue } from './zh'

/** English needs no pack — the resolver's base tables ARE English. */
const PACKS: Record<string, LanguagePack> = { es, fr, pt, hi, zh }

export function getLanguagePack(code: string): LanguagePack | null {
  return PACKS[code] ?? null
}

export function availableLanguages(): Array<{ code: string; label: string }> {
  return [
    { code: 'en', label: 'English' },
    ...Object.values(PACKS).map((p) => ({ code: p.code, label: p.label }))
  ]
}
