/*
 * The verse list's reference column.
 *
 * It is as wide as the longest reference in the chapter on screen — so
 * "Jude 1:5" does not sit in a column cut for "Deuteronomy 32:52" — but
 * never narrower than its own header, and never wider than a cap. A
 * reference past the cap ("Song of Solomon 8:14", "1 Thessalonians 5:28")
 * loses the end of its BOOK name to an ellipsis and keeps its numbers:
 * every row in a chapter has the same book, so cutting the numbers would
 * leave a column of identical "Song of Sol…" with nothing to tell the rows
 * apart.
 */

/** How many times the text size the column may grow to before the book name gives way. */
export const REFERENCE_CAP_EMS = 9;

/** "Song of Solomon 8:14" → book "Song of Solomon", place "8:14". */
export function splitReference(ref: string): { book: string; place: string } {
  const m = ref.match(/^(.*\S)\s+(\d+(?::\d+(?:-\d+)?)?)$/);
  return m ? { book: m[1], place: m[2] } : { book: ref, place: '' };
}

/**
 * The column's width in px: the widest reference, held between the header's
 * own width (floor) and the cap. The floor wins if the two cross, so the
 * header word is never cut.
 */
export function referenceColumnWidth(refWidths: readonly number[], floor: number, cap: number): number {
  const widest = refWidths.length ? Math.max(...refWidths) : 0;
  return Math.ceil(Math.max(floor, Math.min(cap, widest)));
}

/**
 * When the chapter's references pass the cap, how wide the BOOK part may be
 * on every row — the column less the widest set of numbers — so the whole
 * chapter is cut at the same letter. Without it "1 Thessalonians 5:9" fits
 * whole while "5:10" below it does not, and the column reads ragged. Null
 * when nothing needs cutting.
 */
export function bookAllowance(column: number, refWidths: readonly number[], placeWidths: readonly number[]): number | null {
  const widest = refWidths.length ? Math.max(...refWidths) : 0;
  if (widest <= column) return null;
  return Math.max(0, Math.floor(column - Math.max(0, ...placeWidths)));
}
