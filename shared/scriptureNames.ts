/**
 * Shared display casing for Scripture, lyrics, transcripts and notes. Apply
 * at read/render boundaries: source Bible text and recognition input stay intact.
 * Ambiguous family words and pronouns need a title, not a theological guess.
 */

const DIVINE_NAMES = [
  'God', 'Jesus', 'Christ', 'Jehovah', 'Messiah', 'Saviour', 'Savior',
  'Elohim', 'Yahweh', 'Adonai', 'Yeshua', 'Yahshua', 'Abba', 'YHWH',
  'Lord', 'Almighty', 'Redeemer', 'Immanuel', 'Emmanuel', 'Emanuel',
  'Yah', 'Jah', 'Yahveh', 'Yahve', 'Eloah', 'Elah', 'Hashem',
  // Names used by the bundled Spanish, French and Portuguese Bibles.
  'Dios', 'Jesús', 'Cristo', 'Jehová', 'Mesías', 'Señor', 'Salvador',
  'Dieu', 'Jésus', 'Éternel', 'Seigneur', 'Messie', 'Sauveur', 'Rédempteur',
  'Deus', 'Jeová', 'Messias', 'Senhor', 'Redentor',
  // Names heard in the app's Nigerian services, including code-switching.
  'Oluwa', 'Ọlọrun', 'Olorun', 'Olódùmarè', 'Olodumare', 'Chukwu',
  'Chineke', 'Yesu', 'Jesu', 'Jésù', 'Allah', 'Ubangiji',
] as const

/** Exact title phrases; small connecting words keep the speaker's casing. */
const DIVINE_TITLES = [
  'Holy Spirit', 'Holy Ghost', 'Spirit of God', 'Spirit of the Lord',
  'Spirit of Christ', 'Spirit of Jesus',
  'God the Father', 'God the Son', 'God the Holy Spirit',
  'Heavenly Father', 'Father in heaven',
  'Son of God', 'Son of Man', 'Lamb of God', 'Lamb that was slain',
  'Lord God', 'Lord Jesus', 'Lord Christ', 'Lord of Hosts', 'Lord of Lords',
  'Lord Almighty', 'Almighty God', 'Almighty Father', 'the Almighty',
  'the Lord', 'our Lord', 'my Lord', 'O Lord', 'oh Lord', 'is Lord', 'as Lord',
  'Most High', 'King of Kings', 'King of Glory', 'Prince of Peace',
  'Ancient of Days', 'Alpha and Omega', 'Alpha and the Omega',
  'El Shaddai', 'El Elyon', 'El Roi', 'El Olam', 'El Gibbor',
  'Jehovah Jireh', 'Jehovah Rapha', 'Jehovah Nissi', 'Jehovah Shalom',
  'Jehovah Rohi', 'Jehovah Raah', 'Jehovah Tsidkenu', 'Jehovah Shammah',
  'Yahweh Jireh', 'Yahweh Rapha', 'Yahweh Nissi', 'Yahweh Shalom',
  'Yahweh Rohi', 'Yahweh Tsidkenu', 'Yahweh Shammah',
  'Jehovah Sabaoth', 'Yahweh Sabaoth', 'El Shadday', 'El Elohe Israel',
  'El Chay', 'El Qanna',
  'King of Heaven', 'King of Israel', 'King of the Jews',
  'Holy One', 'Holy One of Israel', 'Good Shepherd', 'Great Shepherd',
  'Chief Shepherd', 'Bread of Life', 'Light of the World', 'Living God',
  'Everlasting Father', 'Wonderful Counselor', 'Wonderful Counsellor',
  'Mighty God', 'God Most High', 'Word of God',
  'Lion of Judah', 'Lion of the tribe of Judah', 'Bright Morning Star',
  'Rose of Sharon', 'Lily of the Valley', 'the Comforter', 'the Advocate',
  'Spirit of Truth', 'Spirit of the Living God', 'Prince of Life',
  // Spanish (RVR), French (APEE), Portuguese (AA). Chinese has no letter case.
  'Espíritu Santo', 'Espiritu Santo', 'Santo Espíritu', 'Santo Espiritu',
  'Espíritu de Dios', 'Espíritu del Señor', 'Espíritu de Cristo',
  'Dios Padre', 'Dios Hijo', 'Padre Celestial',
  'Hijo de Dios', 'Hijo del Hombre', 'Cordero de Dios', 'Dios Altísimo',
  'el Altísimo', 'el Todopoderoso', 'Dios Todopoderoso', 'Rey de Reyes',
  'Señor de Señores', 'Príncipe de Paz', 'Alfa y Omega',
  'Saint Esprit', 'Esprit Saint', 'Esprit de Dieu', 'Esprit du Seigneur',
  'Esprit de Christ', 'Dieu le Père', 'Dieu le Fils', 'Père céleste',
  'Fils de Dieu', 'Fils de l’Homme', "Fils de l'Homme", 'Agneau de Dieu',
  'Très Haut', 'Tout Puissant', 'Roi des Rois', 'Seigneur des Seigneurs',
  'Prince de Paix', 'Alpha et Oméga', 'Alpha et Omega',
  'Espírito Santo', 'Espirito Santo', 'Santo Espírito', 'Santo Espirito',
  'Espírito de Deus', 'Espírito do Senhor', 'Espírito de Cristo',
  'Deus Pai', 'Deus Filho', 'Pai Celestial', 'Filho de Deus',
  'Filho do Homem', 'Cordeiro de Deus', 'Deus Altíssimo', 'o Altíssimo',
  'Todo Poderoso', 'Rei dos Reis', 'Senhor dos Senhores', 'Príncipe da Paz',
  'Alfa e Ômega', 'Alfa e Omega', 'Ẹmí Mímọ́', 'Emi Mimo', 'Mmụọ Nsọ',
  'Mmuo Nso', 'Ruhu Mai Tsarki',
] as const

