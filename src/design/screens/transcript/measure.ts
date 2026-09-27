import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Word } from './words';

/*
 * Laying the transcript out ourselves, so line breaks are OURS.
 *
 * A paragraph left to the browser re-wraps from its first word every time
 * the text changes, and a transcript changes at both ends: words arrive at
 * the end, old ones fall off the front. The moment one falls off, every
 * line below it re-wraps and the line being read jumps. So the designs that
 * show more than one line wrap the words themselves — greedily, from a
 * start word they hold still — and a line that has been laid out keeps its
 * words.
 *
 * Widths come from a canvas in the strip's own computed font, which is
 * exact for text with no letter-spacing (the D-27 designs use none). Bold
 * (reference) words are measured bold.
 */

export type Measure = (text: string, bold?: boolean) => number;

const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;

/**
 * Measure words in `el`'s font, and the width words may use. Returns a
 * measure function (null until the element is there), the width, and a
 * version number that changes when either does — fonts finishing loading
 * included, since a fallback font measures differently.
 */
export function useLineMeasure(el: HTMLElement | null) {
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(0);
  const cache = useRef(new Map<string, number>());
  const [measure, setMeasure] = useState<Measure | null>(null);

  useLayoutEffect(() => {
    if (!el || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cs = getComputedStyle(el);
    const font = (weight: string) => `${cs.fontStyle} ${weight} ${cs.fontSize} ${cs.fontFamily}`;
    const regular = font(cs.fontWeight);
    const bold = font('600');
    cache.current.clear();
    const m: Measure = (text, isBold) => {
      const k = (isBold ? 'b' : 'r') + text;
      let v = cache.current.get(k);
      if (v === undefined) {
        ctx.font = isBold ? bold : regular;
        v = ctx.measureText(text).width;
        cache.current.set(k, v);
      }
      return v;
    };
    setMeasure(() => m);
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
    /* The font size follows the density tier, which is an attribute on
       <html>; `fontsReady` and a density change both re-read it. */
  }, [el, fontsReady]);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsReady((n) => n + 1));
    const mo = new MutationObserver(() => setFontsReady((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-density'] });
    return () => {
      alive = false;
      mo.disconnect();
    };
  }, []);

  return { measure, width };
}

/** A word placed on a line, with the space before it in px. */
export interface Placed {
  w: Word;
  lead: number;
}

/*
 * A hair of slack on every line. The canvas and the DOM agree to within a
 * fraction of a pixel, but "within" is not "exactly", and a line that is
 * 0.3px too long would be clipped at its last word — the word being said.
 */
const SLACK = 3;

/**
 * Greedy wrap: as many words on a line as fit in `width`. The space before
 * each word is returned with it and drawn as exactly that margin, so what
 * was measured is what is drawn. A new utterance gets `gap` spaces before
 * it, so where one sentence ends is visible without punctuation hunting.
 */
export function wrap(words: Word[], width: number, measure: Measure, gap = 1): Placed[][] {
  const lines: Placed[][] = [];
  const space = measure(' ');
  const room = Math.max(0, width - SLACK);
  let cur: Placed[] = [];
  let used = 0;
  for (const w of words) {
    const ww = measure(w.text, w.ref);
    const lead = w.index === 0 ? space * gap : space;
    if (cur.length > 0 && used + lead + ww > room) {
      lines.push(cur);
      cur = [{ w, lead: 0 }];
      used = ww;
    } else {
      const l = cur.length === 0 ? 0 : lead;
      cur.push({ w, lead: l });
      used += l + ww;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}
