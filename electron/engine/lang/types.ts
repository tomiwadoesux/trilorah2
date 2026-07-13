/**
 * Language packs — everything the engine needs to HEAR scripture
 * references and commands in a language: native book names, spoken number
 * words, chapter/verse keywords, and command phrases.
 *
 * Packs are additive: the English tables always stay active underneath
 * (bilingual preachers code-switch mid-sentence), the pack extends them.
 */

import type { CommandPhraseConfig } from '../commandConfig'

export interface LanguagePack {
  code: string
  label: string
  /** Canonical ENGLISH book name → native spoken aliases (normalized:
   *  lowercase, diacritics folded for Latin scripts). */
  bookAliases: Record<string, string[]>
  /** Atomic spoken-number words → value (1-100). */
  numberWords: Record<string, number>
  /** Token sequences merged into one atomic token before number parsing
   *  (French "quatre vingt dix neuf" → "quatrevingtdixneuf"). The joined
   *  form must exist in numberWords. Longest sequences win. */
  numberCompounds: string[][]
  /** Connectors allowed inside a number ("y", "et", "e", "and"). */
  numberConnectors: string[]
  chapterWords: string[]
  verseWords: string[]
  /** Words introducing a range end ("to", "al", "au", "ate"). */
  rangeWords: string[]
  fillers: string[]
  /** words: space-separated matching (Latin, Devanagari).
   *  substring: no word boundaries (Chinese). */
  matchMode: 'words' | 'substring'
  /** Command/intent phrases this language contributes. */
  commands: Partial<CommandPhraseConfig>
}

/** Helper: build aliases for numbered books ("1 Corinthians") from the
 *  language's ordinal words + connector ("primera de corintios"). */
export function numberedAliases(
  stem: string,
  digit: '1' | '2' | '3',
  ordinals: Record<'1' | '2' | '3', string[]>,
  connectors: string[] = []
): string[] {
  const out: string[] = [`${digit} ${stem}`]
  for (const ord of ordinals[digit]) {
    out.push(`${ord} ${stem}`)
    for (const c of connectors) out.push(`${ord} ${c} ${stem}`)
  }
  return out
}
