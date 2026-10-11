import { clock, frameLoop, surface, type Gpu, type Surface } from 'vgpu';
import type { HeroLook } from './look';
import { createHeroRenderer, type HeroRenderer } from './scene-renderer';
import {
  boxSdf,
  canonicalBoxGeometry,
  simulationFloorFactor,
  type RenderSize,
} from './settings';
import { brushState, simulationBrushState } from './sim-sizing';

interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
  /** Element that receives pointer input. Defaults to the canvas; pass the hero section
   *  when page content sits over the canvas so hovering it doesn't read as leaving. */
  readonly inputTarget?: HTMLElement;
  readonly look: HeroLook;
  readonly allowTouchScroll?: boolean;
}

export function createRenderer(options: RendererOptions) {
  let disposed = false;
  let gpu: Gpu | undefined;
  let canvasSurface: Surface | undefined;
  let scene: HeroRenderer | undefined;
  let loop: { stop(): void } | undefined;
  let observer: ResizeObserver | undefined;
  let visibilityObserver: IntersectionObserver | undefined;
  let inViewport = true;
  let input: ReturnType<typeof installCanvasInput> | undefined;
  let resizeFrame = 0;
  let resizeGeneration = 0;
  let pendingSize: RenderSize | undefined;
  let lastDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  let look = options.look;

  const fail = (error: unknown): never => {
    dispose();
    throw error;
  };
  const applyResize = () => {
    resizeFrame = 0;
    const size = pendingSize;
    pendingSize = undefined;
    if (disposed || !size || !scene || !canvasSurface) return;
    const generation = ++resizeGeneration;
    try {
      scene.rebuild({ width: size.width, height: size.height, dpr: canvasSurface.dpr });
      scene.setOutputTarget(canvasSurface);
      void scene.prewarm().catch((error: unknown) => {
        if (disposed || generation !== resizeGeneration) return;
        fail(error);
      });
    } catch (error) {
      if (disposed || generation !== resizeGeneration) return;
      fail(error);
    }
  };
  const resize = (size: RenderSize) => {
    if (disposed || size.width <= 0 || size.height <= 0) return;
    pendingSize = size;
    if (!resizeFrame) resizeFrame = requestAnimationFrame(applyResize);
  };
  const measure = () => {
    const rect = options.canvas.getBoundingClientRect();
    resize({ width: rect.width, height: rect.height });
  };
  const onWindowResize = () => {
    if (window.devicePixelRatio === lastDpr) return;
    lastDpr = window.devicePixelRatio;
    measure();
  };
  const setLook = (next: HeroLook) => {
    if (disposed || next === look) return;
    look = next;
    scene?.setLook(next);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    resizeGeneration++;
    loop?.stop();
    loop = undefined;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
    pendingSize = undefined;
    observer?.disconnect();
    observer = undefined;
    visibilityObserver?.disconnect();
    visibilityObserver = undefined;
    if (typeof window !== 'undefined') window.removeEventListener('resize', onWindowResize);
    input?.dispose();
    input = undefined;
    scene?.destroy();
    scene = undefined;
    canvasSurface?.dispose();
    canvasSurface = undefined;
    gpu?.dispose();
    gpu = undefined;
  };
  const initialize = async () => {
    const { init } = await import('vgpu');
    if (disposed) return;
    const nextGpu = await init();
    if (disposed) { nextGpu.dispose(); return; }
    gpu = nextGpu;
    canvasSurface = surface(gpu, options.canvas, { dpr: [1, 2] });
    const nextScene = createHeroRenderer(gpu, { theme: 'dark', css: cssSizeOf(options.canvas, canvasSurface.dpr), look });
    scene = nextScene;
    nextScene.setOutputTarget(canvasSurface);
    await nextScene.prewarm();
    if (disposed) { nextScene.destroy(); return; }
    // A look set while the shaders compiled.
    nextScene.setLook(look);
    input = installCanvasInput(options.canvas, options.inputTarget ?? options.canvas, () => look.box, options.allowTouchScroll);
    observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(options.canvas);
    if (typeof IntersectionObserver !== 'undefined') {
      visibilityObserver = new IntersectionObserver(([entry]) => { inViewport = entry.isIntersecting; });
      visibilityObserver.observe(options.canvas);
    }
    window.addEventListener('resize', onWindowResize);
    measure();
    const time = clock(gpu);
    loop = frameLoop(gpu, (currentFrame) => {
      if (disposed || !scene || !input || !gpu || !inViewport || document.hidden) return;
      scene.setBrush(input.brush());
      scene.setRgbDeployActive(input.rgbDeployActive());
      scene.renderFrame(currentFrame, { time: time.time, dt: time.deltaTime });
    });
  };
  const ready = initialize().catch((error: unknown) => {
    if (disposed) return;
    fail(error);
  });
  const replay = () => { scene?.replayOpening(); };
  return { ready, setLook, replay, resize, dispose };
}

