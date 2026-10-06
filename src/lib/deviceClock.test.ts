import { afterEach, describe, expect, it, vi } from 'vitest';
import { alignClockHands, deviceClockHands, observeDeviceClock } from './deviceClock';

class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';

  changeTo(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function localTime(hour: number, minute = 0, second = 0) {
  return new Date(2026, 9, 5, hour, minute, second);
}

afterEach(() => vi.useRealTimers());

describe('device-local pocket watch', () => {
  it('places noon, midnight, and quarter hours correctly', () => {
    expect(deviceClockHands(localTime(12))).toEqual({ hour: 0, minute: 0, second: 0 });
    expect(deviceClockHands(localTime(0))).toEqual({ hour: 0, minute: 0, second: 0 });
    expect(deviceClockHands(localTime(3, 15))).toEqual({ hour: 97.5, minute: 90, second: 0 });
    expect(deviceClockHands(localTime(18, 30))).toEqual({ hour: 195, minute: 180, second: 0 });
    expect(deviceClockHands(localTime(21, 45))).toEqual({ hour: 292.5, minute: 270, second: 0 });
  });

  it('includes seconds in minute and hour position', () => {
    expect(deviceClockHands(localTime(10, 8, 30))).toEqual({ hour: 304.25, minute: 51, second: 180 });
  });

  it('ticks through 59 to 00 without reversing almost a full turn', () => {
    const before = deviceClockHands(localTime(11, 59, 59));
    const after = alignClockHands(before, deviceClockHands(localTime(12)));
    expect(after.hour).toBeCloseTo(360);
    expect(after.minute).toBeCloseTo(360);
    expect(after.second).toBe(360);
    expect(after.second - before.second).toBe(6);
  });

  it('uses the shortest adjustment in either direction when the device clock jumps', () => {
    const start = { hour: 350, minute: 354, second: 354 };
    const forward = alignClockHands(start, { hour: 10, minute: 6, second: 6 });
    expect(forward).toEqual({ hour: 370, minute: 366, second: 366 });
    expect(alignClockHands(forward, start)).toEqual(start);
  });

  it('samples device time, ticks without hover, and catches forward and backward changes promptly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(localTime(10, 8, 30));
    const onChange = vi.fn();
    const dispose = observeDeviceClock(onChange, { visibility: new Visibility(), focus: new EventTarget() });

    expect(onChange).toHaveBeenLastCalledWith({ hour: 304.25, minute: 51, second: 180 });
    vi.advanceTimersByTime(900);
    expect(onChange).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenLastCalledWith(deviceClockHands(localTime(10, 8, 31)));

    vi.setSystemTime(localTime(18, 45, 12));
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenLastCalledWith(deviceClockHands(localTime(18, 45, 12)));

    vi.setSystemTime(localTime(5, 3, 4));
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenLastCalledWith(deviceClockHands(localTime(5, 3, 4)));
    dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops hidden-tab work, immediately catches up on return, and cleans up its listeners', () => {
    vi.useFakeTimers();
    vi.setSystemTime(localTime(9));
    const visibility = new Visibility();
    const focus = new EventTarget();
    const onChange = vi.fn();
    const dispose = observeDeviceClock(onChange, { visibility, focus });

    visibility.changeTo('hidden');
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(onChange).toHaveBeenCalledTimes(1);

    visibility.changeTo('visible');
    expect(onChange).toHaveBeenLastCalledWith(deviceClockHands(localTime(9, 1)));
    expect(vi.getTimerCount()).toBe(1);
    vi.setSystemTime(localTime(14, 26));
    focus.dispatchEvent(new Event('focus'));
    expect(onChange).toHaveBeenLastCalledWith(deviceClockHands(localTime(14, 26)));
    expect(vi.getTimerCount()).toBe(1);

    dispose();
    onChange.mockClear();
    vi.setSystemTime(localTime(22));
    visibility.changeTo('visible');
    focus.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
