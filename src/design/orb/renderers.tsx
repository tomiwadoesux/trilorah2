import { Component, useEffect, useRef, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react';
import { ThinkingOrb, type OrbState, type OrbSize } from 'thinking-orbs';
import { MODE_FRAMES, resolvePreset } from 'thinking-orbs/engine';
import type P5 from 'p5';
import {
  stockPainter,
  batchedPainter,
  webglPainter,
  timePainter,
  countMarks,
  FRAME_US,
  INK_WHITE,
  type Ink,
  type Painter,
  type PainterOpts,
} from './painters';
import type { WorkerIn, WorkerOut } from './orbWorker';

/*
 * Six ways to put the same orb on screen, as components that really run,
 * and one harness that measures all six the same way.
 *
 * The live components are for looking at — do they draw the same thing.
 * The harness is for comparing — it times each painter on its own scratch
 * surface for a few milliseconds, so the number for `stock` and the number
 * for `webgl` were taken under the same conditions, not read off two
 * different animation loops that happened to be fighting different
 * neighbours for the thread.
 */

export type RendererId = 'stock' | 'batched' | 'webgl' | 'worker' | 'dom' | 'p5';

export interface OrbProps {
  state: OrbState;
  size: OrbSize;
  ink: Ink;
  /** Report the running instance's own draw cost, µs, about once a second. */
  onCost?: (us: number) => void;
}

export interface RendererSpec {
  id: RendererId;
  title: string;
  /** How it paints, in one line. */
  how: string;
  /** Where the per-frame work lands. */
  thread: 'main' | 'worker';
  /** Can it paint in a colour other than the package's grey? */
  takesInk: boolean;
  Component: ComponentType<OrbProps>;
}

const cappedDpr = () => Math.min(2, window.devicePixelRatio || 1);

/* ------------------------------------------------------------------ */
/* Shared loop for the main-thread canvas painters                     */
/* ------------------------------------------------------------------ */

/**
 * The package's own loop, reproduced: performance.now() as the clock so
 * every instance stays in phase, paused while offscreen or the tab is
 * hidden, and a single static frame under prefers-reduced-motion.
 */
function useCanvasLoop(
  ref: React.RefObject<HTMLCanvasElement | null>,
  make: (canvas: HTMLCanvasElement, opts: PainterOpts) => Painter,
  { state, size, ink, onCost }: OrbProps,
) {
  const costRef = useRef(onCost);
  costRef.current = onCost;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let painter: Painter;
    try {
      painter = make(canvas, { state, size, dpr: cappedDpr(), ink });
    } catch (err) {
      /* Surface it on the column, not the gallery: the boundary below
         catches render errors, but an effect that throws unmounts the tree. */
      console.warn('orb painter failed', err);
      return;
    }

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      painter.draw(0.6);
      return () => painter.dispose();
    }

    let raf = 0;
    let running = false;
    let visible = true;
    let sum = 0;
    let n = 0;
    let last = performance.now();

    const tick = () => {
      const t0 = performance.now();
      painter.draw(t0 / 1000);
      const now = performance.now();
      sum += (now - t0) * 1000;
      n += 1;
      if (now - last > 1000) {
        costRef.current?.(sum / n);
        sum = 0;
        n = 0;
        last = now;
      }
      if (running) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && document.visibilityState !== 'hidden') start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => {
      if (document.visibilityState === 'hidden') stop();
      else if (visible) start();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      painter.dispose();
    };
  }, [ref, make, state, size, ink]);
}

function canvasOrb(make: (canvas: HTMLCanvasElement, opts: PainterOpts) => Painter, label: string) {
  return function CanvasOrb(props: OrbProps) {
    const ref = useRef<HTMLCanvasElement>(null);
    useCanvasLoop(ref, make, props);
    return (
      <canvas
        ref={ref}
        role="img"
        aria-label={`${props.state}, ${label}`}
        style={{ width: props.size, height: props.size, display: 'block' }}
      />
    );
  };
}

/* ------------------------------------------------------------------ */
/* stock — the installed component, untouched                          */
/* ------------------------------------------------------------------ */

function StockOrb({ state, size }: OrbProps) {
  /* No cost callback: the component owns its loop and does not report.
     Its number comes from the harness, which runs its painter. */
  return <ThinkingOrb state={state} size={size} theme="dark" />;
}

/* ------------------------------------------------------------------ */
/* worker — OffscreenCanvas, one shared worker for the whole sheet     */
/* ------------------------------------------------------------------ */

