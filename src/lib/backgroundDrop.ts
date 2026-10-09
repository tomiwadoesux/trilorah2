import { videoSpeed, videoBass } from './backgroundPlayback'
import { isVideoUrl, toDisplayUrl } from '../../shared/mediaUrl'
import { clampTextWidth } from '../../shared/textWidth'
import { resolveTextCase } from '../../shared/textCase'
import { resolveTextSpacing } from '../../shared/textSpacing'
import { isTextPosition } from '../../shared/textPosition'
import { outputThemeSettings } from './outputTheme'
import type { ThemeMedia } from '../design/screens/mediaLibrary'
import type { SlideTheme } from '../design/screens/slide'

/*
 * The theme has ONE background, and three places can change it.
 *
 *   the preview  what the next go live will put behind the words
 *   the wall     what is behind the words right now — defaultBackgroundUrl
 *   the LIVE box a picture of the wall, so it is read off the wall's own
 *                setting rather than remembered from the last push
 *
 * Everything here is pure so the rules can be tested without a window: which
 * drop does what, which shelf item a wall URL is, and what the wall's
 * settings say the live theme is.
 */

/**
 * "No picture at all" — the wall's empty defaultBackgroundUrl, which a fresh
 * install has and Settings' REMOVE writes. A named id rather than '' because
 * every theme check treats an empty id as "not set" and falls back to a
 * picture, and that fallback is exactly what this has to not do.
 */
export const NO_BACKGROUND = 'none'

/** The three drop targets that take a background rather than a run row. */
export const BACKGROUND_DROP_KEYS = ['media-themes', 'stage-preview', 'stage-live'] as const
export type BackgroundDropKey = (typeof BACKGROUND_DROP_KEYS)[number]

export function isBackgroundDropKey(key: string | null): key is BackgroundDropKey {
  return key !== null && (BACKGROUND_DROP_KEYS as readonly string[]).includes(key)
}

/** Photos, animated images, washes and looping videos can sit behind text. */
export function canBeBackground(media: Pick<ThemeMedia, 'kind'> | undefined): boolean {
  return !!media
}

/** Background playback must use the clip, never its library thumbnail. */
export function backgroundSrc(media: ThemeMedia, imageSrc: (media: ThemeMedia) => string): string {
  return media.kind === 'video' ? toDisplayUrl(media.url) : imageSrc(media)
}

export type BackgroundAction = 'preview' | 'live' | 'refuse'

/** Dropping on preview/themes stages a background; LIVE replaces only the backdrop. */
export function backgroundDropAction(key: BackgroundDropKey, media: Pick<ThemeMedia, 'kind'> | undefined): BackgroundAction {
  if (!media) return 'refuse'
  return key === 'stage-live' ? 'live' : 'preview'
}

/**
 * Which shelf item a wall URL is.
 *
 * The wall's setting can be file:// (Settings' own picker, every older
 * install), local-media:// (what this screen writes) or a data: wash, and the
 * shelf holds whichever its own source handed back — so both sides go through
 * toDisplayUrl before they are compared, and the item's drawn src is tried as
 * well because a wash has no url at all, only the picture it draws.
 *
 * `prefer` keeps the id this window already uses when it still matches, so a
 * picture that sits on the shelf twice does not flip between its two cards.
 * Undefined means the wall shows something the shelf has never seen.
 */
export function wallUrlToMediaId(
  url: string | null | undefined,
  library: readonly ThemeMedia[],
  srcOf: (media: ThemeMedia) => string,
  prefer?: string,
): string | undefined {
  const target = toDisplayUrl(url)
  if (!target) return NO_BACKGROUND
  const matches = (m: ThemeMedia) => canBeBackground(m) && (toDisplayUrl(m.url) === target || backgroundSrc(m, srcOf) === target)
  const preferred = prefer ? library.find((m) => m.id === prefer) : undefined
  if (preferred && matches(preferred)) return preferred.id
  return library.find(matches)?.id
}

/** FNV-1a, so a wall URL — which can be a multi-KB data: wash — gives a short
    stable id instead of being stored as one. */
export function shortHash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** A card for a wall picture the shelf has never seen — chosen in Settings,
    sent from the phone, or left by an older build — so the LIVE box can draw
    it and the operator can find it again under themes. */
