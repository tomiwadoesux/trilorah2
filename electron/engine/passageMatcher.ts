import corpus from '../data/passages/bsb-sections.json'

export interface PassageCandidate {
  passageId: string
  ref: string
  book: string
  chapter: number
  verse: number
  endVerse?: number
  title: string
  evidence: string[]
  reason: string
  /** Retrieval score, not a calibrated probability. */
  score: number
  source: 'passage'
}

interface Section {
  id: string
  book: string
  chapter: number
  verse: number
  endVerse: number
  title: string
  verses: { verse: number; text: string }[]
}

const STOP = new Set(('a an and are as at be been being but by can could did do does for from had has have he her here hers him his how i if in into is it its just let like me more my no not of on one or our ours out said say says she so some than that the their them then there these they this those through to too up us was we were what when where which who why will with would you your god lord jesus christ man men people thing things now came come went go told tell all also any because before after again about every very shall should may might must shall thus indeed even only own other over under away whom whose am').split(' '))
// Common sermon/meeting vocabulary can contribute to quotes elsewhere, but is
// insufficient story evidence. Keeping it out prevents generic spiritual lists
// from looking like a particular letter or psalm.
for (const word of 'faith hope love joy church day time tomorrow meeting give remember everyone please need last'.split(' ')) STOP.add(word)
const ENTITIES = new Set(('adam eve abel cain noah abraham abram sarah isaac rebekah jacob esau joseph pharaoh moses aaron miriam joshua rahab jericho gideon samson delilah ruth naomi boaz hannah samuel saul david goliath jonathan bathsheba solomon elijah elisha naaman hezekiah josiah esther mordecai haman job isaiah jeremiah ezekiel daniel nebuchadnezzar shadrach meshach abednego hosea joel amos jonah nineveh micah habakkuk zechariah mary martha lazarus peter andrew james john philip nathanael thomas judas zacchaeus bartimaeus nicodemus samaritan levite paul silas barnabas stephen corinth damascus tarsus antioch bethel bethlehem egypt').split(' '))

// Small inspectable equivalences, rather than invented Bible summaries or an
// online model call for each word. Each group counts as ONE piece of evidence.
const GROUPS = [
  ['weapon', 'weapons', 'sword', 'swords', 'spear', 'spears', 'javelin'],
  ['stone', 'stones', 'rock', 'rocks'], ['boat', 'boats', 'ship', 'ships'],
  ['storm', 'storms', 'tempest'], ['calm', 'calmed', 'calming', 'still', 'stilled'],
  ['kill', 'killed', 'slay', 'slays', 'slew'], ['face', 'faced', 'facing', 'confront', 'confronted'],
  ['refuse', 'refused', 'reject', 'rejected'], ['armor', 'armour'],
  ['prison', 'prisoner', 'prisoners', 'jail', 'jailed'], ['heal', 'healed', 'healing', 'cure', 'cured'],
  ['blind', 'blindness'], ['leprosy', 'leper', 'lepers'], ['bread', 'loaf', 'loaves'],
  ['fish', 'fishes'], ['feed', 'fed', 'feeding'], ['five', '5'], ['two', '2'],
  ['twelve', '12'], ['thousand', 'thousands', '1000'], ['swallow', 'swallowed', 'swallowing'],
  ['run', 'ran', 'running'], ['weep', 'wept', 'cry', 'cried', 'crying'],
  ['return', 'returned', 'returning'], ['forgive', 'forgiven', 'forgave', 'forgiveness'],
  ['rise', 'rose', 'risen', 'raised'], ['die', 'died', 'dead', 'death'],
  ['sleep', 'asleep', 'sleeping', 'slept'], ['touch', 'touched', 'touching'],
  ['robe', 'cloak', 'garment'], ['pig', 'pigs', 'swine'], ['lion', 'lions'],
  ['furnace', 'oven'], ['fire', 'fiery', 'burning'], ['silver', 'silverpieces'],
  ['waste', 'wasted', 'wasting', 'squander', 'squandered', 'squandering'], ['inheritance', 'estate', 'property'],
  ['beat', 'beaten', 'beating'], ['help', 'helped', 'care', 'cared'],
  ['robber', 'robbers', 'thief', 'thieves'], ['road', 'roadside'],
  ['select', 'selected', 'pick', 'picked', 'choose', 'chose'], ['approach', 'approached', 'approaching'],
] as const
const SYNONYMS = new Map<string, string>(GROUPS.flatMap(group => group.map(word => [word, group[0]])))
const PHRASES: [RegExp, string][] = [
  [/\b(?:in |by |with )?(?:the )?name of (?:the )?(?:lord|god)\b/g, 'name-of-lord'],
  [/\b(?:five|5) (?:smooth )?(?:stones|rocks)\b/g, 'five-stones'],
  [/\b(?:shepherd(?:s)? )?(?:boy|lad)\b/g, 'boy'],
  [/\bred sea\b/g, 'red-sea'], [/\blions? den\b/g, 'lion-den'],
  [/\b(?:three|3) (?:days|nights)\b/g, 'three-days'],
  [/\b(?:five thousand|5000)\b/g, 'five-thousand'],
  [/\bholy (?:spirit|ghost)\b/g, 'holy-spirit'],
]