let worker: Worker | null = null;
let nextId = 1;
const listeners = new Map<number, (m: WorkerOut) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./orbWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerOut>) => listeners.get(e.data.id)?.(e.data);
  }
  return worker;
}

/*
 * Dev only. A hot update replaces this module, and with it `worker` — but
 * the OLD worker keeps running whatever loops it had, on canvases that no
 * longer exist, until the page is reloaded. That was "the sheet gets heavy
 * while I edit and a reload fixes it". Kill it with the module.
 */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    worker?.terminate();
    worker = null;
    listeners.clear();
  });
}

function WorkerOrb({ state, size, ink, onCost }: OrbProps) {
  const ref = useRef<HTMLDivElement>(null);
  const costRef = useRef(onCost);
  costRef.current = onCost;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    /* A canvas can be transferred once. The host element is replaced with a
       fresh canvas on every (state, ink) change rather than reused. */
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `width:${size}px;height:${size}px;display:block`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${state}, in a worker`);
    host.replaceChildren(canvas);

    const id = nextId++;
    const w = getWorker();
    listeners.set(id, (m) => {
      if (m.type === 'cost') costRef.current?.(m.us);
    });
    const offscreen = canvas.transferControlToOffscreen();
    const msg: WorkerIn = { type: 'start', id, canvas: offscreen, state, size, dpr: cappedDpr(), ink };
    w.postMessage(msg, [offscreen]);

    return () => {
      w.postMessage({ type: 'stop', id } satisfies WorkerIn);
      listeners.delete(id);
    };
  }, [state, size, ink]);

  return <div ref={ref} style={{ width: size, height: size }} />;
}

/* ------------------------------------------------------------------ */
/* dom — one element per dot, styled by JS each frame                  */
/* ------------------------------------------------------------------ */

/**
 * What "do it in CSS" means when every dot moves every frame: the
 * geometry still has to be written into the DOM, one transform and one
 * opacity per dot, and the browser then has to recalc style for all of
 * them. CSS animations are cheap only when the browser owns the whole
 * motion, and it cannot own a depth-sorted scramble.
 */
function domPaint(host: HTMLElement, els: HTMLDivElement[], f: ReturnType<(typeof MODE_FRAMES)['orbits']>, ink: Ink) {
  while (els.length < f.dots.length) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:0;top:0;width:2px;height:2px;border-radius:50%;background:rgb(${ink[0]},${ink[1]},${ink[2]});will-change:transform,opacity`;
    host.appendChild(el);
    els.push(el);
  }
  let n = 0;
  for (const d of f.dots) {
    const el = els[n++];
    const lv = 1 - Math.min(1, Math.max(0, d.white));
    el.style.transform = `translate(${d.x - 1}px,${d.y - 1}px) scale(${d.r})`;
    el.style.opacity = (lv * (d.a ?? 1)).toFixed(2);
  }
  for (let i = n; i < els.length; i += 1) els[i].style.opacity = '0';
}

