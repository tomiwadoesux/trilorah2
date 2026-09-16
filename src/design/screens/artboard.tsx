import { createContext, useContext } from 'react';
import { tierForWidth, type Density } from '../../ui/density';

/*
 * Artboard size — the window the app is actually running in.
 *
 * A screen is not one size. The same LIVE layout has to survive a 13"
 * laptop in a back room and a 27" desktop in a proper booth, and the two
 * fail in opposite directions: the small one runs out of width for the
 * three columns, the large one lets scripture run to a line length nobody
 * can read. Neither shows up on a single fixed artboard, so the size is a
 * control rather than a constant.
 *
 * These are *window* sizes, not screen sizes — what the app gets after the
 * OS takes its share. "this display" is the exception: it is the machine
 * you are sitting at, which is what the app gets when it is fullscreen.
 */

/* The same three tiers tokens.css defines — aliased rather than restated so
   the sandbox and the app cannot drift apart on what a tier is. */
export type ArtboardTier = Density;

export interface ArtboardSize {
  id: string;
  label: string;
  w: number;
  h: number;
  /** Shown in the title attribute — why this size is in the list. */
  note: string;
  /**
   * The density tier this window size naturally pairs with — the tier notes
   * in tokens.css are written in terms of devices, and these are devices.
   * Picking a size adopts its tier as the DEFAULT; the tier control still
   * overrides it, because "big window, small controls" is a real question
   * the sandbox exists to ask. Without this default, every size was judged
   * at comfortable — which is why 2560 always read as tiny type and 1280
   * as oversized chrome.
   */
  tier: ArtboardTier;
  /**
   * The app owns the whole display, so it has no edges of its own — the
   * window corner and the drop shadow are what say "this is a window on a
   * canvas", and fullscreen is not on a canvas.
   */
  full?: boolean;
}

export const SIZES: ArtboardSize[] = [
  { id: 'default', label: 'default', w: 1400, h: 900, tier: 'comfortable', note: 'The size createWindow() opens at — what most people see on first run' },
  { id: 'air13', label: '13" laptop', w: 1280, h: 800, tier: 'compact', note: 'MacBook Air 13" maximised — the smallest machine a church is likely to run this on' },
  { id: 'mbp14', label: '14" macbook', w: 1512, h: 982, tier: 'comfortable', note: 'MacBook Pro 14" maximised' },
  { id: 'mbp16', label: '16" macbook', w: 1728, h: 1117, tier: 'comfortable', note: 'MacBook Pro 16" maximised' },
  { id: 'fhd', label: 'desktop 1080p', w: 1920, h: 1080, tier: 'touch', note: 'The commonest desktop and projector-booth resolution — read at arm\'s length, often standing' },
  { id: 'qhd', label: 'desktop 1440p', w: 2560, h: 1440, tier: 'touch', note: 'A 27" desktop — where line length starts to be the problem, not width' },
];

/* The tier a window of this width naturally reads at — same mapping the
   fixed SIZES use, for sizes that arrive as bare numbers (this display,
   fullscreen). Defined in ui/density.ts — outside the design tree — because
   it is a fact about window sizes rather than about the sandbox, and the app
   will need the same rule when it adopts the token system. Re-exported here
   so the artboard callers below read as one module. */
export { tierForWidth };

/**
 * The machine you are on, appended live.
 *
 * Computed rather than listed because the only honest answer to "how does
 * this look fullscreen" is the resolution of the display in front of you.
 */
export function displaySize(): ArtboardSize {
  const w = Math.round(window.screen.width);
  const h = Math.round(window.screen.height);
  return {
    id: 'display',
    label: 'this display',
    w,
    h,
    tier: tierForWidth(w),
    note: `Fullscreen on the display you are using right now — ${w} × ${h}`,
  };
}

export function allSizes(): ArtboardSize[] {
  const display = displaySize();
  // Do not list the same geometry twice under two names.
  const dupe = SIZES.some((s) => s.w === display.w && s.h === display.h);
  return dupe ? SIZES : [...SIZES, display];
}

const ArtboardContext = createContext<ArtboardSize>(SIZES[0]);

export const ArtboardProvider = ArtboardContext.Provider;

/**
 * The size the screen is being drawn at.
 *
 * Screens read this instead of taking a prop, so adding a screen never
 * means remembering to thread the size through it — a screen that ignored
 * it would silently go back to being fixed-size.
 */
export function useArtboard(): ArtboardSize {
  return useContext(ArtboardContext);
}
