import { describe, expect, it } from 'vitest'
import { readXml, rtfText } from './text'

describe('interchange text regressions', () => {
  it('preserves Cocoa RTF backslash-newline paragraph breaks', () => {
    expect(rtfText('{\\rtf1 First line\\\nSecond line\\\r\nThird line}')).toBe('First line\nSecond line\nThird line')
  })

  it('decodes raw RTF bytes using the declared code page', () => {
    const rtf = Buffer.from('{\\rtf1\\ansi\\ansicpg1252 Caf\xe9}', 'latin1')
    expect(rtfText(rtf)).toBe('Café')
  })

  it('counts Unicode fallback bytes before decoding multibyte characters', () => {
    expect(rtfText(String.raw`{\rtf1\ansi\ansicpg932\uc2\u12354\'82\'a0X}`)).toBe('あX')
    expect(rtfText(String.raw`{\rtf1\ansi\ansicpg932\'82\'a0}`)).toBe('あ')
  })

  it('ends Unicode fallback skipping at a group boundary', () => {
    expect(rtfText(String.raw`{\rtf1{\uc2\u945?}Visible}`)).toBe('αVisible')
  })

  it('preserves the direction of curly quotation marks', () => {
    expect(rtfText(String.raw`{\rtf1\lquote word\rquote\ldblquote word\rdblquote}`)).toBe('‘word’“word”')
  })

  it('reads greater-than signs inside quoted XML attributes', () => {
    expect(readXml('<presentation name="Love > fear" notes=\'1 > 0\'><slide/></presentation>').attrs)
      .toEqual({ name: 'Love > fear', notes: '1 > 0' })
  })

  it.each([
    '<a name="one" name="two"/>', '<a name=unquoted/>', '<a>before &unknown; after</a>',
    '<a>&#0;</a>', '<a>&#xD800;</a>', '<a>&AMP;</a>', 'outside<a/>', '<a/>outside',
  ])('rejects malformed XML instead of silently changing its content: %s', xml => {
    expect(() => readXml(xml)).toThrow()
  })
})
