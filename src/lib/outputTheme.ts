import type { SlideTheme } from '../design/screens/slide'

/** Convert the preview's chosen background and controls to output settings. */
export function outputThemeSettings(theme: SlideTheme, backgroundUrl: string) {
  return {
    defaultBackgroundUrl: backgroundUrl,
    overlayOpacity: theme.dimness / 100,
    backgroundBlur: theme.blur,
    backgroundFit: 'cover',
    backgroundPosition: 'center',
    verseLayout: theme.layout,
    safeMargin: theme.safeMargin,
    refScale: Math.max(0.28, 0.46 + theme.verseSize * 0.035) / 0.46,
    refGap: (theme.refGap / 0.45) * 2,
  }
}
