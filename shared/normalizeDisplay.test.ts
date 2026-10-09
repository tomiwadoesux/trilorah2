import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RULES,
  DISPLAY_FILLERS,
  PROPER_NOUNS,
  capitalizeScriptureNames,
  capitalizeScriptureWords,
  normalizeForDisplay,
  recoverRaw,
  type BookMatcher,
  type NormalizeContext,
  type NormalizedLine,
  type ReadingState,
  type RuleId,
  type SpokenNumberParser
} from './normalizeDisplay'

/* ------------------------------------------------------------------ */
/* Injected tables — faithful copies of what main.ts actually passes    */
/* ------------------------------------------------------------------ */

/**
 * EN_NUMBER_WORDS, copied from referenceResolver.ts:48-54.
 *
 * The copy is deliberate, not laziness: this suite must fail if the display
 * layer ever starts behaving differently from the parser the engine injects,
 * and the only way to assert that is to test against the real table's contents.
 * Its CEILING is the point — see the 'thousand' test below.
 */
const EN_NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100
}

/** EN_FILLER, copied from referenceResolver.ts:377 for the disjointness test. */
const EN_FILLER = ['uh', 'um', 'ah', 'the', 'now', 'so', 'okay', 'well']

/**
 * parseNumberWithTable, ported verbatim from referenceResolver.ts:65-131.
 *
 * Ported rather than stubbed because several corpus rows are assertions about
 * the PARSER, not about the normalizer: that 'one hundred and thirty five'
 * reaches 135 through the connector branch, and that whisper's hyphenated
 * 'ninety-nine' returns null. A hand-written stub would pass those tests while
 * telling us nothing about the function main.ts really injects.
 */
const CONNECTORS = new Set(['and'])

const parseSpokenNumber: SpokenNumberParser = (words, i) => {
  const table = EN_NUMBER_WORDS
  const w = words[i]
  if (w === undefined) return null

  if (/^\d{1,3}$/.test(w)) return { value: parseInt(w, 10), consumed: 1 }

  let total = 0
  let consumed = 0
  let j = i

  const v0 = table[words[j]]
  if (v0 !== undefined && v0 > 0 && v0 < 10 && table[words[j + 1]] === 100) {
    total = v0 * 100
    consumed = 2
    j += 2
  } else if (words[j] === 'a' && table[words[j + 1]] === 100) {
    total = 100
    consumed = 2
    j += 2
  } else if (table[words[j]] === 100) {
    total = 100
    consumed = 1
    j += 1
  }

  if (consumed > 0 && CONNECTORS.has(words[j])) {
    consumed += 1
    j += 1
  }

  const v = table[words[j]]
  if (v !== undefined && v >= 20 && v < 100 && v % 10 === 0) {
    total += v
    consumed += 1
    j += 1
    let k = j
    let extra = 0
    if (CONNECTORS.has(words[k]) && table[words[k + 1]] !== undefined) {
      k += 1
      extra = 1
    }
    const u = table[words[k]]
    if (u !== undefined && u > 0 && u < 10) {
      total += u
      consumed += 1 + extra
    }
    return { value: total, consumed }
  }

  if (v !== undefined && v < 100) {
    total += v
    consumed += 1
    return { value: total, consumed }
  }

  if (consumed > 0) return { value: total, consumed }
  return null
}

/**
 * A book alias table built the way buildAliasTable (referenceResolver.ts:268)
 * builds it: spoken forms mapped to canonical names, sorted longest-first so
 * 'first corinthians' wins over 'corinthians' and 'second john' over 'john'.
 *
 * Only the books the corpus exercises are listed — the matcher's CONTRACT is
 * what is under test here, not the resolver's completeness. 'the acts' and
 * 'the psalms' are included precisely because they exist upstream: the
 * determiner veto has to beat them, and it can only be proven to if they are
 * reachable.
 */
const ALIASES: Array<[string, string]> = [
  ['first corinthians', '1 Corinthians'],
  ['second corinthians', '2 Corinthians'],
  ['first john', '1 John'],
  ['second john', '2 John'],
  ['second kings', '2 Kings'],
  ['first samuel', '1 Samuel'],
  ['the acts', 'Acts'],
  ['the psalms', 'Psalms'],
  ['song of solomon', 'Song of Solomon'],
  ['corinthians', '1 Corinthians'],
  ['ephesians', 'Ephesians'],
  ['romans', 'Romans'],
  ['malachi', 'Malachi'],
  ['genesis', 'Genesis'],
  ['matthew', 'Matthew'],
  ['luke', 'Luke'],
  ['john', 'John'],
  ['psalms', 'Psalms'],
  ['psalm', 'Psalms'],
  ['acts', 'Acts'],
  ['mark', 'Mark'],
  ['job', 'Job'],
  ['kings', '1 Kings'],
  ['hebrews', 'Hebrews'],
  ['james', 'James']
]

const SORTED_ALIASES = ALIASES.map(([alias, canonical]) => ({
  words: alias.split(' '),
  canonical
})).sort((a, b) => b.words.length - a.words.length)