export function wallBackgroundMedia(url: string): ThemeMedia {
  return {
    id: `wall:${shortHash(toDisplayUrl(url))}`,
    label: 'current background',
    detail: 'on the wall',
    seed: 0,
    style: 'smoke',
    source: 'local',
    url,
    kind: isVideoUrl(url) ? 'video' : 'photo',
    collection: 'themes',
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * The parts of a theme the wall's settings carry — outputThemeSettings run
 * backwards. Only what is present comes back, so a caller merges it over the
 * theme it has and keeps what the wall never stores (text size, shadow).
 * Rounded where the forward trip multiplies, so the same theme read back
 * compares equal instead of differing in the fifteenth decimal.
 */
export function themeFieldsFromSettings(s: Record<string, unknown>): Partial<SlideTheme> {
  const out: Partial<SlideTheme> = {}
  if (s.scriptureFontPreset === 'display-serif') out.font = 'serif'
  else if (s.scriptureFontPreset === 'modern-sans') out.font = 'default'
  if (isNumber(s.overlayOpacity)) out.dimness = round2(s.overlayOpacity * 100)
  if (isNumber(s.backgroundBlur)) out.blur = s.backgroundBlur
  if (s.backgroundVideoSpeed !== undefined) out.videoSpeed = videoSpeed(s.backgroundVideoSpeed)
  if (s.backgroundVideoBass !== undefined) out.videoBass = videoBass(s.backgroundVideoBass)
  if (s.backgroundVideoSound !== undefined) out.videoSound = s.backgroundVideoSound === true
  if (isTextPosition(s.verseLayout)) out.layout = s.verseLayout
  else if (s.verseLayout === 'bottom') out.layout = 'bottom-center'
  if (isNumber(s.safeMargin)) out.safeMargin = s.safeMargin
  if (isNumber(s.textWidth)) out.textWidth = clampTextWidth(s.textWidth)
  if (s.textCase !== undefined) out.textCase = resolveTextCase(s.textCase)
  if (s.textSpacing !== undefined) out.textSpacing = resolveTextSpacing(s.textSpacing)
  if (isNumber(s.refGap)) out.refGap = s.refGap
  if (isNumber(s.refScale)) out.verseSize = round2((s.refScale * 0.46 - 0.46) / 0.035)
  return out
}

/* Which theme field each stored setting is, for the comparison below. */
const WALL_FIELDS: ReadonlyArray<readonly [string, keyof SlideTheme]> = [
  ['scriptureFontPreset', 'font'],
  ['overlayOpacity', 'dimness'],
  ['backgroundBlur', 'blur'],
  ['backgroundVideoSpeed', 'videoSpeed'],
  ['backgroundVideoBass', 'videoBass'],
  ['backgroundVideoSound', 'videoSound'],
  ['verseLayout', 'layout'],
  ['safeMargin', 'safeMargin'],
  ['textWidth', 'textWidth'],
  ['textCase', 'textCase'],
  ['textSpacing', 'textSpacing'],
  ['refGap', 'refGap'],
  ['refScale', 'verseSize'],
]

const agrees = (a: unknown, b: unknown) =>
  isNumber(a) && isNumber(b) ? Math.abs(a - b) < 1e-9 : a === b

/**
 * The live theme the wall's settings describe, on top of the one in hand.
 *
 * Only what the wall actually DISAGREES with is taken from it. The trip out
 * is lossy — the 'uppercase' font is stored as plain sans plus a case, an
 * unset case is stored resolved, a width is stored clamped — so reading
 * every field back would hand the LIVE box a theme that says the same thing
 * in other words, and it would repaint a verse people are reading for
 * nothing every time a setting was written. A field whose own trip out
 * lands on the stored value is left exactly as it is.
 */
export function liveThemeFromSettings<T extends SlideTheme>(settings: Record<string, unknown>, current: T, backgroundId: string): T {
  const read = themeFieldsFromSettings(settings)
  const mine = outputThemeSettings(current, '') as Record<string, unknown>
  const taken: Record<string, unknown> = {}
  for (const [key, field] of WALL_FIELDS) {
    if (!(field in read) || agrees(mine[key], settings[key])) continue
    taken[field] = read[field]
  }
  return { ...current, ...(taken as Partial<SlideTheme>), backgroundId }
}

/** Keep the chosen background, or fall back within the themes shelf. */
export function backgroundFor(id: string, library: readonly ThemeMedia[]): ThemeMedia | undefined {
  if (id === NO_BACKGROUND) return undefined
  const chosen = library.find((m) => m.id === id)
  if (chosen && canBeBackground(chosen)) return chosen
  return library.find((m) => canBeBackground(m) && (m.collection ?? 'themes') === 'themes')
}

/** The bits of the projector's state a notice needs to tell the truth. */
export interface WallState {
  screen: 'live' | 'clear' | 'black' | 'logo'
  live: { source: string; mediaKind?: string } | null
  /** From getOutputsStatus; undefined when there is no engine to ask. */
  outputs?: ReadonlyArray<{ role: string; open: boolean; disabled?: boolean }>
}

const FULL_BLEED = (item: { source: string } | null) => !!item && (item.source === 'media' || item.source === 'presentation')

/**
 * What to tell the operator after a background went on the wall.
 *
 * A background is only seen behind words, so the times nobody will see the
 * change are said out loud — a drop that "does nothing" because the screen
 * is black reads exactly like a drop that is broken.
 */
export function liveBackgroundNotice({ screen, live, outputs }: WallState): string {
  if (screen === 'black') return 'set — the screen is black, so it shows when you bring it back'
  if (screen === 'logo') return 'set — the logo is up, so it shows when you take it down'
  if (screen === 'live' && FULL_BLEED(live)) return 'set — a picture is up, so it shows behind the next words'
  if (outputs) {
    const open = outputs.filter((o) => o.open && !o.disabled)
    if (!open.length) return 'set — no projector window is open, so it shows when one is'
    /* Only the projector and the stage paint a background: the stream is
       keyed over video and wants alpha, and the timer is a clock. */
    if (!open.some((o) => o.role === 'projector' || o.role === 'stage')) return 'set — the stream never shows a background'
  }
  return screen === 'live' && live && live.source !== 'background' ? 'on the wall now — the words stay' : 'on the wall now'
}

/**
 * What to tell the operator after a background went into the preview, ending
 * on how to put it on the wall now from where they are: a double-click on a
 * card, a drop on the LIVE box, or — from the online tab, which has neither —
 * the card it just became in media › themes.
 */
export function previewBackgroundNotice(preview: { source: string } | null, how: 'click' | 'drop' | 'pick'): string {
  const now =
    how === 'click' ? 'double-click to put it on the wall now'
    : how === 'drop' ? 'drop it on live to put it on the wall now'
    : 'double-click it in media › themes to put it on the wall now'
  if (FULL_BLEED(preview)) return `in preview, behind words — not behind the picture staged there · ${now}`
  return `in preview — goes up with the next go live · ${now}`
}

/** A clip asked to be a background. */


/** Shallow, so a settings read that changes nothing re-renders nothing. */
export function sameTheme(a: object, b: object): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  return ak.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k])
}
