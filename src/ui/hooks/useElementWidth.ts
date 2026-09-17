import { useLayoutEffect, useRef, useState } from 'react';

/*
 * The measured width of an element, kept current as it resizes.
 *
 * Needed wherever a component has to do geometry CSS cannot express — the
 * slider's fill, for instance, has to reach exactly the handle, and the
 * handle's travel is inset from both ends, so the maths needs real pixels.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    /* clientWidth, not a client RECT: the design sandbox draws screens inside
       a `transform: scale(zoom)` artboard and getBoundingClientRect reports
       the VISUAL box, so at any zoom below 1 this first synchronous read
       disagreed with the contentRect the observer delivers a frame later —
       and the geometry sized off it jumped on first paint. */
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
