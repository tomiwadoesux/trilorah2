import type { Frame, FramePass, Gpu, Target } from 'vgpu';
import { bundle, draw, geometry, target } from 'vgpu';

import ledEmittersWgsl from './shaders/led-emitters.wgsl';
import type { HeroLook } from './look';
import {
  EDGE_COUNT,
  LED_EMITTER_MESH_EXPANSION_PX,
  LED_SDF_CROP_EXPANSION_PX,
  boxEdgeLedLayout,
  canonicalBoxGeometry,
  type BoxGeometry,
  type RenderSize,
  type SceneTunables as LightTunables,
} from './settings';

const LIGHT_SOURCES_FORMAT: GPUTextureFormat = 'rgba16float';

export interface LightSourcesRaw {
  readonly texture: Target;
  readonly ready: Promise<unknown>;
  encode(args: {
    frame: Frame;
    tunables: LightTunables;
  }): void;
  destroy(): void;
}

interface CreateLightSourcesRawOptions {
  size: readonly [number, number];
  ledStorage: unknown;
  look: HeroLook;
}

export function createLightSourcesRaw(
  gpu: Gpu,
  opts: CreateLightSourcesRawOptions,
): LightSourcesRaw {
  const simSize: RenderSize = { width: opts.size[0], height: opts.size[1] };
  const box = canonicalBoxGeometry(simSize, opts.look.box);

  const colorTarget = target(gpu, {
    size: [simSize.width, simSize.height],
    format: LIGHT_SOURCES_FORMAT,
    label: 'box-led-hero-light-sources',
  });

  const ledVertices = ledEmitterVertexData(
    simSize,
    opts.look,
    LED_EMITTER_MESH_EXPANSION_PX,
  );
  const ledGeometry = geometry(gpu, {
    label: 'box-led-hero-led-emitters',
    buffers: [{
      data: ledVertices.buffer as ArrayBuffer,
      stride: 12,
      attributes: {
        position: 'float32x2',
        led_index: 'float32',
      },
    }],
  });

  const ledEmittersDraw = draw(gpu, {
    shader: ledEmittersWgsl,
    label: 'box-led-hero-led-emitters-pass',
    geometry: ledGeometry,
    writeMask: ['r', 'g', 'b'],
    set: { cfg: initialLightSourcesUniform(), leds: opts.ledStorage },
  });

  const ready = ledEmittersDraw.compile(colorTarget);
  const emittersBundle = bundle(gpu, { target: colorTarget, label: 'box-led-hero-led-emitters' },
    (recorded) => recorded.draw(ledEmittersDraw),
  );

  return {
    texture: colorTarget,
    ready,
    encode({ frame, tunables }) {
      ledEmittersDraw.set({ cfg: lightSourcesUniform(simSize, tunables, box) });
      frame.pass(
        { target: colorTarget, clear: [0, 0, 0, 1000] },
        (pass: FramePass) => pass.bundles(emittersBundle),
      );
    },
    destroy() {
      (colorTarget as { destroy?: () => void }).destroy?.();
      ledGeometry.destroy();
    },
  };
}

function lightSourcesUniform(
  size: RenderSize,
  tunables: LightTunables,
  box: BoxGeometry,
) {
  return {
    resolution: [size.width, size.height],
    tunables: [
      tunables.ledIntensity,
      tunables.brightnessMin,
      tunables.brightnessMax,
      0,
    ],
    box: [box.center.x, box.center.y, box.halfWidth, box.halfHeight],
    led_clip: [LED_SDF_CROP_EXPANSION_PX, 0, 0, 0],
  };
}

function initialLightSourcesUniform() {
  return {
    resolution: [0, 0],
    tunables: [0, 0, 0, 0],
    box: [0, 0, 0, 0],
    led_clip: [0, 0, 0, 0],
  };
}

