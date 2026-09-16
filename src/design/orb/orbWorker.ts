import { webglPainter, timePainter, type Painter, type PainterOpts } from './painters';

/*
 * The orb, off the main thread.
 *
 * The page hands over an OffscreenCanvas and never hears about it again:
 * this worker runs its own requestAnimationFrame, paints with the WebGL
 * painter, and the compositor picks the result up directly. The main
 * thread's per-frame cost is zero by construction — not "small", zero —
 * which is the property that matters on a live-service screen where the
 * transcript is scrolling under it.
 *
 * The engine can run here at all because it is closure-free Math (the
 * package author did that for React Native worklets). Same code, same
 * pixels, different thread.
 */

type Start = { type: 'start'; id: number; canvas: OffscreenCanvas } & PainterOpts;
type Stop = { type: 'stop'; id: number };
type Measure = { type: 'measure'; id: number } & PainterOpts;
export type WorkerIn = Start | Stop | Measure;

/** A running orb's average draw cost, reported every second or so. */
export type WorkerOut =
  | { type: 'cost'; id: number; us: number }
  | { type: 'measured'; id: number; us: number };

interface Instance {
  painter: Painter;
  raf: number;
  /** Rolling cost: sum and count since the last report. */
  sum: number;
  n: number;
  lastReport: number;
}

const instances = new Map<number, Instance>();
const post = (m: WorkerOut) => (self as unknown as Worker).postMessage(m);

/* One bench canvas, reused. A WebGL context is not free to create and the
   page's budget of them is shared with the worker's. */
let bench: OffscreenCanvas | null = null;

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const m = e.data;

  if (m.type === 'start') {
    stop(m.id);
    const painter = webglPainter(m.canvas, m);
    const inst: Instance = { painter, raf: 0, sum: 0, n: 0, lastReport: performance.now() };
    instances.set(m.id, inst);
    const loop = () => {
      const t0 = performance.now();
      painter.draw(t0 / 1000);
      const now = performance.now();
      inst.sum += (now - t0) * 1000;
      inst.n += 1;
      if (now - inst.lastReport > 1000) {
        post({ type: 'cost', id: m.id, us: inst.sum / inst.n });
        inst.sum = 0;
        inst.n = 0;
        inst.lastReport = now;
      }
      inst.raf = requestAnimationFrame(loop);
    };
    inst.raf = requestAnimationFrame(loop);
    return;
  }

  if (m.type === 'stop') {
    stop(m.id);
    return;
  }

  if (m.type === 'measure') {
    bench ??= new OffscreenCanvas(1, 1);
    const painter = webglPainter(bench, m);
    const us = timePainter((t) => painter.draw(t));
    /* Do not dispose: that would lose the context we mean to reuse. The
       next painter re-inits programs on the same context. */
    post({ type: 'measured', id: m.id, us });
  }
};

function stop(id: number) {
  const inst = instances.get(id);
  if (!inst) return;
  cancelAnimationFrame(inst.raf);
  inst.painter.dispose();
  instances.delete(id);
}
