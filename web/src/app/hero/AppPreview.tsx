'use client';

import { useLayoutEffect, useRef } from 'react';
import Image from 'next/image';
import { ServiceDemo } from './ServiceDemo';

export type HeroTheme = 'light' | 'dark';

/** Share of the UI's height visible above the fold before any scrolling. */
const REST_PEEK = .3;

export function AppPreview({ theme, showInterface = false }: { theme: HeroTheme; showInterface?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const interfaceRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const aperture = windowRef.current;
    if (!section || !aperture) return;

    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    let frame = 0;
    let lastTime = 0;
    let opening = 0;
    let initialized = false;
    let needsMeasure = true;
    let metrics = { start: 0, sectionHeight: 0, viewportHeight: 0, side: 0, initialHeight: 0, navHeight: 64, appHeight: 0, restScale: 1, restOffset: 0 };

    const draw = (time: number) => {
      frame = 0;
      if (document.hidden) { lastTime = 0; return; }
      if (motion.matches) {
        aperture.style.removeProperty('clip-path');
        aperture.style.removeProperty('transform');
        interfaceRef.current?.style.removeProperty('transform');
        initialized = false;
        lastTime = 0;
        return;
      }

      // Measure only when layout changes, not on every settling frame.
      if (needsMeasure) {
        const bounds = section.getBoundingClientRect();
        const styles = getComputedStyle(section);
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = aperture.clientHeight;
        const gutter = Number.parseFloat(styles.getPropertyValue('--hero-gutter')) || 20;
        const cardWidth = Math.min(1520, viewportWidth - gutter * 2);
        const start = bounds.top + globalThis.scrollY;
        const appWidth = interfaceRef.current?.clientWidth || 0;
        const appHeight = interfaceRef.current?.clientHeight || 0;
        // Widen the resting window without increasing its original height.
        const initialHeight = Math.min(viewportHeight, Math.min(1300, cardWidth) * 941 / 1672);
        // At rest the UI is nearly full size, fitted inside the card, and only its
        // top ~30% shows above the fold, or above the landscape's own bottom edge
        // where that comes first (phones, very tall screens). It never starts
        // closer than 32px to the landscape's top edge.
        const restScale = appWidth ? Math.min(1, (cardWidth - 48) / appWidth) : 1;
        const visibleBottom = Math.min(viewportHeight, start + initialHeight);
        const restTop = Math.max(start + 32, visibleBottom - REST_PEEK * appHeight * restScale);
        metrics = {
          start,
          sectionHeight: bounds.height,
          viewportHeight,
          side: (viewportWidth - cardWidth) / 2,
          initialHeight,
          navHeight: Number.parseFloat(styles.getPropertyValue('--hero-nav-height')) || 64,
          appHeight,
          restScale,
          restOffset: restTop - start,
        };
        needsMeasure = false;
      }

      const target = clamp(globalThis.scrollY / Math.max(1, metrics.start));
      if (!initialized || document.documentElement.classList.contains('lenis')) {
        // Restored scroll positions and reduced-motion changes must not replay.
        // Lenis already eases the native position; don't add a second lag.
        opening = target;
        initialized = true;
      } else {
        const elapsed = lastTime ? Math.min(64, time - lastTime) : 1000 / 60;
        // A short, frame-rate-independent catch-up follows actual scroll distance.
        // No wheel interception, artificial scroll, or overshoot.
        opening += (target - opening) * (1 - Math.exp(-elapsed / 120));
      }
      const settling = Math.abs(target - opening) > .0001;
      if (!settling) opening = target;

      // Width leads; height overlaps gently and takes the rest of the gesture.
      const horizontal = clamp(opening / .45);
      const vertical = clamp((opening - .18) / .82);
      const height = metrics.initialHeight + (metrics.viewportHeight - metrics.initialHeight) * vertical;
      const sectionTop = metrics.start - globalThis.scrollY;
      const sectionBottom = sectionTop + metrics.sectionHeight;
      const top = Math.min(metrics.viewportHeight, Math.max(0, sectionTop));
      const bottom = Math.max(0, metrics.viewportHeight - (Math.max(0, sectionTop) + height));
      // Once open, the whole landscape scrolls away with the section like ordinary content.
      const leave = Math.min(0, sectionBottom - metrics.viewportHeight);

      // Section edges stay attached to native scrolling, even while expansion eases.
      aperture.style.clipPath = `inset(${top}px ${metrics.side * (1 - horizontal)}px ${bottom}px round ${4 * (1 - horizontal)}px)`;
      aperture.style.transform = leave ? `translate3d(0, ${leave}px, 0)` : '';
      const app = interfaceRef.current;
      if (app) {
        // Rises from its resting peek to centred below the navigation as the landscape opens.
        const openTop = metrics.navHeight + Math.max(0, (metrics.viewportHeight - metrics.navHeight - metrics.appHeight) / 2);
        const appTop = Math.max(0, sectionTop) + metrics.restOffset * (1 - opening) + openTop * opening;
        const scale = metrics.restScale + (1 - metrics.restScale) * opening;
        app.style.transform = `translate3d(-50%, ${appTop}px, 0) scale(${scale})`;
      }
      lastTime = settling ? time : 0;
      if (settling) frame = requestAnimationFrame(draw);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const measure = () => { needsMeasure = true; schedule(); };
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      initialized = false;
      measure();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    if (section.parentElement) observer.observe(section.parentElement);
    if (interfaceRef.current) observer.observe(interfaceRef.current);
    globalThis.addEventListener('scroll', schedule, { passive: true });
    globalThis.addEventListener('resize', measure);
    document.addEventListener('visibilitychange', reset);
    motion.addEventListener('change', reset);
    draw(performance.now());

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      globalThis.removeEventListener('scroll', schedule);
      globalThis.removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', reset);
      motion.removeEventListener('change', reset);
    };
  }, [showInterface]);

  return (
    <section className="hero-landscape-section" id="workspace" ref={sectionRef} aria-label="Trilorah landscape">
      <div className="hero-app-frame" ref={windowRef}>
        {(['dark', 'light'] as const).map((mode) => (
          <Image
            key={mode}
            className={`hero-landscape-image hero-landscape-${mode}`}
            src={`/hero-landscape/${mode}.webp`}
            alt={mode === 'light' ? 'A quiet cabin beneath misty mountains in daylight' : 'A warmly lit cabin beneath misty mountains at night'}
            aria-hidden={theme !== mode}
            width={1672}
            height={941}
            sizes="100vw"
            priority
          />
        ))}
        {showInterface && (
          <div className="hero-landscape-ui" ref={interfaceRef}>
            <ServiceDemo theme={theme} />
          </div>
        )}
      </div>
    </section>
  );
}
