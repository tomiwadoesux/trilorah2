import { describe, expect, it } from 'vitest'
import { capitalizeScriptureNames, capitalizeScriptureWords } from './scriptureNames'
import { formatDisplayText } from './textCase'
import { formatNoteText } from './noteDisplay'
import { formatLiveContent } from './liveContent'
import { songCards } from './songCards'

describe('divine names across languages and display surfaces', () => {
  it.each([
    ['lord, god, jesus, holy spirit, elohim, el shaddai and jehovah-jireh',
      'Lord, God, Jesus, Holy Spirit, Elohim, El Shaddai and Jehovah-Jireh'],
    ['immanuel, the redeemer, the good shepherd, king of kings and lord of lords',
      'Immanuel, the Redeemer, the Good Shepherd, King of Kings and Lord of Lords'],
    ['dios, jesús, jehová, señor, el espíritu santo y el hijo de dios',
      'Dios, Jesús, Jehová, Señor, el Espíritu Santo y el Hijo de Dios'],
    ["dieu, jésus, l’éternel, le saint-esprit, le fils de l'homme et le très-haut",
      "Dieu, Jésus, l’Éternel, le Saint-Esprit, le Fils de l'Homme et le Très-Haut"],
    ['deus, jesus cristo, senhor, espírito santo, filho de deus e todo-poderoso',
      'Deus, Jesus Cristo, Senhor, Espírito Santo, Filho de Deus e Todo-Poderoso'],
    ['oluwa, ọlọrun, olódùmarè, jésù, ẹmí mímọ́, chukwu, chineke, mmụọ nsọ, yesu, ruhu mai tsarki',
      'Oluwa, Ọlọrun, Olódùmarè, Jésù, Ẹmí Mímọ́, Chukwu, Chineke, Mmụọ Nsọ, Yesu, Ruhu Mai Tsarki'],
    ['神、耶稣、圣灵、主', '神、耶稣、圣灵、主'],
  ])('cases %s without changing wording or length', (input, expected) => {
    expect(capitalizeScriptureNames(input)).toBe(expected)
    expect(expected.length).toBe(input.length)
    expect(capitalizeScriptureNames(expected)).toBe(expected)
  })

  it('preserves decomposed accents, punctuation, spacing, possessives and uppercase', () => {
    const input = '«jésus», l’éternel, “god’s” love; holy\n\tspirit, jehovah‑jireh; LORD and YHWH.'
    const expected = '«Jésus», l’Éternel, “God’s” love; Holy\n\tSpirit, Jehovah‑Jireh; LORD and YHWH.'
    expect(capitalizeScriptureNames(input)).toBe(expected)
    expect(expected.length).toBe(input.length)
    expect(capitalizeScriptureNames('gods, godly, godliness, a father, his son, a broken spirit; lord it over them')).toBe(
      'gods, godly, godliness, a father, his son, a broken spirit; lord it over them',
    )
  })

  it('preserves sacred capitals in lowercase themes, and honors uppercase themes', () => {
    const text = 'PRAISE GOD, LORD JESUS, THE HOLY SPIRIT, ELOHIM AND YHWH'
    expect(formatDisplayText(text, 'lowercase')).toBe('praise God, Lord Jesus, the Holy Spirit, Elohim and YHWH')
    expect(formatDisplayText('dieu, jésus et le saint-esprit', 'uppercase')).toBe('DIEU, JÉSUS ET LE SAINT-ESPRIT')
    expect(formatDisplayText('Deus e o ESPÍRITO SANTO', 'lowercase')).toBe('Deus e o Espírito Santo')
    expect(formatDisplayText('DIOS Y EL ESPÍRITU SANTO', 'lowercase')).toBe('Dios y el Espíritu Santo')
    expect(formatDisplayText('praise the LORD and jesus')).toBe('praise the LORD and Jesus')
    expect(formatDisplayText('praise the Holy', 'lowercase')).toBe('praise the Holy')
    expect(formatDisplayText('Spirit and his Son', 'lowercase')).toBe('Spirit and his Son')
    expect(formatDisplayText('my father and his son', 'lowercase')).toBe('my father and his son')
  })

  it('keeps accented timed words and their metadata aligned', () => {
    const words = [{ w: 'espíritu', s: 0, e: 1 }, { w: 'santo', s: 1, e: 2 }]
    expect(capitalizeScriptureWords(words)).toEqual([{ w: 'Espíritu', s: 0, e: 1 }, { w: 'Santo', s: 1, e: 2 }])
    expect(words[0].w).toBe('espíritu')
  })

  it('covers restored notes without changing IDs, URLs or the stored source', () => {
    const raw = {
      id: 'god', url: 'https://example.com/jesus', title: 'the holy spirit',
      main_points: [{ point: 'trust god', explanation: 'jesús vive' }],
      definitions: [{ term: 'elohim', definition: 'dieu' }], quotes: ['jesus is lord'],
      applications: ['follow christ'], summary: 'praise the almighty',
    }
    expect(formatNoteText(raw)).toEqual({
      ...raw, title: 'the Holy Spirit',
      main_points: [{ point: 'trust God', explanation: 'Jesús vive' }],
      definitions: [{ term: 'Elohim', definition: 'Dieu' }], quotes: ['Jesus is Lord'],
      applications: ['follow Christ'], summary: 'praise the Almighty',
    })
    expect(raw.title).toBe('the holy spirit')
  })

  it('covers song cards and live announcements, including titles split across lines', () => {
    const sections = [{ label: 'Verse 1', lines: ['praise the holy', 'spirit and jesus'] }]
    expect(songCards({ id: 'god', sections })[0].lines).toEqual(['praise the Holy', 'Spirit and Jesus'])
    expect(sections[0].lines[0]).toBe('praise the holy')
    expect(formatLiveContent({ kind: 'song', title: 'jesus', label: 'Instrumental', lines: [] }).lines).toEqual([])
    expect(formatLiveContent({ kind: 'slide', title: 'god is love', body: 'jesus is lord', path: '/jesus.jpg' })).toEqual({
      kind: 'slide', title: 'God is love', body: 'Jesus is Lord', path: '/jesus.jpg',
    })
  })
})
