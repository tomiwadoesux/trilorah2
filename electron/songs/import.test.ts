import { describe, it, expect } from 'vitest'
import { parseChordPro, parsePlainText, parseOpenLyrics, detectFormat, stripChords } from './import'

const SONGSELECT = `{title: Amazing Grace (My Chains Are Gone)}
{artist: Chris Tomlin | John Newton | Louie Giglio}
{ccli: 4768151}
{copyright: 2006 sixsteps Music}
{key: D}

{c:Verse 1}
A[D]mazing grace how [G]sweet the [D]sound
That saved a [Bm]wretch like [A]me

{c:Chorus}
My [G]chains are gone, I've been set [D]free
My God, my Savior has [A]ransomed me

{c:Verse 2}
'Twas grace that [D]taught my heart to fear
`

describe('stripChords', () => {
  it('removes bracketed chords and tidies spacing', () => {
    expect(stripChords('A[D]mazing  [G]grace')).toBe('Amazing grace')
  })
})

describe('parseChordPro', () => {
  it('parses a SongSelect export', () => {
    const song = parseChordPro(SONGSELECT)
    expect(song.title).toBe('Amazing Grace (My Chains Are Gone)')
    expect(song.ccliNumber).toBe('4768151')
    expect(song.authors).toEqual(['Chris Tomlin', 'John Newton', 'Louie Giglio'])
    expect(song.copyright).toBe('2006 sixsteps Music')
    expect(song.sections.map((s) => s.label)).toEqual(['Verse 1', 'Chorus', 'Verse 2'])
    expect(song.sections[0].lines).toEqual(['Amazing grace how sweet the sound', 'That saved a wretch like me'])
    expect(song.sections[1].lines[0]).toBe("My chains are gone, I've been set free")
  })

  it('handles {t:} and {soc}/{eoc} with blank lines inside the chorus', () => {
    const song = parseChordPro(`{t:Test Song}\n\nLine one\nLine two\n\n{soc}\nChorus a\n\nChorus b\n{eoc}\n\nVerse 2\nBack again\n`)
    expect(song.title).toBe('Test Song')
    expect(song.sections.map((s) => s.label)).toEqual(['Verse 1', 'Chorus', 'Verse 2'])
    expect(song.sections[1].lines).toEqual(['Chorus a', 'Chorus b'])
    expect(song.sections[2].lines).toEqual(['Back again'])
  })

  it('ignores # comments and tab blocks', () => {
    const song = parseChordPro(`# comment\n{title: X}\n{sot}\ne|---0---|\n{eot}\nHello\n`)
    expect(song.sections).toEqual([{ label: 'Verse 1', lines: ['Hello'] }])
  })
})

describe('parsePlainText', () => {
  it('uses a lone first line as the title and splits on blank lines', () => {
    const song = parsePlainText(`How Great Thou Art\n\nO Lord my God\nWhen I in awesome wonder\n\nChorus\nThen sings my soul\n`)
    expect(song.title).toBe('How Great Thou Art')
    expect(song.sections).toEqual([
      { label: 'Verse 1', lines: ['O Lord my God', 'When I in awesome wonder'] },
      { label: 'Chorus', lines: ['Then sings my soul'] }
    ])
  })

  it('does not treat a multi-line first block as a title', () => {
    const song = parsePlainText(`Line a\nLine b\n\nLine c\n`)
    expect(song.title).toBe('Line a')
    expect(song.sections.length).toBe(2)
  })
})

describe('parseOpenLyrics', () => {
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.8">
  <properties>
    <titles><title>Amazing Grace</title></titles>
    <authors><author>John Newton</author><author type="music">Traditional</author></authors>
    <copyright>Public Domain</copyright>
    <ccliNo>22025</ccliNo>
  </properties>
  <lyrics>
    <verse name="v1"><lines>Amazing grace<br/>how sweet the sound<chord name="G"/></lines></verse>
    <verse name="c"><lines>Praise &amp; glory</lines><lines>Second lines</lines></verse>
  </lyrics>
</song>`
  it('parses properties and verses', () => {
    const song = parseOpenLyrics(XML)
    expect(song.title).toBe('Amazing Grace')
    expect(song.authors).toEqual(['John Newton', 'Traditional'])
    expect(song.ccliNumber).toBe('22025')
    expect(song.copyright).toBe('Public Domain')
    expect(song.sections).toEqual([
      { label: 'Verse 1', lines: ['Amazing grace', 'how sweet the sound'] },
      { label: 'Chorus', lines: ['Praise & glory', 'Second lines'] }
    ])
  })
})

describe('detectFormat', () => {
  it('detects by extension and content', () => {
    expect(detectFormat('', 'song.xml')).toBe('openlyrics')
    expect(detectFormat('<song xmlns="http://openlyrics.info/namespace/2009/song">')).toBe('openlyrics')
    expect(detectFormat('', 'song.cho')).toBe('chordpro')
    expect(detectFormat(SONGSELECT)).toBe('chordpro')
    expect(detectFormat('A[G]mazing grace')).toBe('chordpro')
    expect(detectFormat('Just lyrics\n\nMore lyrics', 'song.txt')).toBe('plaintext')
  })
})