function ledEmitterVertexData(
  size: RenderSize,
  look: HeroLook,
  pad: number,
): Float32Array {
  const layout = boxEdgeLedLayout(size, look);
  const { normalHalfThickness } = layout.ledShape;
  const paddedHalfThickness = normalHalfThickness + pad;
  const values: number[] = [];

  const pushVertex = (
    ledIndex: number,
    x: number,
    y: number,
  ) => {
    values.push(x, y, ledIndex);
  };

  const pushQuad = (
    ledIndex: number,
    center: { x: number; y: number },
    edgeDir: { x: number; y: number },
    edgeNormal: { x: number; y: number },
    startT: number,
    endT: number,
    minN: number,
    maxN: number,
  ) => {
    const corners = [
      { t: startT, n: minN },
      { t: endT, n: minN },
      { t: endT, n: maxN },
      { t: startT, n: maxN },
    ] as const;
    const indices = [0, 1, 2, 0, 2, 3] as const;
    for (const cornerIndex of indices) {
      const corner = corners[cornerIndex];
      pushVertex(
        ledIndex,
        center.x + edgeDir.x * corner.t + edgeNormal.x * corner.n,
        center.y + edgeDir.y * corner.t + edgeNormal.y * corner.n,
      );
    }
  };

  // LED spacing differs slightly between the long and short edges, so each edge carries
  // its own LED length.
  const paddedHalfLengths = layout.edges.map((edge) => edge.tangentHalfLength + pad);
  for (const [e, edge] of layout.edges.entries()) {
    const basis = edgeBasis(edge.angle);
    const halfLength = paddedHalfLengths[e];
    for (let i = edge.start; i < edge.start + edge.count; i++) {
      pushQuad(
        i,
        layout.positions[i],
        basis.dir,
        basis.normal,
        -halfLength,
        halfLength,
        -paddedHalfThickness,
        paddedHalfThickness,
      );
    }
  }

  // Fill each corner between the last LED of the incoming edge and the first of the
  // outgoing one, split along the corner bisector.
  for (let edge = 0; edge < EDGE_COUNT; edge++) {
    const prevEdge = (edge + EDGE_COUNT - 1) % EDGE_COUNT;
    const incomingEdge = layout.edges[prevEdge];
    const outgoingEdge = layout.edges[edge];
    const incomingLed = incomingEdge.start + incomingEdge.count - 1;
    const outgoingLed = outgoingEdge.start;
    const incoming = layout.positions[incomingLed];
    const outgoing = layout.positions[outgoingLed];
    const corner = layout.geometry.corners[edge];
    if (!incoming || !outgoing || !corner) continue;

    const incomingHalfLength = paddedHalfLengths[prevEdge];
    const outgoingHalfLength = paddedHalfLengths[edge];
    const incomingBasis = edgeBasis(incoming.angle ?? 0);
    const outgoingBasis = edgeBasis(outgoing.angle ?? 0);
    const incomingEnd = {
      x: incoming.x + incomingBasis.dir.x * incomingHalfLength,
      y: incoming.y + incomingBasis.dir.y * incomingHalfLength,
    };
    const outgoingStart = {
      x: outgoing.x - outgoingBasis.dir.x * outgoingHalfLength,
      y: outgoing.y - outgoingBasis.dir.y * outgoingHalfLength,
    };
    const inwardBisector = normalize({
      x: incomingEnd.x + outgoingStart.x - corner.x * 2,
      y: incomingEnd.y + outgoingStart.y - corner.y * 2,
    });
    const seamReach =
      layout.ledShape.cornerTrim +
      Math.max(incomingHalfLength, outgoingHalfLength);
    const seam = {
      x: corner.x + inwardBisector.x * seamReach,
      y: corner.y + inwardBisector.y * seamReach,
    };
    const incomingBoundary = fartherPoint(
      offsetPoint(incomingEnd, incomingBasis.normal, -paddedHalfThickness),
      offsetPoint(incomingEnd, incomingBasis.normal, paddedHalfThickness),
      outgoingStart,
    );
    const outgoingBoundary = fartherPoint(
      offsetPoint(outgoingStart, outgoingBasis.normal, -paddedHalfThickness),
      offsetPoint(outgoingStart, outgoingBasis.normal, paddedHalfThickness),
      incomingEnd,
    );

    const outerMiter =
      lineIntersection(
        incomingBoundary,
        incomingBasis.dir,
        outgoingBoundary,
        outgoingBasis.dir,
      ) ?? corner;

    pushVertex(incomingLed, outerMiter.x, outerMiter.y);
    pushVertex(
      incomingLed,
      incomingBoundary.x,
      incomingBoundary.y,
    );
    pushVertex(incomingLed, seam.x, seam.y);

    pushVertex(outgoingLed, outerMiter.x, outerMiter.y);
    pushVertex(outgoingLed, seam.x, seam.y);
    pushVertex(
      outgoingLed,
      outgoingBoundary.x,
      outgoingBoundary.y,
    );
  }

  return new Float32Array(values);
}

function edgeBasis(angle: number) {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  return { dir, normal: { x: -dir.y, y: dir.x } };
}

function normalize(v: { x: number; y: number }) {
  const length = Math.hypot(v.x, v.y);
  if (length <= 0) return { x: 0, y: 0 };
  return { x: v.x / length, y: v.y / length };
}

function offsetPoint(
  point: { x: number; y: number },
  normal: { x: number; y: number },
  n: number,
) {
  return { x: point.x + normal.x * n, y: point.y + normal.y * n, n };
}

function fartherPoint<T extends { x: number; y: number }>(
  a: T,
  b: T,
  from: { x: number; y: number },
): T {
  return distanceSquared(a, from) >= distanceSquared(b, from) ? a : b;
}

function distanceSquared(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function lineIntersection(
  p: { x: number; y: number },
  pd: { x: number; y: number },
  q: { x: number; y: number },
  qd: { x: number; y: number },
): { x: number; y: number } | undefined {
  const denom = pd.x * qd.y - pd.y * qd.x;
  if (Math.abs(denom) < 1e-6) return undefined;
  const s = ((q.x - p.x) * qd.y - (q.y - p.y) * qd.x) / denom;
  return { x: p.x + pd.x * s, y: p.y + pd.y * s };
}