function cssSizeOf(canvas: HTMLCanvasElement, dpr: Surface['dpr']) {
  const rect = canvas.getBoundingClientRect();
  return {
    width: Math.max(1, rect.width || canvas.clientWidth || canvas.width / dpr),
    height: Math.max(1, rect.height || canvas.clientHeight || canvas.height / dpr),
    dpr,
  };
}

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [data-hero-ui]';

// Pointer positions are measured against the canvas wherever the events arrive. A press
// that starts on a link or button belongs to it: no capture (that would steal its click)
// and no colour toggle. Only the position is tracked here; the glow settings come from
// the look each frame.
function installCanvasInput(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
  box: () => HeroLook['box'],
  allowTouchScroll = false,
) {
  let currentBrush = brushState({});
  let deployActive = false;
  let activePointer: number | undefined;
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = allowTouchScroll ? 'pan-y' : 'none';

  const leave = () => { currentBrush = brushState({}); };
  const update = (event: PointerEvent) => {
    if (!event.isPrimary || (activePointer !== undefined && event.pointerId !== activePointer)) return false;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || x > width || y < 0 || y > height) { leave(); return false; }
    currentBrush = simulationBrushState({}, {
      x,
      y,
      active: true,
      inside: isPointInsideBox({ x, y }, { width, height }, box()),
      isMouse: event.pointerType === 'mouse',
    }, height);
    return true;
  };
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || activePointer !== undefined) return;
    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
    activePointer = event.pointerId;
    element.setPointerCapture?.(event.pointerId);
    update(event);
  };
  const move = (event: PointerEvent) => { update(event); };
  const up = (event: PointerEvent) => {
    if (!event.isPrimary || event.pointerId !== activePointer) return;
    if (update(event)) deployActive = !deployActive;
    if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
    activePointer = undefined;
  };
  const cancel = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return;
    if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
    activePointer = undefined;
    leave();
  };
  const pointerLeave = () => { if (activePointer === undefined) leave(); };
  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move, { passive: true });
  element.addEventListener('pointerup', up, { passive: true });
  element.addEventListener('pointercancel', cancel);
  element.addEventListener('pointerleave', pointerLeave);
  return {
    brush: () => currentBrush,
    rgbDeployActive: () => deployActive,
    dispose() {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel);
      element.removeEventListener('pointerleave', pointerLeave);
      if (activePointer !== undefined && element.hasPointerCapture?.(activePointer)) element.releasePointerCapture(activePointer);
      activePointer = undefined;
      canvas.style.touchAction = previousTouchAction;
    },
  };
}

// Tested in simulation space, where the box is defined.
function isPointInsideBox(
  point: { x: number; y: number },
  size: { width: number; height: number },
  spec: HeroLook['box'],
) {
  const factor = simulationFloorFactor(size.height);
  const box = canonicalBoxGeometry({ width: size.width * factor, height: size.height * factor }, spec);
  return boxSdf(point.x * factor, point.y * factor, box) <= 0;
}
