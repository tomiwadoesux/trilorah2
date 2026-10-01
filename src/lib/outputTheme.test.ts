import { describe, expect, it } from 'vitest'
import { outputThemeSettings } from './outputTheme'

const theme = { backgroundId: 'selected-photo', dimness: 48, blur: 3, shadow: 65, font: 'default', size: 0, verseSize: 0, refGap: 0.45, layout: 'top', safeMargin: 7 }
describe('preview theme delivery', () => {
  it('transfers the actual selected picture, dimness and blur to the output', () => {
    expect(outputThemeSettings(theme, 'local-media://file/photos/sanctuary.jpg')).toMatchObject({
      defaultBackgroundUrl: 'local-media://file/photos/sanctuary.jpg', overlayOpacity: 0.48, backgroundBlur: 3,
      backgroundFit: 'cover', backgroundPosition: 'center', verseLayout: 'top', safeMargin: 7,
    })
  })
  it('keeps a procedural background when the selected card has no file', () => {
    const data = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'
    expect(outputThemeSettings(theme, data).defaultBackgroundUrl).toBe(data)
  })
})
