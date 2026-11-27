/*
 * The KJV brace handling now lives in shared/scriptureText.ts so the main
 * process can give other apps (ProPresenter's message) the same plain text
 * the wall shows. Everything the renderer imported from here is unchanged.
 */
export { parseVerse, verseToText, type VerseSegment } from '../../shared/scriptureText';
