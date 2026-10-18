// One interruptible transition, advanced by the scene's existing visible ticker.
// Matches cubic-bezier(.77, 0, .175, 1), shared with the CSS motion vocabulary.
export const themeTransitionSeconds = 2.4;
export function themeEase(progress) {
  const x = Math.max(0, Math.min(1, progress));
  let low = 0, high = 1, t = x;
  for (let i = 0; i < 16; i++) {
    const inverse = 1 - t;
    const sample = 3 * inverse * inverse * t * .77 + 3 * inverse * t * t * .175 + t * t * t;
    if (sample < x) low = t; else high = t;
    t = (low + high) / 2;
  }
  return x === 0 || x === 1 ? x : 3 * (1 - t) * t * t + t * t * t;
}

export function createThemeTransition({ uniforms, direction, onUpdate = () => {} }) {
  const channels = [...new Set(uniforms)];
  const snapshot = () => channels.map(uniform => typeof uniform.value === 'number' ? uniform.value : uniform.value.clone());
  let from, to, elapsed = 0, duration = themeTransitionSeconds, active = false;
  let reduced = false;

  function render(amount) {
    channels.forEach((uniform, index) => {
      const weight = reduced && uniform === direction ? 1 : amount;
      if (typeof uniform.value === 'number') uniform.value = from[index] + (to[index] - from[index]) * weight;
      else uniform.value.copy(from[index]).lerp(to[index], weight);
    });
    onUpdate();
  }

  return {
    get active() { return active; },
    retarget(applyTarget, { reducedMotion = false } = {}) {
      // Capture the displayed frame, so a second click never jumps to an endpoint.
      from = snapshot();
      applyTarget();
      to = snapshot();
      reduced = reducedMotion;
      duration = reduced ? .2 : themeTransitionSeconds;
      elapsed = 0;
      active = true;
      render(0);
    },
    tick(seconds) {
      if (!active) return;
      elapsed = Math.min(duration, elapsed + Math.max(0, seconds));
      render(themeEase(elapsed / duration));
      if (elapsed >= duration) active = false;
    },
    finish() {
      if (!active) return;
      render(1);
      active = false;
    },
  };
}
