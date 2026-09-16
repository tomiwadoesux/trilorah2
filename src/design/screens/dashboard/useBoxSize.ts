import { useLayoutEffect, useRef, useState } from 'react';

/*
 * An element's live layout box, in CSS pixels.
 *
 * Two tiles need it and they need it for the same reason: the bento hands
 * every tile a cell of unknown size, and both the orb's ball and the chart's
 * plot are pixel geometry that CSS cannot work out for them. The shared
 * useElementWidth answers only the width, and both of these boxes are
 * constrained on whichever axis is shorter.
 *
 * It stays here rather than in src/ui because two tiles in one folder is not
 * yet the system asking for it — see the note at the top of ../parts.
 */
export function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    /* The same object back when nothing moved. One of these drives a WebGPU
       canvas and the other rebuilds seventy bezier segments, and a settling
       layout delivers the same box several times over. */
    const apply = (width: number, height: number) =>
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));

    const observer = new ResizeObserver(([entry]) =>
      apply(entry.contentRect.width, entry.contentRect.height),
    );
    observer.observe(el);

    /*
     * clientWidth/Height for the first read, NOT a client RECT. The sandbox
     * draws every screen inside a `transform: scale(zoom)` artboard and
     * getBoundingClientRect reports the VISUAL box, so at any zoom below 1
     * the first synchronous read came back smaller than the box the observer
     * reports a frame later — and whatever was sized off it visibly jumped.
     * clientWidth is the layout box, which is what contentRect is too, so
     * the first paint and every observation after it now agree.
     */
    apply(el.clientWidth, el.clientHeight);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}
