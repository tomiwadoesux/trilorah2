/**
 * Every Bible translation the app knows by name.
 *
 * The database stores a code ("WEB", "AA"), and every picker used to show
 * exactly that — "AA APEE BBE CUV KJV RVR WEB" — which an operator in a
 * Lagos church has no way to read. This is the one place a code becomes a
 * name, so the LIVE library, Settings, the projector-text page and the phone
 * remote all say the same thing.
 *
 * It also holds the rule a licensed translation brings with it: its initials
 * go on the wall with every quotation (Biblica asks "(NIV)" after each one in
 * church media; HarperCollins allows NKJV projected in worship when it is
 * cited). shared/verseDisplay.ts reads that here, so the operator's preview,
 * the wall and the phone all carry the same initials.
 *
 * Imports nothing, so the main process, the renderer and verseDisplay can
 * all use it.
 */

export type BibleLicence = 'public-domain' | 'cc-by-sa' | 'licensed'

export interface BibleVersionInfo {
  code: string
  /** The name a church knows it by. */
  name: string
  /** English name of the language, for anything not in English. */
  language: string
  licence: BibleLicence
  /** Its initials must follow every quotation, whatever the theme says. */
  requiresInitials: boolean
  /** Ships inside bible.db. */
  bundled: boolean
}

const pd = (code: string, name: string, language = 'English'): BibleVersionInfo =>
  ({ code, name, language, licence: 'public-domain', requiresInitials: false, bundled: true })
const licensed = (code: string, name: string): BibleVersionInfo =>
  ({ code, name, language: 'English', licence: 'licensed', requiresInitials: true, bundled: false })

/**
 * In picker order: the English Bibles a church asks for first, then the
 * modern public-domain ones, then the other languages.
 */
const CATALOGUE: BibleVersionInfo[] = [
  pd('KJV', 'King James Version'),
  licensed('NKJV', 'New King James Version'),
  licensed('NIV', 'New International Version'),
  pd('BSB', 'Berean Standard Bible'),
  pd('WEB', 'World English Bible'),
  pd('ASV', 'American Standard Version'),
  pd('BBE', 'Bible in Basic English'),
  licensed('ESV', 'English Standard Version'),
  licensed('NLT', 'New Living Translation'),
  licensed('NASB', 'New American Standard Bible'),
  licensed('AMP', 'Amplified Bible'),
  licensed('MSG', 'The Message'),
  licensed('CSB', 'Christian Standard Bible'),
  pd('RVR', 'Reina-Valera', 'Spanish'),
  pd('APEE', "La Bible de l'Épée", 'French'),
  pd('AA', 'Almeida', 'Portuguese'),
  pd('CUV', 'Chinese Union Version', 'Chinese'),
]

export const BIBLE_VERSIONS: Readonly<Record<string, BibleVersionInfo>> = Object.freeze(
  Object.fromEntries(CATALOGUE.map((v) => [v.code, v])),
)

/** What a version code may look like: short enough for the library's picker and the phone's. */
export const VERSION_CODE_RE = /^[A-Z0-9]{2,5}$/

export function versionInfo(code: string | null | undefined): BibleVersionInfo | undefined {
  return code ? BIBLE_VERSIONS[code.toUpperCase()] : undefined
}

/** The full name, or the code itself when the app does not know it. */
export function versionName(code: string): string {
  return versionInfo(code)?.name ?? code
}

/** The name, plus the language when it is not English: 'Reina-Valera · Spanish'. */
export function versionHint(code: string): string {
  const info = versionInfo(code)
  if (!info) return ''
  return info.language === 'English' ? info.name : `${info.name} · ${info.language}`
}

/** 'WEB · World English Bible', 'RVR · Reina-Valera · Spanish' — a code a church can read. */
export function versionLabel(code: string): string {
  const info = versionInfo(code)
  return info ? `${info.code} · ${versionHint(code)}` : code
}

/**
 * Whether the initials have to follow the words on screen. A version the
 * app cannot name is treated as licensed: nobody here can vouch for its
 * terms, and carrying its initials costs nothing.
 */
export function requiresInitials(code: string | null | undefined): boolean {
  if (!code) return false
  return versionInfo(code)?.requiresInitials ?? true
}

/** Installed codes in picker order; ones the catalogue does not know go last, alphabetically. */
export function sortVersions(codes: readonly string[]): string[] {
  const rank = (code: string) => {
    const i = CATALOGUE.findIndex((v) => v.code === code)
    return i < 0 ? CATALOGUE.length : i
  }
  return [...new Set(codes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

/** Picker rows: the code on the trigger, the name beside it in the list. */
export function versionOptions(codes: readonly string[]): { value: string; label: string; hint: string }[] {
  return sortVersions(codes).map((code) => ({ value: code, label: code, hint: versionHint(code) }))
}
