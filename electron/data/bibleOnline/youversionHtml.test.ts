import { describe, expect, it } from 'vitest'
import { versesFromPassageHtml } from './youversionHtml'

/* Invented words in the Platform's passage markup — never real Bible text. */
const v = (n: number | string) => `<span class="yv-v" v="${n}"></span><span class="yv-vlbl">${n}</span>`

describe('versesFromPassageHtml', () => {
  it('splits a chapter at the verse markers and drops the printed numbers', () => {
    const html = `<div><div class="p">${v(1)}Alpha words here. ${v(2)}Beta words follow.</div></div>`
    expect(versesFromPassageHtml(html)).toEqual([
      { verse: 1, text: 'Alpha words here.' },
      { verse: 2, text: 'Beta words follow.' },
    ])
  })

  it('keeps a verse together across poetry lines and paragraphs', () => {
    const html = `<div class="q1">${v(3)}First line of gamma</div><div class="q2">second line of gamma;</div>` +
      `<div class="p">and a new paragraph of gamma.</div><div class="q1">${v(4)}Delta.</div>`
    expect(versesFromPassageHtml(html)).toEqual([
      { verse: 3, text: 'First line of gamma second line of gamma; and a new paragraph of gamma.' },
      { verse: 4, text: 'Delta.' },
    ])
  })

  it('drops headings, psalm titles, acrostic lines and nested footnotes', () => {
    const html =
      '<div class="d">An invented title before verse one</div>' +
      `<div class="s1 yv-h">Invented heading</div><div class="p">${v(1)}Epsilon` +
      '<span class="yv-n f"><span class="fr">1:1 </span><span class="ft">An invented <i>note</i>.</span></span>' +
      ' continues.</div><div class="qa">ALEPH</div>' +
      `<div class="p">${v(2)}Zeta<span class="note x"><span class="xt">Invented 1:2</span></span>.</div>`
    expect(versesFromPassageHtml(html)).toEqual([
      { verse: 1, text: 'Epsilon continues.' },
      { verse: 2, text: 'Zeta.' },
    ])
  })

  it('decodes entities and tidies the spacing a congregation would see', () => {
    const html = `<div class="p">${v(5)}Eta&#8217;s &ldquo;words&rdquo;&nbsp;&amp; more &#x2014; then <span class="wj">quoted </span> , end.</div>`
    expect(versesFromPassageHtml(html)).toEqual([{ verse: 5, text: 'Eta’s “words” & more — then quoted, end.' }])
  })

  it('reads a joined verse ("16-17") as its first number and leaves an omitted one absent', () => {
    const html = `<div class="p">${v('16-17')}Theta joined. ${v(19)}Iota after a gap.</div>`
    expect(versesFromPassageHtml(html)).toEqual([
      { verse: 16, text: 'Theta joined.' },
      { verse: 19, text: 'Iota after a gap.' },
    ])
  })

  it('returns nothing for markup with no verse markers or only empty verses', () => {
    expect(versesFromPassageHtml('<div class="p">No markers at all.</div>')).toEqual([])
    expect(versesFromPassageHtml(`<div>${v(1)}<span class="yv-n f">only a note</span></div>`)).toEqual([])
  })

  it('survives self-closing tags, comments and a stray angle bracket', () => {
    const html = `<!-- c --><div class="p">${v(1)}Kappa<br/>line<br />two 3 < 4.</div>`
    expect(versesFromPassageHtml(html)).toEqual([{ verse: 1, text: 'Kappa line two 3 < 4.' }])
  })
})
