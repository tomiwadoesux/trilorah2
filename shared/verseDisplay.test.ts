import { describe, it, expect } from 'vitest'
import {
  buildVerseSlides,
  formatReference,
  showsReference,
  splitText,
  TRANSLATION_SEPARATOR,
  VERSE_NUMBER_SPACE,
  splitVerseNumbers,
  pageVerses,
  PAGE_WORDS,
  CONTINUES,
  type VerseDisplayOptions,
  type VerseText
} from './verseDisplay'

const REF = { book: 'John', chapter: 3, version: 'KJV' }

const RANGE: VerseText[] = [
  { verse: 16, text: 'For God so loved the world.' },
  { verse: 17, text: 'For God sent not his Son to condemn the world.' },
  { verse: 18, text: 'He that believeth on him is not condemned.' }
]

const SINGLE: VerseText[] = [{ verse: 16, text: 'For God so loved the world.' }]

function opts(over: Partial<VerseDisplayOptions> = {}): VerseDisplayOptions {
  return {
    breakOnVerse: false,
    showVerseNumbers: false,
    referenceMode: 'each',
    showTranslation: false,
    ...over
  }
}

describe('formatReference', () => {
  it('renders a single verse and a span', () => {
    expect(formatReference(REF, 16, 16, { showTranslation: false })).toBe('John 3:16')
    expect(formatReference(REF, 16, 18, { showTranslation: false })).toBe('John 3:16-18')
  })

  it('appends the translation code when asked', () => {
    expect(formatReference(REF, 16, 16, { showTranslation: true })).toBe('John 3:16' + TRANSLATION_SEPARATOR + 'KJV')
  })

  it('omits a dangling separator when the version code is blank', () => {
    expect(formatReference({ ...REF, version: '' }, 16, 16, { showTranslation: true })).toBe('John 3:16')
  })

  it('handles multi-word books and a reversed-looking range', () => {
    const song = { book: 'Song of Solomon', chapter: 2, version: 'NIV' }
    expect(formatReference(song, 1, 1, { showTranslation: true })).toBe('Song of Solomon 2:1 · NIV')
    // endVerse below start is treated as a single verse, never '5-3'.
    expect(formatReference(song, 5, 3, { showTranslation: false })).toBe('Song of Solomon 2:5')
  })
})

describe('showsReference', () => {
  it('follows slide position for every mode', () => {
    expect([0, 1, 2].map((i) => showsReference('each', i, 3))).toEqual([true, true, true])
    expect([0, 1, 2].map((i) => showsReference('first', i, 3))).toEqual([true, false, false])
    expect([0, 1, 2].map((i) => showsReference('last', i, 3))).toEqual([false, false, true])
    expect([0, 1, 2].map((i) => showsReference('none', i, 3))).toEqual([false, false, false])
  })

  it('shows the reference on a lone slide under first and last alike', () => {
    expect(showsReference('first', 0, 1)).toBe(true)
    expect(showsReference('last', 0, 1)).toBe(true)
  })
})

describe('buildVerseSlides — empty input', () => {
  it('returns no slides at all', () => {
    expect(buildVerseSlides(REF, [], opts())).toEqual([])
    expect(buildVerseSlides(REF, [], opts({ breakOnVerse: true, referenceMode: 'each' }))).toEqual([])
  })
})

