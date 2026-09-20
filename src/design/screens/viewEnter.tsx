import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type RefObject } from 'react';
import { animate, stagger } from 'motion/react';
import { EASE_BEZIER, reducedMotion } from './dashboard/expand';

/*
 * How a view arrives: its panels settle in, in reading order.
 *
 * operator ⇄ dashboard used to be a hard cut — sixteen boxes replaced by
 * ten others in one frame, which reads as the app blinking rather than as
 * turning to look at something else. The header is drawn in the same place
 * in both views on purpose (see LiveBody), so it must NOT move; only the
 * panels under it do.
 *
 * Imperative, not <motion.div> wrappers: the operator view is a subgrid and
 * the bento is a tower of flex weights, and a wrapper element in either one
 * is a layout change. This touches the panels that are already there and
 * takes its inline styles away again when it is done, so a finished
 * entrance leaves no transform behind to become a containing block for
 * something fixed inside a panel.
 *
 * Budget: the last panel has landed by 320ms. Step and duration are derived
 * from the count so ten tiles and four panels both fit it — the step is
 * capped at 40ms so a short list does not turn into a slow drum roll.
 */
const PANEL = 'section.tri-rounded-surface';
const TOTAL_S = 0.32;
const MAX_STEP_S = 0.04;
const MOVE_S = 0.176;

/* The app opening is not a view switch: the operator surface is simply
   there at launch, and only arrives when it is turned BACK to. */
let launched = false;

export function useViewEnter<T extends HTMLElement>(opts: { skipFirst?: boolean } = {}): RefObject<T | null> {
  const root = useRef<T>(null);
  /* Decided once per mount and kept in a ref, because StrictMode runs the
     effect twice and the second run must reach the same answer. */
  const skip = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (skip.current === null) {
      skip.current = !!opts.skipFirst && !launched;
      launched = true;
    }
    if (!el || skip.current || reducedMotion()) return;

    /* Top-level panels only. A panel inside a panel arrives with its
       parent; animating both would fade the inner one twice. */
    const panels = [...el.querySelectorAll<HTMLElement>(PANEL)].filter((p) => {
      const outer = p.parentElement?.closest(PANEL);
      return !outer || !el.contains(outer);
    });
    if (panels.length === 0) return;

    const step = Math.min(MAX_STEP_S, (TOTAL_S - MOVE_S) / Math.max(1, panels.length - 1));
    const FROM = 'translateY(6px) scale(0.992)';
    /* Hidden HERE, synchronously, before the browser has painted the new
       view: Motion applies its first keyframe on its own next tick, and a
       layout effect that only scheduled the animation left one frame in
       which all ten tiles stood at full opacity before dropping to zero. */
    for (const p of panels) {
      p.style.opacity = '0';
      p.style.transform = FROM;
    }
    const controls = animate(
      panels,
      { opacity: [0, 1], transform: [FROM, 'translateY(0px) scale(1)'] },
      { duration: MOVE_S, ease: EASE_BEZIER, delay: stagger(step) },
    );
    let done = false;
    const tidy = () => {
      done = true;
      for (const p of panels) {
        p.style.removeProperty('opacity');
        p.style.removeProperty('transform');
      }
    };
    /* A beat after `finished`: Motion writes the final keyframe to the last
       element as it resolves, and tidying in the same tick lost that race —
       the last panel kept a transform, which is a containing block. */
    const later = () => setTimeout(() => !done && tidy(), 34);
    void controls.finished.then(later, later);
    return () => {
      controls.stop();
      tidy();
    };
    // Runs once per mount: each view mounts fresh when it is switched to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return root;
}

/** The same, for a view that is a branch of a bigger component rather than a
    component of its own: a plain div that IS the view's root — not a wrapper
    around it — so it mounts, and enters, each time the branch is taken. */
export function ViewEnter({ skipFirst, ...rest }: ComponentPropsWithoutRef<'div'> & { skipFirst?: boolean }) {
  const ref = useViewEnter<HTMLDivElement>({ skipFirst });
  return <div ref={ref} {...rest} />;
}
