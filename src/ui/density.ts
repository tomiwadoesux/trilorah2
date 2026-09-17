/*
 * Which density tier a window reads at.
 *
 * tokens.css defines three tiers and says what each is for; this is the one
 * rule that decides which one a given window gets. It lives in ui/ rather
 * than in the design tree because it is a fact about window sizes, not about
 * the sandbox — and because the shipping app will need exactly this rule the
 * moment it adopts the token system. (It does not load tokens.css yet: today
 * src/screens/Live.tsx is the old surface and src/design/screens/Live.tsx is
 * the Trilorah one. Wiring trackDensity into src/main.tsx before that
 * changeover would set an attribute nothing reads.)
 */

export type Density = 'compact' | 'comfortable' | 'touch';

/**
 * The tier a window of this width naturally reads at.
 *
 * Width, not height: the thing that changes between these devices is how far
 * away the operator is sitting, and width is what tracks that. A 1080p booth
 * monitor read standing gets the same tier as a 1080p desktop, which is
 * correct — both are arm's length or further.
 */
export function tierForWidth(w: number): Density {
  if (w <= 1366) return 'compact';
  if (w < 1920) return 'comfortable';
  return 'touch';
}

/**
 * Keep <html data-density> in step with the window, for the life of the page.
 *
 * Returns its own teardown. The tier only changes when the window crosses a
 * breakpoint, so this writes the attribute unconditionally on resize and lets
 * the DOM no-op the repeats — cheaper than tracking the last value, and there
 * is no layout read here to make the resize handler worth debouncing.
 */
export function trackDensity(el: HTMLElement = document.documentElement): () => void {
  const apply = () => {
    el.dataset.density = tierForWidth(window.innerWidth);
  };
  apply();
  window.addEventListener('resize', apply);
  return () => window.removeEventListener('resize', apply);
}
