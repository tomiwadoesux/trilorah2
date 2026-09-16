import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ORB_STYLES, WGSL, orbDots, packDots, orbInk, DOT_FLOATS, MAX_DPR } from './ThinkingOrbsPill';

/*
 * Hover-to-play gallery.
 *
 * The grid is still. Hover a card and that orb turns; leave and it freezes
 * on the frame it reached; hover again and it carries on from there rather
 * than snapping back to the start. The pointer is what brings a card to
 * life, so at any instant at most one orb in the grid is animating.
 *
 * Written against the vendored file's exports rather than by editing it,
 * so ThinkingOrbsPill.tsx stays a verbatim copy of what was handed over.
 *
 * The whole design rests on one decision: every cell owns a fixed slot in
 * the dot buffer.
 *
 * The shipped gallery packs its stills contiguously and re-packs all of
 * them whenever anything changes — fine when "anything" is a resize, fatal
 * per frame, because 38 styles of geometry is ~3.4ms and a 60Hz frame is
 * 16.7ms. With fixed slots, a frozen card's dots simply stay in the buffer
 * where they were written; a still card therefore costs nothing at all —
 * no geometry, no upload — and a moving card costs exactly one style's
 * geometry plus a write to its own slot. That is what makes this cheaper
 * than the always-running original rather than more expensive.
 */

export interface HoverGalleryProps {
  /** Rendered size of each orb, CSS px. */
  ball?: number;
  columns?: number;
  selected?: string;
  onSelect?: (id: string) => void;
  dotColor?: string;
  accent?: string;
  pill?: string;
  labelColor?: string;
  /** Keep the selected card running even when the pointer is elsewhere. */
  playsSelected?: boolean;
  /** Multiplier on each style's baked period. */
  speed?: number;
  /** Reports main-thread µs per frame and how many orbs are moving. */
  onCost?: (us: number, moving: number) => void;
}

const GAP = 10;
const LABEL_H = 30;
const CELL_PAD = 24;

/**
 * Slot sizes: the most dots a style ever emits across its loop.
 *
 * Sampled rather than read off `style.dots`, because that field is the
 * nominal count and several loops (burst, wedge) emit fewer or more as
 * they run. A slot too small would clip the orb at its densest instant.
 */
function planSlots(ball: number): { offsets: number[]; sizes: number[]; total: number } {
  const offsets: number[] = [];
  const sizes: number[] = [];
  let total = 0;
  for (let i = 0; i < ORB_STYLES.length; i += 1) {
    let max = 0;
    for (let k = 0; k < 24; k += 1) {
      const n = orbDots(i, k / 24, ball, 1, { n: 1, sp: 1, pv: 1, dz: 1, df: 1, yw: 0, pc: 0, sn: 0, op: 1 }).length;
      if (n > max) max = n;
    }
    offsets.push(total);
    sizes.push(max);
    total += max;
  }
  return { offsets, sizes, total };
}

