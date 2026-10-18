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

/** Keep short ranges together; longer readings use pages of whole verses.
 * The preview and wall fit every word of each page without truncation.
 */
export function fitRules(verses: { text: string }[], together?: boolean) {
  const keep = together ?? verses.length > 1;
  return { ...SLIDE_RULES, breakOnVerse: !keep, showVerseNumbers: keep && verses.length > 1 };
}
