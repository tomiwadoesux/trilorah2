'use client';

import { useEffect, useRef } from 'react';
import { createDitherField } from '../../../../src/design/screens/ditherField';
import { subscribeDither } from '../../../../src/design/screens/ditherClock';

/**
 * The app's dot patches (src/design/screens/DitheredPatches.tsx) as the
 * hero's landscape: the same field, the same ordered dither, the same shared
 * 24fps clock, minus the click halos, which have no place behind a web page.
 * Colour and strength come from CSS so the theme can set them:
 * --hero-dot-rgb (three numbers) and --hero-dot-alpha.
 */
export function HeroDots({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dots = document.createElement('canvas');
    const dotContext = dots.getContext('2d');
    const mask = document.createElement('canvas');
    const maskContext = mask.getContext('2d');
    if (!ctx || !dotContext || !maskContext) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const phase = Math.random() * Math.PI * 2;
    let field = createDitherField(0, 0, seed);
    let width = 0, height = 0;
    let ambient = .3;
    let rgb: [number, number, number] = [229, 235, 243];
    let pixels: ImageData | undefined;
    let visible = false;
    let unsubscribe: (() => void) | undefined;

    const paint = (time: number) => {
      if (!width || !height || !pixels) return;
      const t = (reduced.matches ? 0 : time * .00018) + phase;
      const a = (Math.sin(t) + 1) * .5;
      const b = (Math.cos(t * .73) + 1) * .5;
      const { values, cols, rows, step } = field;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const offset = (row * cols + col) * 4;
          let value = values[offset] * (1 - a) + values[offset + 1] * a;
          value = value * (1 - b * .45) + values[offset + 2] * b * .45;
          const strength = Math.max(0, Math.min(1, (value - .46) * 4.8)) * values[offset + 3];
          // Ordered dithering along the soft contours, with no random flicker.
          const threshold = ((col % 2) * 2 + ((row + col) % 2)) / 4;
          const bucket = Math.min(7, Math.floor(strength * 8 - threshold));
          const alpha = bucket < 0 ? 0 : (bucket + 1) * ambient / 8;
          pixels.data[offset] = rgb[0];
          pixels.data[offset + 1] = rgb[1];
          pixels.data[offset + 2] = rgb[2];
          pixels.data[offset + 3] = alpha * 255;
        }
      }
      ctx.clearRect(0, 0, width, height);
      maskContext.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mask, 0, 0, cols * step, rows * step);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(dots, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    };

    const sync = () => {
      const active = visible && !document.hidden && !reduced.matches && width > 0 && height > 0;
      if (active && !unsubscribe) unsubscribe = subscribeDither(paint);
      if (!active && unsubscribe) { unsubscribe(); unsubscribe = undefined; }
      if (visible && !document.hidden) paint(performance.now());
    };

    const resize = () => {
      const style = getComputedStyle(canvas);
      const alpha = Number.parseFloat(style.getPropertyValue('--hero-dot-alpha'));
      ambient = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : .3;
      const parts = style.getPropertyValue('--hero-dot-rgb').trim().split(/\s+/).map(Number);
      if (parts.length === 3 && parts.every(Number.isFinite)) rgb = parts as [number, number, number];
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      // One CSS pixel is enough for a faint texture; cap the raster all the same.
      const scale = Math.min(1, Math.sqrt(360_000 / Math.max(1, width * height)));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      field = createDitherField(width, height, seed);
      dots.width = canvas.width;
      dots.height = canvas.height;
      dotContext.setTransform(scale, 0, 0, scale, 0, 0);
      dotContext.fillStyle = '#fff';
      dotContext.beginPath();
      for (let row = 0; row < field.rows; row++) {
        for (let col = 0; col < field.cols; col++) {
          const x = (col + .5) * field.step, y = (row + .5) * field.step;
          dotContext.moveTo(x + .75, y);
          dotContext.arc(x, y, .75, 0, Math.PI * 2);
        }
      }
      dotContext.fill();
      mask.width = field.cols;
      mask.height = field.rows;
      pixels = field.cols && field.rows ? maskContext.createImageData(field.cols, field.rows) : undefined;
      sync();
    };

    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    const observer = new ResizeObserver(resize);
    intersection.observe(canvas);
    observer.observe(canvas);
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    // The theme switch changes the dot colour without resizing anything.
    const theme = new MutationObserver(resize);
    const page = canvas.closest('[data-theme]');
    if (page) theme.observe(page, { attributes: true, attributeFilter: ['data-theme'] });
    resize();
    return () => {
      unsubscribe?.();
      observer.disconnect();
      intersection.disconnect();
      theme.disconnect();
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`hero-dots ${className}`} />;
}
