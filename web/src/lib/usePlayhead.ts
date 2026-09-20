"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The seconds-since-service-start that the page is currently SHOWING.
 *
 * requestAnimationFrame rather than an interval, for two reasons that matter on
 * a phone in a hand: rAF is aligned to the display's refresh so a word lights
 * on a frame boundary instead of a tenth of a frame late, and the browser
 * suspends it when the tab goes away instead of waking the CPU every 100ms in
 * someone's pocket. We ALSO check `document.hidden` and stop the loop
 * ourselves, because a backgrounded iOS tab is not guaranteed to be throttled
 * and because resuming should recompute from the clock, not resume a stale
 * animation.
 *
 * State is only set when the rendered value actually changed by a meaningful
 * amount — sixty React renders a second would jank the word list even though
 * the maths is cheap.
 */
export function usePlayhead(
  compute: () => number,
  /** Re-render granularity in seconds. A word is ~0.3s, so 1/20s is invisible. */
  granularity = 0.05,
): number {
  const [value, setValue] = useState(() => compute());

  // The latest compute() without restarting the loop when it changes identity —
  // it closes over the nudge and the player, both of which move under us.
  const computeRef = useRef(compute);
  computeRef.current = compute;

  useEffect(() => {
    let frame = 0;
    let last = -Infinity;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const next = computeRef.current();
      if (Math.abs(next - last) >= granularity) {
        last = next;
        setValue(next);
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (stopped || frame) return;
      last = -Infinity; // force one immediate paint at the true current time
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [granularity]);

  return value;
}
