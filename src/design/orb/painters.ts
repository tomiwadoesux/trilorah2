import { MODE_FRAMES, MODE_DRAWS, resolvePreset, type OrbState, type OrbSize, type OrbFrame } from 'thinking-orbs/engine';

/*
 * Painters — the same geometry, put on screen five different ways.
 *
 * Everything here takes an `OrbFrame` from the package's own engine and
 * draws it. The engine is the part worth keeping: nine hand-tuned
 * animations, pure math, no DOM. What this file questions is only the last
 * step — the package paints every dot with its own `beginPath/arc/fill`
 * and a freshly built colour string, and that step is ~80% of the cost.
 *
 * No React and no `document` in this file, so the worker can import it.
 */

export type Ink = readonly [number, number, number];
/** What the package paints on a dark ground. */
export const INK_WHITE: Ink = [255, 255, 255];
/** --tri-ink. The one thing the stock painter cannot do. */
export const INK_TRI: Ink = [0xe5, 0xf3, 0xf2];

export type Surface = HTMLCanvasElement | OffscreenCanvas;

export interface Painter {
  /** Draw the orb as it is at `t` seconds on the package's clock. */
  draw(t: number): void;
  dispose(): void;
}

export interface PainterOpts {
  state: OrbState;
  size: OrbSize;
  /** Device pixel ratio, already capped at 2 like the package does. */
  dpr: number;
  ink: Ink;
}

/** Brightness of a dot on a dark ground: near = bright, as the package does it. */
const level = (white: number) => 1 - Math.min(1, Math.max(0, white));

/* ------------------------------------------------------------------ */
/* stock — the package's own painter, for a like-for-like baseline      */
/* ------------------------------------------------------------------ */

export function stockPainter(canvas: Surface, { state, size, dpr }: PainterOpts): Painter {
  const { mode, speed, opts } = resolvePreset(state, size);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  const draw = MODE_DRAWS[mode];
  return {
    draw(t) {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      draw(ctx, size, t * speed, true, opts);
    },
    dispose() {},
  };
}

/* ------------------------------------------------------------------ */
/* batched — Canvas 2D, one path per ink level instead of one per dot   */
/* ------------------------------------------------------------------ */

const LEVELS = 12;
const ALPHA_STEPS = 4;

/**
 * Same API, same pixels to within one grey step; the difference is that a
 * frame with 140 dots does 12 fills instead of 140. Dots that share a
 * brightness bucket lose their exact z-order relative to each other, but
 * brightness *is* depth in this design — buckets drawn dim-to-bright put
 * near dots on top, which is what the z-sort was for.
 */