describe('buildVerseSlides — breakOnVerse false', () => {
  it('collapses the whole range onto one slide with a spanning reference', () => {
    const slides = buildVerseSlides(REF, RANGE, opts())
    expect(slides).toHaveLength(1)
    expect(slides[0].reference).toBe('John 3:16-18')
    expect(slides[0].verseStart).toBe(16)
    expect(slides[0].verseEnd).toBe(18)
    expect(slides[0].index).toBe(1)
    expect(slides[0].total).toBe(1)
    expect(slides[0].lines).toHaveLength(1)
    expect(slides[0].lines[0]).toEqual({
      version: 'KJV',
      text: RANGE.map((v) => v.text).join(' ')
    })
  })

  it('numbers every verse in the blob when verse numbers are on', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ showVerseNumbers: true }))
    const text = slides[0].lines[0].text
    expect(text.startsWith('16' + VERSE_NUMBER_SPACE + 'For God')).toBe(true)
    expect(text).toContain('17' + VERSE_NUMBER_SPACE + 'For God sent not')
    expect(text).toContain('18' + VERSE_NUMBER_SPACE + 'He that believeth')
  })

  it('ignores maxCharsPerSlide, because one slide was explicitly asked for', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ maxCharsPerSlide: 20 }))
    expect(slides).toHaveLength(1)
  })

  it('honours every reference mode on the single collapsed slide', () => {
    for (const mode of ['each', 'first', 'last'] as const) {
      expect(buildVerseSlides(REF, RANGE, opts({ referenceMode: mode }))[0].reference).toBe('John 3:16-18')
    }
    expect(buildVerseSlides(REF, RANGE, opts({ referenceMode: 'none' }))[0].reference).toBeNull()
  })
})

describe('buildVerseSlides — breakOnVerse true', () => {
  it('produces one slide per verse with per-verse references', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true }))
    expect(slides).toHaveLength(3)
    expect(slides.map((s) => s.reference)).toEqual(['John 3:16', 'John 3:17', 'John 3:18'])
    expect(slides.map((s) => s.index)).toEqual([1, 2, 3])
    expect(slides.every((s) => s.total === 3)).toBe(true)
    expect(slides.map((s) => [s.verseStart, s.verseEnd])).toEqual([
      [16, 16],
      [17, 17],
      [18, 18]
    ])
  })

  it('still shows the number on a one-verse slide — it is the reader anchor', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, showVerseNumbers: true }))
    expect(slides[1].lines[0].text).toBe('17' + VERSE_NUMBER_SPACE + RANGE[1].text)
  })

  it('omits numbers when they are off', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true }))
    expect(slides[1].lines[0].text).toBe(RANGE[1].text)
  })

  it('places the reference by mode across the verse slides', () => {
    const first = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, referenceMode: 'first' }))
    expect(first.map((s) => s.reference)).toEqual(['John 3:16', null, null])

    const last = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, referenceMode: 'last' }))
    expect(last.map((s) => s.reference)).toEqual([null, null, 'John 3:18'])

    const none = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, referenceMode: 'none' }))
    expect(none.map((s) => s.reference)).toEqual([null, null, null])
  })

  it('carries the translation suffix onto each reference', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, showTranslation: true }))
    expect(slides.map((s) => s.reference)).toEqual(['John 3:16 · KJV', 'John 3:17 · KJV', 'John 3:18 · KJV'])
  })
})

describe('buildVerseSlides — a single verse under every combination', () => {
  it('always yields exactly one slide with sane index/total', () => {
    for (const breakOnVerse of [false, true]) {
      for (const showVerseNumbers of [false, true]) {
        for (const showTranslation of [false, true]) {
          for (const referenceMode of ['each', 'first', 'last', 'none'] as const) {
            const slides = buildVerseSlides(
              REF,
              SINGLE,
              opts({ breakOnVerse, showVerseNumbers, showTranslation, referenceMode })
            )
            expect(slides).toHaveLength(1)
            const s = slides[0]
            expect([s.index, s.total, s.verseStart, s.verseEnd]).toEqual([1, 1, 16, 16])
            if (referenceMode === 'none') expect(s.reference).toBeNull()
            else expect(s.reference).toBe(showTranslation ? 'John 3:16 · KJV' : 'John 3:16')
            expect(s.lines[0].text).toBe(
              showVerseNumbers ? '16' + VERSE_NUMBER_SPACE + SINGLE[0].text : SINGLE[0].text
            )
          }
        }
      }
    }
  })
})

