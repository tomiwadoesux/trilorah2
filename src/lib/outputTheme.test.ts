import { describe, expect, it } from 'vitest'
import { outputThemeSettings } from './outputTheme'

const theme = { backgroundId: 'selected-photo', dimness: 48, blur: 3, shadow: 65, font: 'default', size: 0, verseSize: 0, refGap: 0.45, layout: 'top', safeMargin: 7 }
describe('preview theme delivery', () => {
  it('sends both font choices to the projector instead of leaving its old preset active', () => {
    expect(outputThemeSettings({ ...theme, font: 'serif' }, '')).toMatchObject({
      scriptureFontPreset: 'display-serif', defaultFontFamily: 'Georgia, "Times New Roman", serif',
    })
    expect(outputThemeSettings(theme, '')).toMatchObject({
      scriptureFontPreset: 'modern-sans', defaultFontFamily: 'Roboto, Arial, sans-serif',
    })
  })
  it('transfers the actual selected picture, dimness and blur to the output', () => {
    expect(outputThemeSettings(theme, 'local-media://file/photos/sanctuary.jpg')).toMatchObject({
      defaultBackgroundUrl: 'local-media://file/photos/sanctuary.jpg', overlayOpacity: 0.48, backgroundBlur: 3,
      verseLayout: 'top', safeMargin: 7,
    })
  })
  it('leaves the fit and position Settings chose alone', () => {
    const settings = outputThemeSettings(theme, '')
    expect(settings).not.toHaveProperty('backgroundFit')
    expect(settings).not.toHaveProperty('backgroundPosition')
  })
  it('preserves centered layout and reference spacing on the projector', () => {
    expect(outputThemeSettings({ ...theme, layout: 'center', safeMargin: 10, refGap: 0.9 }, '')).toMatchObject({
      verseLayout: 'center', safeMargin: 10, refGap: 0.9,
    })
  })
  it('keeps a procedural background when the selected card has no file', () => {
    const data = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'
    expect(outputThemeSettings(theme, data).defaultBackgroundUrl).toBe(data)
  })
  it('delivers text width independently of safe margin and font sizing', () => {
    expect(outputThemeSettings({ ...theme, textWidth: 65 }, '')).toMatchObject({ textWidth: 65, safeMargin: 7, refScale: 1 })
    expect(outputThemeSettings(theme, '').textWidth).toBe(86)
  })
  it('delivers case independently of the selected font and supports older uppercase themes', () => {
    expect(outputThemeSettings({ ...theme, font: 'serif', textCase: 'lowercase' }, '').textCase).toBe('lowercase')
    expect(outputThemeSettings({ ...theme, font: 'uppercase' }, '').textCase).toBe('uppercase')
    expect(outputThemeSettings(theme, '').textCase).toBe('none')
  })
  it.each(['normal', 'tight', 'airy'] as const)('delivers %s spacing without changing font size or reference spacing', (textSpacing) => {
    expect(outputThemeSettings({ ...theme, textSpacing }, '')).toMatchObject({ textSpacing, refScale: 1, refGap: 0.45 })
    expect(outputThemeSettings(theme, '').textSpacing).toBe('normal')
  })
  it.each(['top-left', 'top-right', 'middle-left', 'middle-right'])('delivers the %s preview position to the projector', (layout) => {
    expect(outputThemeSettings({ ...theme, layout }, '').verseLayout).toBe(layout)
  })
})
