import { useLayoutEffect, useRef } from 'react';
import { createHoverBrake } from '../../lib/hoverBrake';

export function useEmptyHover(enabled: boolean) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !enabled) return;
    const card = element.closest('section') ?? element;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const brake = createHoverBrake(() =>
      element.getAnimations({ subtree: true }).filter(animation =>
        animation instanceof CSSAnimation && animation.animationName !== 'tri-dot-drift',
      ),
    );
    let over = card.matches(':hover');
    let focused = card.contains(document.activeElement);
    const sync = () => {
      const active = (over || focused) && !document.hidden && !reduced.matches;
      element.dataset.emptyActive = String(active);
      brake.setActive(active, document.hidden || reduced.matches);
    };
    const enter = () => { over = true; sync(); };
    const leave = () => { over = false; sync(); };
    const focusIn = () => { focused = true; sync(); };
    const focusOut = (event: FocusEvent) => {
      focused = event.relatedTarget instanceof Node && card.contains(event.relatedTarget);
      sync();
    };
    brake.setActive(false, true);
    sync();
    card.addEventListener('pointerenter', enter);
    card.addEventListener('pointerleave', leave);
    card.addEventListener('focusin', focusIn);
    card.addEventListener('focusout', focusOut);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    return () => {
      brake.dispose();
      delete element.dataset.emptyActive;
      card.removeEventListener('pointerenter', enter);
      card.removeEventListener('pointerleave', leave);
      card.removeEventListener('focusin', focusIn);
      card.removeEventListener('focusout', focusOut);
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', sync);
    };
  }, [enabled]);
  return root;
}