describe('splitText', () => {
  it('returns the text untouched when it fits or splitting is off', () => {
    expect(splitText('short', 50)).toEqual(['short'])
    expect(splitText('a long piece of text', 0)).toEqual(['a long piece of text'])
    expect(splitText('a long piece of text', -5)).toEqual(['a long piece of text'])
  })

  it('prefers a sentence boundary inside the window', () => {
    const pieces = splitText('One. Two. Three words follow here.', 20)
    expect(pieces[0]).toBe('One. Two. ')
    expect(pieces.join('')).toBe('One. Two. Three words follow here.')
  })

  it('breaks on clause punctuation too', () => {
    expect(splitText('alpha; beta gamma delta', 12)[0]).toBe('alpha; ')
    expect(splitText('alpha: beta gamma delta', 12)[0]).toBe('alpha: ')
    expect(splitText('alpha? beta gamma delta', 12)[0]).toBe('alpha? ')
    expect(splitText('alpha! beta gamma delta', 12)[0]).toBe('alpha! ')
  })

  it('falls back to the last space when there is no punctuation', () => {
    const pieces = splitText('aaaa bbbb cccc dddd', 11)
    expect(pieces[0]).toBe('aaaa bbbb ')
    expect(pieces.join('')).toBe('aaaa bbbb cccc dddd')
  })

  it('hard-cuts one absurd unbroken word', () => {
    const word = 'x'.repeat(25)
    const pieces = splitText(word, 10)
    expect(pieces).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)])
    expect(pieces.join('')).toBe(word)
  })

  it('never emits an empty piece', () => {
    for (const max of [1, 2, 3, 5, 8, 13]) {
      for (const t of ['a b c d e f g', 'One. Two. Three.', 'y'.repeat(30), 'w', '']) {
        for (const piece of splitText(t, max)) {
          if (t !== '') expect(piece.length).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('buildVerseSlides — maxCharsPerSlide', () => {
  const LONG: VerseText[] = [
    {
      verse: 1,
      text: 'In the beginning was the Word. And the Word was with God. And the Word was God.'
    }
  ]

  it('splits a long verse at sentence boundaries and repeats its verse range', () => {
    const slides = buildVerseSlides(
      { book: 'John', chapter: 1, version: 'KJV' },
      LONG,
      opts({ breakOnVerse: true, maxCharsPerSlide: 40 })
    )
    expect(slides.length).toBeGreaterThan(1)
    expect(slides.every((s) => s.verseStart === 1 && s.verseEnd === 1)).toBe(true)
    expect(slides.map((s) => s.index)).toEqual(slides.map((_, i) => i + 1))
    expect(slides.every((s) => s.total === slides.length)).toBe(true)
    expect(slides[0].lines[0].text).toBe('In the beginning was the Word. ')
  })

  it('applies reference rules by slide position, not by verse', () => {
    const ref = { book: 'John', chapter: 1, version: 'KJV' }
    const first = buildVerseSlides(ref, LONG, opts({ breakOnVerse: true, maxCharsPerSlide: 40, referenceMode: 'first' }))
    expect(first[0].reference).toBe('John 1:1')
    expect(first.slice(1).every((s) => s.reference === null)).toBe(true)

    const last = buildVerseSlides(ref, LONG, opts({ breakOnVerse: true, maxCharsPerSlide: 40, referenceMode: 'last' }))
    expect(last[last.length - 1].reference).toBe('John 1:1')
    expect(last.slice(0, -1).every((s) => s.reference === null)).toBe(true)

    const each = buildVerseSlides(ref, LONG, opts({ breakOnVerse: true, maxCharsPerSlide: 40, referenceMode: 'each' }))
    expect(each.every((s) => s.reference === 'John 1:1')).toBe(true)
  })

  it('counts the verse number toward the cap and keeps it on the first piece only', () => {
    const slides = buildVerseSlides(
      { book: 'John', chapter: 1, version: 'KJV' },
      LONG,
      opts({ breakOnVerse: true, showVerseNumbers: true, maxCharsPerSlide: 40 })
    )
    expect(slides[0].lines[0].text.startsWith('1' + VERSE_NUMBER_SPACE)).toBe(true)
    expect(slides.slice(1).some((s) => s.lines[0].text.startsWith('1' + VERSE_NUMBER_SPACE))).toBe(false)
  })

  it('splits each verse of a range independently', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, maxCharsPerSlide: 25 }))
    expect(slides.length).toBeGreaterThan(3)
    // Verse order is preserved even though each verse contributes several slides.
    const seen = slides.map((s) => s.verseStart)
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(new Set(seen)).toEqual(new Set([16, 17, 18]))
  })

  it('never emits an empty slide', () => {
    for (const max of [1, 3, 7, 15, 40]) {
      const slides = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, maxCharsPerSlide: max }))
      for (const s of slides) expect(s.lines[0].text.length).toBeGreaterThan(0)
    }
  })
})

