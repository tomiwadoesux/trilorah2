/**
 * Voice-command / intent phrase configuration — everything the engines
 * listen for is data, not code.
 *
 * Four layers, unioned (later layers ADD phrases, never remove):
 *   1. built-in defaults (English)
 *   2. the active language pack's phrases (Spanish, French, …)
 *   3. the user's own file:  <userData>/voice-commands.json
 *   4. the active preacher's file: <userData>/preacher-commands/<id>.json
 *
 * The user file is plain JSON with any subset of the keys below — add a
 * phrase to any list and it's live at next engine reload. A commented
 * template is written on first run.
 */

import fs from 'node:fs'
import path from 'node:path'

export interface VersionPhrase {
  phrases: string[]
  code: string
}

export interface CommandPhraseConfig {
  versionPhrases: VersionPhrase[]
  /** Correction lead-ins: "i said", "yo dije", … */
  iSaidTriggers: string[]
  prayerStart: string[]
  prayerEnd: string[]
  dismiss: string[]
  hold: string[]
  navNext: string[]
  navPrevious: string[]
  intentPhrases: string[]
  narrativeMarkers: string[]
  deferPhrases: string[]
  /** Words meaning "chapter" / "verse" for the correction grammar. */
  chapterWords: string[]
  verseWords: string[]
  /**
   * Habitual words a preacher appends after a reference ("amen",
   * "say verse ten") — stripped from the utterance tail before resolving.
   * Mostly per-preacher; empty by default.
   */
  ignoreTails?: string[]
}

/** Keys of CommandPhraseConfig that are plain phrase lists. */
export type PhraseListKey = Exclude<keyof CommandPhraseConfig, 'versionPhrases'>

export const DEFAULT_COMMANDS: CommandPhraseConfig = {
  versionPhrases: [
    { phrases: ['new king james version', 'new king james'], code: 'NKJV' },
    { phrases: ['king james version', 'king james', 'authorized version'], code: 'KJV' },
    { phrases: ['berean standard bible', 'berean standard', 'berean bible'], code: 'BSB' },
    { phrases: ['new international version', 'n i v'], code: 'NIV' },
    { phrases: ['english standard version', 'e s v'], code: 'ESV' },
    { phrases: ['new living translation', 'n l t'], code: 'NLT' },
    { phrases: ['new american standard bible', 'new american standard'], code: 'NASB' },
    { phrases: ['amplified bible', 'the amplified', 'amplified version'], code: 'AMP' },
    { phrases: ['message translation', 'the message bible'], code: 'MSG' },
    { phrases: ['world english bible'], code: 'WEB' },
    { phrases: ['american standard version'], code: 'ASV' },
    { phrases: ['revised standard version'], code: 'RSV' },
    { phrases: ['bible in basic english', 'basic english bible', 'basic english version'], code: 'BBE' },
    { phrases: ['new revised standard version'], code: 'NRSV' },
    { phrases: ['christian standard bible'], code: 'CSB' },
    { phrases: ['reina valera'], code: 'RVR' },
    { phrases: ['almeida'], code: 'AA' },
    { phrases: ['chinese union version'], code: 'CUV' },
    { phrases: ['bible de l epee', "bible de l'epee"], code: 'APEE' }
  ],
  iSaidTriggers: ['i said'],
  prayerStart: ['let us pray', "let's pray", 'bow your heads', 'every head bowed'],
  prayerEnd: ['amen'],
  dismiss: ['take that down', 'take it down', 'clear the screen', 'take it off'],
  hold: [
    'leave that up',
    'leave it up',
    'keep that up',
    'keep it up',
    'keep it there',
    'hold that',
    'hold it there'
  ],
  // Multi-word only — bare "next" / "back" / "continue" fire on ordinary
  // preaching ("and then the next thing Paul says…").
  navNext: [
    'next verse',
    'the next verse',
    'go to the next verse',
    'verse after that',
    // Asked of the text rather than commanded — "what's the next thing there?"
    'read the next verse',
    'read the next one',
    'the next one',
    'whats next',
    'what is next',
    'whats the next',
    'what is the next',
    'what does the next',
    'the following verse',
    'lets read on',
    'read on'
  ],
  navPrevious: [
    'previous verse',
    'the previous verse',
    'go back a verse',
    'the verse before',
    'verse before that'
  ],
  intentPhrases: [
    'turn with me to',
    'turn to',
    'turn in your bibles',
    'open your bibles',
    'open your bible',
    'if you have your bible',
    'go with me to',
    'come with me to',
    "let's read",
    'let us read',
    'i want to read',
    'reading from',
    'look at',
    'looking at'
  ],
  narrativeMarkers: [
    'there was a',
    'there was once',
    'let me tell you',
    'i remember',
    'years ago',
    'a story',
    'the story of',
    'one day',
    'imagine'
  ],
  deferPhrases: [
    "we'll come back to",
    'we will come back to',
    "we'll get to",
    "we'll look at that later",
    'come back to that',
    'hold that thought',
    'later on'
  ],
  chapterWords: ['chapter'],
  verseWords: ['verse', 'verses'],
  ignoreTails: []
}

