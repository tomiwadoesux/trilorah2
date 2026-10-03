import { useEffect, useMemo, useRef, useState } from 'react';
import { ORB_BY_STATE, pickStatusLook, type OrbPick } from './statusLooks';

/*
 * The orb's idle life, and what it says on hover.
 *
 * Two small behaviours, both for the same moment: a service that is simply
 * RUNNING. The engine is listening, the transcript is coming through, and it
 * has been that way long enough that nothing needs the operator. That is
 * most of a Sunday, and for all of it the bar is a still green ball.
 *
 * ── The drift ──────────────────────────────────────────────────────────
 *
 * After two unbroken minutes of `listening`, the orb borrows another shape
 * from listening's own pool for a few seconds, then comes back to the one
 * this session picked. It is the same colour, the same speed, the same
 * state — only the motion changes, and only for as long as a glance.
 *
 * Why it is safe to do at all: the orb's JOB is to report the state, and a
 * drift reports the same state it always did. The colour never moves, and
 * colour is what an operator reads across a booth. Shape is the second
 * channel, and spending it here costs nothing because during a smooth
 * stretch there is no second thing to say.
 *
 * Why ONLY here: any state that wants the operator — connecting, an engine
 * error, no mic, a frozen output — holds its shape absolutely. A wandering
 * orb during a fault would be the interface fidgeting while something is
 * wrong. `listening` alone earns this, and only after it has proved itself
 * for two minutes, because a fresh `listening` is exactly when the operator
 * is still watching to see whether it took.
 *
 * The timer RESTARTS on every state change, so a sermon that goes
 * listening → preview → live → listening never drifts. The drift is a sign
 * of a long quiet stretch, which is the only thing it is allowed to mean.
 *
 * ── The hover ──────────────────────────────────────────────────────────
 *
 * Hover and keyboard focus explain the current state in plain language.
 * Keep the explanation stable so operators can learn what each state means.
 */

/* ------------------------------------------------------------------ */
/* The drift                                                           */
/* ------------------------------------------------------------------ */

/** How long `listening` must hold, unbroken, before the orb may drift. */
const SETTLED_MS = 120_000;
/** How long a borrowed shape is worn. */
const DRIFT_MS = 7_000;
/** The gap between drifts, once they have started. */
const BETWEEN_MS = 90_000;
/** The only state a drift may happen in. */
const DRIFTS_IN = 'listening';

/**
 * The shape the orb wears right now: this session's pick for `state`, or —
 * during a drift — another style from the same state's pool.
 *
 * Only `listening` ever drifts, and only after SETTLED_MS unbroken. Every
 * other state returns its session pick and nothing else, forever.
 */
export function useOrbShape(state: string): OrbPick {
  const pick = useMemo(() => pickStatusLook(state), [state]);
  const [drift, setDrift] = useState<OrbPick | null>(null);

  /* The pool this state may borrow from, minus the shape already on. */
  const others = useMemo(() => {
    const pool = ORB_BY_STATE[state]?.pool ?? [];
    return pool.filter((p) => p.style !== pick.style);
  }, [state, pick.style]);

  const lastDrift = useRef<string | null>(null);

  useEffect(() => {
    setDrift(null);
    lastDrift.current = null;
    if (state !== DRIFTS_IN || others.length === 0) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let on: number | undefined;
    let off: number | undefined;

    const start = () => {
      /* Not the one we drifted to last time, when there is a choice: two
         drifts in a row to the same shape reads as a glitch, not a life. */
      const choices = others.length > 1 ? others.filter((p) => p.style !== lastDrift.current) : others;
      const next = choices[Math.floor(Math.random() * choices.length)] ?? others[0];
      lastDrift.current = next.style;
      setDrift(next);
      off = window.setTimeout(() => {
        setDrift(null);
        on = window.setTimeout(start, BETWEEN_MS);
      }, DRIFT_MS);
    };

    on = window.setTimeout(start, SETTLED_MS);
    /* Only the timers are torn down here. The drift itself is cleared at
       the TOP of the next run, which is the same frame the new state's
       shape is chosen — clearing it in the cleanup as well would set state
       on the way out of an unmount for no gain. */
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, [state, others]);

  return drift ?? pick;
}

/** Plain-language explanations shared by hover and assistive technology. */
const STATUS_DESCRIPTIONS: Record<string, string> = {
  'idle': 'Mic is off. Select Start listening.',
  'connecting': 'Connecting. Please wait.',
  'listening': 'Listening for verses. No action needed.',
  'in preview': 'Preview ready. Select Go live.',
  'live': 'Content is live. Use Next or Previous to move.',
  'auto live': 'Auto mode is live. Watch for verse changes.',
  'correction': 'Checking the verse. Please wait.',
  'prayer mode': 'Prayer pause is on. Resume when ready.',
  'practice mode': 'Practice mode. The projector is unchanged.',
  'output frozen': 'Output is held. Select Restore to continue.',
  'media / QR': 'Media is live. Clear it when finished.',
  'engine error': 'Listening stopped. Check your connection or select verses manually.',
  'no display': 'No audience display. Connect a screen.',
  'no mic signal': 'No mic sound. Check your microphone and volume.',
};

export function orbStatusDescription(state: string): string {
  return STATUS_DESCRIPTIONS[state] ?? STATUS_DESCRIPTIONS.idle;
}
