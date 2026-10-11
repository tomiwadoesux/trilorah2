'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SAVED_LOOK, type HeroLook } from './look';
import { boxCss } from './settings';

/**
 * Full-height hero: an empty WebGPU box edged with LEDs that light the floor around it.
 * `above` sits in the space over the box, `below` under it. Without WebGPU the box is drawn
 * in CSS instead. In development a panel edits the look live (see LookPanel).
 */
export function BoxLedHero({
  above,
  below,
  footer,
  children,
  className = '',
  showControls = true,
  allowTouchScroll = false,
}: {
  above?: ReactNode;
  below?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  showControls?: boolean;
  allowTouchScroll?: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<{ setLook(look: HeroLook): void; replay(): void } | null>(null);
  const [look, setLook] = useState<HeroLook>(SAVED_LOOK);
  const lookRef = useRef(look);
  lookRef.current = look;
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    let generation = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const start = () => {
      const current = ++generation;
      dispose?.();
      dispose = undefined;
      rendererRef.current = null;
      if (reducedMotion.matches) {
        setStatus('unsupported');
        return;
      }
      setStatus('loading');
      // Loaded here so vgpu stays out of the server render and the first paint.
      import('./renderer').then(
        ({ createRenderer }) => {
          if (cancelled || current !== generation) return;
          const renderer = createRenderer({ canvas, inputTarget: section, look: lookRef.current, allowTouchScroll });
          rendererRef.current = renderer;
          dispose = renderer.dispose;
          renderer.ready.then(
            () => { if (!cancelled && current === generation) setStatus('ready'); },
            () => { if (!cancelled && current === generation) setStatus('unsupported'); },
          );
        },
        () => { if (!cancelled && current === generation) setStatus('unsupported'); },
      );
    };
    start();
    reducedMotion.addEventListener('change', start);
    return () => {
      cancelled = true;
      reducedMotion.removeEventListener('change', start);
      rendererRef.current = null;
      dispose?.();
    };
  }, [allowTouchScroll]);

  useEffect(() => {
    rendererRef.current?.setLook(look);
  }, [look]);

  useEffect(() => {
    const section = sectionRef.current;
    // Wrapped in the env check (not an early return) so production builds drop the panel
    // and lil-gui entirely.
    if (process.env.NODE_ENV === 'development' && section && showControls) {
      let cancelled = false;
      let panel: { destroy(): void } | undefined;
      import('./LookPanel').then(({ mountLookPanel }) => {
        if (cancelled) return;
        panel = mountLookPanel({
          container: section,
          look: lookRef.current,
          onChange: setLook,
          onReplay: () => rendererRef.current?.replay(),
        });
      });
      return () => {
        cancelled = true;
        panel?.destroy();
      };
    }
  }, [showControls]);

  const box = boxCss(look.box);

  return (
    <section
      ref={sectionRef}
      className={`relative h-[100svh] min-h-[480px] w-full overflow-hidden ${className}`}
      style={{ background: look.light.background, ...inkFor(look.light.background) }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className={`absolute inset-0 block h-full w-full ${allowTouchScroll ? 'touch-pan-y' : 'touch-none'} transition-opacity duration-300 ease-out ${
          status === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {status === 'unsupported' && (
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 border shadow-[0_0_24px_rgba(125,211,252,0.25),0_0_80px_rgba(4,120,87,0.12)]"
          style={{
            top: box.top,
            height: box.height,
            width: box.width,
            background: look.box.fill,
            borderImage: `linear-gradient(${look.leds.gradientAngle}deg, ${look.leds.colorFrom}, ${look.leds.colorTo}) 1`,
          }}
        />
      )}
      {children && (
        <div
          className="absolute left-1/2 -translate-x-1/2 overflow-hidden"
          style={{ top: box.top, height: box.height, width: box.width, padding: 2 }}
        >
          {children}
        </div>
      )}
      {above && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-end px-6 pb-6 text-center [&_a]:pointer-events-auto [&_button]:pointer-events-auto"
          style={{ height: box.top }}
        >
          {above}
        </div>
      )}
      {below && (
        <div
          className="pointer-events-none absolute inset-x-0 flex flex-col items-center px-6 pt-6 text-center [&_a]:pointer-events-auto [&_button]:pointer-events-auto"
          style={{ top: `calc(${box.top} + ${box.height})` }}
        >
          {below}
        </div>
      )}
      {footer && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-6 text-center">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Text colours for whatever sits on the background: --hero-ink, --hero-ink-soft,
 *  --hero-line (borders) and --hero-surface (quiet button fill). */
function inkFor(background: string): CSSProperties {
  const channel = (offset: number) => parseInt(background.slice(offset, offset + 2), 16) / 255;
  const light = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5) > 0.5;
  return {
    '--hero-ink': light ? '#0a0a0a' : '#f5f5f5',
    '--hero-ink-soft': light ? '#4b5563' : '#d1d5db',
    '--hero-line': light ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.15)',
    '--hero-surface': light ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.6)',
  } as CSSProperties;
}