function unionArrays(a: string[] = [], b: string[] = []): string[] {
  return [...new Set([...a, ...b])]
}

function unionVersions(a: VersionPhrase[] = [], b: VersionPhrase[] = []): VersionPhrase[] {
  const byCode = new Map<string, Set<string>>()
  for (const { code, phrases } of [...a, ...b]) {
    const set = byCode.get(code) ?? new Set<string>()
    phrases.forEach((p) => set.add(p))
    byCode.set(code, set)
  }
  return [...byCode.entries()].map(([code, phrases]) => ({
    code,
    phrases: [...phrases]
  }))
}

/** Union two configs — every list grows, nothing is removed. */
export function mergeCommandConfigs(
  base: CommandPhraseConfig,
  extra: Partial<CommandPhraseConfig>
): CommandPhraseConfig {
  return {
    versionPhrases: unionVersions(base.versionPhrases, extra.versionPhrases),
    iSaidTriggers: unionArrays(base.iSaidTriggers, extra.iSaidTriggers),
    prayerStart: unionArrays(base.prayerStart, extra.prayerStart),
    prayerEnd: unionArrays(base.prayerEnd, extra.prayerEnd),
    dismiss: unionArrays(base.dismiss, extra.dismiss),
    hold: unionArrays(base.hold, extra.hold),
    navNext: unionArrays(base.navNext, extra.navNext),
    navPrevious: unionArrays(base.navPrevious, extra.navPrevious),
    intentPhrases: unionArrays(base.intentPhrases, extra.intentPhrases),
    narrativeMarkers: unionArrays(base.narrativeMarkers, extra.narrativeMarkers),
    deferPhrases: unionArrays(base.deferPhrases, extra.deferPhrases),
    chapterWords: unionArrays(base.chapterWords, extra.chapterWords),
    verseWords: unionArrays(base.verseWords, extra.verseWords),
    ignoreTails: unionArrays(base.ignoreTails, extra.ignoreTails)
  }
}

/**
 * Strip a preacher's habitual tail words from the END of an utterance
 * ("romans eight twenty eight amen" → "romans eight twenty eight").
 * Repeats until no tail matches, so "… amen amen" also folds. Comparison is
 * case/punctuation-insensitive; the surviving text is returned trimmed.
 */
export function stripIgnoreTails(text: string, tails: string[] = []): string {
  if (tails.length === 0) return text
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
  const tailWords = tails.map(norm).filter((t) => t.length > 0)
  let words = norm(text)
  let changed = true
  while (changed && words.length > 0) {
    changed = false
    for (const t of tailWords) {
      if (t.length > words.length) continue
      const end = words.slice(words.length - t.length)
      if (end.every((w, i) => w === t[i])) {
        words = words.slice(0, words.length - t.length)
        changed = true
      }
    }
  }
  return words.join(' ')
}

const USER_FILE_TEMPLATE = {
  _readme:
    'Add your own phrases to any list — they are ADDED to the built-in ones. ' +
    'Keys: versionPhrases, iSaidTriggers, prayerStart, prayerEnd, dismiss, hold, ' +
    'navNext, navPrevious, intentPhrases, narrativeMarkers, deferPhrases, ' +
    'chapterWords, verseWords, ignoreTails. Phrases must be lowercase. ' +
    'Reload from Settings or restart the app to apply.',
  prayerStart: [],
  dismiss: [],
  versionPhrases: []
}

