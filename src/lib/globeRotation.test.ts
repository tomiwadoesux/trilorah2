import { describe, expect, it } from 'vitest';
import { createGlobeRotation, type GlobeRotationScheduler } from './globeRotation';

function harness(initialAngle = 0) {
  let time = 0;
  let nextId = 0;
  const frames = new Map<number, (time: number) => void>();
  const angles: number[] = [];
  const scheduler: GlobeRotationScheduler = {
    now: () => time,
    request: (frame) => { frames.set(++nextId, frame); return nextId; },
    cancel: (id) => { frames.delete(id); },
  };
  return {
    motor: createGlobeRotation((angle) => angles.push(angle), scheduler, initialAngle),
    angles,
    frames,
    advance(milliseconds: number) {
      time += milliseconds;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((frame) => frame(time));
    },
    get angle() { return angles.at(-1) ?? initialAngle; },
  };
}

describe('globe rotation', () => {
  it('runs at a constant angular speed after starting and has no idle frame', () => {
    const run = harness();
    expect(run.frames.size).toBe(0);
    run.motor.setActive(true);
    run.advance(220);
    const started = run.angle;
    run.advance(1000);
    const firstSecond = run.angle - started;
    run.advance(1000);
    expect(run.angle - started - firstSecond).toBeCloseTo(firstSecond, 10);
    expect(firstSecond).toBeCloseTo(Math.PI / 10, 10);
  });

  it('decelerates for 500 ms, retains its reached angle and resumes there', () => {
    const run = harness();
    run.motor.setActive(true);
    run.advance(1000);
    run.motor.setActive(false);
    const released = run.angle;
    run.advance(250);
    const firstHalf = run.angle - released;
    run.advance(250);
    const secondHalf = run.angle - released - firstHalf;
    expect(firstHalf).toBeGreaterThan(secondHalf);
    expect(secondHalf).toBeGreaterThan(0);
    expect(run.frames.size).toBe(0);
    const stopped = run.angle;
    run.advance(3000);
    expect(run.angle).toBe(stopped);
    run.motor.setActive(true);
    expect(run.angle).toBe(stopped);
    run.advance(220);
    expect(run.angle).toBeGreaterThan(stopped);
  });

  it('can resume during braking without jumping or reversing', () => {
    const run = harness();
    run.motor.setActive(true);
    run.advance(1000);
    run.motor.setActive(false);
    run.advance(180);
    const interrupted = run.angle;
    run.motor.setActive(true);
    expect(run.angle).toBe(interrupted);
    run.advance(16);
    expect(run.angle).toBeGreaterThan(interrupted);
    expect(run.angle - interrupted).toBeLessThan(Math.PI / 10 * 0.016);
    expect(run.frames.size).toBe(1);
  });

  it('freezes immediately for reduced motion or a hidden document and disposes frames', () => {
    const run = harness(1.25);
    run.motor.setActive(true);
    run.advance(1000);
    const stopped = run.angle;
    run.motor.setActive(false, true);
    expect(run.frames.size).toBe(0);
    run.advance(60000);
    expect(run.angle).toBe(stopped);
    run.motor.setActive(true);
    run.advance(220);
    expect(run.angle).toBeCloseTo(stopped + Math.PI / 10 * 0.11, 10);
    run.motor.dispose();
    expect(run.frames.size).toBe(0);
    run.motor.setActive(true);
    expect(run.frames.size).toBe(0);
  });
});
