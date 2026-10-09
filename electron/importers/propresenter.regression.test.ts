import { describe, expect, it } from 'vitest'
import { pb } from './fixtures'
import { parsePro, parsePro6, parseProPlaylist } from './propresenter'

// Original text encoded using field meanings from the public 7.16.2 descriptors:
// https://github.com/greyshirtguy/ProPresenter7-Proto/tree/master/Proto7.16.2
const id = (value: string) => pb([1, value])
const textAction = (text: string | Buffer, enabled = true) => pb(...(enabled ? [[6, 1] as [number, number]] : []),
  [23, pb([2, pb([1, pb([1, pb([1, pb([13, pb([5, typeof text === 'string' ? `{\\rtf1 ${text}}` : text])])])])])])])
const cue = (name: string, actions: Buffer[], enabled = true) => pb([1, id(name)], [2, name],
  ...(enabled ? [[12, 1] as [number, number]] : []), ...actions.map(value => [10, value] as [number, Buffer]))
const presentation = (cues: Buffer[], extra: Array<[number, Buffer | string | number]> = []) => pb(
  [2, id('presentation')], [3, 'Original test'], ...cues.map(value => [13, value] as [number, Buffer]), ...extra)

describe('ProPresenter authored content regressions', () => {
  it('does not turn disabled slides and actions into active imported lyrics', () => {
    const result = parsePro(presentation([
      cue('Visible', [textAction('Shown'), textAction('Disabled action', false)]),
      cue('Disabled cue', [textAction('Hidden slide')], false),
      cue('No enabled actions', [textAction('Also hidden', false)]),
    ]), 'test.pro')
    expect(result.slides.map(slide => slide.text)).toEqual(['Shown'])
    expect(result.warnings.some(value => /disabled/i.test(value))).toBe(true)
  })

  it('decodes protobuf RTF byte fields without losing legacy or Unicode text', () => {
    const result = parsePro(presentation([
      cue('Legacy bytes', [textAction(Buffer.from('{\\rtf1\\ansicpg1252 Caf\xe9}', 'latin1'))]),
      cue('UTF8 bytes', [textAction(Buffer.from('{\\rtf1\\ansicpg65001 日本語}'))]),
    ]), 'test.pro')
    expect(result.slides.map(slide => slide.text)).toEqual(['Café', '日本語'])
  })

  it('preserves artist credits when the author field is absent', () => {
    const result = parsePro(presentation([cue('Verse', [textAction('Original verse')])], [[14, pb([2, 'Test artist'])]]), 'test.pro')
    expect(result.authors).toEqual(['Test artist'])
  })

  it('omits hidden playlist items with a review warning', () => {
    const item = (name: string, hidden = false) => pb([1, id(name)], [2, name], [9, hidden ? 1 : 0], [4, pb([1, pb([2, `${name}.pro`])])])
    const result = parseProPlaylist(pb([1, id('playlist')], [2, 'Service'], [3, 1], [13, pb([1, item('Shown')], [1, item('Hidden', true)])]))
    expect(result.items.map(value => value.label)).toEqual(['Shown'])
    expect(result.warnings.some(value => /hidden/i.test(value))).toBe(true)
  })

  it('preserves Pro6 text, publisher credits and enabled slide order', () => {
    const encoded = Buffer.from('First line\nSecond line').toString('base64')
    const result = parsePro6(`<RVPresentationDocument name="Love > fear" CCLIPublisher="Test publisher" CCLICopyrightYear="2026">
      <RVSlideGrouping name="Verse"><RVDisplaySlide enabled="true"><RVTextElement><NSString rvXMLIvarName="PlainText">${encoded}</NSString></RVTextElement></RVDisplaySlide>
      <RVDisplaySlide enabled="false"><RVTextElement><NSString rvXMLIvarName="PlainText">${encoded}</NSString></RVTextElement></RVDisplaySlide></RVSlideGrouping>
    </RVPresentationDocument>`, 'test.pro6')
    expect(result.title).toBe('Love > fear')
    expect(result.copyright).toBe('2026 Test publisher')
    expect(result.slides).toHaveLength(1)
    expect(result.slides[0].text).toBe('First line\nSecond line')
  })
})
