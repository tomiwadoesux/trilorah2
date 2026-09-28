/** Briefly adjust native animation speed, with no frame loop at rest or cruise. */
export function createHoverBrake(getAnimations: () => Animation[]) {
  let rate = 0;
  let frame = 0;
  let animations: Animation[] = [];

  const cancel = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const stop = () => {
    cancel();
    rate = 0;
    for (const animation of animations) {
      if (animation.playState !== 'finished') {
        animation.pause();
        animation.updatePlaybackRate(0);
      }
    }
  };
  const setActive = (active: boolean, immediate = false) => {
    cancel();
    animations = getAnimations().filter(animation => animation.playState !== 'finished');
    if (immediate) {
      stop();
      return;
    }
    const target = active ? 1 : 0;
    if (!animations.length || rate === target) return;
    for (const animation of animations) {
      animation.updatePlaybackRate(rate);
      if (active) animation.play();
    }
    const from = rate;
    const start = performance.now();
    const duration = active ? 180 : 620;
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      // Velocity approaches its destination smoothly, including rapid re-entry.
      const eased = 1 - (1 - progress) ** 2;
      rate = from + (target - from) * eased;
      for (const animation of animations) {
        if (animation.playState !== 'finished') animation.updatePlaybackRate(rate);
      }
      if (progress < 1) frame = requestAnimationFrame(step);
      else {
        frame = 0;
        if (!active) stop();
      }
    };
    frame = requestAnimationFrame(step);
  };
  return { setActive, dispose: stop };
}
