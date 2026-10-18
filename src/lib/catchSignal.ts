/*
 * When a catch raises a signal, and where (owner, 2026-10-17).
 *
 * The signal says "something is waiting for you" to an operator who is not
 * looking at it — in another tab, on the dashboard, in another app. So:
 *
 *   - Only when the preacher names a scripture — "Genesis chapter four
 *     verse four" (owner: "it should only glow for scripture … if the name
 *     was said"). Not for a verse read out without its name, not for a song
 *     heard, not for the session moving on by itself to the next verse, and
 *     never for a guess (a named passage, a story): a signal that turns out
 *     wrong teaches the operator to ignore them all.
 *   - Not while the operator is already looking at it.
 *   - References named together — a set in one breath — make one signal.
 *
 * It never moves anything towards the wall. A catch still waits for a press
 * (see the catches pane); this only says it is there.
 *
 * Pure apart from the timers AwayHolds is handed. The drawing is
 * lib/signalPlayer, which still draws the double buzz and the slant the
 * owner chose first, should those come back; the names of the signals are
 * shared/catchSignal.
 */
import type { CatchSignal } from '../../shared/catchSignal';
import type { CatchKind } from './catchSets';

/** `stepped`: the session moved on by itself (a verse read to its end, "next") — nothing was named. */
export function signalForCatch(kind: CatchKind, stepped = false): CatchSignal | null {
  return kind === 'said' && !stepped ? 'sweep' : null;
}

/** What the operator has in front of them. `view` and `tab` are the live screen's. */
export interface Attention {
  /** This window has the keyboard — the operator is in the app, not another one. */
  focused: boolean;
  /** Not minimised or hidden. */
  visible: boolean;
  /** operator, dashboard, profile or settings. */
  view: string;
  /** The library tab: scriptures, songs, themes, slides, media. */
  tab: string;
}

/**
 * none    the operator is looking at it already
 * window  in the app, but somewhere the catch is not: the app's own edges
 * screen  in another app, or the app is out of sight: the whole screen
 */
export type SignalPlace = 'none' | 'window' | 'screen';

export function signalPlace(a: Attention): SignalPlace {
  if (!a.focused || !a.visible) return 'screen';
  if (a.view !== 'operator') return 'window';
  // A caught verse lands in the verses card.
  return a.tab === 'scriptures' ? 'none' : 'window';
}

/** The operator can see the catches (the verses card, or the left card on another tab). */
export const seesCatches = (a: Attention) => a.focused && a.visible && a.view === 'operator';

/** References named this close together raise one signal. */
export const SIGNAL_GAP_MS = 5000;

export class SignalGate {
  private last = Number.NEGATIVE_INFINITY;

  /** True, and the gate closes for SIGNAL_GAP_MS, when a signal may play at `now`. */
  allow(now: number): boolean {
    if (now - this.last < SIGNAL_GAP_MS) return false;
    this.last = now;
    return true;
  }
}

/*
 * A catch waits for an operator who is away.
 *
 * Each catch stays six seconds (lib/catchClock). Called back from another
 * app by the signal, the operator would arrive to find it already gone. So
 * while they cannot see the catches every one waiting is held — for up to
 * AWAY_HOLD_MAX_MS, after which it runs out its time as usual: a verse from
 * a minute ago is not what the preacher is on now.
 */
export const AWAY_HOLD_MAX_MS = 30_000;

export interface AwayTimers {
  set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear: (timer: ReturnType<typeof setTimeout>) => void;
}

const REAL_TIMERS: AwayTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (timer) => clearTimeout(timer),
};

export class AwayHolds {
  private away = false;
  /** Held now, each with the timer that lets it go. */
  private held = new Map<string, ReturnType<typeof setTimeout>>();
  /** Held once already this time away, and let go. */
  private spent = new Set<string>();
  private hold: (id: string, on: boolean) => void;
  private timers: AwayTimers;

  constructor(hold: (id: string, on: boolean) => void, timers: AwayTimers = REAL_TIMERS) {
    this.hold = hold;
    this.timers = timers;
  }

  /** The operator left the catches (true) or came back to them (false); `ids` are the catches waiting. */
  setAway(away: boolean, ids: readonly string[]): void {
    if (away !== this.away) {
      this.away = away;
      if (!away) {
        for (const id of [...this.held.keys()]) this.release(id);
        this.spent.clear();
      }
    }
    this.sync(ids);
  }

  /** The catches waiting now: hold the new ones while away, forget the gone ones. */
  sync(ids: readonly string[]): void {
    const waiting = new Set(ids);
    for (const [id, timer] of [...this.held]) {
      if (waiting.has(id)) continue;
      this.timers.clear(timer);
      this.held.delete(id);
    }
    for (const id of [...this.spent]) if (!waiting.has(id)) this.spent.delete(id);
    if (!this.away) return;
    for (const id of waiting) {
      if (this.held.has(id) || this.spent.has(id)) continue;
      this.hold(id, true);
      this.held.set(id, this.timers.set(() => {
        this.held.delete(id);
        this.spent.add(id);
        this.hold(id, false);
      }, AWAY_HOLD_MAX_MS));
    }
  }

  dispose(): void {
    for (const id of [...this.held.keys()]) this.release(id);
  }

  private release(id: string): void {
    const timer = this.held.get(id);
    if (timer != null) this.timers.clear(timer);
    this.held.delete(id);
    this.hold(id, false);
  }
}
