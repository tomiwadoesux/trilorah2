import { useEffect, useRef } from 'react';
import { createDitherField } from './ditherField';
import { createDitherInteraction, dotLightOpacity, type DotColor, type DotPalette } from './ditherInteraction';
import { subscribeDither } from './ditherClock';
import './dottedSurface.css';

/** Decorative only: the containing surface keeps all its normal interactions. */
export function DitheredPatches({ className = '', interactionParent = false }: {
  className?: string;
  /** A backdrop is pointer-transparent; listen on the panel containing it. */
  interactionParent?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const surface = canvas?.parentElement;
    if (!canvas || !surface) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dots = document.createElement('canvas');
    const dotContext = dots.getContext('2d');
    const mask = document.createElement('canvas');
    const maskContext = mask.getContext('2d');
    if (!dotContext || !maskContext) return;
    const target = interactionParent ? surface.parentElement : surface;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const phase = Math.random() * Math.PI * 2;
    let field = createDitherField(0, 0, seed);
    let width = 0, height = 0;
    let ambientOpacity = .3;
    let palette: DotPalette = { green: [143, 211, 192], yellow: [228, 216, 122] };
    let pixels: ImageData | undefined;
    let visible = false;
    let unsubscribe: (() => void) | undefined;
    const interaction = createDitherInteraction();
    const paint = (time: number) => {
      if (!width || !height || !pixels) return;
      const t = (reduced.matches ? 0 : time * .00018) + phase;
      const a = (Math.sin(t) + 1) * .5;
      const b = (Math.cos(t * .73) + 1) * .5;
      ctx.clearRect(0, 0, width, height);
      // Keep the growing red silhouettes visible over the green/yellow waves.
      const lights = interaction.sample(time).sort((a, b) =>
        Number(a.shape === 'heart' || a.shape === 'flower')
        - Number(b.shape === 'heart' || b.shape === 'flower'));
      const { values, cols, rows, step } = field;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const offset = (row * cols + col) * 4;
          const x = (col + .5) * step, y = (row + .5) * step;
          let value = values[offset] * (1 - a) + values[offset + 1] * a;
          value = value * (1 - b * .45) + values[offset + 2] * b * .45;
          const strength = Math.max(0, Math.min(1, (value - .46) * 4.8)) * values[offset + 3];
          // Ordered dithering along the soft contours, with no random flicker.
          const threshold = ((col % 2) * 2 + ((row + col) % 2)) / 4;
          const bucket = Math.min(7, Math.floor(strength * 8 - threshold));
          let alpha = bucket < 0 ? 0 : (bucket + 1) * ambientOpacity / 8;
          let red = 229 * alpha, green = 235 * alpha, blue = 243 * alpha;
          for (const light of lights) {
            const glow = dotLightOpacity(light, x, y) * Math.max(0, values[offset + 3]);
            red = red * (1 - glow) + light.color[0] * glow;
            green = green * (1 - glow) + light.color[1] * glow;
            blue = blue * (1 - glow) + light.color[2] * glow;
            alpha += glow * (1 - alpha);
          }
          pixels.data[offset] = alpha ? red / alpha : 229;
          pixels.data[offset + 1] = alpha ? green / alpha : 235;
          pixels.data[offset + 2] = alpha ? blue / alpha : 243;
          pixels.data[offset + 3] = alpha * 255;
        }
      }
      // Only the tiny, one-pixel-per-dot color mask changes. Reuse the dot bitmap;
      // two image composites replace thousands of per-frame vector paths.
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
      if (!visible || document.hidden || reduced.matches) interaction.clear();
      if (visible && !document.hidden) paint(performance.now());
    };
    const resize = () => {
      const style = getComputedStyle(canvas);
      const opacity = Number.parseFloat(style.getPropertyValue('--tri-dot-alpha'));
      ambientOpacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : .3;
      const color = (name: string, fallback: DotColor): DotColor => {
        const parts = style.getPropertyValue(name).trim().split(/\s+/).map(Number);
        return parts.length === 3 && parts.every(Number.isFinite) ? parts as [number, number, number] : fallback;
      };
      palette = { green: color('--tri-go-2', [143, 211, 192]), yellow: color('--tri-caution-2', [228, 216, 122]) };
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      // Cap raster memory too: one CSS pixel is enough for a faint texture.
      const scale = Math.min(1, Math.sqrt(360_000 / Math.max(1, width * height)));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      field = createDitherField(width, height, seed);
      dots.width = canvas.width;
      dots.height = canvas.height;
      dotContext.setTransform(scale, 0, 0, scale, 0, 0);
      dotContext.fillStyle = '#e5ebf3';
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
    const pointAt = (event: PointerEvent) => {
      if (!width || !height) return;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * width / rect.width;
      const y = (event.clientY - rect.top) * height / rect.height;
      if (x < 0 || y < 0 || x > width || y > height) return;
      return { x, y };
    };
    const press = (event: PointerEvent) => {
      if (event.button !== 0 || reduced.matches || !visible || document.hidden) return;
      const point = pointAt(event);
      if (point) interaction.press(point.x, point.y, performance.now(), palette);
    };
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    const observer = new ResizeObserver(resize);
    intersection.observe(canvas);
    observer.observe(canvas);
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    target?.addEventListener('pointerdown', press, { passive: true, capture: true });
    resize();
    return () => {
      unsubscribe?.();
      observer.disconnect();
      intersection.disconnect();
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      target?.removeEventListener('pointerdown', press, true);
    };
  }, [interactionParent]);
  return <canvas ref={ref} aria-hidden="true" className={`tri-dither-patches ${className}`} />;
}
