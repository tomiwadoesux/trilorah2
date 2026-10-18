const MAX_PIXELS = 2_000_000;

export function budgetPixelRatio(width, height, nativeDpr, mobile = false) {
  const area = Math.max(1, width) * Math.max(1, height);
  return Math.min(nativeDpr || 1, mobile ? 1.25 : 1.5, Math.sqrt(MAX_PIXELS / area));
}

// Create after app.init(), before ATTACH. Start visibility handling only after
// ATTACH and the scene's clock listener are installed: ticker.play() ticks inline.
export function createRenderBudget({ app, wrapper, onResume = () => {} }) {
  const viewport = app.tools.viewport;
  const infos = viewport.infos;
  const originalDpr = Object.getOwnPropertyDescriptor(infos, 'dpr');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  let nativeDpr = infos.dpr;
  let started = false;
  let disposed = false;
  let pageActive = true;
  let running = null;
  let observer;
  let intersecting = true;

  // The vendor writes this same object before updating its shared uResolution
  // and uDPR uniforms, then passes it to the renderer's resize listener. Keeping
  // the cap here ensures shader coordinates and drawing-buffer pixels agree.
  Object.defineProperty(infos, 'dpr', {
    configurable: true,
    enumerable: true,
    get: () => budgetPixelRatio(infos.width, infos.height, nativeDpr, coarsePointer.matches || infos.width < 768),
    set: value => { nativeDpr = value; },
  });
  viewport.onResize();

  function resetIntersection() {
    const rect = wrapper.getBoundingClientRect();
    intersecting = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
      && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  function syncVisibility() {
    if (!started || disposed) return;
    const next = pageActive && !document.hidden && intersecting;
    if (next === running) return;
    running = next;
    if (next) {
      onResume();
      app.core.ticker.play();
    } else {
      app.core.ticker.pause();
    }
  }

  function resize() {
    viewport.onResize();
    // IntersectionObserver also accounts for clipping by an embedding iframe.
    // Keep its last result until it delivers the new intersection.
    if (!observer) resetIntersection();
    syncVisibility();
  }

  function checkIntersection() {
    resetIntersection();
    syncVisibility();
  }

  function pageHide() {
    pageActive = false;
    syncVisibility();
  }

  function pageShow() {
    pageActive = true;
    resize();
    // No observer callback is required for an unchanged BFCache intersection.
    syncVisibility();
  }

  function start() {
    if (started || disposed) return;
    started = true;
    resetIntersection();
    if ('IntersectionObserver' in window) {
      observer = new window.IntersectionObserver(entries => {
        const entry = entries.find(item => item.target === wrapper);
        if (!entry) return;
        intersecting = entry.isIntersecting && entry.intersectionRatio > 0;
        syncVisibility();
      });
      observer.observe(wrapper);
    } else {
      window.addEventListener('scroll', checkIntersection, { passive: true });
    }
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', pageShow);
    window.addEventListener('resize', resize);
    coarsePointer.addEventListener('change', resize);
    syncVisibility();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    document.removeEventListener('visibilitychange', syncVisibility);
    window.removeEventListener('pagehide', pageHide);
    window.removeEventListener('pageshow', pageShow);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', checkIntersection);
    coarsePointer.removeEventListener('change', resize);
    app.core.ticker.pause();
    Object.defineProperty(infos, 'dpr', { ...originalDpr, value: nativeDpr });
    viewport.onResize();
  }

  return {
    start,
    dispose,
    get pixelRatio() { return infos.dpr; },
    get paused() { return running === false; },
    maxPixels: MAX_PIXELS,
  };
}
