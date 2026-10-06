export type GlobeRotationScheduler = {
  now: () => number;
  request: (frame: (time: number) => void) => number;
  cancel: (id: number) => void;
};

const SPEED = Math.PI / 10;
const ACCELERATION_MS = 220;
const BRAKE_MS = 500;

type Ramp = { from: number; to: number; duration: number; elapsed: number };

/** The integral of a smoothstep velocity ramp, in radians. */
function rampDistance(ramp: Ramp, elapsed: number) {
  const t = Math.min(1, elapsed / ramp.duration);
  return ramp.duration / 1000 * (
    ramp.from * t + (ramp.to - ramp.from) * (t ** 3 - 0.5 * t ** 4)
  );
}

/** Retains the sphere's phase and owns a frame only while turning or braking. */
export function createGlobeRotation(
  draw: (angle: number) => void,
  scheduler: GlobeRotationScheduler = {
    now: () => performance.now(),
    request: (frame) => requestAnimationFrame(frame),
    cancel: (id) => cancelAnimationFrame(id),
  },
  initialAngle = 0,
) {
  let angle = initialAngle;
  let velocity = 0;
  let active = false;
  let disposed = false;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let ramp: Ramp | null = null;

  function advance(time: number) {
    if (lastTime === null) {
      lastTime = time;
      return;
    }
    let elapsed = Math.max(0, time - lastTime);
    lastTime = time;
    const before = angle;
    if (ramp) {
      const end = Math.min(ramp.duration, ramp.elapsed + elapsed);
      angle += rampDistance(ramp, end) - rampDistance(ramp, ramp.elapsed);
      elapsed -= end - ramp.elapsed;
      ramp.elapsed = end;
      const t = end / ramp.duration;
      velocity = ramp.from + (ramp.to - ramp.from) * (3 * t * t - 2 * t * t * t);
      if (end === ramp.duration) {
        velocity = ramp.to;
        ramp = null;
      }
    }
    angle += velocity * elapsed / 1000;
    if (angle !== before) draw(angle);
  }

  function tick(time: number) {
    frame = null;
    if (disposed) return;
    advance(time);
    if (active || velocity > 0) frame = scheduler.request(tick);
    else lastTime = null;
  }

  return {
    setActive(next: boolean, immediately = false) {
      if (disposed) return;
      if (immediately && !next) {
        active = false;
        velocity = 0;
        ramp = null;
        lastTime = null;
        if (frame !== null) scheduler.cancel(frame);
        frame = null;
        return;
      }
      if (active === next) return;
      const now = scheduler.now();
      advance(now);
      active = next;
      ramp = {
        from: velocity,
        to: active ? SPEED : 0,
        duration: active ? ACCELERATION_MS : BRAKE_MS,
        elapsed: 0,
      };
      lastTime = now;
      if (active || velocity > 0) {
        if (frame === null) frame = scheduler.request(tick);
      } else {
        ramp = null;
        lastTime = null;
        if (frame !== null) scheduler.cancel(frame);
        frame = null;
      }
    },
    dispose() {
      disposed = true;
      if (frame !== null) scheduler.cancel(frame);
      frame = null;
    },
  };
}
