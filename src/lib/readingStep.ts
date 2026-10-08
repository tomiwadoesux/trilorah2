/*
 * "Next" inside a reading before "next" past it.
 *
 * A range too long for one screen goes up in pages — Jude 1:1-3 can be
 * verse 1, then 2, then 3. Next used to jump straight to the verse after
 * the range (4), so verses 2 and 3 were never shown. The page cursor has to
 * be used up first; only on the last page does next leave the reading, and
 * only on the first does previous.
 */

/** The page to move to inside the reading, or null to leave it for the neighbouring verse. */
export function readingStep(at: number, total: number, dir: 1 | -1): number | null {
  if (total <= 1) return null;
  const next = at + dir;
  return next >= 0 && next < total ? next : null;
}