describe('buildVerseSlides — round trip, no text lost', () => {
  it('rejoining every slide reconstructs the source text, at every cap', () => {
    const source = RANGE.map((v) => v.text)
    for (const max of [0, 1, 2, 5, 9, 17, 33, 200]) {
      for (const showVerseNumbers of [false, true]) {
        const slides = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, showVerseNumbers, maxCharsPerSlide: max }))
        // Slides of one verse concatenate exactly; verses stay separate.
        const perVerse = new Map<number, string>()
        for (const s of slides) perVerse.set(s.verseStart, (perVerse.get(s.verseStart) ?? '') + s.lines[0].text)
        const rebuilt = RANGE.map((v) => perVerse.get(v.verse) ?? '')
        expect(rebuilt).toEqual(
          showVerseNumbers ? RANGE.map((v) => `${v.verse}${VERSE_NUMBER_SPACE}${v.text}`) : source
        )
      }
    }
  })

  it('loses nothing on a pathological unbroken verse', () => {
    const blob = [{ verse: 4, text: 'z'.repeat(300) }]
    const slides = buildVerseSlides(REF, blob, opts({ breakOnVerse: true, maxCharsPerSlide: 7 }))
    expect(slides.map((s) => s.lines[0].text).join('')).toBe('z'.repeat(300))
    expect(slides).toHaveLength(Math.ceil(300 / 7))
  })
})

describe('buildVerseSlides — secondary translation', () => {
  const SECONDARY = {
    version: 'NIV',
    verses: [
      { verse: 16, text: 'For God so loved the world (NIV).' },
      { verse: 17, text: 'For God did not send his Son (NIV).' },
      { verse: 18, text: 'Whoever believes is not condemned (NIV).' }
    ]
  }

  it('adds a second line per slide when breaking on verse', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, secondary: SECONDARY }))
    expect(slides).toHaveLength(3)
    for (const s of slides) expect(s.lines).toHaveLength(2)
    expect(slides[0].lines[1]).toEqual({ version: 'NIV', text: SECONDARY.verses[0].text })
  })

  it('joins the same range on the collapsed slide', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ secondary: SECONDARY }))
    expect(slides).toHaveLength(1)
    expect(slides[0].lines[1].text).toBe(SECONDARY.verses.map((v) => v.text).join(' '))
  })

  it('numbers the secondary line too', () => {
    const slides = buildVerseSlides(REF, RANGE, opts({ showVerseNumbers: true, secondary: SECONDARY }))
    expect(slides[0].lines[1].text.startsWith('16' + VERSE_NUMBER_SPACE)).toBe(true)
  })

  it('shows the reference once per slide, in the primary version', () => {
    const slides = buildVerseSlides(
      REF,
      RANGE,
      opts({ breakOnVerse: true, showTranslation: true, secondary: SECONDARY })
    )
    expect(slides[0].reference).toBe('John 3:16 · KJV')
    expect(slides[0].reference).not.toContain('NIV')
  })

  it('drops the second line for a ragged secondary instead of throwing', () => {
    const ragged = { version: 'NIV', verses: [SECONDARY.verses[0], SECONDARY.verses[2]] }
    const slides = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, secondary: ragged }))
    expect(slides.map((s) => s.lines.length)).toEqual([2, 1, 2])
    expect(slides[1].lines[0].version).toBe('KJV')
  })

  it('survives an entirely empty or null secondary', () => {
    const empty = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, secondary: { version: 'NIV', verses: [] } }))
    expect(empty.every((s) => s.lines.length === 1)).toBe(true)
    const nulled = buildVerseSlides(REF, RANGE, opts({ breakOnVerse: true, secondary: null }))
    expect(nulled.every((s) => s.lines.length === 1)).toBe(true)
  })

  it('repeats the secondary on every continuation slide of a split verse', () => {
    const slides = buildVerseSlides(
      REF,
      [{ verse: 16, text: 'One. Two. Three. Four. Five sentences here.' }],
      opts({ breakOnVerse: true, maxCharsPerSlide: 12, secondary: SECONDARY })
    )
    expect(slides.length).toBeGreaterThan(1)
    for (const s of slides) expect(s.lines[1]).toEqual({ version: 'NIV', text: SECONDARY.verses[0].text })
  })
})

