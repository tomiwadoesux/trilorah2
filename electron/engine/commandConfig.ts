/**
 * Voice-command / intent phrase configuration — everything the engines
 * listen for is data, not code.
 *
 * Three layers, unioned (later layers ADD phrases, never remove):
 *   1. built-in defaults (English)
 *   2. the active language pack's phrases (Spanish, French, …)
 *   3. the user's own file:  <userData>/voice-commands.json
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
}

export const DEFAULT_COMMANDS: CommandPhraseConfig = {
  versionPhrases: [
    { phrases: ['new king james version', 'new king james'], code: 'NKJV' },
    { phrases: ['king james version', 'king james', 'authorized version'], code: 'KJV' },
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
  hold: ['leave that up', 'leave it up', 'keep that up', 'keep it up', 'keep it there'],
  navNext: ['next verse', 'next', 'continue', 'go on', 'keep going', 'move on'],
  navPrevious: ['previous verse', 'previous', 'go back', 'back', 'last verse', 'before'],
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
  verseWords: ['verse', 'verses']
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
    verseWords: unionArrays(base.verseWords, extra.verseWords)
  }
}

const USER_FILE_TEMPLATE = {
  _readme:
    'Add your own phrases to any list — they are ADDED to the built-in ones. ' +
    'Keys: versionPhrases, iSaidTriggers, prayerStart, prayerEnd, dismiss, hold, ' +
    'navNext, navPrevious, intentPhrases, narrativeMarkers, deferPhrases, ' +
    'chapterWords, verseWords. Phrases must be lowercase. ' +
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
