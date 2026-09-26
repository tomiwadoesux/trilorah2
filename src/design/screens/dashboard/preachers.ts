import { useSyncExternalStore } from 'react';

/*
 * The preachers the dashboard knows — SAMPLE DATA, for now.
 *
 * The engine keeps real profiles (window.api.listPreacherProfiles /
 * getPreacherStats, the old PREACHERS tab in src/screens/Preachers.tsx), but
 * none of the numbers this surface wants to show — a trust history per
 * service, recent services, what was misheard — exist there yet. So the
 * tile, the list and the profile all read from this one store, which holds
 * a handful of made-up preachers and whatever is added in the session.
 * Nothing here reaches the engine: adding a preacher or picking today's is
 * local until profiles are wired.
 *
 * A module-level store rather than component state because three surfaces
 * read it — the tile face, the list it opens, the profile the list opens —
 * and they must agree the moment one of them changes it.
 */

export type PreacherRole = 'pastor' | 'minister' | 'guest';
export type TrainingStage = 'new' | 'training' | 'mature' | 'auto';

export interface ServicePoint {
  /** '20 sep' */
  label: string;
  /** Wilson lower bound after that service, 0..1. */
  trust: number;
  /** Share of detections that were right, 0..1. */
  precision: number;
}

export interface ServiceRow {
  date: string;
  verses: number;
  /** 0..1 */
  accuracy: number;
  minutes: number;
}

export interface Miss {
  /** What the pulpit said, as the recogniser heard it. */
  heard: string;
  /** What the engine proposed. */
  caught: string;
  /** What the operator corrected it to. */
  meant: string;
  date: string;
}

export interface Preacher {
  id: string;
  name: string;
  role: PreacherRole;
  services: number;
  /** Verified detections — the auto-mode gate counts these. */
  samples: number;
  precision: number;
  trustLowerBound: number;
  correctionsLastService: number;
  avgSermonMin: number | null;
  mostQuoted: string | null;
  topBooks: string[];
  lastPreached: string | null;
  history: ServicePoint[];
  recent: ServiceRow[];
  misses: Miss[];
}

/* The same three defaults Settings stores (autoModeMinTrust / MinSamples /
   MinServices). Written once so the tile, the list and the profile cannot
   disagree about where the line is. */
export const GATES = { trust: 0.9, samples: 100, services: 5 } as const;

export function stageOf(p: Preacher): TrainingStage {
  if (p.services === 0) return 'new';
  if (p.trustLowerBound >= GATES.trust && p.samples >= GATES.samples && p.services >= GATES.services) return 'auto';
  if (p.services >= 4 && p.correctionsLastService <= 1) return 'mature';
  return 'training';
}

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

/* Sundays, newest first. Enough for the longest history below. */
const SUNDAYS = ['20 sep', '13 sep', '06 sep', '30 aug', '23 aug', '16 aug', '09 aug', '02 aug', '26 jul', '19 jul', '12 jul', '05 jul'];

/* A small fixed wobble so the lines are not ruler-straight. Fixed, not
   random: the same preacher must draw the same chart every time. */
const WOBBLE = [0, 0.03, -0.02, 0.025, -0.015, 0.01, -0.01, 0.02, -0.005, 0.01, 0, 0];

/**
 * n services of history, oldest first, easing from a start to where the
 * preacher stands today. Trust climbs slower than accuracy — it is a lower
 * bound, and a lower bound needs samples.
 */
function climb(n: number, dates: string[], from: [number, number], to: [number, number]): ServicePoint[] {
  const out: ServicePoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const ease = 1 - (1 - t) * (1 - t);
    const w = i === n - 1 ? 0 : WOBBLE[i % WOBBLE.length];
    out.push({
      label: dates[n - 1 - i],
      trust: Math.max(0, Math.min(1, from[0] + (to[0] - from[0]) * t * t + w * 0.6)),
      precision: Math.max(0, Math.min(1, from[1] + (to[1] - from[1]) * ease + w)),
    });
  }
  return out;
}

function recentFrom(history: ServicePoint[], verses: number[], minutes: number[]): ServiceRow[] {
  return history
    .slice(-5)
    .reverse()
    .map((p, i) => ({ date: p.label, verses: verses[i] ?? 10, accuracy: p.precision, minutes: minutes[i] ?? 35 }));
}

function seed(
  id: string,
  name: string,
  role: PreacherRole,
  n: number,
  s: {
    /** How many Sundays ago they last preached — they do not all share one. */
    ago: number;
    samples: number;
    precision: number;
    trust: number;
    corrections: number;
    avg: number;
    quoted: string;
    books: string[];
    start: [number, number];
    verses: number[];
    minutes: number[];
    misses: Miss[];
  },
): Preacher {
  const history = climb(n, SUNDAYS.slice(s.ago), s.start, [s.trust, s.precision]);
  return {
    id,
    name,
    role,
    services: n,
    samples: s.samples,
    precision: s.precision,
    trustLowerBound: s.trust,
    correctionsLastService: s.corrections,
    avgSermonMin: s.avg,
    mostQuoted: s.quoted,
    topBooks: s.books,
    lastPreached: history[history.length - 1]?.label ?? null,
    history,
    recent: recentFrom(history, s.verses, s.minutes),
    misses: s.misses,
  };
}