const normalise = (text: string) => text.toLowerCase().replace(/[’']s\b/g, '').replace(/[’']/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
function tokens(text: string): Set<string> {
  const value = normalise(text)
  const result = new Set(value.split(/[\s-]+/).filter(word => word.length > 1 && !STOP.has(word)).map(word => SYNONYMS.get(word) ?? word))
  for (const [pattern, concept] of PHRASES) {
    pattern.lastIndex = 0
    if (pattern.test(value)) result.add(concept)
  }
  // Do not count both a phrase and each of its component words as independent
  // story details ("five stones" alone is not three pieces of evidence).
  if (result.has('five-stones')) { result.delete('five'); result.delete('stone') }
  if (result.has('name-of-lord')) result.delete('name')
  if (result.has('three-days')) { result.delete('three'); result.delete('days') }
  return result
}

interface IndexedSection {
  section: Section
  words: Set<string>
  heading: Set<string>
  verses: { verse: number; words: Set<string> }[]
}

// These aliases describe people/objects explicitly present in the linked
// account. They only broaden retrieval; acceptance still requires other details.
function localAliases(section: Section): string {
  if (section.book === '1 Samuel' && section.chapter === 17) return 'giant Goliath'
  return ''
}

let sharedIndex: ReturnType<typeof buildIndex> | undefined
function buildIndex() {
  const rows: IndexedSection[] = (corpus.sections as Section[]).map(section => {
    const heading = tokens(section.title)
    const words = tokens(`${section.title} ${section.verses.map(verse => verse.text).join(' ')} ${localAliases(section)}`)
    return { section, heading, words, verses: section.verses.map(verse => ({ verse: verse.verse, words: tokens(verse.text) })) }
  })
  const postings = new Map<string, number[]>()
  rows.forEach((row, index) => row.words.forEach(word => {
    const list = postings.get(word) ?? []
    list.push(index)
    postings.set(word, list)
  }))
  const weights = new Map([...postings].map(([word, ids]) => [word, Math.log(1 + rows.length / ids.length)]))
  // Deletion keys support one-letter insertions, deletions and substitutions
  // without scanning the whole Bible or fuzzing short, ambiguous words.
  const spellings = new Map<string, string[]>()
  for (const word of postings.keys()) {
    if (word.length < 5 || word.includes('-')) continue
    for (let i = -1; i < word.length; i++) {
      const key = i < 0 ? word : word.slice(0, i) + word.slice(i + 1)
      const list = spellings.get(key) ?? []
      if (!list.includes(word)) list.push(word)
      spellings.set(key, list)
    }
  }
  return { rows, postings, weights, spellings }
}

function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length >= b.length) i++
    if (b.length >= a.length) j++
  }
  return edits + Number(i < a.length || j < b.length) <= 1
}

