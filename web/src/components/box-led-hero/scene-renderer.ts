import type { Bundle, Frame, FramePass, Gpu, StorageBuffer, Target } from 'vgpu';
import { bundle, draw, frame, storage, target } from 'vgpu';

import type { HeroLook } from './look';
import {
  HERO_CANVAS_MAX_CSS,
  canonicalBoxGeometry,
  ledMeshGeometry,
  type BrushState,
  type RenderSize,
} from './settings';
import { buildLedGeometry, computeLeds, replayOpening, type LedGeometryState } from './led-buffer';
import { createHeroFrameState } from './hero-frame-state';
import { createLightSourcesRaw, type LightSourcesRaw } from './light-sources-raw';
import { canvasRenderSizing } from './sim-sizing';
import raycastWgsl from './shaders/direct-box-raycast.wgsl';
import floorNoiseWgsl from './shaders/floor-noise.wgsl';
import darkFloorWgsl from './shaders/main-scene-floor.wgsl';

const DIRECT_BOX_TARGET_SCALE = 0.5;
const DIRECT_BOX_MIN_STEP_PX = 1.5;
const DIRECT_BOX_HIT_THRESHOLD_PX = 0.75;
const DIRECT_BOX_MIN_SOURCE_LUMA = 0.001;
const LED_FLOATS = 8;

export interface HeroRendererCss {
  width: number;
  height: number;
  dpr: number;
}

export interface HeroRenderFrameArgs {
  time: number;
  dt?: number;
}

export interface HeroRenderer {
  renderFrame(currentFrame: Frame, args: HeroRenderFrameArgs): void;
  setOutputTarget(colorTarget: Target): void;
  rebuild(css: HeroRendererCss): void;
  setBrush(b: Partial<BrushState>): void;
  setLook(look: HeroLook): void;
  replayOpening(): void;
  setRgbDeployActive(v: boolean): void;
  prewarm(): Promise<void>;
  destroy(): void;
}

type DestroyableStorage = StorageBuffer & {
  readonly buffer?: { destroy(): void };
  destroy?: () => void;
};

interface RendererParts {
  css: HeroRendererCss;
  simulationSize: RenderSize;
  presentationSize: RenderSize;
  pixelRatio: number;
  leds: LedGeometryState;
  ledStorage: DestroyableStorage;
  lightSources: LightSourcesRaw;
  raycastTarget: Target;
  raycastBundle: Bundle;
  floorBundle?: Bundle;
}

