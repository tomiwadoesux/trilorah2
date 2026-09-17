import { useEffect, useRef, useState } from 'react';

/*
 * A number that travels to its target instead of jumping there.
 *
 * Used wherever a value can change either by direct manipulation or at a
 * distance: dragging must stay glued to the finger (immediate), while a
 * click, a keypress or a change from elsewhere should be seen to move, or
 * the control appears to teleport and the eye loses track of it.
 */

/** Decelerating. Movement is fastest at the start, where the eye is looking. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function useAnimatedNumber(
  target: number,
  { duration = 240, immediate = false }: { duration?: number; immediate?: boolean } = {},
) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const frame = useRef<number | null>(null);

  // Mirrored so a new animation can start from wherever the last one got to,
  // rather than restarting from the previous target.
  useEffect(() => {
    current.current = value;
  }, [value]);

  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);

    if (immediate || duration <= 0 || prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }

    const from = current.current;
    const delta = target - from;
    if (delta === 0) return;

    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const next = from + delta * easeOut(t);
      current.current = next;
      setValue(next);
      frame.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, immediate, duration]);

  return value;
}