/** Everyday scheduling or biography with no biblical framing. */
export function isContemporaryTalk(speech: string): boolean {
  return /\b(?:yesterday|tomorrow|weekend|last (?:week|month|night)|next (?:week|month)|school|shop|shopping|costume)\b/.test(speech)
    && !/\b(?:bible|scripture|parable|testament|book of)\b/.test(speech)
}

/**
 * Offline passage retrieval from editor-curated BSB sections and their text.
 * This is lexical/concept retrieval, not an embedding model or a theological
 * inference engine. It deliberately abstains from broad thematic matches.
 * No method sends a passage live or waits for a timer/network request.
 */
export class PassageMatcher {
  private index = sharedIndex ??= buildIndex()
  private completed: string[] = []
  private lastFinal = ''
  private lastSpeechAt = 0

  reset(): void {
    this.completed = []
    this.lastFinal = ''
    this.lastSpeechAt = 0
  }

  /** Interim text replaces the current utterance; only final text is retained. */
  updateTranscript(text: string, isFinal: boolean): PassageCandidate | null {
    const now = Date.now()
    if (now - this.lastSpeechAt > 30_000) this.reset()
    this.lastSpeechAt = now
    const utterance = normalise(text)
    if (!utterance) return null
    const combined = [...this.completed, utterance].join(' ').split(' ').slice(-85).join(' ')
    if (isFinal && utterance !== this.lastFinal) {
      this.completed = [...this.completed, utterance].join(' ').split(' ').slice(-60)
      this.lastFinal = utterance
    }
    // Prefer current evidence so a previous story does not mask a new one.
    const direct = this.detect(utterance)
    if (direct) return direct
    const contextual = this.detect(combined)
    if (!contextual) return null
    const current = tokens(utterance)
    // Previous context can supply the subject, but cannot manufacture current
    // evidence. A new prayer/request/topic must not resurface the last story.
    const currentEvidence = contextual.evidence.some(word => current.has(word) && (this.index.weights.get(word) ?? 0) >= 3)
    return currentEvidence ? contextual : null
  }