const matchBook: BookMatcher = (lowerWords, i) => {
  for (const alias of SORTED_ALIASES) {
    let ok = true
    for (let k = 0; k < alias.words.length; k++) {
      if (lowerWords[i + k] !== alias.words[k]) {
        ok = false
        break
      }
    }
    if (ok) return { canonical: alias.canonical, consumed: alias.words.length }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** A final chunk with the full engine wiring — the production configuration. */
function ctx(over: Partial<NormalizeContext> = {}): NormalizeContext {
  return {
    reading: 'no',
    isFinal: true,
    parseNumber: parseSpokenNumber,
    matchBook,
    ...over
  }
}

/** The displayed string for a final chunk, which is what the projector shows. */
function display(raw: string, over: Partial<NormalizeContext> = {}): string {
  return normalizeForDisplay(raw, ctx(over)).text
}

/** Every reading state, so a 'must not fire' can be proven in all three. */
const READING_STATES: ReadingState[] = ['no', 'maybe', 'reading']

/* ------------------------------------------------------------------ */
/* filler                                                              */
/* ------------------------------------------------------------------ */

describe('normalizeForDisplay — filler, the cases it must catch', () => {
  it('removes a hesitation opening the line and closes the gap behind it', () => {
    expect(display('um, so Paul writes here')).toBe('So Paul writes here')
    expect(display('uh let me read that again')).toBe('Let me read that again')
  })

  it('removes a hesitation after a full stop, mid-line', () => {
    expect(display('He turned. Uh, then he wept.')).toBe('He turned. Then he wept.')
  })

  it('catches the doubled spellings whisper-local actually emits', () => {
    // Whisper-local produces 'umm'/'uhh' more often than the tidy two-letter forms.
    expect(display('umm, so Paul writes here')).toBe('So Paul writes here')
    expect(display('uhh, then he rose')).toBe('Then he rose')
    expect(display('erm, let us pray')).toBe('Let us pray')
    expect(display('uhm, hear me')).toBe('Hear me')
  })

  it('leaves exactly one space where the filler was, never two', () => {
    expect(display('He wept. Um. Then he rose.')).toBe('He wept. Then he rose.')
    expect(display('He wept. Um Then he rose.')).toBe('He wept. Then he rose.')
  })

  it('absorbs an ellipsis with the token rather than orphaning the dots', () => {
    expect(
      display('Am I speaking to somebody? Uh-uh, you are not listening. Um... somebody shout hallelujah!')
    ).toBe('Am I speaking to somebody? Uh-uh, you are not listening. Somebody shout hallelujah!')
  })

  it('promotes a terminal mark off a deleted filler instead of losing the sentence', () => {
    // 'nine years. uh. and he died.' must neither lose its full stop nor gain a second.
    expect(display('and all the days of methuselah were nine hundred sixty and nine years. uh. and he died.')).toBe(
      'And all the days of methuselah were nine hundred sixty and nine years. And he died.'
    )
  })

  it('removes a filler that ends the line, taking the space before it', () => {
    // At the end of a line there is no space after the token, so the one
    // before goes with it and nothing is left dangling.
    expect(display('He wept. um')).toBe('He wept.')
    expect(display('so Paul writes here. um')).toBe('So Paul writes here.')
  })

  it('runs while inert — clearing your throat before John 3:16 is not John 3:16', () => {
    for (const reading of READING_STATES) {
      expect(display('um, so Paul writes here', { reading })).toBe('So Paul writes here')
    }
  })
})

describe('normalizeForDisplay — filler, the near misses it must not fire on', () => {
  it('never matches a prefix of a longer word', () => {
    // G4. Whole-token match on `lower`, never a prefix.
    expect(display('Umberto came to the meeting')).toBe('Umberto came to the meeting')
    expect(display('umbrella in the rain')).toBe('Umbrella in the rain')
    expect(display('Umar was waiting')).toBe('Umar was waiting')
  })

  it('leaves a mid-sentence hesitation alone, because cadence is not noise', () => {
    // G2. A comma is not a terminal, so this 'uh' is rhythm and stays.
    expect(display('and then, uh, he turned')).toBe('And then, uh, he turned')
    expect(display('he waited um and then spoke')).toBe('He waited um and then spoke')
    // Trailing off mid-clause is still mid-clause; the position is what the
    // guard reads, not the fact that nothing follows.
    expect(display('so Paul writes here um')).toBe('So Paul writes here um')
  })

  it('does not delete an affirmation whose next word gives it away', () => {
    // G3. The veto is written against the following word, so it holds whether
    // or not whisper emitted the hyphen.
    expect(display("uh huh. that's right. amen.")).toBe("Uh huh. That's right. Amen.")
    expect(display('uh hmm, I hear you')).toBe('Uh hmm, I hear you')
    expect(display('uh-huh, that is right')).toBe('Uh-huh, that is right')
  })

  it('leaves the opening token alone when the previous chunk ended mid-clause', () => {
    // G2, the fatal one: here 'uh' is the SUBJECT of the sentence, and the
    // previous chunk ('...and he will') did not end a sentence.
    expect(display('uh is not a word in Hebrew, but Abba is', { atSentenceStart: false })).toBe(
      'uh is not a word in Hebrew, but Abba is'
    )
  })

  it('never touches the words EN_FILLER would have eaten', () => {
    // G1, the fatal one. 'ah' is the most load-bearing word in Nigerian
    // Pentecostal delivery, and 'so'/'now'/'well'/'the' open real sentences.
    expect(display('ah, my brother')).toBe('Ah, my brother')
    expect(display('so we begin')).toBe('So we begin')
    expect(display('now hear this')).toBe('Now hear this')
    expect(display('well, he answered')).toBe('Well, he answered')
    expect(display('okay let us move')).toBe('Okay let us move')
    expect(display('the time has come')).toBe('The time has come')
  })

  it('leaves affirmations alone — a congregation saying mmm is content', () => {
    expect(display('mm, yes')).toBe('Mm, yes')
    expect(display('hmm, think about it')).toBe('Hmm, think about it')
    expect(display('hm. consider that.')).toBe('Hm. Consider that.')
  })
})

describe('DISPLAY_FILLERS — the frozen set', () => {
  it('shares only um and uh with the resolver matching table', () => {
    // The two sets must be provably different. EN_FILLER is a MATCHING table
    // for the reference walker; using it here would delete 'Ah!'.
    expect([...DISPLAY_FILLERS].filter((w) => EN_FILLER.includes(w)).sort()).toEqual(['uh', 'um'])
  })

  it('excludes every word that is also real English', () => {
    for (const word of ['ah', 'the', 'now', 'so', 'okay', 'well', 'mm', 'hm', 'hmm']) {
      expect(DISPLAY_FILLERS.has(word)).toBe(false)
    }
  })

  it('contains exactly the six transcriptions of breath', () => {
    expect([...DISPLAY_FILLERS].sort()).toEqual(['erm', 'uh', 'uhh', 'uhm', 'um', 'umm'])
  })
})

/* ------------------------------------------------------------------ */
/* sentence-case                                                       */
/* ------------------------------------------------------------------ */

describe('normalizeForDisplay — sentence-case, the cases it must catch', () => {
  it('capitalizes the line and each following sentence', () => {
    expect(display('so paul writes here')).toBe('So Paul writes here')
    expect(display('he wept. then he rose.')).toBe('He wept. Then he rose.')
    expect(display('who is he? he is the door!')).toBe('Who is he? He is the door!')
  })

  it('skips leading digits to find the letter that deserves the capital', () => {
    // G1. '1 corinthians says' must not lose its capital to a character that
    // cannot carry one.
    expect(display('1 corinthians says')).toBe('1 Corinthians says')
  })

  it('capitalizes proper nouns wherever they fall', () => {
    expect(display('and god said unto moses')).toBe('And God said unto Moses')
    expect(display('the spirit of the lord is upon me')).toBe('The Spirit of the Lord is upon me')
    expect(display('paul went up to jerusalem')).toBe('Paul went up to Jerusalem')
  })

  it('keeps a continuation line lowercase when the previous chunk ran on', () => {
    expect(display('and he will never leave you', { atSentenceStart: false })).toBe(
      'and he will never leave you'
    )
  })

  it('runs while inert — lowercase Scripture on a projector is worse than the disease', () => {
    for (const reading of READING_STATES) {
      expect(display('for god so loved the world', { reading })).toBe('For God so loved the world')
    }
  })

  it('reports whether the line ended a sentence, for the next chunk to use', () => {
    expect(normalizeForDisplay('he wept.', ctx()).endsSentence).toBe(true)
    expect(normalizeForDisplay('he wept!"', ctx()).endsSentence).toBe(true)
    expect(normalizeForDisplay('and he will', ctx()).endsSentence).toBe(false)
    expect(normalizeForDisplay('and then,', ctx()).endsSentence).toBe(false)
  })
})

describe('normalizeForDisplay — sentence-case, the near misses it must not fire on', () => {
  it('never capitalizes a standalone i, in any position', () => {
    // The pronoun rule was CUT three ways, and leaving the sentence capital
    // open lets every one of them back in through a side door.
    expect(display('i na-aga')).toBe('i na-aga')
    expect(display('i john three sixteen')).toBe('i john three sixteen')
    expect(display('and god said unto moses i am that i am.')).toBe(
      'And God said unto Moses i am that i am.'
    )
    expect(display('na God o! i no fit shout. i dey believe am')).toBe(
      'Na God o! i no fit shout. i dey believe am'
    )
  })

  it('never lowercases a capital the recognizer supplied', () => {
    // G3. There is no downcasing path anywhere in the module.
    expect(display('And GOD said unto MOSES')).toBe('And GOD said unto MOSES')
    expect(display('NASB reading of Romans')).toBe('NASB reading of Romans')
    expect(display('He read the KJV and the NIV')).toBe('He read the KJV and the NIV')
    // The rule only ever uppercases, so a sentence-initial lowercase letter
    // still gains its capital — that is orthography, not a downcasing path.
    expect(display('the LORD is my shepherd')).toBe('The LORD is my shepherd')
  })

  it('leaves the ambiguous book names lowercase, because they are ordinary words', () => {
    expect(display('he took a job in lagos')).toBe('He took a job in lagos')
    expect(display('mark my words')).toBe('Mark my words')
    expect(display('the numbers did not add up')).toBe('The numbers did not add up')
    expect(display('the judges ruled against him')).toBe('The judges ruled against him')
    expect(display('the acts of a desperate man')).toBe('The acts of a desperate man')
    expect(display('two kings sat at the table')).toBe('Two kings sat at the table')
  })

  it('leaves the ambiguous given names lowercase when they stand alone', () => {
    // Where these really are books, scripture-ref has already emitted the
    // canonical capital, so the exclusion costs nothing where it matters.
    expect(display('john took the stand')).toBe('John took the stand')
    expect(display('my friend james called')).toBe('My friend james called')
    expect(display('peter is my neighbour')).toBe('Peter is my neighbour')
    expect(display('and mary went home')).toBe('And mary went home')
  })

  it('matches a proper noun as a whole token only', () => {
    expect(display('the gods of egypt')).toBe('The gods of Egypt')
    expect(display('godliness is profitable')).toBe('Godliness is profitable')
    expect(display('he was godly')).toBe('He was godly')
  })

  it('does not capitalize father or son — that is a reading, not orthography', () => {
    expect(display('my father worked in the mines')).toBe('My father worked in the mines')
    expect(display('his son came home')).toBe('His son came home')
    expect(PROPER_NOUNS.has('father')).toBe(false)
    expect(PROPER_NOUNS.has('son')).toBe(false)
  })

  it('never re-cases a canonical name scripture-ref already emitted', () => {
    expect(display('second Kings chapter two verse nine')).toBe('2 Kings 2:9')
  })
})

describe('divine names and titles on transcript surfaces', () => {
  it('capitalizes divine names without rewriting the sentence', () => {
    expect(capitalizeScriptureNames('we trust jesus, god, elohim, yahweh, adonai, yeshua and abba.')).toBe(
      'we trust Jesus, God, Elohim, Yahweh, Adonai, Yeshua and Abba.',
    )
    expect(capitalizeScriptureNames('we praise yhwh and jehovah.')).toBe('we praise YHWH and Jehovah.')
  })

  it('capitalizes full titles, keeping connecting words as spoken', () => {
    expect(capitalizeScriptureNames('the holy spirit reveals the son of god and god the father.')).toBe(
      'the Holy Spirit reveals the Son of God and God the Father.',
    )
    expect(capitalizeScriptureNames('our heavenly father, the most high, ancient of days and prince of peace.')).toBe(
      'our Heavenly Father, the Most High, Ancient of Days and Prince of Peace.',
    )
    expect(capitalizeScriptureNames('the spirit of the lord, the lamb of god, king of kings and lord of lords.')).toBe(
      'the Spirit of the Lord, the Lamb of God, King of kings and Lord of lords.',
    )
  })

  it('preserves spaces and hyphens in Hebrew divine names', () => {
    const input = 'el shaddai, el-elyon, el roi, jehovah-jireh and jehovah\t rapha'
    const expected = 'El Shaddai, El-Elyon, El Roi, Jehovah-Jireh and Jehovah\t Rapha'
    expect(capitalizeScriptureNames(input)).toBe(expected)
    expect(capitalizeScriptureNames(input).length).toBe(input.length)
  })

  it('handles possessives, quotation marks and existing uppercase without changing punctuation', () => {
    expect(capitalizeScriptureNames('“god’s love,” jesus\' teaching and the holy spirit\'s work; GOD, LORD and JESUS.')).toBe(
      '“God’s love,” Jesus\' teaching and the Holy Spirit\'s work; GOD, LORD and JESUS.',
    )
  })

  it('does not turn ordinary family, spirit or lord wording into divine titles', () => {
    const ordinary = 'my father told his son about a broken spirit, a holy place and the lord of the manor. do not lord it over others.'
    expect(capitalizeScriptureNames(ordinary)).toBe(ordinary)
    expect(display(ordinary)).toBe('My father told his son about a broken spirit, a holy place and the lord of the manor. Do not lord it over others.')
    expect(capitalizeScriptureNames('the lord of the rings and the lord of the flies')).toBe('the lord of the rings and the lord of the flies')
  })

  it('matches whole names and does not join titles across punctuation', () => {
    const ordinary = 'gods, godliness, godly, elohimish, jesús, spirit. of god'
    expect(capitalizeScriptureNames(ordinary)).toBe('gods, godliness, godly, elohimish, jesús, spirit. of God')
  })

  it('keeps display spans reversible and length-stable while Scripture is being read', () => {
    const raw = 'the holy spirit reveals elohim’s son, the prince of peace.'
    for (const reading of READING_STATES) {
      const line = normalizeForDisplay(raw, ctx({ reading }))
      expect(line.text).toBe('The Holy Spirit reveals Elohim’s son, the Prince of Peace.')
      expect(line.text.length).toBe(raw.length)
      expect(recoverRaw(line.spans)).toBe(raw)
      for (const span of line.spans) {
        expect(raw.slice(span.start, span.end)).toBe(span.raw ?? span.text)
      }
    }
  })

  it('preserves timed word boundaries and metadata while recognizing a title across words', () => {
    const words = [
      { w: 'the', s: 1, e: 1.2, speaker: 0 },
      { w: 'holy', s: 1.2, e: 1.5, speaker: 0 },
      { w: 'spirit,', s: 1.5, e: 1.9, speaker: 0 },
      { w: 'elohim’s', s: 2, e: 2.5, speaker: 1 },
      { w: 'presence.', s: 2.5, e: 3, speaker: 1 },
    ]
    const cased = capitalizeScriptureWords(words)
    expect(cased.map(({ w }) => w)).toEqual(['the', 'Holy', 'Spirit,', 'Elohim’s', 'presence.'])
    expect(cased.map(({ w: _w, ...timing }) => timing)).toEqual(words.map(({ w: _w, ...timing }) => timing))
    expect(words[1].w).toBe('holy')
    expect(cased[0]).toBe(words[0])
    expect(capitalizeScriptureWords(cased)).toBe(cased)
    expect(capitalizeScriptureWords([])).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* scripture-ref                                                       */
/* ------------------------------------------------------------------ */

describe('normalizeForDisplay — scripture-ref, the cases it must catch', () => {
  it('converts the full spoken citation — the signature feature', () => {
    expect(display('turn with me to first corinthians chapter thirteen verse four')).toBe(
      'Turn with me to 1 Corinthians 13:4'
    )
  })

  it('converts a range', () => {
    expect(display('romans chapter eight verses twenty eight through thirty')).toBe('Romans 8:28-30')
    expect(display('Open your Bible — Psalm chapter twenty three verse one to six')).toBe(
      'Open your Bible — Psalm 23:1-6'
    )
    expect(display('Malachi chapter three verse ten to eleven')).toBe('Malachi 3:10-11')
  })

  it('keeps Psalm singular when that is the word he spoke', () => {
    // G9. The most-referenced book in the corpus; the projector must not show
    // a word he did not say.
    expect(display('Psalm chapter twenty three verse one')).toBe('Psalm 23:1')
    expect(display('Psalms chapter twenty three verse one')).toBe('Psalms 23:1')
  })

  it('renders a numbered book with its digit prefix', () => {
    expect(display('second Kings chapter two verse nine')).toBe('2 Kings 2:9')
    expect(display('first john chapter one verse nine and confess')).toBe('1 John 1:9 and confess')
  })

  it('keeps the sentence around the citation intact, punctuation and all', () => {
    expect(display('look at romans chapter eight verse twenty eight, and be encouraged')).toBe(
      'Look at Romans 8:28, and be encouraged'
    )
  })

  it('accepts digits directly, so the default parser degrades rather than breaks', () => {
    expect(display('romans chapter 8 verse 28', { parseNumber: undefined })).toBe('Romans 8:28')
    // Without the injected parser the spoken form simply does not convert.
    expect(display('romans chapter eight verse twenty eight', { parseNumber: undefined })).toBe(
      'Romans chapter eight verse twenty eight'
    )
  })

  it('runs while inert, because verse text does not cite itself', () => {
    for (const reading of READING_STATES) {
      expect(display('turn with me to first corinthians chapter thirteen verse four', { reading })).toBe(
        'Turn with me to 1 Corinthians 13:4'
      )
    }
  })

  it('never fires at all when no book matcher was injected', () => {
    expect(display('romans chapter eight verse twenty eight', { matchBook: undefined })).toBe(
      'Romans chapter eight verse twenty eight'
    )
  })

  it('is never marked — a hedged citation would undermine the feature', () => {
    const line = normalizeForDisplay('romans chapter eight verse twenty eight', ctx())
    expect(line.hasUncertain).toBe(false)
    expect(line.spans.every((s) => s.mark === undefined)).toBe(true)
  })
})

describe('normalizeForDisplay — scripture-ref, the near misses it must not fire on', () => {
  it('refuses a bare book name with no number attached', () => {
    // G1, fatal twice over: a bare substitution rewrites a man's name into a
    // citation, and deletes an idiom.
    expect(display('mark chapter and verse everything you did wrong')).toBe(
      'Mark chapter and verse everything you did wrong'
    )
    expect(display('second john took the stand, chapter closed')).toBe(
      'Second john took the stand, chapter closed'
    )
  })

  it('refuses a book alias behind a determiner or possessive', () => {
    // G3. 'my job' is never the book of Job.
    expect(display('my job, chapter one of my life, verse by verse')).toBe(
      'My job, chapter one of my life, verse by verse'
    )
    expect(display('the acts chapter two of our series')).toBe('The acts chapter two of our series')
    expect(display('a psalm chapter three of his own')).toBe('A psalm chapter three of his own')
  })

  it('refuses the chapter-and-verse idiom, wherever it sits', () => {
    // G4. A fixed English idiom that appears in sermons constantly.
    expect(display("I'm not going to give you chapter and verse on this")).toBe(
      "I'm not going to give you chapter and verse on this"
    )
    expect(display('God gave it to me chapter and verse')).toBe('God gave it to me chapter and verse')
    expect(display('mark chapter and verse three of the plan')).toBe(
      'Mark chapter and verse three of the plan'
    )
  })

  it('refuses when a quantity noun follows the number', () => {
    // G5. 'Acts 11 years' is a sentence nobody meant to write.
    expect(display('he was in prison for acts chapter eleven years')).toBe(
      'He was in prison for acts chapter eleven years'
    )
    expect(display('romans chapter eight verse ten people were there')).toBe(
      'Romans chapter eight verse ten people were there'
    )
  })

  it('refuses when a number dangles unconsumed after the citation', () => {
    // G6. A half-parsed citation is worse than none.
    expect(display('ephesians chapter two verse eight nine')).toBe(
      'Ephesians chapter two verse eight nine'
    )
  })

  it('has no cross-line memory and will never borrow a book', () => {
    // G7. The resolver's 15-minute lastBook borrow would print words onto the
    // line that the preacher did not say on that line. Not even '8:28'.
    expect(display('chapter eight verse twenty eight')).toBe('Chapter eight verse twenty eight')
    expect(
      display("Paul is not writing a chapter, he's writing a letter — and in that letter, chapter three verse one, he turns a corner.")
    ).toBe(
      "Paul is not writing a chapter, he's writing a letter — and in that letter, chapter three verse one, he turns a corner."
    )
  })

  it('refuses when anything at all sits between the book and the keyword', () => {
    // G2. The resolver's filler-skipping walk is stateful-engine behaviour and
    // is deliberately not copied to the display layer.
    expect(display('i want to look at the acts of giving chapter two of our series')).toBe(
      'i want to look at the acts of giving chapter two of our series'
    )
    expect(display('romans the chapter eight verse twenty eight')).toBe(
      'Romans the chapter eight verse twenty eight'
    )
  })

  it('treats a comma after the book as a hard run break', () => {
    // This is exactly why the tokenizer must not reuse normalizeWords, which
    // strips all punctuation.
    expect(display('mark my words, twelve of them left')).toBe('Mark my words, twelve of them left')
    expect(display('romans, chapter eight verse twenty eight')).toBe(
      'Romans, chapter eight verse twenty eight'
    )
  })

  it('refuses bare adjacency — resolver Pattern E is never implemented here', () => {
    // On the display layer a missed conversion costs one unabbreviated line; a
    // false one prints a wrong reference inside his own sentence, permanently.
    expect(display('John three sixteen')).toBe('John three sixteen')
    expect(display('my friend John is thirty two years old')).toBe('My friend John is thirty two years old')
    expect(display('romans twelve kilometers to the prayer mountain')).toBe(
      'Romans twelve kilometers to the prayer mountain'
    )
  })

  it('refuses the ordinal form — ORDINALS stops at twelfth and was rejected', () => {
    expect(display('the third chapter of John')).toBe('The third chapter of John')
  })

  it('refuses a verse keyword with no chapter, rather than inventing one', () => {
    expect(display('romans verse nine tells us')).toBe('Romans verse nine tells us')
  })

  it('misses the paused delivery, and that is documented rather than a bug', () => {
    // Four separate finals convert nothing, while the same words in one breath
    // convert. The variable is whisper's segmenter and it is invisible.
    expect(display('Turn with me.')).toBe('Turn with me.')
    expect(display('First Corinthians.', { atSentenceStart: true })).toBe('First Corinthians.')
    expect(display('Chapter thirteen.', { atSentenceStart: true })).toBe('Chapter thirteen.')
    expect(display('Verse four.', { atSentenceStart: true })).toBe('Verse four.')
  })
})

/* ------------------------------------------------------------------ */
/* scripture-ref — the end-of-chunk hold                               */
/* ------------------------------------------------------------------ */

describe('normalizeForDisplay — scripture-ref, the end-of-chunk hold', () => {
  it('holds a chapter-only citation that runs to the last token of the line', () => {
    // G8. This may be the front half of 'turn to 1 John 1' / 'verse nine and
    // confess'. A bisected citation looks broken; an unconverted line does not.
    expect(display('turn to first john chapter one')).toBe('Turn to first john chapter one')
    expect(display('look at john chapter three')).toBe('Look at john chapter three')
  })

  it('converts the same chapter-only citation once a word follows it', () => {
    expect(display('look at john chapter three and see')).toBe('Look at John 3 and see')
    expect(display('turn to first john chapter one with me')).toBe('Turn to 1 John 1 with me')
  })

  it('holds a chapter-only citation at the line end even when punctuation closed it', () => {
    // G8 is deliberately literal: the span ends at the last token, so it is
    // held, full stop or not. The spec's own example table shows 'look at John
    // 3' converting while its mustNotFire holds 'turn to first john chapter
    // one' — both are chapter-only spans ending at the last token, so the two
    // cannot both be honoured. The guard is implemented as written and the
    // conservative side is the one that reaches a projector.
    expect(display('look at john chapter three.')).toBe('Look at john chapter three.')
  })

  it('holds every citation on a partial, not just the keyword-less shape', () => {
    // A many-words-to-one-symbol conversion can only be flicker-free if it is
    // held until the utterance settles — otherwise the operator watches
    // '1 Corinthians 13' rewrite itself into '1 Corinthians 13:4'.
    // The words stay as spoken — only the proper-noun pass touches them, which
    // is casing and cannot change what was said.
    expect(display('turn with me to first corinthians chapter thirteen verse four', { isFinal: false })).toBe(
      'Turn with me to first Corinthians chapter thirteen verse four'
    )
  })

  it('converts on a partial once two settled tokens follow the citation', () => {
    expect(display('romans chapter eight verse twenty eight is the promise', { isFinal: false })).toBe(
      'Romans 8:28 is the promise'
    )
  })
})

/* ------------------------------------------------------------------ */
/* Inertness                                                           */
/* ------------------------------------------------------------------ */

describe('normalizeForDisplay — inertness, the mechanism', () => {
  it('reports inert for every state but no, and maybe collapses to reading', () => {
    expect(normalizeForDisplay('he wept', ctx({ reading: 'no' })).inert).toBe(false)
    expect(normalizeForDisplay('he wept', ctx({ reading: 'maybe' })).inert).toBe(true)
    expect(normalizeForDisplay('he wept', ctx({ reading: 'reading' })).inert).toBe(true)
  })

  it('produces identical output under maybe and reading', () => {
    const inputs = [
      'um, so paul writes here',
      'turn with me to first corinthians chapter thirteen verse four',
      'and god said unto moses i am that i am.',
      'he wept. uh. then he rose.'
    ]
    for (const raw of inputs) {
      expect(display(raw, { reading: 'maybe' })).toBe(display(raw, { reading: 'reading' }))
    }
  })

  it('changes nothing but capitalization when inert, on a verse read aloud', () => {
    // The owner's constraint, stated as a test: his wording is not touched.
    const verse =
      'for god so loved the world that he gave his only begotten son that whosoever believeth in him should not perish but have everlasting life'
    const out = display(verse, { reading: 'reading' })
    expect(out.toLowerCase()).toBe(verse.toLowerCase())
  })

  it('leaves an archaic number phrase exactly as spoken, in every state', () => {
    // 'threescore and ten' is safe by construction: EN_NUMBER_WORDS has no
    // 'score', so there is no table entry to fire from.
    for (const reading of READING_STATES) {
      expect(display('and the days of our years are threescore years and ten', { reading })).toBe(
        'And the days of our years are threescore years and ten'
      )
    }
  })

  it('keeps the lexical branch alive even though nothing is lexical yet', () => {
    // There are zero lexical rules today, so the inert filter suppresses
    // nothing and every shipped rule must survive it untouched. The day a
    // lexical rule lands it is off during Scripture without anyone remembering.
    for (const reading of READING_STATES) {
      const line = normalizeForDisplay('um, turn to romans chapter eight verse twenty eight now', ctx({ reading }))
      expect(line.text).toBe('Turn to Romans 8:28 now')
    }
  })
})

/* ------------------------------------------------------------------ */
/* Partials                                                            */
/* ------------------------------------------------------------------ */

describe('normalizeForDisplay — partials and the held tail', () => {
  it('cases a partial immediately, because a capital two words late looks broken', () => {
    expect(display('so paul writes', { isFinal: false })).toBe('So Paul writes')
  })

  it('removes an opening filler on a partial, for the same reason', () => {
    expect(display('um, so paul writes here', { isFinal: false })).toBe('So Paul writes here')
  })

  it('never converts a citation reaching into the held tail', () => {
    // The last two tokens of a partial are still being revised, so a citation
    // that touches them is held whole. With two settled tokens after it there
    // is nothing left to revise and it converts.
    for (const n of [0, 1]) {
      const raw = 'romans chapter eight verse twenty eight' + ' word'.repeat(n)
      expect(display(raw, { isFinal: false })).toContain('chapter eight')
    }
    expect(display('romans chapter eight verse twenty eight word word', { isFinal: false })).toContain(
      'Romans 8:28'
    )
  })

  it('either converts a partial exactly as the final does, or not at all', () => {
    // The strict prefix property is unachievable — converting 'first
    // corinthians' to '1 Corinthians' necessarily makes the pre-conversion
    // partial diverge. This is the guarantee the module actually provides, and
    // it is the one that matters: the viewer never sees a DIFFERENT citation.
    const final = 'turn with me to first corinthians chapter thirteen verse four and read with me'
    const words = final.split(' ')
    const finalText = display(final)
    for (let n = 1; n <= words.length; n++) {
      const partial = display(words.slice(0, n).join(' '), { isFinal: false })
      const converted = /\d+:\d+/.test(partial)
      if (converted) expect(finalText).toContain('1 Corinthians 13:4')
      else expect(partial).not.toContain('Corinthians 13')
    }
  })

  it('produces no intermediate wrong state as a citation grows word by word', () => {
    const seen = new Set<string>()
    const words = 'romans chapter eight verse twenty eight is the promise'.split(' ')
    for (let n = 1; n <= words.length; n++) {
      const out = display(words.slice(0, n).join(' '), { isFinal: false })
      const cite = out.match(/Romans \d+(?::\d+)?/)
      if (cite) seen.add(cite[0])
    }
    // Only the settled citation ever appears — never 'Romans 8' on the way.
    expect([...seen]).toEqual(['Romans 8:28'])
  })
})

/* ------------------------------------------------------------------ */
/* Spans                                                               */
/* ------------------------------------------------------------------ */

describe('normalizeForDisplay — the span model', () => {
  it('collapses untouched text into a single span', () => {
    // Without this a normal sentence becomes forty spans and React re-keys the
    // world on every chunk.
    const line = normalizeForDisplay('He went up to the mountain to pray', ctx())
    expect(line.spans).toHaveLength(1)
    expect(line.spans[0].raw).toBeUndefined()
    expect(line.spans[0].rule).toBeUndefined()
  })

  it('keeps a line that only needed a capital as one span, carrying its raw', () => {
    const line = normalizeForDisplay('he went up to the mountain to pray', ctx())
    expect(line.spans).toHaveLength(1)
    expect(line.spans[0].text).toBe('He went up to the mountain to pray')
    expect(line.spans[0].raw).toBe('he went up to the mountain to pray')
  })

  it('carries raw only where the text actually differs', () => {
    const line = normalizeForDisplay('turn to romans chapter eight verse twenty eight now', ctx())
    const converted = line.spans.filter((s) => s.rule === 'scripture-ref')
    expect(converted).toHaveLength(1)
    expect(converted[0].text).toBe('Romans 8:28')
    expect(converted[0].raw).toBe('romans chapter eight verse twenty eight')
  })

  it('points the offsets of every span back at the raw string', () => {
    const raw = 'um, turn to romans chapter eight verse twenty eight now'
    const line = normalizeForDisplay(raw, ctx())
    for (const span of line.spans) {
      expect(span.end).toBeGreaterThanOrEqual(span.start)
      expect(raw.slice(span.start, span.end)).toBe(span.raw ?? span.text)
    }
  })

  it('names the rule that produced each changed span', () => {
    const line = normalizeForDisplay('um, look at romans chapter eight verse one now', ctx())
    const rules = line.spans.map((s) => s.rule).filter(Boolean)
    expect(rules).toContain('filler')
    expect(rules).toContain('scripture-ref')
  })

  it('keeps text exactly equal to the joined span texts', () => {
    for (const raw of ['um, so paul writes here', 'romans chapter eight verse one now', 'plain words']) {
      const line = normalizeForDisplay(raw, ctx())
      expect(line.spans.map((s) => s.text).join('')).toBe(line.text)
    }
  })
})

/* ------------------------------------------------------------------ */
/* Rule selection                                                      */
/* ------------------------------------------------------------------ */

describe('normalizeForDisplay — rule selection', () => {
  it('ships exactly three rules, in the order that makes casing last', () => {
    expect(DEFAULT_RULES).toEqual(['filler', 'scripture-ref', 'sentence-case'])
  })

  it('turns a rule off by editing an array of strings', () => {
    const raw = 'um, look at romans chapter eight verse one now'
    expect(display(raw, { rules: ['sentence-case'] })).toBe('Um, look at Romans chapter eight verse one now')
    expect(display(raw, { rules: ['filler'] })).toBe('look at romans chapter eight verse one now')
    expect(display(raw, { rules: ['scripture-ref'] })).toBe('um, look at Romans 8:1 now')
    expect(display(raw, { rules: [] })).toBe(raw)
  })
})

/* ------------------------------------------------------------------ */
/* Degenerate input                                                    */
/* ------------------------------------------------------------------ */

describe('normalizeForDisplay — degenerate input', () => {
  it('survives empty and whitespace-only lines', () => {
    for (const raw of ['', ' ', '   ', '\t\n ']) {
      const line = normalizeForDisplay(raw, ctx())
      expect(line.text).toBe(raw)
      expect(line.endsSentence).toBe(false)
      expect(recoverRaw(line.spans)).toBe(raw)
    }
  })

  it('preserves leading and trailing whitespace exactly', () => {
    const line = normalizeForDisplay('  so paul writes  ', ctx())
    expect(line.text).toBe('  So Paul writes  ')
    expect(recoverRaw(line.spans)).toBe('  so paul writes  ')
  })

  it('survives a line that is nothing but a filler', () => {
    expect(display('um')).toBe('')
    expect(display('um.')).toBe('')
  })

  it('survives punctuation with no words', () => {
    for (const raw of ['...', '—', '!?', '"']) {
      expect(display(raw)).toBe(raw)
    }
  })
})

/* ------------------------------------------------------------------ */
/* The injected parser, pinned                                         */
/* ------------------------------------------------------------------ */

describe('parseSpokenNumber — the ceiling is a safety feature', () => {
  // Numbers 1 census: "of the tribe of Reuben, forty and six thousand and five
  // hundred." Extending EN_NUMBER_WORDS with 'thousand' turns a KJV genealogy
  // into "46,500 / 59,300 / 45,650" on a projector. The ceiling is load-bearing.
  it('EN_NUMBER_WORDS has exactly 29 keys and no thousand', () => {
    expect(Object.keys(EN_NUMBER_WORDS)).toHaveLength(29)
    expect('thousand' in EN_NUMBER_WORDS).toBe(false)
    expect('score' in EN_NUMBER_WORDS).toBe(false)
    expect('threescore' in EN_NUMBER_WORDS).toBe(false)
  })

  it('parses the connector form, correcting a claim that it did not', () => {
    expect(parseSpokenNumber(['one', 'hundred', 'and', 'thirty', 'five'], 0)).toEqual({
      value: 135,
      consumed: 5
    })
  })

  it('returns null for the hyphenated tokens whisper really emits', () => {
    // Any future number rule must fix the tokenizer first, or it ships randomly
    // half-effective within a single sentence.
    expect(parseSpokenNumber(['ninety-nine'], 0)).toBeNull()
    expect(parseSpokenNumber(['twenty-seven'], 0)).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* The regression corpus                                               */
/* ------------------------------------------------------------------ */

/**
 * Every row of the hardened spec's regression corpus, as a table.
 *
 * The rows whose expectation is 'casing only' are the four cut rules — unit,
 * currency, percent and the i→I sub-rule — pinned as absences. They are the
 * most valuable rows in the file: a contributor who reinstates one of those
 * rules sees the sermon it would have mangled, in the test name, rather than a
 * diff that looks like an improvement.
 */
describe('normalizeForDisplay — the regression corpus', () => {
  const corpus: Array<[string, string, string]> = [
    [
      'God told me, sow one hundred dollars and receive a hundred fold. Not fifty naira, not twenty naira — one hundred dollars!',
      'God told me, sow one hundred dollars and receive a hundred fold. Not fifty naira, not twenty naira — one hundred dollars!',
      'currency is cut: $100 beside raw-word naira is the throw-it-out case'
    ],
    [
      'Twenty dollars — that is like thirty thousand naira today, twenty dollars!',
      'Twenty dollars — that is like thirty thousand naira today, twenty dollars!',
      'the fatal break that killed currency: local currency as words beside foreign currency as a symbol'
    ],
    [
      'and he found one of his fellow servants who owed him a hundred pence',
      'And he found one of his fellow servants who owed him a hundred pence',
      'modern-translation Scripture read unannounced, with the gate blind'
    ],
    [
      'Now a tithe is ten percent — but notice God does not say ten percent. He says all the tithes.',
      'Now a tithe is ten percent — but notice God does not say ten percent. He says all the tithes.',
      'the fatal break that killed percent: a quotative frame the gate provably cannot see'
    ],
    [
      'I am not talking about fifty percent commitment, I am talking about one hundred percent, two hundred percent, three hundred percent!',
      'I am not talking about fifty percent commitment, I am talking about one hundred percent, two hundred percent, three hundred percent!',
      '200% and 300% render rhetoric as a visible arithmetic error'
    ],
    [
      'a hundred percent committed',
      'A hundred percent committed',
      "the old spec's own happy path shipped ungrammatical 'a 100%' as a correct example"
    ],
    [
      'In Luke fifteen the shepherd leaves the ninety and nine. Ninety-nine percent of the flock was safe — and he went after the one percent.',
      'In Luke fifteen the shepherd leaves the ninety and nine. Ninety-nine percent of the flock was safe — and he went after the one percent.',
      "'the one percent' reads as a political slogan; also the hyphen-token half-firing case"
    ],
    [
      'I trekked forty kilometers, forty kilometers to that prayer mountain. Forty kilometers on my two legs!',
      'I trekked forty kilometers, forty kilometers to that prayer mountain. Forty kilometers on my two legs!',
      'unit is cut: three 40 km in one line reads as a delivery receipt, and the repetition IS the testimony'
    ],
    [
      'Prophet Elijah ran ahead of the chariot — thirty kilometers, brethren, from Carmel to Jezreel',
      'Prophet Elijah ran ahead of the chariot — thirty kilometers, brethren, from Carmel to Jezreel',
      "the preacher's own metric gloss of a biblical distance — the door the cubit guard leaves open"
    ],
    [
      'the length of the ark shall be three hundred cubits... that is about one hundred and thirty five meters, brethren',
      'The length of the ark shall be three hundred cubits... That is about one hundred and thirty five meters, brethren',
      'unit is cut; the parser test alongside pins that this parses to 135, not 100'
    ],
    [
      'his blood sugar was two hundred grams',
      'His blood sugar was two hundred grams',
      'always-uncertain conversions reached the companion unmarked; unit is cut'
    ],
    [
      'ah e don do ah ah my brother na wetin i dey talk be that',
      'Ah e don do ah ah my brother na wetin i dey talk be that',
      'fatal: DISPLAY_FILLERS must never inherit EN_FILLER, and i is not capitalized'
    ],
    [
      'Am I speaking to somebody? Uh-uh, you are not listening. Um... somebody shout hallelujah!',
      'Am I speaking to somebody? Uh-uh, you are not listening. Somebody shout hallelujah!',
      'ellipsis trail absorbed with the token; no orphaned dots at line start'
    ],
    [
      "uh huh. that's right. amen.",
      "Uh huh. That's right. Amen.",
      "G3: the next-token veto makes the uh-huh guard independent of whisper's hyphen luck"
    ],
    [
      'and all the days of methuselah were nine hundred sixty and nine years. uh. and he died.',
      'And all the days of methuselah were nine hundred sixty and nine years. And he died.',
      'the standalone-filler-as-its-own-sentence trail rule; no doubled terminal'
    ],
    [
      'umm, so Paul writes here',
      'So Paul writes here',
      'whisper-local emits umm and uhh more often than um and uh'
    ],
    [
      'and god said unto moses i am that i am.',
      'And God said unto Moses i am that i am.',
      'fatal: PROPER_NOUNS capitalizes god and moses, and the i→I rule does NOT exist'
    ],
    ['i na-aga', 'i na-aga', 'Igbo second-person pronoun, not English first-person'],
    [
      'i john three sixteen',
      'i john three sixteen',
      'the Roman-numeral book prefix must not print as a pronoun'
    ],
    [
      'na God o! i no fit shout. i dey believe am',
      'Na God o! i no fit shout. i dey believe am',
      'Pidgin: sentence capitals only'
    ],
    [
      'and i said the i in israel is silent',
      'And i said the i in Israel is silent',
      'Israel is capitalized by PROPER_NOUNS; i is untouched'
    ],
    [
      'he took a job in lagos',
      'He took a job in lagos',
      'job is in the ambiguous-alias exclusion and is never capitalized'
    ],
    ['1 corinthians says', '1 Corinthians says', 'G1: the first-alphabetic search skips leading digits'],
    [
      'turn with me to first corinthians chapter thirteen verse four',
      'Turn with me to 1 Corinthians 13:4',
      'the signature feature; must stay green forever'
    ],
    [
      'Open your Bible — Psalm chapter twenty three verse one to six',
      'Open your Bible — Psalm 23:1-6',
      'G9: Psalm singular, not Psalms — the projector must not show a word he did not say'
    ],
    [
      'mark chapter and verse everything you did wrong',
      'Mark chapter and verse everything you did wrong',
      'fatal: G1 number required, plus G4 idiom blocklist. No bare book-name rewrite, ever'
    ],
    [
      'second john took the stand, chapter closed',
      'Second john took the stand, chapter closed',
      "fatal: G1. A book substitution with no number rewrites a man's name into a citation"
    ],
    [
      'my job, chapter one of my life, verse by verse',
      'My job, chapter one of my life, verse by verse',
      'fatal: G3 determiner veto. my job is never the book of Job'
    ],
    [
      "I'm not going to give you chapter and verse on this",
      "I'm not going to give you chapter and verse on this",
      'G4: a fixed English idiom that appears in sermons constantly'
    ],
    [
      'God gave it to me chapter and verse',
      'God gave it to me chapter and verse',
      'G4, with a book alias nearby'
    ],
    [
      'he was in prison for acts chapter eleven years',
      'He was in prison for acts chapter eleven years',
      'G5: trailing-noun veto'
    ],
    [
      'ephesians chapter two verse eight nine',
      'Ephesians chapter two verse eight nine',
      'G6: trailing-number veto. A half-parsed citation is worse than none'
    ],
    [
      'chapter eight verse twenty eight',
      'Chapter eight verse twenty eight',
      'G7: no cross-line lastBook borrow, ever — not even 8:28. Accept the miss'
    ],
    [
      'i want to look at the acts of giving chapter two of our series',
      'i want to look at the acts of giving chapter two of our series',
      'G2 contiguity plus G3: four tokens between book and keyword'
    ],
    [
      "Paul is not writing a chapter, he's writing a letter — and in that letter, chapter three verse one, he turns a corner.",
      "Paul is not writing a chapter, he's writing a letter — and in that letter, chapter three verse one, he turns a corner.",
      'G7: the display layer has no lastBook'
    ],
    [
      'turn to first john chapter one',
      'Turn to first john chapter one',
      'G8 end-of-chunk hold: a bisected citation looks broken, an unconverted line does not'
    ],
    [
      'John three sixteen',
      'John three sixteen',
      'bare adjacency: resolver Pattern E is never implemented on the display layer'
    ],
    [
      'mark my words, twelve of them left',
      'Mark my words, twelve of them left',
      'the comma in trail is a hard run break — why the tokenizer must not reuse normalizeWords'
    ],
    [
      'romans chapter eight verses twenty eight through thirty',
      'Romans 8:28-30',
      'range handling'
    ],
    [
      'second Kings chapter two verse nine',
      '2 Kings 2:9',
      'numbered book; sentence-case must not re-case the canonical string'
    ]
  ]

  for (const [input, expected, why] of corpus) {
    it(`${JSON.stringify(input.slice(0, 60))} — ${why}`, () => {
      expect(display(input)).toBe(expected)
    })
  }

  it('leaves chunk two alone when chunk one ended mid-clause', () => {
    // G2 across a chunk boundary: line start is not sentence start, and
    // deleting 'uh' here deletes the subject of the sentence.
    const first = normalizeForDisplay('...and he will', ctx())
    expect(first.endsSentence).toBe(false)
    expect(
      display('uh is not a word in Hebrew, but Abba is', { atSentenceStart: first.endsSentence })
    ).toBe('uh is not a word in Hebrew, but Abba is')
  })

  it('converts nothing across four separate finals of a paused delivery', () => {
    const finals = ['Turn with me.', 'First Corinthians.', 'Chapter thirteen.', 'Verse four.']
    let atSentenceStart = true
    for (const chunk of finals) {
      const line = normalizeForDisplay(chunk, ctx({ atSentenceStart }))
      expect(line.text).toBe(chunk)
      atSentenceStart = line.endsSentence
    }
  })
})

/* ------------------------------------------------------------------ */
/* Invariants                                                          */
/* ------------------------------------------------------------------ */

/**
 * The properties that must hold for EVERY input, whatever the rules did.
 *
 * These are the tests that keep the module honest as it grows: a new rule can
 * pass every case above and still break an offset, and an offset bug shows up
 * on a projector as text that cannot be traced back to what the man said.
 */
describe('normalizeForDisplay — invariants over the whole corpus', () => {
  const INPUTS: string[] = [
    '',
    '   ',
    'um',
    'um.',
    'plain words with nothing to do',
    'um, so Paul writes here',
    'He turned. Uh, then he wept.',
    'Am I speaking to somebody? Uh-uh, you are not listening. Um... somebody shout hallelujah!',
    'and all the days of methuselah were nine hundred sixty and nine years. uh. and he died.',
    "uh huh. that's right. amen.",
    'ah e don do ah ah my brother na wetin i dey talk be that',
    'and god said unto moses i am that i am.',
    'na God o! i no fit shout. i dey believe am',
    'i na-aga',
    'i john three sixteen',
    'he took a job in lagos',
    '1 corinthians says',
    'turn with me to first corinthians chapter thirteen verse four',
    'romans chapter eight verses twenty eight through thirty',
    'Open your Bible — Psalm chapter twenty three verse one to six',
    'second Kings chapter two verse nine',
    'turn to first john chapter one',
    'look at john chapter three and see',
    'mark chapter and verse everything you did wrong',
    'second john took the stand, chapter closed',
    'my job, chapter one of my life, verse by verse',
    'he was in prison for acts chapter eleven years',
    'ephesians chapter two verse eight nine',
    'chapter eight verse twenty eight',
    'mark my words, twelve of them left',
    'John three sixteen',
    '  leading and trailing space  ',
    'I trekked forty kilometers, forty kilometers to that prayer mountain.',
    'Now a tithe is ten percent — but notice God does not say ten percent.',
    'um, turn to romans chapter eight verse twenty eight now'
  ]

  const CONFIGS: Array<[string, Partial<NormalizeContext>]> = [
    ['final, not reading', { isFinal: true, reading: 'no' }],
    ['final, reading', { isFinal: true, reading: 'reading' }],
    ['final, maybe', { isFinal: true, reading: 'maybe' }],
    ['partial, not reading', { isFinal: false, reading: 'no' }],
    ['partial, reading', { isFinal: false, reading: 'reading' }],
    ['mid-sentence continuation', { isFinal: true, reading: 'no', atSentenceStart: false }]
  ]

  function each(fn: (line: NormalizedLine, raw: string, label: string) => void): void {
    for (const raw of INPUTS) {
      for (const [label, over] of CONFIGS) {
        fn(normalizeForDisplay(raw, ctx(over)), raw, label)
      }
    }
  }

  it('the raw text is always recoverable from the spans', () => {
    // The first invariant, and the one everything else rests on: every surface
    // that stores spans can get back exactly what the microphone heard.
    each((line, raw, label) => {
      expect(recoverRaw(line.spans), `${label}: ${JSON.stringify(raw)}`).toBe(raw)
      expect(line.raw).toBe(raw)
    })
  })

  it('text is always exactly the joined span texts', () => {
    each((line, raw, label) => {
      expect(line.spans.map((s) => s.text).join(''), `${label}: ${JSON.stringify(raw)}`).toBe(line.text)
    })
  })

  it('every span offset slices its own raw back out of the input', () => {
    each((line, raw, label) => {
      for (const span of line.spans) {
        expect(span.start, `${label}: ${JSON.stringify(raw)}`).toBeLessThanOrEqual(span.end)
        expect(raw.slice(span.start, span.end), `${label}: ${JSON.stringify(raw)}`).toBe(
          span.raw ?? span.text
        )
      }
    })
  })

  it('spans tile the raw string in order, with no gap and no overlap', () => {
    each((line, raw, label) => {
      let at = 0
      for (const span of line.spans) {
        expect(span.start, `${label}: ${JSON.stringify(raw)}`).toBe(at)
        at = span.end
      }
      expect(at, `${label}: ${JSON.stringify(raw)}`).toBe(raw.length)
    })
  })

  it('raw is present only where it actually differs from text', () => {
    each((line, raw, label) => {
      for (const span of line.spans) {
        if (span.raw !== undefined) {
          expect(span.raw, `${label}: ${JSON.stringify(raw)}`).not.toBe(span.text)
        }
      }
    })
  })

  it('an inert pass changes only capitalization, outside a converted citation', () => {
    // The owner's constraint as an executable guarantee: while inert, every
    // span the rules did not claim is byte-identical to the input apart from
    // case. Only two things may differ — a deleted filler, which is breath
    // rather than wording, and a spoken citation, which is class 'reference'
    // and runs while inert by design because verse text does not cite itself.
    // Every OTHER character he said survives untouched but for its capital.
    for (const raw of INPUTS) {
      for (const reading of ['maybe', 'reading'] as const) {
        const line = normalizeForDisplay(raw, ctx({ reading }))
        for (const span of line.spans) {
          if (span.rule === 'filler' || span.rule === 'scripture-ref') continue
          expect(
            span.text.toLowerCase(),
            `${reading}: ${JSON.stringify(raw)} rewrote ${JSON.stringify(span.raw ?? span.text)}`
          ).toBe((span.raw ?? span.text).toLowerCase())
        }
      }
    }
  })

  it('an inert pass never rewrites wording when no citation was spoken', () => {
    // The same guarantee stated end to end, on the lines that carry no
    // citation at all — which is what a verse read aloud looks like.
    const verses = INPUTS.filter((raw) => !/chapter|verse/i.test(raw))
    for (const raw of verses) {
      for (const reading of ['maybe', 'reading'] as const) {
        const line = normalizeForDisplay(raw, ctx({ reading }))
        const withFillersBack = line.spans
          .map((s) => (s.rule === 'filler' ? (s.raw ?? '') : s.text))
          .join('')
        expect(withFillersBack.toLowerCase(), `${reading}: ${JSON.stringify(raw)}`).toBe(raw.toLowerCase())
      }
    }
  })

  it('normalizing twice is idempotent', () => {
    // The transcript is re-rendered on every chunk and a recap re-runs the
    // whole service, so a rule that fired again on its own output would
    // compound silently. Fed back through the SAME context, every rule must be
    // a no-op the second time.
    for (const raw of INPUTS) {
      for (const [label, over] of CONFIGS) {
        const once = normalizeForDisplay(raw, ctx(over))
        const twice = normalizeForDisplay(once.text, ctx(over))
        expect(twice.text, `${label}: ${JSON.stringify(raw)}`).toBe(once.text)
      }
    }
  })

  it('hasUncertain agrees with the spans, and nothing ships marked today', () => {
    each((line, raw, label) => {
      expect(line.hasUncertain, `${label}: ${JSON.stringify(raw)}`).toBe(
        line.spans.some((s) => s.mark === 'uncertain')
      )
      // All three shipped rules are 'certain'. When a marked rule lands, this
      // line is the one that should be edited deliberately.
      expect(line.hasUncertain, `${label}: ${JSON.stringify(raw)}`).toBe(false)
    })
  })

  it('every rule id on a span is one that was enabled', () => {
    const enabled = new Set<RuleId>(DEFAULT_RULES)
    each((line, raw, label) => {
      for (const span of line.spans) {
        if (span.rule) expect(enabled.has(span.rule), `${label}: ${JSON.stringify(raw)}`).toBe(true)
      }
    })
  })

  it('disabling every rule returns the input byte for byte', () => {
    for (const raw of INPUTS) {
      const line = normalizeForDisplay(raw, ctx({ rules: [] }))
      expect(line.text).toBe(raw)
      expect(line.spans.every((s) => s.raw === undefined)).toBe(true)
    }
  })
})
