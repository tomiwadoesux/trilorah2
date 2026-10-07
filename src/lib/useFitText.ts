import { useLayoutEffect, type RefObject } from 'react';

/**
 * The smallest the words may be drawn, as a share of the size the church
 * set. Three quarters: the screens are TVs across a room, and at half size
 * a reading could not be read (owner, 2026-10-07). A reading that would need
 * smaller is paged instead (shared/verseDisplay pageVerses), so this floor
 * is reached only by a theme set very large or one very long verse.
 */
export const FIT_FLOOR = 0.75;

/**
 * Words that fit their box (owner, 2026-10-07: Matthew 9:27-29 ran off the
 * top of the live screen).
 *
 * A reading is drawn at the size the church chose. When it is too tall for
 * its box it shrinks — every line together, never one line on its own —
 * until it fits, but never below FIT_FLOOR of that size. A reading too long
 * even then is cut at the last line that fits and ends in "…".
 *
 * The size is found by trying it — a short binary search over real layouts,
 * before the frame is painted — and tried again whenever the box changes
 * size or a web font arrives, since a font that lands late wraps the words
 * differently.
 *
 * `--fit` is set on `content` for the stylesheet to multiply into the body's
 * font size (the reference keeps its own size). The cut is made on the
 * element marked `data-fit-body` inside it: the primary words, never the
 * reference. Everything here is written straight to the elements, outside
 * React's styles, so a re-render does not undo it.
 */
export function useFitText(
  box: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  key: string,
  floor = FIT_FLOOR,
): void {
  useLayoutEffect(() => {
    const frame = box.current;
    const words = content.current;
    if (!frame || !words) return;
    const CLAMP = ['display', '-webkit-box-orient', '-webkit-line-clamp', 'overflow'];

    const fit = () => {
      const body = words.querySelector<HTMLElement>('[data-fit-body]');
      if (body) for (const p of CLAMP) body.style.removeProperty(p);
      const room = frame.clientHeight;
      if (room <= 0) return;
      const fits = () => words.scrollHeight <= room + 1;

      words.style.setProperty('--fit', '1');
      if (fits()) return;

      words.style.setProperty('--fit', String(floor));
      if (!fits()) {
        /* Too long even at the floor: keep the floor, and cut the body at
           the last whole line the room holds after everything else. */
        if (!body) return;
        const style = getComputedStyle(body);
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.35;
        const others = words.scrollHeight - body.scrollHeight;
        const lines = Math.max(1, Math.floor((room - others) / lineHeight));
        body.style.setProperty('display', '-webkit-box');
        body.style.setProperty('-webkit-box-orient', 'vertical');
        body.style.setProperty('-webkit-line-clamp', String(lines));
        body.style.setProperty('overflow', 'hidden');
        return;
      }

      let lo = floor;
      let hi = 1;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        words.style.setProperty('--fit', String(mid));
        if (fits()) lo = mid;
        else hi = mid;
      }
      words.style.setProperty('--fit', String(lo));
    };

    fit();
    /* The box is sized by the screen, not by the words, so watching it
       cannot feed back on itself. */
    const watch = new ResizeObserver(() => fit());
    watch.observe(frame);
    let alive = true;
    void document.fonts?.ready.then(() => { if (alive) fit(); });
    return () => {
      alive = false;
      watch.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, floor]);
}