  detect(text: string): PassageCandidate | null {
    const { rows, postings, weights, spellings } = this.index
    const speech = normalise(text)
    // Contemporary scheduling/biographical statements need explicit biblical
    // framing before being treated as a retelling, even when a person shares a
    // Bible name. This is contextual abstention, not a list of fixture phrases.
    if (isContemporaryTalk(speech)) return null
    // Guard a few known contradictory retellings. Retrieval is not a claim that
    // arbitrary subject/object relationships have been semantically verified.
    if (/\bdavid\b.{0,45}\b(?:fled|ran away|ran from|running from)\b.{0,30}\b(?:goliath|giant)\b/.test(speech)
      || /\b(?:goliath|giant)\b.{0,25}\b(?:killed|slew|beheaded)\b.{0,20}\bdavid\b/.test(speech)
      || /\bdaniel\b.{0,45}\b(?:thrown|cast|put)\b.{0,30}\bfurnace\b/.test(speech)
      || /\bjonah\b.{0,35}\b(?:built|building)\b.{0,20}\bark\b/.test(speech)) return null
    const query = tokens(text)
    const corrected = new Map<string, string>()
    for (const word of query) {
      if (postings.has(word) || word.length < 5 || word.includes('-')) continue
      const candidates = new Set<string>()
      for (let i = -1; i < word.length; i++) {
        const key = i < 0 ? word : word.slice(0, i) + word.slice(i + 1)
        for (const candidate of spellings.get(key) ?? []) if (oneEditApart(word, candidate)) candidates.add(candidate)
      }
      // Ambiguous spelling corrections are not evidence.
      if (candidates.size === 1) corrected.set(word, [...candidates][0])
    }
    const terms = [...query].map(word => corrected.get(word) ?? word)
    const known = [...new Set(terms.filter(word => postings.has(word)))]
    if (known.length < 2) return null
    const weight = (word: string) => Math.min(6, weights.get(word) ?? 2)
    const queryWeight = [...new Set(terms)].reduce((sum, word) => sum + (postings.has(word) ? weight(word) : 2.5), 0)
    const possible = new Map<number, string[]>()
    for (const word of known) {
      if (weight(word) < 1.5) continue
      for (const id of postings.get(word) ?? []) {
        const matches = possible.get(id) ?? []
        matches.push(word)
        possible.set(id, matches)
      }
    }
    const ranked: { row: IndexedSection; matched: string[]; score: number; coverage: number; titlePair: boolean }[] = []
    for (const [id, matched] of possible) {
      const row = rows[id]
      const rare = matched.filter(word => weight(word) >= 3)
      const headingMatches = matched.filter(word => row.heading.has(word) && weight(word) >= 1.5)
      const titlePair = headingMatches.length >= 2 && headingMatches.some(word => ENTITIES.has(word)) && headingMatches.some(word => weight(word) >= 4)
      if (!titlePair && (matched.length < 3 || rare.length < 2)) continue
      const entity = matched.some(word => ENTITIES.has(word))
      const specificPhrase = matched.some(word => word.includes('-'))
      if (!titlePair && !entity && matched.length < 4 && !specificPhrase) continue
      const sum = matched.reduce((total, word) => total + weight(word), 0)
      const coverage = sum / queryWeight
      if (coverage < 0.53) continue
      const windows = row.verses.map((_, offset) => {
        const nearby = row.verses.slice(offset, offset + 5)
        return matched.filter(word => nearby.some(verse => verse.words.has(word)))
      })
      const denseWindow = windows.sort((a, b) => b.reduce((s, w) => s + weight(w), 0) - a.reduce((s, w) => s + weight(w), 0))[0]
      const nearbyScore = denseWindow.reduce((sum, word) => sum + weight(word), 0)
      const requiredNearby = specificPhrase && matched.length >= 3 ? 2 : 3
      if (!titlePair && (nearbyScore / queryWeight < 0.5 || denseWindow.length < requiredNearby)) continue
      const score = sum + headingMatches.reduce((total, word) => total + weight(word) * 0.55, 0) + nearbyScore * 0.65
      ranked.push({ row, matched, score, coverage, titlePair })
    }
    ranked.sort((a, b) => b.score - a.score)
    const best = ranked[0]
    if (!best) return null
    const second = ranked[1]
    // Near ties across different accounts remain suggestions for the slower,
    // source-verified reasoning path, rather than false precision here.
    if (second && best.score < second.score * 1.12 && !best.titlePair) return null
    const { section } = best.row
    const verseRanking = best.row.verses.map(verse => {
      const matched = best.matched.filter(word => verse.words.has(word))
      return { verse: verse.verse, matched, score: matched.reduce((sum, word) => sum + weight(word), 0) }
    }).sort((a, b) => b.score - a.score)
    const firstVerse = verseRanking[0]
    const runnerUp = verseRanking[1]
    const storyOnlyWeight = best.matched.filter(word => !best.row.verses.some(verse => verse.words.has(word))).reduce((sum, word) => sum + weight(word), 0)
    const verseCoverage = firstVerse.score / Math.max(1, queryWeight - storyOnlyWeight)
    // Names identify the story; a specific verse needs a distinctive action
    // or object too and enough separation from the surrounding verses.
    const specificPhrase = firstVerse.matched.some(word => ['five-stones', 'name-of-lord', 'three-days'].includes(word))
    const narrow = specificPhrase && firstVerse.matched.length >= 2 && verseCoverage >= 0.52 && (!runnerUp || firstVerse.score >= runnerUp.score * 1.22)
    const verse = narrow ? firstVerse.verse : section.verse
    const endVerse = narrow ? verse : section.endVerse
    const evidence = best.matched.slice().sort((a, b) => weight(b) - weight(a)).slice(0, 6)
    return {
      passageId: section.id, ref: `${section.book} ${section.chapter}:${verse}${endVerse > verse ? `-${endVerse}` : ''}`,
      book: section.book, chapter: section.chapter, verse, endVerse, title: section.title,
      evidence, reason: `${section.title} — matching details: ${evidence.map(word => word.replaceAll('-', ' ')).join(', ')}`,
      score: best.score, source: 'passage',
    }
  }
}