describe('splitVerseNumbers', () => {
  it('lifts each verse number out of a composed range, keeping the space between verses', () => {
    const [slide] = buildVerseSlides(REF, RANGE, opts({ showVerseNumbers: true }))
    const parts = splitVerseNumbers(slide.lines[0].text)
    expect(parts.filter((p) => p.kind === 'verse').map((p) => (p.kind === 'verse' ? p.verse : ''))).toEqual(['16', '17', '18'])
    expect(parts[0]).toEqual({ kind: 'verse', verse: '16' })
    expect(parts[1]).toMatchObject({ kind: 'text' })
    expect(parts[1].kind === 'text' && parts[1].text.startsWith('For God')).toBe(true)
    expect(parts[1].kind === 'text' && parts[1].text.endsWith(' ')).toBe(true)
  })
  it('leaves words with no verse numbers whole, numbers in the text included', () => {
    expect(splitVerseNumbers('the 12 disciples went out')).toEqual([{ kind: 'text', text: 'the 12 disciples went out' }])
  })
})

describe('pages of a long reading', () => {
  const verse = (n: number, words: number) => ({ verse: n, text: Array.from({ length: words }, (_, i) => `w${i}`).join(' ') })

  it('keeps a reading that can be read from the back on one slide', () => {
    const three = [verse(3, 24), verse(4, 20), verse(5, 27)]
    expect(pageVerses(three, PAGE_WORDS)).toHaveLength(1)
    const slides = buildVerseSlides(REF, three, opts({ showVerseNumbers: true, maxWordsPerSlide: PAGE_WORDS }))
    expect(slides).toHaveLength(1)
    expect(slides[0].lines[0].text.endsWith(CONTINUES)).toBe(false)
  })

  it('pages a long one in whole verses, evenly, each page but the last saying there is more', () => {
    const sixteen = Array.from({ length: 16 }, (_, i) => verse(i + 1, 18))
    const pages = pageVerses(sixteen, PAGE_WORDS)
    expect(pages.map((p) => p.length)).toEqual([4, 4, 4, 4])
    const slides = buildVerseSlides(REF, sixteen, opts({ showVerseNumbers: true, maxWordsPerSlide: PAGE_WORDS }))
    expect(slides.map((s) => [s.verseStart, s.verseEnd])).toEqual([[1, 4], [5, 8], [9, 12], [13, 16]])
    expect(slides.slice(0, 3).every((s) => s.lines[0].text.endsWith(CONTINUES))).toBe(true)
    expect(slides[3].lines[0].text.endsWith(CONTINUES)).toBe(false)
    expect(slides[1].reference).toContain(':5-8')
  })

  it('never cuts a verse, even one longer than a page', () => {
    const pages = pageVerses([verse(1, 30), verse(2, 120), verse(3, 30)], PAGE_WORDS)
    expect(pages.map((p) => p.map((v) => v.verse))).toEqual([[1], [2], [3]])
  })
})
