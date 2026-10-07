import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATCH_LIFE_MS, CatchClocks, clockShare } from './catchClock';

describe('CatchClocks', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const expired: string[] = [];
    const clocks = new CatchClocks((id) => expired.push(id), undefined, {
      now: () => Date.now(),
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (t) => clearTimeout(t),
    });
    return { clocks, expired };
  };

  it('lets a catch stay six seconds, then lets it go', () => {
    const { clocks, expired } = make();
    clocks.start('john');
    vi.advanceTimersByTime(CATCH_LIFE_MS - 1);
    expect(expired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(expired).toEqual(['john']);
    expect(clocks.get('john')).toBeUndefined();
  });

  it('stops while the operator has hold of the card and carries on after', () => {
    const { clocks, expired } = make();
    clocks.start('john');
    vi.advanceTimersByTime(2000);
    clocks.hold('john', true);
    vi.advanceTimersByTime(30_000);
    expect(expired).toEqual([]);
    expect(clocks.get('john')?.remaining).toBe(4000);
    clocks.hold('john', false);
    vi.advanceTimersByTime(3999);
    expect(expired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(expired).toEqual(['john']);
  });

  it('starts again from full when the verse is heard again', () => {
    const { clocks, expired } = make();
    clocks.start('john');
    vi.advanceTimersByTime(5000);
    clocks.start('john');
    vi.advanceTimersByTime(5000);
    expect(expired).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(expired).toEqual(['john']);
  });

  it('gives each catch its own clock', () => {
    const { clocks, expired } = make();
    clocks.start('genesis');
    vi.advanceTimersByTime(1000);
    clocks.start('john');
    vi.advanceTimersByTime(5000);
    expect(expired).toEqual(['genesis']);
    vi.advanceTimersByTime(1000);
    expect(expired).toEqual(['genesis', 'john']);
  });

  it('forgets a card that was answered, so it never expires later', () => {
    const { clocks, expired } = make();
    clocks.start('genesis');
    clocks.start('john');
    clocks.keepOnly(['john']);
    vi.advanceTimersByTime(CATCH_LIFE_MS);
    expect(expired).toEqual(['john']);
  });

  it('stays held while any reason is left', () => {
    const { clocks, expired } = make();
    clocks.start('john');
    clocks.hold('john', true, 'queued');
    clocks.hold('john', true, 'pointer');
    clocks.hold('john', false, 'pointer');
    vi.advanceTimersByTime(30_000);
    expect(expired).toEqual([]);
    clocks.hold('john', false, 'queued');
    vi.advanceTimersByTime(CATCH_LIFE_MS);
    expect(expired).toEqual(['john']);
  });

  it('keeps a hold through a restart', () => {
    const { clocks, expired } = make();
    clocks.start('john');
    clocks.hold('john', true);
    clocks.start('john');
    vi.advanceTimersByTime(30_000);
    expect(expired).toEqual([]);
    expect(clocks.get('john')?.held).toBe(true);
  });

  it('reports the share of time left for the bar', () => {
    const clock = { life: 6000, remaining: 6000, since: 1000, held: false };
    expect(clockShare(clock, 1000)).toBe(1);
    expect(clockShare(clock, 4000)).toBe(0.5);
    expect(clockShare(clock, 9000)).toBe(0);
    expect(clockShare({ ...clock, remaining: 3000, held: true }, 99_999)).toBe(0.5);
  });
});
