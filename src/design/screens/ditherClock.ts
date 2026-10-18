import { DITHER_FRAME_MS } from './ditherField';

// All visible patches share one clock; hidden/offscreen surfaces unsubscribe.
const painters = new Set<(time: number) => void>();
let frame = 0;
let last = -Infinity;
function tick(time: number) {
  frame = 0;
  if (time - last >= DITHER_FRAME_MS) {
    last = time;
    painters.forEach(paint => paint(time));
  }
  if (painters.size) frame = requestAnimationFrame(tick);
}
export function subscribeDither(paint: (time: number) => void) {
  painters.add(paint);
  if (!frame) frame = requestAnimationFrame(tick);
  return () => {
    painters.delete(paint);
    if (!painters.size) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = -Infinity;
    }
  };
}