export function createHeroRenderer(
  gpu: Gpu,
  opts: { theme?: 'dark'; css: HeroRendererCss; look: HeroLook; target?: Target },
): HeroRenderer {
  const frameState = createHeroFrameState();
  const brush: Partial<BrushState> = {};
  let look = opts.look;
  let rgbDeployActive = false;
  let outputTarget = opts.target;
  let destroyed = false;

  const noiseTarget = target(gpu, {
    size: [500, 500],
    format: 'rgba16float',
    label: 'box-led-hero-floor-noise',
  });
  const noiseDraw = draw(gpu, { shader: floorNoiseWgsl, vertices: 3 });
  const floorDraw = draw(gpu, { shader: darkFloorWgsl, vertices: 3 });
  const raycastDraw = draw(gpu, { shader: raycastWgsl, vertices: 3 });
  frame(gpu, (currentFrame: Frame) => {
    currentFrame.pass({ target: noiseTarget }, (pass: FramePass) => pass.draw(noiseDraw));
  });

  let parts = buildParts(opts.css);
  if (outputTarget) recordFloorBundle(parts, outputTarget);

  return {
    renderFrame(currentFrame, { time }) {
      if (destroyed || !outputTarget) return;
      const current = parts;
      const { tunables } = frameState.resolveFrame({
        look,
        patch: brush,
        hoverRgbDeployActive: rgbDeployActive,
        time,
        updateLedsFor(ctx) {
          computeLeds(
            current.leds,
            ctx.time,
            ctx.tunables,
            ctx.settings,
            look,
            ctx.hoverDeploy,
            ctx.brush,
          );
          current.ledStorage.write(current.leds.data.buffer as ArrayBuffer);
        },
      });
      current.lightSources.encode({ frame: currentFrame, tunables });
      currentFrame.pass(
        { target: current.raycastTarget, clear: [0, 0, 0, 1] },
        (pass: FramePass) => pass.bundles(current.raycastBundle),
      );
      const floorBundle = current.floorBundle ?? recordFloorBundle(current, outputTarget);
      currentFrame.pass(
        { target: outputTarget, clear: [0, 0, 0, 1] },
        (pass: FramePass) => pass.bundles(floorBundle),
      );
    },
    setOutputTarget(colorTarget) {
      outputTarget = colorTarget;
      recordFloorBundle(parts, colorTarget);
    },
    rebuild(css) {
      if (destroyed) return;
      const next = buildParts(css, parts.leds);
      destroyParts(parts);
      parts = next;
      if (outputTarget) recordFloorBundle(parts, outputTarget);
    },
    setBrush(next) {
      Object.assign(brush, next);
    },
    // The box and the LED spacing reshape the geometry and need a rebuild; everything
    // else is uniforms and per-frame CPU state, so it lands on the next frame.
    setLook(next) {
      if (destroyed) return;
      const reshape =
        boxShape(next) !== boxShape(look) || next.leds.spacing !== look.leds.spacing;
      look = next;
      if (reshape) {
        const rebuilt = buildParts(parts.css, parts.leds);
        destroyParts(parts);
        parts = rebuilt;
        if (outputTarget) recordFloorBundle(parts, outputTarget);
        return;
      }
      raycastDraw.set({ cfg: directBoxRaycastUniformData(parts.simulationSize, look) });
      if (outputTarget) floorDraw.set({ cfg: floorUniformData(parts, look) });
    },
    replayOpening() {
      replayOpening(parts.leds);
    },
    setRgbDeployActive(active) {
      rgbDeployActive = active;
    },
    async prewarm() {
      if (!outputTarget) return;
      await Promise.all([
        floorDraw.compile({ colors: [outputTarget.format] }),
        raycastDraw.compile(parts.raycastTarget),
        noiseDraw.compile(noiseTarget),
        parts.lightSources.ready,
      ]);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      destroyParts(parts);
    },
  };

  function recordFloorBundle(current: RendererParts, colorTarget: Target) {
    floorDraw.set({
      cfg: floorUniformData(current, look),
      radiance_tex: current.raycastTarget,
      light_sources_tex: current.lightSources.texture,
      floor_noise_tex: noiseTarget,
    });
    const result = bundle(
      gpu,
      { target: { colors: [colorTarget.format] }, label: 'box-led-hero-dark-floor' },
      (recorded) => recorded.draw(floorDraw),
    );
    current.floorBundle = result;
    return result;
  }

  function buildParts(css: HeroRendererCss, previous?: LedGeometryState): RendererParts {
    const sizing = canvasRenderSizing(css.width, css.height, css.dpr);
    const simulationSize = normalizedSize(sizing.simulationWidth, sizing.simulationHeight);
    const presentationSize = normalizedSize(css.width * css.dpr, css.height * css.dpr);
    const pixelRatio = normalizedPixelRatio(sizing.pixelRatio);
    const leds = buildLedGeometry(simulationSize, look, previous);
    const ledStorage = storage(gpu, leds.count * LED_FLOATS * 4) as DestroyableStorage;
    ledStorage.write(leds.data.buffer as ArrayBuffer);
    const raycastSize = directBoxTargetSize(simulationSize);
    const raycastTarget = target(gpu, {
      size: [raycastSize.width, raycastSize.height],
      format: 'rgba16float',
      label: 'box-led-hero-direct-box-raycast',
    });
    const lightSources = createLightSourcesRaw(gpu, {
      size: [simulationSize.width, simulationSize.height],
      ledStorage,
      look,
    });
    raycastDraw.set({
      cfg: directBoxRaycastUniformData(simulationSize, look),
      light_sources_tex: lightSources.texture,
    });
    const raycastBundle = bundle(
      gpu,
      { target: raycastTarget, label: 'box-led-hero-raycast' },
      (recorded) => recorded.draw(raycastDraw),
    );
    return {
      css,
      simulationSize,
      presentationSize,
      pixelRatio,
      leds,
      ledStorage,
      lightSources,
      raycastTarget,
      raycastBundle,
    };
  }

  function destroyParts(current: RendererParts) {
    current.lightSources.destroy();
    current.ledStorage.destroy?.();
    current.ledStorage.buffer?.destroy();
    const texture = current.raycastTarget.color?.gpu ?? current.raycastTarget.gpu;
    texture?.destroy?.();
  }
}

