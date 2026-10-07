/*
 * How long a caught scripture waits for the operator.
 *
 * Every catch — a reference the preacher said, a verse he read, a named
 * passage, a story the engine recognised — stays CATCH_LIFE_MS and then
 * leaves (owner, 2026-10-06). The card shows the time it has left as a bar
 * that drains, so leaving is never a surprise.
 *
 * Holding is for the operator's hand: while the pointer is on a card its
 * clock stops, and it carries on from where it stopped when the pointer
 * goes. A card that vanished from under the cursor at the moment of the
 * press would be the worst way for this to fail.
 *
 * Hearing the same verse again starts its clock afresh — the preacher is
 * still on it.
 *
 * A clock can be held for more than one reason at once — the operator's
 * pointer, or waiting its turn in a set of verses said together (only the
 * one in the spotlight runs). It runs only when no reason is left.
 *
 * Pure apart from the timer functions, which are injected so the tests can
 * run on a fake clock.
 */

export const CATCH_LIFE_MS = 6000;

export interface CatchClock {
  /** The whole life, for drawing the bar as a share of it. */
  life: number;
  /** Time left as of `since`. */
  remaining: number;
  /** When the clock last started running or stopped. */
  since: number;
  held: boolean;
}

interface Running extends CatchClock {
  timer: ReturnType<typeof setTimeout> | null;
  reasons: Set<string>;
}

export interface CatchClockTimers {
  now: () => number;
  set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear: (timer: ReturnType<typeof setTimeout>) => void;
}

const REAL_TIMERS: CatchClockTimers = {
  now: () => Date.now(),
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (timer) => clearTimeout(timer),
};

export class CatchClocks {
  private clocks = new Map<string, Running>();
  private onExpire: (id: string) => void;
  private onChange: (clocks: Record<string, CatchClock>) => void;
  private timers: CatchClockTimers;

  constructor(
    onExpire: (id: string) => void,
    onChange: (clocks: Record<string, CatchClock>) => void = () => undefined,
    timers: CatchClockTimers = REAL_TIMERS,
  ) {
    this.onExpire = onExpire;
    this.onChange = onChange;
    this.timers = timers;
  }

  /** Start, or start again from full, the clock for `id`. */
  start(id: string, life = CATCH_LIFE_MS): void {
    this.stopTimer(id);
    /* Reasons outlive a restart: a verse heard again while the operator's
       pointer is on it is still under the pointer. */
    const reasons = this.clocks.get(id)?.reasons ?? new Set<string>();
    const clock: Running = { life, remaining: life, since: this.timers.now(), held: reasons.size > 0, timer: null, reasons };
    if (!clock.held) clock.timer = this.timers.set(() => this.expire(id), life);
    this.clocks.set(id, clock);
    this.changed();
  }

  /** Hold (true) or let go (false) of the clock for one reason. */
  hold(id: string, held: boolean, reason = 'pointer'): void {
    const clock = this.clocks.get(id);
    if (!clock) return;
    if (held) clock.reasons.add(reason);
    else clock.reasons.delete(reason);
    held = clock.reasons.size > 0;
    if (clock.held === held) return;
    const now = this.timers.now();
    if (held) {
      this.stopTimer(id);
      clock.remaining = Math.max(0, clock.remaining - (now - clock.since));
    } else {
      clock.timer = this.timers.set(() => this.expire(id), clock.remaining);
    }
    clock.held = held;
    clock.since = now;
    this.changed();
  }

  /** Forget every clock whose card is gone — answered, dismissed, withdrawn. */
  keepOnly(ids: Iterable<string>): void {
    const keep = new Set(ids);
    let dropped = false;
    for (const id of [...this.clocks.keys()]) {
      if (keep.has(id)) continue;
      this.stopTimer(id);
      this.clocks.delete(id);
      dropped = true;
    }
    if (dropped) this.changed();
  }

  get(id: string): CatchClock | undefined {
    const clock = this.clocks.get(id);
    if (!clock) return undefined;
    const { timer: _timer, reasons: _reasons, ...rest } = clock;
    return rest;
  }

  dispose(): void {
    for (const id of this.clocks.keys()) this.stopTimer(id);
    this.clocks.clear();
  }

  private expire(id: string): void {
    const clock = this.clocks.get(id);
    if (!clock || clock.held) return;
    this.clocks.delete(id);
    this.changed();
    this.onExpire(id);
  }

  private stopTimer(id: string): void {
    const clock = this.clocks.get(id);
    if (clock?.timer != null) this.timers.clear(clock.timer);
    if (clock) clock.timer = null;
  }

  private changed(): void {
    const out: Record<string, CatchClock> = {};
    for (const id of this.clocks.keys()) out[id] = this.get(id)!;
    this.onChange(out);
  }
}

/** The share of its life a clock has left at `now`, 0 to 1. */
export function clockShare(clock: CatchClock, now: number): number {
  const left = clock.held ? clock.remaining : clock.remaining - (now - clock.since);
  return Math.max(0, Math.min(1, left / clock.life));
}
