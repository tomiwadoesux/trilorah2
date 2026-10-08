/*
 * How much room the "find scripture" answers have, and so how they are laid out.
 *
 * The answers are drawn over the preview's picture band (scriptureFind.css),
 * and that band changes shape under them: a raised library or a short window
 * takes height away, and the band of a raised library is about 3.5 times wider
 * than it is tall at EVERY window width, because the stage derives its height
 * from its width. Height alone is therefore the wrong test. The card's type
 * scales with the band's width (cqw) up to its px caps, so a wide, short band
 * — a maximised 1080p window with the library raised — has full-size type in
 * rows too short for it, and a height-only rule picked the roomy layout there
 * and cut the second line of verse text in half.
 *
 *   full     2×2 cards: reference, title line, two lines of text
 *            (four when one or two answers have the band to themselves)
 *   compact  3-4 cards: no title line, one line of text
 *   tight    two cards to a page, side by side, no title line; ‹ › for the rest
 *   micro    as tight, one line of text, slimmer cards
 *
 * w and h are the veil's CONTENT box, in CSS pixels.
 */

export type FindTier = 'full' | 'compact' | 'tight' | 'micro';

export function findTier(w: number, h: number): FindTier {
  /* Nothing measured yet (the first frame, a collapsed pane): the roomy
     layout, which the first real measurement corrects before paint. */
  if (!(w > 0) || !(h > 0)) return 'full';
  if (h < 100) return 'micro';
  if (h < 130 || w / h > 4.4) return 'tight';
  if (h < 180 || w / h > 2.6) return 'compact';
  return 'full';
}

/* The finder returns at most four passages, so four to a page is one page;
   the narrow tiers show two at a time and page with ‹ › and ← →, which keeps
   every card reachable without a hidden sideways scroll. */
export const perPageFor = (tier: FindTier) => (tier === 'tight' || tier === 'micro' ? 2 : 4);
