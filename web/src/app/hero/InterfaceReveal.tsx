'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { componentSkeletons, SkeletonCollection, type SkeletonKind } from './ComponentSkeletons';

function randomMix(): SkeletonKind[] {
  const pool = componentSkeletons.map(component => component.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 6);
}

/** Separate skeletons of the current app components, revealed where you point. */
export function InterfaceReveal() {
  const id = useId().replace(/:/g, '');
  const region = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const spotlight = useRef<SVGGElement>(null);
  const [kinds, setKinds] = useState<readonly SkeletonKind[]>(() => componentSkeletons.slice(0, 6).map(component => component.id));

  useEffect(() => {
    // Keep server and initial client markup identical; choose this page's mix
    // after hydration, independently of hover, scrolling, or theme changes.
    setKinds(randomMix());
  }, []);

  useEffect(() => {
    const node = region.current;
    const artwork = svg.current;
    const feather = spotlight.current;
    if (!node || !artwork || !feather) return;

    const enabled = window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    let frame = 0;
    let idleTimer = 0;
    let inView = false;
    let focused = true;
    let x = 0;
    let y = 0;

    const stopIdle = () => {
      window.clearTimeout(idleTimer);
      node.dataset.idle = 'false';
    };
    const scheduleIdle = () => {
      stopIdle();
      if (!enabled.matches || !inView || !focused || document.hidden) return;
      idleTimer = window.setTimeout(() => {
        node.dataset.active = 'false';
        node.dataset.idle = 'true';
      }, 3500);
    };
    const paint = () => {
      frame = 0;
      const matrix = artwork.getScreenCTM();
      if (!matrix) return;
      // SVG coordinates keep the spotlight under the pointer at every scale.
      const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
      feather.setAttribute('transform', `translate(${point.x} ${point.y})`);
      node.dataset.active = 'true';
      scheduleIdle();
    };
    const move = (event: PointerEvent) => {
      if (!enabled.matches || event.pointerType === 'touch') return;
      stopIdle();
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      node.dataset.active = 'false';
      scheduleIdle();
    };
    const blur = () => {
      focused = false;
      leave();
    };
    const focus = () => {
      focused = true;
      scheduleIdle();
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      leave();
    });
    observer.observe(node);

    node.addEventListener('pointerenter', move);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', leave);
    node.addEventListener('pointercancel', leave);
    enabled.addEventListener('change', leave);
    document.addEventListener('visibilitychange', leave);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      stopIdle();
      node.removeEventListener('pointerenter', move);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', leave);
      node.removeEventListener('pointercancel', leave);
      enabled.removeEventListener('change', leave);
      document.removeEventListener('visibilitychange', leave);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
    };
  }, []);

  return (
    <div className="hero-interface-reveal" ref={region} aria-hidden="true">
      <svg ref={svg} className="hero-interface-art" viewBox="0 0 960 600" fill="none" focusable="false">
        <defs>
          <radialGradient id={`${id}-soft`}>
            <stop offset="0" stopColor="white" stopOpacity=".9" />
            <stop offset=".2" stopColor="white" stopOpacity=".65" />
            <stop offset=".45" stopColor="white" stopOpacity=".27" />
            <stop offset=".72" stopColor="white" stopOpacity=".06" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id={`${id}-spotlight`} maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="600">
            {/* Unequal, offset feathers avoid a circular rim without blur or noise filters. */}
            <g ref={spotlight} transform="translate(530 300)" fill={`url(#${id}-soft)`}>
              <ellipse rx="420" ry="210" transform="rotate(-12)" />
              <ellipse cx="90" cy="32" rx="310" ry="145" transform="rotate(9)" opacity=".45" />
            </g>
          </mask>
          <g id={`${id}-workspace`}><SkeletonCollection id={id} kinds={kinds} /></g>
        </defs>
        <use href={`#${id}-workspace`} className="hero-interface-ghost" />
        <g mask={`url(#${id}-spotlight)`} className="hero-interface-spotlight">
          <use href={`#${id}-workspace`} />
        </g>
        <g className="hero-interface-idle" strokeLinecap="round">
          {kinds.slice(0, 3).map(kind => <g className="hero-interface-cue" key={kind}>
            <use href={`#${id}-${kind}`} />
          </g>)}
        </g>
      </svg>
    </div>
  );
}
