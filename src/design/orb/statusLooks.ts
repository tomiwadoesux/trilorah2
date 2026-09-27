/*
 * The status orb's looks, one pool of styles per engine state.
 *
 * Lives here, not in Live.tsx, so the Live bar and the Thinking orb 2
 * sheet read the same table: what the sheet shows is what the bar does.
 * The reasoning for the colours and the still states is in Live.tsx above
 * StatusOrb.
 *
 * A state is a COLOUR and a FAMILY of motions, not one fixed animation.
 * Each state has a pool of styles; the orb picks one at random the first
 * time the state comes up in a session and keeps it for the rest of that
 * session, so a sermon's "listening" never changes shape halfway through.
 * Stopping (the orb passing through idle) ends the session: next time the
 * operator starts listening the picks are rolled again, and never land on
 * the same style as last time when the pool has another. Styles are shared
 * between states freely where the colour tells them apart; the states that
 * follow each other in a sermon in the same green never share one.
 */

export interface OrbPick {
  style: string;
  /** Where in its loop the style sits. Only matters for a still state. */
  startAt?: number;
}

export interface OrbLook {
  /** The styles this state may wear. One is picked per session. */
  pool: OrbPick[];
  /** The accent dots' colour — the only colour the state gets. */
  accent: string;
  /** 0 holds the orb exactly where it is. */
  speed: number;
  opacity: number;
}

export const STATUS_ORB_INK = '#e5f3f2';
const RED = '#ef5350';    // not connected
const ORANGE = '#ffa726'; // connecting, or held
const GREEN = '#66bb6a';  // connected

/*
 * First in each pool is the style the state wore when it had only one.
 *
 * Green states that follow each other through a sermon (listening, in
 * preview, live, auto live, correction, prayer) never share a style, so a
 * change of state is always a change of shape. The red states never share
 * with each other either. Everything else borrows freely: the colour tells
 * a green `band` from an orange one.
 *
 * Five styles are left out of the bar because they do not read at 30px:
 * twinkle (empty for half its loop), spot (a roaming light that vanishes),
 * magnet (collapses to specks), layers (too dim) and rain (noise).
 */
export const ORB_BY_STATE: Record<string, OrbLook> = {
  /* Still, dim. Each on a frame that reads as a calm sphere. */
  'idle': {
    pool: [{ style: 'nest', startAt: 0 }, { style: 'rings', startAt: 0 }, { style: 'breathe', startAt: 0.5 }, { style: 'gimbal', startAt: 0 }],
    accent: RED, speed: 0, opacity: 0.45,
  },
  /* Reaching out: a probe, a searching belt, things fired outward. */
  'connecting': {
    pool: [{ style: 'ping' }, { style: 'band' }, { style: 'burst' }, { style: 'popcorn' }],
    accent: ORANGE, speed: 1, opacity: 0.8,
  },
  /* An attentive surface: ripples, a passing wave, a slow breath. */
  'listening': {
    pool: [{ style: 'noise' }, { style: 'wave' }, { style: 'breathe' }, { style: 'stripes' }],
    accent: GREEN, speed: 1, opacity: 0.9,
  },
  /* Held up for inspection: gimbals, rings, order settling. (Not spot: a
     roaming light on a dark sphere is invisible at 28px.) */
  'in preview': {
    pool: [{ style: 'gyro' }, { style: 'gimbal' }, { style: 'rings' }, { style: 'crystal' }],
    accent: GREEN, speed: 1, opacity: 0.9,
  },
  /* Settled and sure: shells turning, a steady rock. */
  'live': {
    pool: [{ style: 'nested' }, { style: 'nest' }, { style: 'arms' }, { style: 'rock' }],
    accent: GREEN, speed: 1, opacity: 1,
  },
  /* Self-driven and quicker: a lit trail, spin-ups, winding. */
  'auto live': {
    pool: [{ style: 'chase' }, { style: 'spinup' }, { style: 'ribbon' }, { style: 'coil' }],
    accent: GREEN, speed: 1.3, opacity: 1,
  },
  /* A snap and a re-shape. */
  'correction': {
    pool: [{ style: 'ratchet' }, { style: 'converge' }, { style: 'pinch' }, { style: 'funnel' }],
    accent: GREEN, speed: 1, opacity: 0.9,
  },
  /* Slow, low, receding. */
  'prayer mode': {
    pool: [{ style: 'tide' }, { style: 'sag' }, { style: 'drain' }, { style: 'vortex' }],
    accent: GREEN, speed: 0.55, opacity: 0.6,
  },
  /* Live's family, lighter. Never on at the same time as live. */
  'practice mode': {
    pool: [{ style: 'nested' }, { style: 'arms' }, { style: 'popcorn' }, { style: 'burst' }],
    accent: GREEN, speed: 1, opacity: 0.85,
  },
  /* Still, held. */
  'output frozen': {
    pool: [{ style: 'nested', startAt: 0 }, { style: 'cube', startAt: 0.375 }, { style: 'rock', startAt: 0 }, { style: 'crystal', startAt: 0.5 }],
    accent: ORANGE, speed: 0, opacity: 0.55,
  },
  /* Structured: lattices, a cube, a belt, rings. */
  'media / QR': {
    pool: [{ style: 'grid' }, { style: 'cube' }, { style: 'band' }, { style: 'rings' }],
    accent: GREEN, speed: 1, opacity: 0.9,
  },
  /* A broken rhythm: jolts, collapses, pinches. */
  'engine error': {
    pool: [{ style: 'bounce' }, { style: 'popcorn' }, { style: 'pinch' }, { style: 'converge' }],
    accent: RED, speed: 1, opacity: 1,
  },
  /* Something missing: half dark, a sector gone, a dim ball. */
  'no display': {
    pool: [{ style: 'terminator' }, { style: 'wedge' }, { style: 'band' }, { style: 'ping' }],
    accent: RED, speed: 0.8, opacity: 0.7,
  },
  /* Sagging and draining. Never the same as listening's, which it
     interrupts. */
  'no mic signal': {
    pool: [{ style: 'sag' }, { style: 'drain' }, { style: 'vortex' }, { style: 'funnel' }],
    accent: RED, speed: 0.8, opacity: 0.7,
  },
};

/* ------------------------------------------------------------------ */
/* Picking                                                             */
/* ------------------------------------------------------------------ */

/* This session's pick per state, and the one before it, so a re-roll can
   avoid showing the operator the same orb they had last time. */
const picks = new Map<string, OrbPick>();
const previous = new Map<string, OrbPick>();
let lastState: string | null = null;

function roll(state: string, pool: OrbPick[]): OrbPick {
  const before = previous.get(state);
  const choices = pool.length > 1 && before ? pool.filter((p) => p.style !== before.style) : pool;
  return choices[Math.floor(Math.random() * choices.length)] ?? pool[0];
}

/**
 * The style the orb wears for `state` right now.
 *
 * Coming back to idle from anything else is a stop, and a stop ends the
 * session: every state rolls again the next time it comes up. Calling this
 * again for the same state returns the same pick, so re-renders, a second
 * orb on another view, and React's double render in development all agree.
 */
export function pickStatusLook(state: string): OrbPick {
  const look = ORB_BY_STATE[state] ?? ORB_BY_STATE.idle;
  if (state === 'idle' && lastState !== null && lastState !== 'idle') {
    for (const [k, v] of picks) previous.set(k, v);
    picks.clear();
  }
  lastState = state;
  let pick = picks.get(state);
  if (!pick || !look.pool.some((p) => p.style === pick!.style)) {
    pick = roll(state, look.pool);
    picks.set(state, pick);
  }
  return pick;
}