export function batchedPainter(canvas: Surface, { state, size, dpr, ink }: PainterOpts): Painter {
  const { mode, speed, opts } = resolvePreset(state, size);
  const frame = MODE_FRAMES[mode];
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  const buckets = new Map<number, Path2D>();
  const [ir, ig, ib] = ink;

  return {
    draw(t) {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const f: OrbFrame = frame(size, t * speed, opts);

      for (const l of f.lines) {
        const lv = level(l.white);
        ctx.strokeStyle = `rgba(${ir * lv},${ig * lv},${ib * lv},${l.a ?? 1})`;
        ctx.lineWidth = l.w;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      }

      buckets.clear();
      for (const d of f.dots) {
        const lv = Math.round(level(d.white) * (LEVELS - 1));
        const a = Math.round((d.a ?? 1) * ALPHA_STEPS);
        const k = lv * (ALPHA_STEPS + 1) + a;
        let path = buckets.get(k);
        if (!path) {
          path = new Path2D();
          buckets.set(k, path);
        }
        path.moveTo(d.x + d.r, d.y);
        path.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      }
      const keys = [...buckets.keys()].sort((p, q) => p - q);
      for (const k of keys) {
        const lv = Math.floor(k / (ALPHA_STEPS + 1)) / (LEVELS - 1);
        const a = (k % (ALPHA_STEPS + 1)) / ALPHA_STEPS;
        ctx.fillStyle = `rgba(${Math.round(ir * lv)},${Math.round(ig * lv)},${Math.round(ib * lv)},${a})`;
        ctx.fill(buckets.get(k)!);
      }
    },
    dispose() {
      buckets.clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/* webgl — points; the GPU draws the circles                           */
/* ------------------------------------------------------------------ */

const POINT_VS = `
attribute vec2 p; attribute float r; attribute vec2 ia;
uniform vec2 res; uniform float dpr;
varying vec2 v;
void main() {
  gl_Position = vec4(p / res * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y *= -1.0;
  gl_PointSize = r * 2.0 * dpr + 2.0;
  v = ia;
}`;

const POINT_FS = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision mediump float;
uniform vec3 ink;
varying vec2 v;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float dist = length(d) * 2.0;
#ifdef GL_OES_standard_derivatives
  float e = fwidth(dist);
  float cov = 1.0 - smoothstep(1.0 - e, 1.0 + e, dist);
#else
  float cov = step(dist, 1.0);
#endif
  float al = cov * v.y;
  gl_FragColor = vec4(ink * v.x * al, al);
}`;

const LINE_VS = `
attribute vec2 p; attribute vec2 ia;
uniform vec2 res;
varying vec2 v;
void main() {
  gl_Position = vec4(p / res * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y *= -1.0;
  v = ia;
}`;

const LINE_FS = `
precision mediump float;
uniform vec3 ink;
varying vec2 v;
void main() { gl_FragColor = vec4(ink * v.x * v.y, v.y); }`;

function compile(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) ?? 'shader failed');
    }
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  return prog;
}

/**
 * One `drawArrays(POINTS)` for the dots and one `drawArrays(LINES)` for the
 * edges. The CPU still runs the engine — that is the floor — but the
 * 140 fills become 140 floats in a buffer, and the circle edge is a
 * `smoothstep` in the fragment shader rather than an arc the rasteriser has
 * to trace. Premultiplied blending, drawn in the engine's own z-order.
 */
export function webglPainter(canvas: Surface, { state, size, dpr, ink }: PainterOpts): Painter {
  const { mode, speed, opts } = resolvePreset(state, size);
  const frame = MODE_FRAMES[mode];
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    preserveDrawingBuffer: false,
  }) as WebGLRenderingContext | null;
  /* A lost context (GPU reset, or a canvas whose previous painter is
     gone) is not an error worth throwing out of a React effect. Paint
     nothing rather than take the gallery down. */
  if (!gl || gl.isContextLost()) return { draw() {}, dispose() {} };

  gl.getExtension('OES_standard_derivatives');
  const P = compile(gl, POINT_VS, POINT_FS);
  const L = compile(gl, LINE_VS, LINE_FS);
  const inkV = [ink[0] / 255, ink[1] / 255, ink[2] / 255] as const;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const dotBuf = gl.createBuffer();
  const lineBuf = gl.createBuffer();
  let dots = new Float32Array(600 * 5);
  let lines = new Float32Array(200 * 8);

  const pa = {
    p: gl.getAttribLocation(P, 'p'),
    r: gl.getAttribLocation(P, 'r'),
    ia: gl.getAttribLocation(P, 'ia'),
    res: gl.getUniformLocation(P, 'res'),
    dpr: gl.getUniformLocation(P, 'dpr'),
    ink: gl.getUniformLocation(P, 'ink'),
  };
  const la = {
    p: gl.getAttribLocation(L, 'p'),
    ia: gl.getAttribLocation(L, 'ia'),
    res: gl.getUniformLocation(L, 'res'),
    ink: gl.getUniformLocation(L, 'ink'),
  };

  return {
    draw(t) {
      const f = frame(size, t * speed, opts);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (f.lines.length) {
        if (lines.length < f.lines.length * 8) lines = new Float32Array(f.lines.length * 8);
        let k = 0;
        for (const l of f.lines) {
          const lv = level(l.white);
          const a = l.a ?? 1;
          lines[k++] = l.x1; lines[k++] = l.y1; lines[k++] = lv; lines[k++] = a;
          lines[k++] = l.x2; lines[k++] = l.y2; lines[k++] = lv; lines[k++] = a;
        }
        gl.useProgram(L);
        gl.uniform2f(la.res, size, size);
        gl.uniform3f(la.ink, inkV[0], inkV[1], inkV[2]);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
        gl.bufferData(gl.ARRAY_BUFFER, lines.subarray(0, k), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(la.p);
        gl.vertexAttribPointer(la.p, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(la.ia);
        gl.vertexAttribPointer(la.ia, 2, gl.FLOAT, false, 16, 8);
        gl.drawArrays(gl.LINES, 0, f.lines.length * 2);
      }

      if (dots.length < f.dots.length * 5) dots = new Float32Array(f.dots.length * 5);
      let k = 0;
      for (const d of f.dots) {
        dots[k++] = d.x; dots[k++] = d.y; dots[k++] = d.r;
        dots[k++] = level(d.white); dots[k++] = d.a ?? 1;
      }
      gl.useProgram(P);
      gl.uniform2f(pa.res, size, size);
      gl.uniform1f(pa.dpr, dpr);
      gl.uniform3f(pa.ink, inkV[0], inkV[1], inkV[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, dotBuf);
      gl.bufferData(gl.ARRAY_BUFFER, dots.subarray(0, k), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pa.p);
      gl.vertexAttribPointer(pa.p, 2, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(pa.r);
      gl.vertexAttribPointer(pa.r, 1, gl.FLOAT, false, 20, 8);
      gl.enableVertexAttribArray(pa.ia);
      gl.vertexAttribPointer(pa.ia, 2, gl.FLOAT, false, 20, 12);
      gl.drawArrays(gl.POINTS, 0, f.dots.length);
    },
    dispose() {
      gl.deleteBuffer(dotBuf);
      gl.deleteBuffer(lineBuf);
      gl.deleteProgram(P);
      gl.deleteProgram(L);
      /* The context itself is left alone. A canvas keeps its context for
         life, so the next painter on this canvas gets the same one back —
         losing it here would hand that painter a dead context and every
         later compile would fail. The context goes when the canvas does. */
    },
  };
}

/* ------------------------------------------------------------------ */
/* Harness                                                             */
/* ------------------------------------------------------------------ */

/** One 60Hz frame in microseconds. */
export const FRAME_US = 1_000_000 / 60;

/**
 * Time `draw` for a short burst and return microseconds per frame.
 *
 * Warms first — a cold canvas path runs several times slower for its first
 * few frames — then samples for `budgetMs`, which is kept under a frame so
 * that measuring never stalls the orbs that are animating on the sheet.
 */
export function timePainter(draw: (t: number) => void, budgetMs = 8): number {
  for (let i = 0; i < 30; i += 1) draw(i * 0.0167);
  const start = performance.now();
  let n = 0;
  do {
    draw((100 + n) * 0.0167);
    n += 1;
  } while (n < 400 && performance.now() - start < budgetMs);
  return ((performance.now() - start) / n) * 1000;
}

/** Marks per frame, averaged over a cycle — density moves through the animation. */
export function countMarks(state: OrbState, size: OrbSize): number {
  const { mode, speed, opts } = resolvePreset(state, size);
  const frame = MODE_FRAMES[mode];
  let marks = 0;
  const samples = 16;
  for (let i = 0; i < samples; i += 1) {
    const f = frame(size, (i / samples) * 4 * speed, opts);
    marks += f.dots.length + f.lines.length;
  }
  return Math.round(marks / samples);
}