export function userCommandFilePath(userDataDir: string): string {
  return path.join(userDataDir, 'voice-commands.json')
}

/** Read the user's overrides, creating a commented template on first run. */
export function loadUserCommandConfig(userDataDir: string): Partial<CommandPhraseConfig> {
  const file = userCommandFilePath(userDataDir)
  try {
    if (!fs.existsSync(file)) {
      fs.mkdirSync(userDataDir, { recursive: true })
      fs.writeFileSync(file, JSON.stringify(USER_FILE_TEMPLATE, null, 2))
      return {}
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    delete parsed._readme
    return parsed
  } catch (e) {
    console.error('❌ voice-commands.json unreadable — using defaults:', e)
    return {}
  }
}

/* ---------------- per-preacher layer ---------------- */

function safePreacherId(preacherId: string): string {
  return preacherId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function preacherCommandFilePath(userDataDir: string, preacherId: string): string {
  return path.join(userDataDir, 'preacher-commands', `${safePreacherId(preacherId)}.json`)
}

/** Read one preacher's phrase additions (missing file → empty layer). */
export function loadPreacherCommandConfig(
  userDataDir: string,
  preacherId: string
): Partial<CommandPhraseConfig> {
  if (!preacherId) return {}
  const file = preacherCommandFilePath(userDataDir, preacherId)
  try {
    if (!fs.existsSync(file)) return {}
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    delete parsed._readme
    return parsed
  } catch (e) {
    console.error(`❌ preacher-commands/${safePreacherId(preacherId)}.json unreadable:`, e)
    return {}
  }
}

const PREACHER_FILE_README =
  'Phrases this preacher habitually uses — ADDED to the built-in + user lists. ' +
  'Same keys as voice-commands.json, plus ignoreTails: words they append after ' +
  'a reference (e.g. "amen") that should be ignored.'

/** Merge `partial` into the preacher's file (lists are unioned, not replaced). */
export function savePreacherCommandConfig(
  userDataDir: string,
  preacherId: string,
  partial: Partial<CommandPhraseConfig>
): Partial<CommandPhraseConfig> {
  const existing = loadPreacherCommandConfig(userDataDir, preacherId)
  const merged: Record<string, unknown> = { ...existing }
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) continue
    if (key === 'versionPhrases') {
      merged.versionPhrases = unionVersions(
        existing.versionPhrases,
        value as VersionPhrase[]
      )
    } else {
      merged[key] = unionArrays(
        (existing as Record<string, string[] | undefined>)[key],
        value as string[]
      )
    }
  }
  const file = preacherCommandFilePath(userDataDir, preacherId)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ _readme: PREACHER_FILE_README, ...merged }, null, 2))
  return merged as Partial<CommandPhraseConfig>
}

export function addPreacherPhrase(
  userDataDir: string,
  preacherId: string,
  key: PhraseListKey,
  phrase: string
): void {
  const p = phrase.trim().toLowerCase()
  if (!p) return
  savePreacherCommandConfig(userDataDir, preacherId, { [key]: [p] })
  console.log(`🗣️ Preacher ${preacherId}: +${key} "${p}"`)
}

export function removePreacherPhrase(
  userDataDir: string,
  preacherId: string,
  key: PhraseListKey,
  phrase: string
): void {
  const existing = loadPreacherCommandConfig(userDataDir, preacherId)
  const list = existing[key]
  if (!list) return
  const p = phrase.trim().toLowerCase()
  const next = list.filter((x) => x !== p)
  if (next.length === list.length) return
  const out: Record<string, unknown> = { ...existing, [key]: next }
  if (next.length === 0) delete out[key]
  const file = preacherCommandFilePath(userDataDir, preacherId)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ _readme: PREACHER_FILE_README, ...out }, null, 2))
  console.log(`🗣️ Preacher ${preacherId}: -${key} "${p}"`)
}

export function saveUserCommandConfig(
  userDataDir: string,
  config: Partial<CommandPhraseConfig>
): void {
  const file = userCommandFilePath(userDataDir)
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(
    file,
    JSON.stringify({ _readme: USER_FILE_TEMPLATE._readme, ...config }, null, 2)
  )
}
