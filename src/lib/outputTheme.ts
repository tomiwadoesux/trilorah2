import type { SlideTheme } from '../design/screens/slide'
import { clampTextWidth } from '../../shared/textWidth'
import { resolveTextCase } from '../../shared/textCase'
import { resolveTextSpacing } from '../../shared/textSpacing'
import { displayFontFamily } from '../../shared/displayFont'

/**
 * Convert the preview's chosen background and controls to output settings.
 *
 * Fit and position are not here on purpose: the preview has no control for
 * either, so writing 'cover'/'center' on every push only undid what Settings →
 * Projector text had set, the moment the next verse went up.
 */
export function outputThemeSettings(theme: SlideTheme, backgroundUrl: string) {
  return {
    defaultFontFamily: displayFontFamily(theme.font),
    scriptureFontPreset: theme.font === 'serif' ? 'display-serif' : 'modern-sans',
    defaultBackgroundUrl: backgroundUrl,
    overlayOpacity: theme.dimness / 100,
    backgroundBlur: theme.blur,
    verseLayout: theme.layout,
    safeMargin: theme.safeMargin,
    textWidth: clampTextWidth(theme.textWidth, 100 - theme.safeMargin * 2),
    textCase: resolveTextCase(theme.textCase, theme.font),
    textSpacing: resolveTextSpacing(theme.textSpacing),
    refScale: Math.max(0.28, 0.46 + theme.verseSize * 0.035) / 0.46,
    // Both renderers measure this gap in reference-line ems.
    refGap: theme.refGap,
  }
}
