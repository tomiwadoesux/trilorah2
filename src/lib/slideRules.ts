import { PAGE_WORDS } from '../../shared/verseDisplay';

/*
 * How a reading becomes slides.
 *
 * These are the renderer-facing options, and they are deliberately NOT the
 * app's saved projector settings: the sandbox has no business rewriting a
 * church's configuration to draw its own preview. One verse per slide with
 * the reference on it is the arrangement a Bible study wants — the reading
 * is walked verse by verse and every slide has to say where it is, because
 * people arrive late and look up.
 *
 * Kept out of engine.tsx so a plain module (publishLiveItem) can slice a
 * reading the same way without importing the whole engine provider.
 */
export const SLIDE_RULES = {
  breakOnVerse: true,
  showVerseNumbers: false,
  referenceMode: 'each' as const,
  showTranslation: false,
  maxCharsPerSlide: 240,
  /* A range together is pages of whole verses past this, so it can be read
     on a TV — the same number the wall pages by (src/output.tsx). */
  maxWordsPerSlide: PAGE_WORDS,
};

/**
 * "Verse four and five" means show four and five — together (owner,
 * 2026-10-07: "Genesis 3 verse 3-5 should show 3-5", and 3-7 likewise).
 *
 * A range is one slide. Fitting it is the screen's job, not a word count's:
 * the wall and the preview shrink the words until they fit, to half size at
 * most, and past that end them with "…" (lib/useFitText). Before, a range
 * past TIGHT_WORDS was walked verse by verse — which is why 3-5 showed 3.
 * Apart is still the operator's to choose, with the preview's
 * together/apart control (`together` false).
 */
export function fitRules(verses: { text: string }[], together?: boolean) {
  const keep = together ?? verses.length > 1;
  return { ...SLIDE_RULES, breakOnVerse: !keep, showVerseNumbers: keep && verses.length > 1 };
}
