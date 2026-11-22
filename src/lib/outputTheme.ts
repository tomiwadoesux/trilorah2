import { videoSpeed, videoBass } from './backgroundPlayback'
import type { SlideTheme } from '../design/screens/slide'
import { clampTextWidth } from '../../shared/textWidth'
import { resolveTextCase } from '../../shared/textCase'
import { resolveTextSpacing } from '../../shared/textSpacing'
import { scriptureFaceForKind } from '../../shared/displayFont'
import { resolveTextAlign } from '../../shared/textPosition'

const round2 = (n: number) => Math.round(n * 100) / 100

/** The preview draws the body at (27 + size·2)/6 cqw against the wall's
    4.5vw base, so this is the one mapping between the editor's size slider
    and the wall's scale — and sizeFromScale below is it run backwards. */
export const scaleFromSize = (size: number) => round2((27 + size * 2) / 27)
export const sizeFromScale = (scale: number) => round2((scale * 27 - 27) / 2)

/**
 * Convert the preview's chosen background and controls to output settings.
 *
 * Fit and position are not here on purpose: the preview has no control for
 * either, so writing 'cover'/'center' on every push only undid what Settings →
 * Projector text had set, the moment the next verse went up.
 *
 * `facePreset` is the church's Settings → Appearance face. The theme says
 * serif or sans; the preset says WHICH serif or sans — so a push no longer
 * flattens a chosen Cormorant or Inter back to Georgia/Roboto.
 */
export function outputThemeSettings(theme: SlideTheme, backgroundUrl: string, facePreset?: unknown) {
  const face = scriptureFaceForKind(facePreset, theme.font === 'serif' ? 'serif' : 'sans')
  return {
    defaultFontFamily: face.stack,
    scriptureFontPreset: face.id,
    defaultFontSize: scaleFromSize(theme.size),
    defaultFontWeight: theme.weight ?? 600,
    textShadow: theme.shadow,
    defaultBackgroundUrl: backgroundUrl,
    overlayOpacity: theme.dimness / 100,
    backgroundBlur: theme.blur,
    backgroundVideoSpeed: videoSpeed(theme.videoSpeed),
    backgroundVideoBass: videoBass(theme.videoBass),
    backgroundVideoSound: theme.videoSound === true,
    verseLayout: theme.layout,
    textAlign: resolveTextAlign(theme.textAlign),
    safeMargin: theme.safeMargin,
    textWidth: clampTextWidth(theme.textWidth, 100 - theme.safeMargin * 2),
    textCase: resolveTextCase(theme.textCase, theme.font),
    textSpacing: resolveTextSpacing(theme.textSpacing),
    refScale: Math.max(0.28, 0.46 + theme.verseSize * 0.035) / 0.46,
    // Both renderers measure this gap in reference-line ems.
    refGap: theme.refGap,
  }
}
