import { useCallback, useRef } from 'react';

/*
 * The refusal nudge — what a control does when it is pressed but can't act.
 *
 * A disabled control that does nothing on press is ambiguous: the user
 * cannot tell whether the interface refused them or simply missed the click,
 * so they click again. A short shake answers the press without pretending
 * the action happened. It is the one motion in the system the user should
 * consciously notice, because it is carrying a message.
 *
 * Web Animations API rather than a CSS keyframe class: a keyframe restarts
 * from zero and needs class-toggling gymnastics to replay, while
 * `element.animate()` can simply be cancelled and re-run on every press —
 * which matters, because a refused button is exactly the thing people press
 * twice. It stays off the main thread like any CSS animation.
 */

/** Peak travel. Past ~4px this stops reading as a refusal and starts reading as a bug. */
const AMPLITUDE = 3;

/** Under 300ms, per the system's motion budget — long enough to register, short enough not to nag. */
const DURATION = 220;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Returns a ref to attach to the element, and a `nudge()` to call when an
 * interaction is refused.
 *
 *   const { ref, nudge } = useNudge<HTMLButtonElement>();
 *   <button ref={ref} onClick={() => (canAct ? act() : nudge())} />
 */
export function useNudge<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const running = useRef<Animation | null>(null);

  const nudge = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Re-pressing restarts the gesture rather than queueing a second one.
    running.current?.cancel();

    // Reduced motion keeps the acknowledgement but drops the travel: the
    // surface brightens and settles instead of moving.
    const keyframes = prefersReducedMotion()
      ? [{ opacity: 0.4 }, { opacity: 0.75 }, { opacity: 0.4 }]
      : [
          { transform: 'translateX(0)' },
          { transform: `translateX(-${AMPLITUDE}px)` },
          { transform: `translateX(${AMPLITUDE * 0.8}px)` },
          { transform: `translateX(-${AMPLITUDE * 0.45}px)` },
          { transform: 'translateX(0)' },
        ];

    running.current = el.animate(keyframes, {
      duration: DURATION,
      easing: 'ease-out',
    });
  }, []);

  return { ref, nudge };
}
