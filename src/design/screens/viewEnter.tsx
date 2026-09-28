import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type RefObject } from 'react';
import { EASE, reducedMotion } from './dashboard/expand';
import './viewEnter.css';

/*
 * How a view arrives: its panels settle in, in reading order.
 *
 * operator ⇄ dashboard used to be a hard cut — sixteen boxes replaced by
 * ten others in one frame, which reads as the app blinking rather than as
 * turning to look at something else. The header is drawn in the same place
 * in both views on purpose (see LiveBody), so it must NOT move; only the
 * panels under it do.
 *
 * Animate the existing panels: wrappers would change the operator subgrid
 * and the dashboard's flex layout. CSS owns the transient opacity and
 * transform, then releases them automatically. No panel is left hidden
 * waiting for an animation promise, and no finished transform becomes a
 * containing block for something fixed inside a panel.
 *
 * Budget: the last panel has landed by 320ms. Step and duration are derived
 * from the count so ten tiles and four panels both fit it — the step is
 * capped at 40ms so a short list does not turn into a slow drum roll.
 */
const PANEL = 'section.tri-rounded-surface';
const ENTER_CLASS = 'tri-view-enter-panel';
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
    /* Set before paint, including the backwards fill during the stagger.
       The resting styles stay visible even if a transition is interrupted
       or a completion event never runs. */
    panels.forEach((panel, i) => {
      panel.style.setProperty('--tri-view-enter-delay', `${i * step}s`);
      panel.style.setProperty('--tri-view-enter-duration', `${MOVE_S}s`);
      panel.style.setProperty('--tri-view-enter-ease', EASE);
      panel.classList.add(ENTER_CLASS);
    });
    return () => {
      for (const panel of panels) {
        panel.classList.remove(ENTER_CLASS);
        panel.style.removeProperty('--tri-view-enter-delay');
        panel.style.removeProperty('--tri-view-enter-duration');
        panel.style.removeProperty('--tri-view-enter-ease');
      }
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
