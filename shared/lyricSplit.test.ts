import { describe, it, expect } from 'vitest'
import { splitLyrics, resliceSection, estimateSyllables, slideFit, MAX_LINES } from './lyricSplit'

// Every lyric line in this file is invented. Nothing here is from a real song.
const L = (n: number, stem = 'made up line number') => Array.from({ length: n }, (_, i) => `${stem} ${i + 1}`)
const sizes = (text: string) => splitLyrics(text).map((s) => s.lines.length)
const allLines = (text: string) => splitLyrics(text).flatMap((s) => s.lines)

describe('estimateSyllables — close enough to balance a slide', () => {
  it.each([
    ['grace', 1],
    ['holy', 2],
    ['hallelujah', 4],
    ['the morning comes again', 6]
  ])('%s ≈ %i', (line, n) => {
    expect(Math.abs(estimateSyllables(line) - n)).toBeLessThanOrEqual(1)
  })
  it('counts nothing for an empty line', () => {
    expect(estimateSyllables('')).toBe(0)
  })
  it('grows with the line', () => {
    expect(estimateSyllables('river river river river')).toBeGreaterThan(estimateSyllables('river'))
  })
})

describe('splitLyrics — a block with no blank lines at all', () => {
  it('cuts eight lines into two fours', () => {
    expect(sizes(L(8).join('\n'))).toEqual([4, 4])
  })
  it('never leaves a one-line tail: five is a three and a two, never four and one', () => {
    // Which of the two comes first is the syllable balancer's call; the rule
    // the owner asked for is only that nobody is left singing a lone line.
    expect([...sizes(L(5).join('\n'))].sort()).toEqual([2, 3])
  })
  it('balances nine as three threes rather than four-four-one', () => {
    const s = sizes(L(9).join('\n'))
    expect(s.reduce((a, b) => a + b, 0)).toBe(9)
    expect(Math.min(...s)).toBeGreaterThanOrEqual(2)
    expect(Math.max(...s) - Math.min(...s)).toBeLessThanOrEqual(1)
  })
  it('leaves a short block alone', () => {
    expect(sizes(L(3).join('\n'))).toEqual([3])
    expect(sizes(L(1).join('\n'))).toEqual([1])
  })
})

describe('splitLyrics — blank lines and labels are hard breaks', () => {
  it('never merges across a blank line', () => {
    expect(sizes(`${L(2).join('\n')}\n\n${L(2, 'other stanza line').join('\n')}`)).toEqual([2, 2])
  })
  it('names sections from label lines and bracket tags', () => {
    const out = splitLyrics(`Verse 1\n${L(2).join('\n')}\n\n[Chorus]\n${L(2, 'chorus line').join('\n')}`)
    expect(out.map((s) => s.label)).toEqual(['Verse 1', 'Chorus'])
  })
  it('auto-numbers unlabeled stanzas', () => {
    const out = splitLyrics(`${L(2).join('\n')}\n\n${L(2, 'second').join('\n')}`)
    expect(out.map((s) => s.label)).toEqual(['Verse 1', 'Verse 2'])
  })
  it('gives the pieces of one long section labels that read as a sequence', () => {
    const out = splitLyrics(`Verse 1\n${L(8).join('\n')}`)
    expect(out).toHaveLength(2)
    expect(out[0].label).toContain('Verse 1')
    expect(out[1].label).toContain('Verse 1')
    expect(out[0].label).not.toBe(out[1].label)
  })
})

describe('splitLyrics — cleaning what the internet hands over', () => {
  it('drops chord lines and inline chords', () => {
    expect(allLines('G   D   Em  C\n[G]open up the [D]gates today')).toEqual(['open up the gates today'])
  })
  it('drops lyric-site furniture', () => {
    expect(allLines('Lyrics\nfirst made up line\nYou might also like\nsecond made up line\nEmbed')).toEqual([
      'first made up line',
      'second made up line'
    ])
  })
  it('takes a repeat marker off the words', () => {
    const lines = allLines('sing it out again (x2)')
    expect(lines.join(' ')).not.toMatch(/x2/i)
    expect(lines.join(' ')).toContain('sing it out again')
  })
})

describe('splitLyrics — balanced by how it is sung', () => {
  it('holds fewer long lines on a slide than short ones', () => {
    const long = 'everlasting overflowing neverending mercy carrying every weary wanderer homeward'
    const longSizes = sizes(Array(8).fill(long).join('\n'))
    const shortSizes = sizes(Array(8).fill('rise up').join('\n'))
    expect(Math.max(...longSizes)).toBeLessThan(Math.max(...shortSizes))
  })
})

describe('slideFit — the hint under each card in the editor', () => {
  it('says a normal slide fits', () => {
    expect(slideFit(L(3)).fit).toBe('fits')
  })
  it('says an overloaded slide is over', () => {
    expect(slideFit(L(9)).fit).toBe('over')
  })
  it('reports its counts', () => {
    const f = slideFit(['one two', 'three'])
    expect(f.lines).toBe(2)
    expect(f.chars).toBeGreaterThan(0)
    expect(f.syllables).toBeGreaterThan(0)
  })
})

describe('resliceSection', () => {
  it('cuts one long section without touching the words', () => {
    const lines = L(7)
    expect(resliceSection({ label: 'Bridge', lines }).flatMap((s) => s.lines)).toEqual(lines)
  })
})

describe('invariants, for every length from 1 to 40', () => {
  const cases = Array.from({ length: 40 }, (_, i) => i + 1)

  it.each(cases)('%i lines: nothing lost, nothing reordered', (n) => {
    expect(allLines(L(n).join('\n'))).toEqual(L(n))
  })
  it.each(cases)('%i lines: no slide over the limit', (n) => {
    expect(Math.max(...sizes(L(n).join('\n')))).toBeLessThanOrEqual(MAX_LINES)
  })
  it.each(cases.filter((n) => n > 1))('%i lines: no one-line tail', (n) => {
    expect(Math.min(...sizes(L(n).join('\n')))).toBeGreaterThanOrEqual(2)
  })
  it.each([3, 5, 9, 14, 23])('%i lines: splitting its own output changes nothing', (n) => {
    const once = splitLyrics(L(n).join('\n'))
    for (const s of once) expect(resliceSection(s).map((r) => r.lines)).toEqual([s.lines])
  })
})