function directBoxRaycastUniformData(simulationSize: RenderSize, look: HeroLook) {
  const box = ledMeshGeometry(simulationSize, look.box);
  const pxStepScale =
    Math.min(simulationSize.height, HERO_CANVAS_MAX_CSS) / HERO_CANVAS_MAX_CSS;
  return {
    box: [box.center.x, box.center.y, box.halfWidth, box.halfHeight],
    size_steps: [
      simulationSize.width,
      simulationSize.height,
      DIRECT_BOX_MIN_STEP_PX * pxStepScale,
      DIRECT_BOX_HIT_THRESHOLD_PX * pxStepScale,
    ],
    params: [
      look.light.haze / simulationSize.height,
      look.light.falloff,
      look.light.strength,
      DIRECT_BOX_MIN_SOURCE_LUMA,
    ],
    target_info: [
      DIRECT_BOX_TARGET_SCALE,
      HERO_CANVAS_MAX_CSS / Math.max(simulationSize.height, 1),
      0,
      0,
    ],
  };
}

function directBoxTargetSize(size: RenderSize) {
  return {
    width: Math.max(1, Math.ceil(size.width * DIRECT_BOX_TARGET_SCALE)),
    height: Math.max(1, Math.ceil(size.height * DIRECT_BOX_TARGET_SCALE)),
  };
}

function floorUniformData(parts: RendererParts, look: HeroLook) {
  const { simulationSize, presentationSize, pixelRatio } = parts;
  const transform = presentationSimulationTransform(simulationSize, presentationSize);
  const box = canonicalBoxGeometry(simulationSize, look.box);
  const { light } = look;
  const referencePresentationHeight =
    HERO_CANVAS_MAX_CSS * Math.max(pixelRatio, 1e-4);
  const radianceJitterNorm =
    Math.min(presentationSize.height, referencePresentationHeight) /
    referencePresentationHeight;
  return {
    screen: [presentationSize.width, presentationSize.height, 0, pixelRatio],
    light_sources: [simulationSize.width, simulationSize.height, 0, 0],
    box: [
      transform.originX + box.center.x * transform.scale,
      transform.originY + box.center.y * transform.scale,
      box.halfWidth * transform.scale,
      box.halfHeight * transform.scale,
    ],
    // The radiance dither band was sized by the triangle's circumradius (2/3 of its height).
    box_glow: [((box.scaleRef * 2) / 3) * transform.scale, 0, 0, 0],
    // (width in device px, intensity, light-map lo, light-map hi)
    edge_line: [light.edgeLineWidth * transform.scale, light.edgeLine, 2.74, 5.0],
    // (intensity, _, light-map lo, light-map hi)
    bloom: [light.bloom, 2.0, 0.0, 8.85],
    // (exposure, contrast, grain, top/bottom fade band as a share of the height)
    grade: [light.exposure, light.contrast, light.grain, light.screenFade],
    // Display-space colours; background.w (its luminance) picks adding vs tinting.
    background: displayColour(light.background, true),
    box_fill: displayColour(look.box.fill, false),
    tint: [light.tint, light.tintLightness, 0, 0],
    radiance_fit: [
      transform.originX,
      transform.originY,
      simulationSize.width * transform.scale,
      simulationSize.height * transform.scale,
    ],
    sim_transform: [
      transform.originX,
      transform.originY,
      transform.scale,
      radianceJitterNorm,
    ],
  };
}

function boxShape({ box }: HeroLook) {
  return [box.maxWidth, box.maxHeight, box.sideMargin, box.spaceAbove, box.spaceBelow].join();
}

function displayColour(hex: string, withLuminance: boolean) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, withLuminance ? 0.2126 * r + 0.7152 * g + 0.0722 * b : 0];
}

function presentationSimulationTransform(
  simulationSize: RenderSize,
  presentationSize: RenderSize,
) {
  const scale = Math.max(
    0.001,
    presentationSize.height / Math.max(1, simulationSize.height),
  );
  return {
    originX: (presentationSize.width - simulationSize.width * scale) * 0.5,
    originY: (presentationSize.height - simulationSize.height * scale) * 0.5,
    scale,
  };
}

function normalizedSize(width: number, height: number): RenderSize {
  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  };
}

function normalizedPixelRatio(value: number | undefined) {
  return Math.max(
    0.001,
    typeof value === 'number' && Number.isFinite(value) ? value : 1,
  );
}
