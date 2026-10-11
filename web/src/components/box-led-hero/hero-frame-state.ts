import type { HoverDeployAnimationState } from './led-buffer';
import type { HeroLook } from './look';
import {
  BRIGHTNESS_MIN_HOVER_SMOOTHING,
  brushSettings,
  heroStateFor,
  rgbTintSettings,
  sceneTunables,
  type BrushState,
  type HeroStateSettings,
  type SceneTunables,
} from './settings';

export interface UpdateLedsContext {
  time: number;
  tunables: SceneTunables;
  settings: HeroStateSettings;
  hoverDeploy: HoverDeployAnimationState;
  brush: BrushState;
}

interface ResolveFrameArgs {
  look: HeroLook;
  patch?: Partial<BrushState>;
  hoverRgbDeployActive: boolean;
  time: number;
  updateLedsFor(ctx: UpdateLedsContext): void;
}

interface Smoother {
  initialized: boolean;
  lastTime: number;
  value: number;
}

const BRUSH_RESET = {
  x: -1000,
  y: -1000,
  active: false,
  inside: false,
  isMouse: false,
};

export function createHeroFrameState() {
  const deploy: Smoother = { initialized: false, lastTime: 0, value: 0 };
  const brightness: Smoother = { initialized: false, lastTime: 0, value: 0 };
  const brush = { ...BRUSH_RESET } as BrushState;

  return {
    resolveFrame(args: ResolveFrameArgs) {
      const { time, look } = args;
      Object.assign(brush, brushSettings(look), BRUSH_RESET, args.patch);
      const tunables = sceneTunables(look);
      const hero = heroStateFor(look);
      const tint = rgbTintSettings(look);
      // Each click flips the toggle, which always gives a speed burst; the four edge
      // colours ride on it only when they're switched on.
      const deployTarget =
        look.colours.mode === 'always' || args.hoverRgbDeployActive ? 1 : 0;
      const deployFactor = smooth(deploy, deployTarget, time, tint.responseSmoothing);
      const baseBrightness = tunables.brightnessMinDark;
      tunables.brightnessMin = smooth(
        brightness,
        brush.active && brush.inside === true && look.hover.enabled
          ? baseBrightness * look.hover.insideBoost
          : baseBrightness,
        time,
        BRIGHTNESS_MIN_HOVER_SMOOTHING,
      );
      args.updateLedsFor({
        time,
        tunables,
        settings: hero,
        hoverDeploy: { factor: deployFactor, tint },
        brush,
      });
      return { tunables };
    },
  };
}

function smooth(
  state: Smoother,
  target: number,
  time: number,
  smoothing: number,
) {
  if (!state.initialized) {
    state.initialized = true;
    state.lastTime = time;
    state.value = target;
    return state.value;
  }
  const rawDt = time - state.lastTime;
  state.lastTime = time;
  if (smoothing <= 0 || !Number.isFinite(smoothing)) {
    state.value = target;
    return state.value;
  }
  const dt = Math.min(0.25, Math.max(0, Number.isFinite(rawDt) ? rawDt : 0));
  const alpha = 1 - Math.exp(-dt / smoothing);
  state.value = state.value + (target - state.value) * alpha;
  if (Math.abs(state.value - target) < 0.0001) state.value = target;
  return state.value;
}