function blank(id: string, name: string, role: PreacherRole): Preacher {
  return {
    id,
    name,
    role,
    services: 0,
    samples: 0,
    precision: 0,
    trustLowerBound: 0,
    correctionsLastService: 0,
    avgSermonMin: null,
    mostQuoted: null,
    topBooks: [],
    lastPreached: null,
    history: [],
    recent: [],
    misses: [],
  };
}

const SEED: Preacher[] = [
  seed('pastor-dan', 'Pastor Dan', 'pastor', 8, {
    ago: 0, samples: 142, precision: 0.92, trust: 0.86, corrections: 1, avg: 38,
    quoted: 'romans 11:23', books: ['psalms', 'romans', 'john'], start: [0.48, 0.7],
    verses: [14, 11, 16, 12, 15], minutes: [38, 34, 41, 36, 39],
    misses: [
      { heard: 'first john four eight', caught: '1 John 4:18', meant: '1 John 4:8', date: '20 sep' },
      { heard: 'psalm twenty three verse one', caught: 'Psalm 23', meant: 'Psalm 23:1', date: '06 sep' },
    ],
  }),
  seed('pastor-ade', 'Pastor Ade', 'pastor', 10, {
    ago: 1, samples: 268, precision: 0.96, trust: 0.93, corrections: 0, avg: 42,
    quoted: 'john 3:16', books: ['john', 'hebrews', 'isaiah'], start: [0.55, 0.76],
    verses: [18, 21, 17, 19, 22], minutes: [44, 41, 46, 40, 43],
    misses: [],
  }),
  seed('sis-grace', 'Sis. Grace', 'minister', 3, {
    ago: 2, samples: 41, precision: 0.78, trust: 0.66, corrections: 5, avg: 31,
    quoted: 'proverbs 3:5', books: ['proverbs', 'psalms', 'james'], start: [0.4, 0.68],
    verses: [9, 12, 8], minutes: [31, 29, 33],
    misses: [
      { heard: 'proverbs three five and six', caught: 'Proverbs 3:5', meant: 'Proverbs 3:5-6', date: '06 sep' },
      { heard: 'james one five', caught: 'John 1:5', meant: 'James 1:5', date: '23 aug' },
      { heard: 'the book of ruth chapter one', caught: '—', meant: 'Ruth 1', date: '23 aug' },
    ],
  }),
  seed('bro-femi', 'Bro. Femi', 'guest', 2, {
    ago: 3, samples: 23, precision: 0.81, trust: 0.58, corrections: 3, avg: 29,
    quoted: 'acts 2:38', books: ['acts', 'romans'], start: [0.44, 0.72],
    verses: [7, 16], minutes: [29, 28],
    misses: [{ heard: 'acts two thirty eight', caught: 'Acts 2:3', meant: 'Acts 2:38', date: '30 aug' }],
  }),
  blank('min-joy', 'Min. Joy', 'minister'),
];

/* ------------------------------------------------------------------ */
/* The store                                                           */
/* ------------------------------------------------------------------ */

export interface PreachersState {
  preachers: Preacher[];
  /** Today's preacher — the profile the engine adapts to this service. */
  activeId: string | null;
}

let state: PreachersState = { preachers: SEED, activeId: 'pastor-dan' };
const listeners = new Set<() => void>();

function commit(next: PreachersState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePreachers(): PreachersState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Collapses stray spaces so "pastor  dan " and "Pastor Dan" are one person. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function findByName(name: string): Preacher | undefined {
  const key = cleanName(name).toLowerCase();
  return state.preachers.find((p) => p.name.toLowerCase() === key);
}

/** Adds a preacher at the top of the list, with no history. */
export function addPreacher(name: string, role: PreacherRole): Preacher | null {
  const clean = cleanName(name);
  if (!clean || findByName(clean)) return null;
  const base = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preacher';
  let id = base;
  for (let n = 2; state.preachers.some((p) => p.id === id); n++) id = `${base}-${n}`;
  const p = blank(id, clean, role);
  commit({ ...state, preachers: [p, ...state.preachers] });
  return p;
}

export function setActivePreacher(id: string) {
  if (state.activeId === id || !state.preachers.some((p) => p.id === id)) return;
  commit({ ...state, activeId: id });
}

export function removePreacher(id: string) {
  commit({
    preachers: state.preachers.filter((p) => p.id !== id),
    activeId: state.activeId === id ? null : state.activeId,
  });
}