interface NameWord {
  text: string
  key: string
  start: number
  end: number
}

function nameWords(text: string): NameWord[] {
  return [...text.matchAll(/[\p{L}\p{M}\p{N}_]+/gu)].map((match) => ({
    text: match[0],
    key: match[0].normalize('NFC').toLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }))
}

interface NamePhrase {
  words: NameWord[]
  gaps: string[]
}

// Index by the first word so a transcript does not run hundreds of Unicode
// regular expressions per update. Overlapping titles can still both match.
const PHRASES_BY_FIRST_WORD = new Map<string, NamePhrase[]>()
for (const title of new Set([...DIVINE_TITLES, ...DIVINE_NAMES])) {
  const words = nameWords(title)
  const gaps = words.slice(1).map((word, i) => title.slice(words[i].end, word.start))
  const key = words[0].key
  const phrases = PHRASES_BY_FIRST_WORD.get(key) ?? []
  phrases.push({ words, gaps })
  PHRASES_BY_FIRST_WORD.set(key, phrases)
}

const TITLE_CAPITALS = new Set(DIVINE_TITLES.flatMap(title =>
  nameWords(title).filter(word => /^\p{Lu}/u.test(word.text) && word.key !== 'el').map(word => word.key),
))

/** A paged title can arrive as "Holy" on one slide and "Spirit" on the next.
 * Keep already-capitalized title words when a lowercase theme is applied.
 * Ordinary lowercase "father", "son" or "spirit" still stays lowercase.
 * "El" requires its full Hebrew title because "el" is a Spanish article. */
export function lowercaseScriptureText(text: string): string {
  const lower = text.replace(/[\p{L}\p{M}\p{N}_]+/gu, word => {
    const lowered = word.toLowerCase()
    return /^\p{Lu}/u.test(word) && TITLE_CAPITALS.has(word.normalize('NFC').toLowerCase())
      ? lowered[0].toUpperCase() + lowered.slice(1)
      : lowered
  })
  return capitalizeScriptureNames(lower)
}

/**
 * Display-only casing. Preserve wording, spacing, accents, existing capitals
 * and UTF-16 offsets (the transcript's timed words use those offsets).
 * Matching normalizes accents, but the returned text keeps the source form.
 */
export function capitalizeScriptureNames(text: string): string {
  const words = nameWords(text)
  let characters: string[] | null = null
  for (let start = 0; start < words.length; start++) {
    const phrases = PHRASES_BY_FIRST_WORD.get(words[start].key)
    if (!phrases) continue
    for (const phrase of phrases) {
      const matches = phrase.words.every((canonical, i) => {
        const word = words[start + i]
        if (!word || word.key !== canonical.key) return false
        if (i === 0) return true
        const gap = text.slice(words[start + i - 1].end, word.start)
        return phrase.gaps[i - 1] === ' '
          ? /^[\s\p{Pd}]+$/u.test(gap)
          : /^[’']$/.test(gap)
      })
      if (!matches) continue
      for (let i = 0; i < phrase.words.length; i++) {
        const canonical = phrase.words[i]
        if (!/^\p{Lu}/u.test(canonical.text)) continue
        const word = words[start + i]
        // A verb or familiar secular title is not a name for God.
        if (word.key === 'lord' && /^(?:\s+of\s+(?:the\s+)?(?:manor|rings|flies)\b|\s+it\s+over\b)/i.test(text.slice(word.end))) continue
        const length = canonical.text === 'YHWH' ? word.text.length : 1
        for (let j = 0; j < length; j++) {
          const upper = word.text[j].toUpperCase()
          if (upper !== word.text[j] && upper.length === 1) {
            characters ??= text.split('')
            characters[word.start + j] = upper
          }
        }
      }
    }
  }
  return characters ? characters.join('') : text
}

/** Apply title context across timed words without changing timing or boundaries. */
export function capitalizeScriptureWords<T extends { w: string }>(words: T[]): T[] {
  const original = words.map(({ w }) => w).join(' ')
  const cased = capitalizeScriptureNames(original)
  if (cased === original) return words
  let start = 0
  return words.map((word) => {
    const w = cased.slice(start, start + word.w.length)
    start += word.w.length + 1
    return w === word.w ? word : { ...word, w }
  })
}