function DomOrb({ state, size, ink, onCost }: OrbProps) {
  const ref = useRef<HTMLDivElement>(null);
  const costRef = useRef(onCost);
  costRef.current = onCost;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.replaceChildren();
    const { mode, speed, opts } = resolvePreset(state, size);
    const frame = MODE_FRAMES[mode];
    const els: HTMLDivElement[] = [];
    let raf = 0;
    let sum = 0;
    let n = 0;
    let last = performance.now();
    const tick = () => {
      const t0 = performance.now();
      domPaint(host, els, frame(size, (t0 / 1000) * speed, opts), ink);
      const now = performance.now();
      sum += (now - t0) * 1000;
      n += 1;
      if (now - last > 1000) {
        costRef.current?.(sum / n);
        sum = 0;
        n = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      host.replaceChildren();
    };
  }, [state, size, ink]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${state}, as DOM elements`}
      style={{ position: 'relative', width: size, height: size, overflow: 'hidden' }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* p5 — the same arcs through p5's API                                 */
/* ------------------------------------------------------------------ */

let p5Module: Promise<typeof P5> | null = null;
/** Loaded on first use only — p5 is 1MB and the sandbox should not pay it on every sheet. */
const loadP5 = () => (p5Module ??= import('p5').then((m) => m.default));

/**
 * Build a p5 sketch that draws frames from the engine. Shared by the live
 * component (looping) and the harness (noLoop + redraw).
 */
function p5Sketch(
  P: typeof P5,
  host: HTMLElement,
  { state, size, dpr, ink }: PainterOpts,
  loop: boolean,
  onFrame?: (us: number) => void,
): P5 {
  const { mode, speed, opts } = resolvePreset(state, size);
  const frame = MODE_FRAMES[mode];
  const [ir, ig, ib] = ink;
  return new P((p) => {
    p.setup = () => {
      p.createCanvas(size, size);
      p.pixelDensity(dpr);
      if (!loop) p.noLoop();
    };
    p.draw = () => {
      const t0 = performance.now();
      const f = frame(size, (t0 / 1000) * speed, opts);
      p.clear();
      for (const l of f.lines) {
        const lv = 1 - Math.min(1, Math.max(0, l.white));
        p.stroke(ir * lv, ig * lv, ib * lv, (l.a ?? 1) * 255);
        p.strokeWeight(l.w);
        p.line(l.x1, l.y1, l.x2, l.y2);
      }
      p.noStroke();
      for (const d of f.dots) {
        const lv = 1 - Math.min(1, Math.max(0, d.white));
        p.fill(ir * lv, ig * lv, ib * lv, (d.a ?? 1) * 255);
        p.circle(d.x, d.y, d.r * 2);
      }
      onFrame?.((performance.now() - t0) * 1000);
    };
  }, host, true);
}

function P5Orb({ state, size, ink, onCost }: OrbProps) {
  const ref = useRef<HTMLDivElement>(null);
  const costRef = useRef(onCost);
  costRef.current = onCost;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let inst: P5 | null = null;
    let cancelled = false;
    let sum = 0;
    let n = 0;
    let last = performance.now();
    loadP5().then((P) => {
      if (cancelled) return;
      host.replaceChildren();
      inst = p5Sketch(P, host, { state, size, dpr: cappedDpr(), ink }, true, (us) => {
        sum += us;
        n += 1;
        const now = performance.now();
        if (now - last > 1000) {
          costRef.current?.(sum / n);
          sum = 0;
          n = 0;
          last = now;
        }
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
      inst?.remove();
      host.replaceChildren();
    };
  }, [state, size, ink]);

  /* p5 appends its canvas into `ref`, so that div is a leaf React never
     writes into — the loading note is a sibling, not a child, or React
     would try to remove a span p5 has already replaced and crash the
     whole gallery on unmount. */
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div ref={ref} role="img" aria-label={`${state}, via p5`} style={{ width: size, height: size }} />
      {!ready && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--tri-ink-muted)]">
          loading p5…
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Containment                                                         */
/* ------------------------------------------------------------------ */

interface BoundaryState {
  error: string | null;
}

/**
 * Six experimental renderers share one page with the rest of the gallery.
 * If one of them throws — no WebGL, p5 refusing to load, a context lost
 * mid-frame — it should say so in its own column, not blank every sheet.
 */
export class RendererBoundary extends Component<{ children: ReactNode; resetKey: string }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(err: unknown): BoundaryState {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.warn('orb renderer failed', err, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    /* A new state or ink is a fresh attempt. */
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-full px-2 text-center font-mono text-[10px] leading-4 text-[var(--tri-ink-danger)]">
          failed: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* The roster                                                          */
/* ------------------------------------------------------------------ */

export const RENDERERS: RendererSpec[] = [
  {
    id: 'stock',
    title: 'stock',
    how: 'the installed component — Canvas 2D, one arc + fill per dot',
    thread: 'main',
    takesInk: false,
    Component: StockOrb,
  },
  {
    id: 'batched',
    title: 'batched 2D',
    how: 'Canvas 2D, dots grouped by brightness — 12 fills per frame, not 140',
    thread: 'main',
    takesInk: true,
    Component: canvasOrb(batchedPainter, 'batched canvas'),
  },
  {
    id: 'webgl',
    title: 'WebGL',
    how: 'gl.POINTS — the GPU draws the circles, one draw call per frame',
    thread: 'main',
    takesInk: true,
    Component: canvasOrb(webglPainter, 'WebGL'),
  },
  {
    id: 'worker',
    title: 'worker',
    how: 'WebGL in a Worker via OffscreenCanvas — the page does nothing per frame',
    thread: 'worker',
    takesInk: true,
    Component: WorkerOrb,
  },
  {
    id: 'dom',
    title: 'DOM / CSS',
    how: 'one <div> per dot, transform + opacity rewritten every frame',
    thread: 'main',
    takesInk: true,
    Component: DomOrb,
  },
  {
    id: 'p5',
    title: 'p5.js',
    how: 'p5 instance mode — clear(), fill(), circle() per dot, p5 runs the loop',
    thread: 'main',
    takesInk: true,
    Component: P5Orb,
  },
];

export const findRenderer = (id: RendererId) => RENDERERS.find((r) => r.id === id)!;

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

export interface Weight {
  /** Dots + lines drawn per frame. */
  marks: number;
  /** Main-thread microseconds per frame. Zero for the worker. */
  mainUs: number;
  /** Microseconds per frame wherever the work actually runs. */
  workUs: number;
  /** Main-thread share of one 60Hz frame — the number that matters. */
  share: number;
}

/* One scratch surface per kind, reused: WebGL contexts are rationed, and
   a fresh canvas per measurement would also re-pay its allocation. */
const scratch: Partial<Record<'2d' | 'webgl' | 'dom' | 'p5', HTMLElement>> = {};
function scratchEl(kind: keyof typeof scratch, tag: 'canvas' | 'div'): HTMLElement {
  let el = scratch[kind];
  if (!el) {
    el = document.createElement(tag);
    /* Attached so DOM and p5 measurements include a real style flush;
       off-canvas so it never paints. */
    el.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;opacity:0';
    document.body.appendChild(el);
    scratch[kind] = el;
  }
  return el;
}

function measureWorker(opts: PainterOpts): Promise<number> {
  return new Promise((resolve) => {
    const id = nextId++;
    listeners.set(id, (m) => {
      if (m.type !== 'measured') return;
      listeners.delete(id);
      resolve(m.us);
    });
    getWorker().postMessage({ type: 'measure', id, ...opts } satisfies WorkerIn);
  });
}

async function measureP5(opts: PainterOpts): Promise<number> {
  const P = await loadP5();
  const host = scratchEl('p5', 'div');
  host.replaceChildren();
  const inst = p5Sketch(P, host, opts, false);
  /* redraw() is async in p5 2 — so this is an awaited loop rather than
     timePainter, with the same warm-up and budget. */
  for (let i = 0; i < 30; i += 1) await inst.redraw();
  const start = performance.now();
  let n = 0;
  do {
    await inst.redraw();
    n += 1;
  } while (n < 400 && performance.now() - start < 8);
  const us = ((performance.now() - start) / n) * 1000;
  inst.remove();
  return us;
}

/** Measure one renderer for one (state, size). Same warm-up, same budget, for all six. */
export async function measureRenderer(id: RendererId, state: OrbState, size: OrbSize, ink: Ink = INK_WHITE): Promise<Weight> {
  const opts: PainterOpts = { state, size, dpr: cappedDpr(), ink };
  const marks = countMarks(state, size);
  let mainUs = 0;
  let workUs = 0;

  switch (id) {
    case 'stock':
    case 'batched': {
      const canvas = scratchEl('2d', 'canvas') as HTMLCanvasElement;
      const painter = (id === 'stock' ? stockPainter : batchedPainter)(canvas, opts);
      mainUs = workUs = timePainter((t) => painter.draw(t));
      painter.dispose();
      break;
    }
    case 'webgl': {
      const canvas = scratchEl('webgl', 'canvas') as HTMLCanvasElement;
      const painter = webglPainter(canvas, opts);
      mainUs = workUs = timePainter((t) => painter.draw(t));
      /* Not disposed: dispose() loses the context, and this canvas is the
         one we mean to keep. The next painter re-inits on it. */
      break;
    }
    case 'worker': {
      workUs = await measureWorker(opts);
      mainUs = 0;
      break;
    }
    case 'dom': {
      const host = scratchEl('dom', 'div');
      host.replaceChildren();
      const { mode, speed, opts: o } = resolvePreset(state, size);
      const frame = MODE_FRAMES[mode];
      const els: HTMLDivElement[] = [];
      mainUs = workUs = timePainter((t) => {
        domPaint(host, els, frame(size, t * speed, o), ink);
        /* Force the style flush the browser would do at the end of the
           frame, so its cost is counted where it belongs. */
        void host.offsetWidth;
        void getComputedStyle(els[0]).opacity;
      });
      host.replaceChildren();
      break;
    }
    case 'p5': {
      mainUs = workUs = await measureP5(opts);
      break;
    }
  }

  return { marks, mainUs, workUs, share: mainUs / FRAME_US };
}
