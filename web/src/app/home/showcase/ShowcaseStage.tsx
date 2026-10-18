'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The composition box of a showcase row, and its scroll reveal.
 *
 * The hidden state is armed only from here, after hydration: without JS, with
 * reduced motion, or when the stage is already on screen (a jump to #scripture),
 * nothing is ever hidden. Otherwise it reveals once, the first time it scrolls
 * into view; showcase.css owns the motion.
 */
export function ShowcaseStage({ caption, children }: { caption: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = stage.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;

    stage.dataset.reveal = 'armed';
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      stage.dataset.reveal = 'shown';
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(stage);
    return () => {
      observer.disconnect();
      // A remount (fast refresh) must not leave the panels hidden.
      if (stage.dataset.reveal === 'armed') delete stage.dataset.reveal;
    };
  }, []);

  return (
    <figure ref={ref} className="sc-stage">
      {children}
      <figcaption className="sc-visually-hidden">{caption}</figcaption>
    </figure>
  );
}
