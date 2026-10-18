'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { ART_HEIGHT, ART_WIDTH, artSceneToSVG, createArtScene, paintArtScene, type ArtScene, type ArtSettings } from './generative-art';

export type ArtworkHandle = { downloadSVG: () => void; reset: () => void };
export type GenerativeArtworkProps = {
  settings: ArtSettings;
  playing: boolean;
  className?: string;
  onReady?: () => void;
  /** Fixed, time-zero render for a miniature variation preview. */
  still?: boolean;
  label?: string;
};

const GenerativeArtwork = forwardRef<ArtworkHandle, GenerativeArtworkProps>(function GenerativeArtwork(
  { settings, playing, className, onReady, still = false, label }, ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const playingRef = useRef(playing);
  const readyRef = useRef(onReady);
  const timeRef = useRef(0);
  const sceneRef = useRef<ArtScene | null>(null);
  const visibleRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const renderRef = useRef<() => void>(() => undefined);
  settingsRef.current = settings;
  playingRef.current = playing;
  readyRef.current = onReady;

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !context) return;
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const scene = createArtScene(settingsRef.current, timeRef.current);
    sceneRef.current = scene;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = scene.colors.background;
    context.fillRect(0, 0, width, height);
    const scale = Math.max(width / ART_WIDTH, height / ART_HEIGHT);
    context.setTransform(scale, 0, 0, scale, (width - ART_WIDTH * scale) / 2, (height - ART_HEIGHT * scale) / 2);
    context.save();
    context.beginPath();
    context.rect(0, 0, ART_WIDTH, ART_HEIGHT);
    context.clip();
    // Small previews need legible marks while retaining the exact same geometry.
    const preview = still ? {
      ...scene,
      marks: scene.marks.map(mark => ({ ...mark, width: Math.max(mark.width ?? 1, 0.75 * dpr / scale) })),
    } : scene;
    paintArtScene(context, preview);
    context.restore();
  }, [still]);
  renderRef.current = render;

  useImperativeHandle(ref, () => ({
    reset() { timeRef.current = 0; renderRef.current(); },
    downloadSVG() {
      const scene = sceneRef.current ?? createArtScene(settingsRef.current, timeRef.current);
      const source = artSceneToSVG(scene, settingsRef.current, timeRef.current);
      const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `trilorah-${settingsRef.current.mode === 'patterns' ? settingsRef.current.pattern ?? 'orbit' : settingsRef.current.mode}-${settingsRef.current.seed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'art'}-${settingsRef.current.palette}.svg`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  }), []);

  useEffect(() => {
    timeRef.current = 0;
    if (!still) { render(); readyRef.current?.(); return; }
    // Miniature previews settle after the dials stop moving, so a drag stays smooth on the main stage.
    const timer = window.setTimeout(() => { render(); readyRef.current?.(); }, 120);
    return () => window.clearTimeout(timer);
  }, [still, settings.seed, settings.mode, settings.pattern, settings.dotted, settings.palette, settings.tension, settings.openness, settings.density, render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(canvas);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = media.matches;
    const motionChanged = () => { reducedMotionRef.current = media.matches; };
    media.addEventListener('change', motionChanged);
    const intersectionObserver = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting; }, { threshold: 0.02 });
    intersectionObserver.observe(canvas);
    let frame = 0;
    let previous = 0;
    let lastPaint = 0;
    const tick = (now: number) => {
      const active = playingRef.current && visibleRef.current && !document.hidden && !reducedMotionRef.current && !still;
      if (active && now - lastPaint >= 1000 / 30) {
        if (previous) timeRef.current += Math.min((now - previous) / 1000, 0.08);
        previous = now;
        lastPaint = now;
        render();
      } else if (!active) previous = 0;
      frame = window.requestAnimationFrame(tick);
    };
    if (!still) frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      media.removeEventListener('change', motionChanged);
    };
  }, [render, still]);

  const description = label ?? `${settings.mode === 'patterns' ? `A line study in the ${settings.pattern ?? 'orbit'} family, composed by its seed` : 'Fine threads drifting through a field of light'}, generated from seed ${settings.seed}, in the ${settings.palette} palette. ${playing && !still ? 'The form slowly evolves; use Freeze to pause the artwork.' : 'The artwork is still.'}`;
  return <canvas ref={canvasRef} className={className} width={ART_WIDTH} height={ART_HEIGHT} role="img" aria-label={description} style={{ display: 'block', width: '100%', height: '100%' }}>{description}</canvas>;
});

export default GenerativeArtwork;
