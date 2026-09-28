import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHoverBrake } from './hoverBrake';

let time = 0;
let nextId = 0;
const frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  time = 0;
  frames.clear();
  vi.spyOn(performance, 'now').mockImplementation(() => time);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function advance(ms: number) {
  time += ms;
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach(callback => callback(time));
}

function fixture() {
  const animation = {
    playState: 'paused', playbackRate: 0, currentTime: 123,
    play: vi.fn(() => { animation.playState = 'running'; }),
    pause: vi.fn(() => { animation.playState = 'paused'; }),
    updatePlaybackRate: vi.fn((rate: number) => { animation.playbackRate = rate; }),
  };
  const brake = createHoverBrake(() => [animation as unknown as Animation]);
  brake.setActive(false, true);
  return { animation, brake };
}

it('decelerates before pausing and schedules no frames at rest or full speed', () => {
  const { animation, brake } = fixture();
  expect(frames.size).toBe(0);
  brake.setActive(true);
  advance(180);
  expect(animation.playbackRate).toBe(1);
  expect(frames.size).toBe(0);
  brake.setActive(false);
  advance(160);
  const firstRate = animation.playbackRate;
  expect(firstRate).toBeGreaterThan(0);
  expect(firstRate).toBeLessThan(1);
  expect(animation.playState).toBe('running');
  advance(160);
  expect(animation.playbackRate).toBeLessThan(firstRate);
  advance(300);
  expect(animation.playState).toBe('paused');
  expect(animation.playbackRate).toBe(0);
  expect(animation.currentTime).toBe(123);
  expect(frames.size).toBe(0);
});

it('resumes smoothly during braking without resetting the animation', () => {
  const { animation, brake } = fixture();
  brake.setActive(true);
  advance(180);
  brake.setActive(false);
  advance(200);
  const leavingRate = animation.playbackRate;
  brake.setActive(true);
  expect(animation.playbackRate).toBe(leavingRate);
  expect(frames.size).toBe(1);
  advance(90);
  expect(animation.playbackRate).toBeGreaterThan(leavingRate);
  expect(animation.playbackRate).toBeLessThan(1);
  advance(90);
  expect(animation.playbackRate).toBe(1);
  expect(animation.currentTime).toBe(123);
  expect(frames.size).toBe(0);
});

it('stops immediately for reduced motion, hidden tabs, and disposal', () => {
  const { animation, brake } = fixture();
  brake.setActive(true);
  advance(90);
  brake.setActive(false, true);
  expect(animation.playState).toBe('paused');
  expect(frames.size).toBe(0);
  brake.setActive(true);
  advance(90);
  brake.dispose();
  expect(animation.playState).toBe('paused');
  expect(frames.size).toBe(0);
});

it('does not replay completed entrance animations on hover', () => {
  const { animation, brake } = fixture();
  animation.playState = 'finished';
  brake.setActive(true);
  expect(animation.play).not.toHaveBeenCalled();
  expect(frames.size).toBe(0);
});