export function HoverGallery({
  ball = 64,
  columns = 8,
  selected,
  onSelect,
  dotColor = '#F4F1EA',
  accent = '#E8853C',
  pill = 'rgb(21 21 21)',
  labelColor = '#F4F1EA',
  playsSelected = false,
  speed = 1,
  onCost,
}: HoverGalleryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const cols = Math.max(1, columns);
  const rows = Math.ceil(ORB_STYLES.length / cols);
  const cellH = ball + CELL_PAD + LABEL_H;

  /* Phase per cell, and which cells are advancing. Refs, not state: the
     render loop reads these every frame and must not re-run React to do it. */
  const phase = useRef<Float32Array>(new Float32Array(ORB_STYLES.length));
  const hovered = useRef(-1);
  const selectedRef = useRef(-1);
  const costRef = useRef(onCost);
  costRef.current = onCost;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const playsSelectedRef = useRef(playsSelected);
  playsSelectedRef.current = playsSelected;

  selectedRef.current = selected ? ORB_STYLES.findIndex((s) => s.id === selected) : -1;

  const ink = useMemo(() => orbInk(dotColor), [dotColor]);
  const acc = useMemo(() => orbInk(accent), [accent]);
  const inkRef = useRef(ink);
  inkRef.current = ink;
  const accRef = useRef(acc);
  accRef.current = acc;

  /* Cell geometry, in CSS px relative to the grid — shared by the buttons
     (laid out in the DOM) and the packer (drawing into the canvas), so the
     two can never disagree about where a cell is. */
  const cellAt = useCallback(
    (i: number, width: number) => {
      const cellW = (width - GAP * (cols - 1)) / cols;
      return {
        x: (i % cols) * (cellW + GAP),
        y: Math.floor(i / cols) * (cellH + GAP),
        w: cellW,
      };
    },
    [cols, cellH],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const gpu = (navigator as unknown as { gpu?: unknown }).gpu as any;
    if (!gpu) {
      setError('WebGPU is not available in this window.');
      return;
    }

    let stopped = false;
    let raf = 0;
    let cleanup = () => {};

    (async () => {
      const adapter = await gpu.requestAdapter();
      if (!adapter) { setError('No WebGPU adapter is available.'); return; }
      const device = await adapter.requestDevice();
      if (stopped) { device.destroy?.(); return; }
      const ctx = canvas.getContext('webgpu') as any;
      if (!ctx) { setError("This canvas can't provide a WebGPU context."); return; }

      const format = gpu.getPreferredCanvasFormat();
      ctx.configure({ device, format, alphaMode: 'premultiplied' });

      const G = globalThis as any;
      const module = device.createShaderModule({ code: WGSL });
      const layout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: G.GPUShaderStage.VERTEX | G.GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
          { binding: 1, visibility: G.GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        ],
      });
      const pipeline = await device.createRenderPipelineAsync({
        layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
        vertex: { module, entryPoint: 'orb_vertex' },
        fragment: {
          module,
          entryPoint: 'orb_fragment',
          targets: [{
            format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          }],
        },
        primitive: { topology: 'triangle-list' },
      });
      if (stopped) { device.destroy?.(); return; }

      const { offsets, sizes, total } = planSlots(ball);
      const dots = new Float32Array(total * DOT_FLOATS);
      const uniforms = new Float32Array(8);
      const ubo = device.createBuffer({ size: 32, usage: G.GPUBufferUsage.UNIFORM | G.GPUBufferUsage.COPY_DST });
      const dbo = device.createBuffer({ size: total * DOT_FLOATS * 4, usage: G.GPUBufferUsage.STORAGE | G.GPUBufferUsage.COPY_DST });
      const group = device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: { buffer: ubo } },
          { binding: 1, resource: { buffer: dbo } },
        ],
      });

      const KNOBS = { n: 1, sp: 1, pv: 1, dz: 1, df: 1, yw: 0, pc: 0, sn: 0, op: 1 };

      /** Write one cell into its own slot, and blank the slot's remainder. */
      const packCell = (i: number, width: number) => {
        const c = cellAt(i, width);
        const n = packDots(
          { index: i, dotScale: 1, dot: inkRef.current, accent: accRef.current, knobs: KNOBS },
          phase.current[i],
          ball,
          dots,
          offsets[i],
          c.x + (c.w - ball) / 2,
          c.y + 12,
        );
        /* A frame with fewer dots than the slot would otherwise leave the
           previous frame's tail on screen. Alpha 0 and radius 0 retires
           them without disturbing any neighbour's slot. */
        for (let k = n; k < sizes[i]; k += 1) {
          const o = (offsets[i] + k) * DOT_FLOATS;
          dots[o + 2] = 0;
          dots[o + 3] = 0;
        }
        return n;
      };

      const uploadCell = (i: number) => {
        device.queue.writeBuffer(
          dbo,
          offsets[i] * DOT_FLOATS * 4,
          dots,
          offsets[i] * DOT_FLOATS,
          sizes[i] * DOT_FLOATS,
        );
      };

      let lastWidth = 0;
      let lastInk = '';
      let last = performance.now();
      let sum = 0;
      let frames = 0;
      let report = performance.now();

      const frame = () => {
        if (stopped) return;
        raf = requestAnimationFrame(frame);

        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        const rect = host.getBoundingClientRect();
        if (rect.width < 1) return;
        const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
        const dw = Math.max(1, Math.round(rect.width * dpr));
        const dh = Math.max(1, Math.round((rows * cellH + (rows - 1) * GAP) * dpr));
        if (canvas.width !== dw || canvas.height !== dh) { canvas.width = dw; canvas.height = dh; }

        const t0 = performance.now();
        const inkKey = inkRef.current.join(',') + accRef.current.join(',');

        /* A resize or a colour change invalidates every slot — the only
           time all 38 are re-packed, and it is not a per-frame path. */
        if (rect.width !== lastWidth || inkKey !== lastInk) {
          lastWidth = rect.width;
          lastInk = inkKey;
          for (let i = 0; i < ORB_STYLES.length; i += 1) packCell(i, rect.width);
          device.queue.writeBuffer(dbo, 0, dots, 0, total * DOT_FLOATS);
        }

        /* The per-frame path: only what is actually moving. */
        const running: number[] = [];
        if (hovered.current >= 0) running.push(hovered.current);
        if (playsSelectedRef.current && selectedRef.current >= 0 && selectedRef.current !== hovered.current) {
          running.push(selectedRef.current);
        }
        for (const i of running) {
          const period = ORB_STYLES[i].period / Math.max(0.0001, speedRef.current);
          phase.current[i] = (phase.current[i] + dt / period) % 1;
          packCell(i, rect.width);
          uploadCell(i);
        }

        uniforms[0] = dw; uniforms[1] = dh;
        uniforms[2] = 0; uniforms[3] = 0;
        uniforms[4] = dpr;
        device.queue.writeBuffer(ubo, 0, uniforms);

        const enc = device.createCommandEncoder();
        const pass = enc.beginRenderPass({
          colorAttachments: [{
            view: ctx.getCurrentTexture().createView(),
            loadOp: 'clear', storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          }],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group);
        pass.draw(6, total);
        pass.end();
        device.queue.submit([enc.finish()]);

        sum += (performance.now() - t0) * 1000;
        frames += 1;
        if (now - report > 700) {
          costRef.current?.(sum / frames, running.length);
          sum = 0; frames = 0; report = now;
        }
      };

      cleanup = () => { ubo.destroy(); dbo.destroy(); device.destroy?.(); };
      frame();
    })().catch((err) => setError(String(err?.message ?? err)));

    return () => { stopped = true; cancelAnimationFrame(raf); cleanup(); };
  }, [ball, cols, cellH, rows, cellAt]);

  const gridH = rows * cellH + (rows - 1) * GAP;

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%', height: gridH }}>
      {/* Above the cards, not behind them: each card paints an opaque
          background, so a canvas underneath is simply covered. It takes no
          pointer events, so the buttons below still get every hover. */}
      <canvas
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', zIndex: 1 }}
        ref={canvasRef}
      />
      {error && (
        <div className="absolute inset-x-0 top-0 rounded-[12px] px-4 py-3 font-mono text-[11px] text-[var(--tri-ink-danger)]" style={{ background: pill }}>
          {error}
        </div>
      )}
      {ORB_STYLES.map((s, i) => {
        const c = cellAt(i, hostRef.current?.getBoundingClientRect().width ?? 900);
        const on = s.id === selected;
        return (
          <button
            key={s.id}
            type="button"
            title={s.motion}
            /* The pointer is the transport control. Enter starts this cell
               advancing, leave freezes it where it stands — the phase array
               is never reset, which is what makes a second hover continue
               rather than restart. */
            onPointerEnter={() => { hovered.current = i; }}
            onPointerLeave={() => { if (hovered.current === i) hovered.current = -1; }}
            onFocus={() => { hovered.current = i; }}
            onBlur={() => { if (hovered.current === i) hovered.current = -1; }}
            onClick={() => onSelect?.(s.id)}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y,
              width: c.w,
              height: cellH,
              boxSizing: 'border-box',
              margin: 0,
              padding: 0,
              background: pill,
              border: '1px solid ' + (on ? 'transparent' : 'rgb(255 255 255 / 0.08)'),
              boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'none',
              borderRadius: 14,
              cursor: 'pointer',
              appearance: 'none',
              color: labelColor,
              font: 'inherit',
            }}
          >
            <span
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 9, padding: '0 6px',
                fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                color: on ? accent : labelColor, opacity: on ? 1 : 0.63,
              }}
            >
              {s.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
