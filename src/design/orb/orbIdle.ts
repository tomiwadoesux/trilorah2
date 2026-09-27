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
 * Hovering the orb used to name the state, and the state is still there —
 * the aria-label carries it, and the log line under the bar says what the
 * service is doing in words. What the tooltip shows now is a short machine
 * fragment: what the thing is doing this second, in two or three words, of
 * the kind a status line would print. "48 kHz", "buffer clear", "12 caught".
 *
 * They are drawn from the state, so they are never wrong — a red state says
 * red things — and the ones that carry a NUMBER are handed the real number
 * from the engine. A phrase that cannot be filled in is not shown. Nothing
 * here is chatty and nothing here is a person talking: no "I'm listening",
 * no "ready when you are". It is a tool reporting itself.
 *
 * The phrase is re-drawn on each hover, so leaving and coming back shows
 * another one. The pool per state is small enough that the operator learns
 * them and stops reading them, which is the right end state for a tooltip
 * that is not load-bearing.
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

/* ------------------------------------------------------------------ */
/* The hover phrase                                                    */
/* ------------------------------------------------------------------ */

/*
 * What the engine can tell the tooltip about itself.
 *
 * Every field here is something the app ALREADY measures — the mic level it
 * reports, the lines it has committed, the clock since it started. Nothing
 * invented, nothing approximated: a tooltip that printed "48 kHz" when
 * nothing had read the sample rate would be decoration wearing the clothes
 * of an instrument, and the first time an operator trusted it over their
 * ears it would cost them a service.
 */
export interface OrbFacts {
  /** Last mic level the engine reported, 0..1. */
  level?: number;
  /** Utterances committed this service. */
  lines?: number;
  /** Words transcribed this service. */
  words?: number;
  /** Seconds since the engine started listening. */
  uptime?: number;
}

type Phrase = string | ((f: OrbFacts) => string | null);

/**
 * Two or three words per state. A function returns null when the engine has
 * not given it a number to print, and that phrase is skipped.
 *
 * `listening` gets the longest list because it is the state the orb is in
 * for most of a service, so it is the one that would go stale.
 */
const PHRASES: Record<string, Phrase[]> = {
  'idle': ['standing by', 'mic closed', 'nothing queued', 'cold', 'armed'],
  'connecting': ['handshake', 'opening socket', 'negotiating', 'dialling out'],
  'listening': [
    'mic open',
    'stream clean',
    'buffer clear',
    'on the words',
    (f) => (f.words ? `${f.words} words` : null),
    (f) => (f.lines ? `${f.lines} lines` : null),
    (f) => (f.uptime && f.uptime >= 60 ? `${Math.floor(f.uptime / 60)} min in` : null),
    (f) => (f.level ? `level ${Math.round(f.level * 100)}` : null),
  ],
  'in preview': ['held back', 'staged', 'awaiting press', 'one queued'],
  'live': ['on the wall', 'pushed', 'holding', 'out'],
  'auto live': ['unattended', 'auto push', 'driving itself', 'hands off'],
  'correction': ['re-reading', 'second pass', 'revising', 'recut'],
  'prayer mode': ['screen dark', 'held quiet', 'paused out', 'nothing out'],
  'practice mode': ['rehearsal', 'off air', 'dry run', 'no output'],
  'output frozen': ['frame held', 'output locked', 'clock stopped', 'frozen'],
  'media / QR': ['serving media', 'code up', 'phones reading', 'asset out'],
  'engine error': ['fault', 'dropped out', 'no stream', 'broken pipe'],
  'no display': ['no sink', 'screen missing', 'nowhere to draw', 'unplugged'],
  'no mic signal': ['silence', 'flat line', 'no input', 'level zero'],
};

/**
 * A short fragment for `state`, re-rolled every time `nonce` changes — the
 * caller bumps it on each hover. Falls back to the state's own name if
 * nothing in its list can be filled in, so the tooltip is never empty.
 */
export function useOrbPhrase(state: string, facts: OrbFacts, nonce: number): string {
  return useMemo(() => {
    const list = PHRASES[state] ?? PHRASES.idle;
    const filled = list
      .map((p) => (typeof p === 'function' ? p(facts) : p))
      .filter((s): s is string => Boolean(s));
    return filled[Math.floor(Math.random() * filled.length)] ?? state;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, nonce]);
}
