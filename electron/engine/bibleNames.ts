import corpus from '../data/passages/bsb-sections.json'

/**
 * Every proper name in the Bible, read off the text itself: a word the
 * translation capitalises mid-sentence and never writes in lowercase.
 * About 1,600 of them, so "Mephibosheth" is known without anyone typing it.
 *
 * Speech arrives without reliable capitals, so a name is matched in any case.
 * That makes a few everyday words dangerous ("he lost his job" is not Job),
 * and titles and festivals are capitalised without being anyone's name. Both
 * are left out below. God, Lord, Jesus and Christ are left out because they
 * are in every other sentence and identify no passage.
 */
const NOT_NAMES = new Set((
  'god lord jesus christ spirit holy father son israel israelites judah jerusalem jews jew messiah most high one ' +
  // capitalised in the text, but not a person or place
  'almighty alpha omega abyss creator dispersion emperor paradise passover protector revealer rabbi sabbath scripture scriptures selah treatise ' +
  'jubilee ingathering zealot pharisee pharisees sadducees gentile gentiles magi behemoth leviathan praetorium law amen ' +
  // everyday words, or sounds of them, when heard without capitals
  'job eve dan gad ham nun gob media mica salmon tidal tyre amok dodo ether pur pau toi tou kore lod nob pul dor on no ai ur'
).split(' '))

let names: Set<string> | undefined

export function bibleNames(): Set<string> {
  if (names) return names
  const capitalised = new Map<string, number>()
  const lowercase = new Set<string>()
  for (const section of corpus.sections as { verses: { text: string }[] }[]) {
    for (const verse of section.verses) {
      const tokens = verse.text.split(/\s+/)
      tokens.forEach((raw, i) => {
        const word = raw.replace(/[’']s$/, '').replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
        if (/^[a-z]+$/.test(word)) lowercase.add(word)
        // A sentence's first word is capitalised whatever it is.
        const opensSentence = i === 0 || /[.?!:;“”"‘’']$/.test(tokens[i - 1]) || /^[“"‘']/.test(raw)
        if (/^[A-Z][a-z]{2,}$/.test(word) && !opensSentence) capitalised.set(word, (capitalised.get(word) ?? 0) + 1)
      })
    }
  }
  names = new Set([...capitalised]
    .filter(([word, count]) => count >= 2 && !lowercase.has(word.toLowerCase()) && !NOT_NAMES.has(word.toLowerCase()))
    .map(([word]) => word.toLowerCase()))
  return names
}

/** The Bible names said in this text, lowercase, in order, once each. */
export function bibleNamesIn(text: string): string[] {
  const known = bibleNames()
  return [...new Set(text.toLowerCase().replace(/[’']s\b/g, '').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(word => known.has(word)))]
}
