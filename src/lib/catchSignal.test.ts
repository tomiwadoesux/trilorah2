import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AWAY_HOLD_MAX_MS, AwayHolds, SIGNAL_GAP_MS, SignalGate, seesCatches, signalForCatch, signalPlace, type Attention } from './catchSignal';

const inApp = (view: string, tab: string): Attention => ({ focused: true, visible: true, view, tab });

describe('which signal a catch raises', () => {
  it('raises one only when the preacher names a scripture', () => {
    expect(signalForCatch('said')).toBe('sweep');
    expect(signalForCatch('read')).toBeNull();
    expect(signalForCatch('named')).toBeNull();
    expect(signalForCatch('story')).toBeNull();
  });

  it('raises none when the session moves on by itself', () => {
    expect(signalForCatch('said', true)).toBeNull();
  });
});

describe('where a signal shows', () => {
  it('stays quiet while the operator is looking at the verses', () => {
    expect(signalPlace(inApp('operator', 'scriptures'))).toBe('none');
  });

  it('lights the window when the operator is in the app but elsewhere', () => {
    expect(signalPlace(inApp('operator', 'songs'))).toBe('window');
    expect(signalPlace(inApp('operator', 'media'))).toBe('window');
    expect(signalPlace(inApp('dashboard', 'scriptures'))).toBe('window');
    expect(signalPlace(inApp('settings', 'songs'))).toBe('window');
  });

  it('lights the whole screen when the operator is in another app or the window is out of sight', () => {
    expect(signalPlace({ ...inApp('operator', 'scriptures'), focused: false })).toBe('screen');
    expect(signalPlace({ ...inApp('operator', 'songs'), visible: false })).toBe('screen');
  });

  it('counts the catches as seen only from the operator view of a window in front', () => {
    expect(seesCatches(inApp('operator', 'media'))).toBe(true);
    expect(seesCatches(inApp('dashboard', 'scriptures'))).toBe(false);
    expect(seesCatches({ ...inApp('operator', 'scriptures'), focused: false })).toBe(false);
  });
});

describe('SignalGate', () => {
  it('lets catches that arrive together raise one signal', () => {
    const gate = new SignalGate();
    expect(gate.allow(1000)).toBe(true);
    expect(gate.allow(1000 + SIGNAL_GAP_MS - 1)).toBe(false);
    expect(gate.allow(1000 + SIGNAL_GAP_MS)).toBe(true);
  });
});

describe('AwayHolds', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const calls: string[] = [];
    const holds = new AwayHolds((id, on) => calls.push(`${on ? 'hold' : 'let go'} ${id}`), {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (t) => clearTimeout(t),
    });
    return { holds, calls };
  };

  it('holds every catch waiting while the operator is away, and lets them go on return', () => {
    const { holds, calls } = make();
    holds.setAway(false, ['john']);
    expect(calls).toEqual([]);
    holds.setAway(true, ['john']);
    holds.sync(['romans', 'john']);
    expect(calls).toEqual(['hold john', 'hold romans']);
    holds.setAway(false, ['romans', 'john']);
    expect(calls.slice(2).sort()).toEqual(['let go john', 'let go romans']);
  });

  it('holds each one for half a minute at most', () => {
    const { holds, calls } = make();
    holds.setAway(true, ['john']);
    vi.advanceTimersByTime(AWAY_HOLD_MAX_MS - 1);
    expect(calls).toEqual(['hold john']);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['hold john', 'let go john']);
    /* Not held again by the next change while the operator is still away. */
    holds.sync(['john', 'psalm']);
    expect(calls).toEqual(['hold john', 'let go john', 'hold psalm']);
  });

  it('forgets a catch that has gone, without letting go of a clock that is no longer there', () => {
    const { holds, calls } = make();
    holds.setAway(true, ['john']);
    holds.sync([]);
    vi.advanceTimersByTime(AWAY_HOLD_MAX_MS);
    holds.setAway(false, []);
    expect(calls).toEqual(['hold john']);
  });
});
