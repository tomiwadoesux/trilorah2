import {
  WGSL,
  ORB_STYLES,
  orbDots,
  sizeDotScale,
  packDots,
  orbInk,
  MAX_DOTS,
  DOT_FLOATS,
  MAX_DPR,
} from './ThinkingOrbsPill';
import { FRAME_US, timePainter } from './painters';

/*
 * Harness for the second orb system (ThinkingOrbsPill.tsx).
 *
 * Its frame is: run the style's geometry (150 dots, sorted by depth), pack
 * them into a Float32Array, upload two buffers, encode one render pass with
 * a single instanced draw, submit. This times exactly that path on one
 * scratch WebGPU device, with the same warm-up and budget the C-65 harness
 * uses for the other renderers — so a number here and a number there were
 * taken the same way.
 *
 * The GPU's own time is invisible from here, as it was for WebGL on C-65.
 * The main thread is the operator's screen; that is what is measured.
 */

export interface Orb2Style {
  id: string;
  name: string;
  label: string;
  period: number;
  dots: number;
  motion: string;
  desc: string;
}

export const ORB2_STYLES: Orb2Style[] = ORB_STYLES;

export interface Orb2Weight {
  /** Dots actually emitted per frame, averaged over the loop. */
  dots: number;
  /** The geometry alone — what any renderer of this system has to pay. */
  geoUs: number;
  /** The whole main-thread frame: geometry + pack + upload + submit. */
  mainUs: number;
  /** Main-thread share of one 60Hz frame. */
  share: number;
  /** False if WebGPU was unavailable and only geometry + pack was timed. */
  gpu: boolean;
}

/** The component's own defaults — every knob at 1, no extra spin or tilt. */
const KNOBS0 = { n: 1, sp: 1, pv: 1, dz: 1, df: 1, yw: 0, pc: 0, sn: 0, op: 1 };
const DOT = orbInk('#F4F1EA');
const ACCENT = orbInk('#E8853C');

export const hasWebGPU = () => typeof navigator !== 'undefined' && !!(navigator as unknown as { gpu?: unknown }).gpu;

/* WebGPU has no types in this project's lib set; the vendored file is
   `any` throughout for the same reason, so the harness follows it. */
/* eslint-disable @typescript-eslint/no-explicit-any */
interface Gpu {
  device: any;
  ctx: any;
  pipeline: any;
  group: any;
  ubo: any;
  dbo: any;
  uniforms: Float32Array;
  dots: Float32Array;
  size: number;
  dpr: number;
}

let gpuPromise: Promise<Gpu | null> | null = null;

/* Dev only: a hot update of this module would otherwise leave the bench
   device — and its buffers and canvas — alive with nothing pointing at it,
   once per save. Destroy it with the module. */
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void gpuPromise?.then((g) => g?.device?.destroy?.());
    gpuPromise = null;
  });
}

/**
 * One scratch device and pipeline, built once and reused for all 38 styles.
 * The Pill component builds one of these per instance; the harness does not
 * need to repeat that cost per measurement, and doing so would be measuring
 * device creation rather than frames.
 */
function getGpu(size: number): Promise<Gpu | null> {
  gpuPromise ??= (async () => {
    const gpu = (navigator as any).gpu;
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;opacity:0';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('webgpu') as any;
    if (!ctx) return null;
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
        targets: [
          {
            format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });
    const ubo = device.createBuffer({ size: 32, usage: G.GPUBufferUsage.UNIFORM | G.GPUBufferUsage.COPY_DST });
    const dbo = device.createBuffer({
      size: MAX_DOTS * DOT_FLOATS * 4,
      usage: G.GPUBufferUsage.STORAGE | G.GPUBufferUsage.COPY_DST,
    });
    const group = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: ubo } },
        { binding: 1, resource: { buffer: dbo } },
      ],
    });
    return {
      device,
      ctx,
      pipeline,
      group,
      ubo,
      dbo,
      uniforms: new Float32Array(8),
      dots: new Float32Array(MAX_DOTS * DOT_FLOATS),
      size,
      dpr,
    };
  })().catch((err) => {
    console.warn('orb2 harness: WebGPU unavailable', err);
    return null;
  });
  return gpuPromise;
}

/** The body of the component's own frame(), minus the DOM measurements it does for layout. */
function frame(g: Gpu, s: any, t01: number) {
  const dw = Math.round(g.size * g.dpr);
  const count = packDots(s, t01, g.size, g.dots);
  g.uniforms[0] = dw;
  g.uniforms[1] = dw;
  g.uniforms[2] = 0;
  g.uniforms[3] = 0;
  g.uniforms[4] = g.dpr;
  g.device.queue.writeBuffer(g.ubo, 0, g.uniforms);
  if (count > 0) g.device.queue.writeBuffer(g.dbo, 0, g.dots, 0, count * DOT_FLOATS);
  const enc = g.device.createCommandEncoder();
  const pass = enc.beginRenderPass({
    colorAttachments: [
      {
        view: g.ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
      },
    ],
  });
  if (count > 0) {
    pass.setPipeline(g.pipeline);
    pass.setBindGroup(0, g.group);
    pass.draw(6, count);
  }
  pass.end();
  g.device.queue.submit([enc.finish()]);
}

/** Measure one style at `size` CSS px. Same warm-up and budget as the C-65 harness. */
export async function measureOrb2(index: number, size = 64): Promise<Orb2Weight> {
  const style = ORB_STYLES[index];
  const ds = sizeDotScale(size);
  const t01 = (seconds: number) => (seconds / style.period) % 1;
  const s = { index, dotScale: 1, dot: DOT, accent: ACCENT, knobs: KNOBS0 };

  /* Dot count moves through some loops (burst, wedge), so average it. */
  let dots = 0;
  const samples = 16;
  for (let i = 0; i < samples; i += 1) dots += orbDots(index, i / samples, size, ds, KNOBS0).length;
  dots = Math.round(dots / samples);

  const geoUs = timePainter((sec) => {
    orbDots(index, t01(sec), size, ds, KNOBS0);
  });

  const g = await getGpu(size);
  if (!g) {
    const scratch = new Float32Array(MAX_DOTS * DOT_FLOATS);
    const mainUs = timePainter((sec) => {
      packDots(s, t01(sec), size, scratch);
    });
    return { dots, geoUs, mainUs, share: mainUs / FRAME_US, gpu: false };
  }

  const mainUs = timePainter((sec) => frame(g, s, t01(sec)));
  return { dots, geoUs, mainUs, share: mainUs / FRAME_US, gpu: true };
}
