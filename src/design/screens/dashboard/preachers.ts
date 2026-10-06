import { isEmptyPreview } from '../../emptyPreviewMode';
import { useEffect, useSyncExternalStore } from 'react';
import type { PreacherLearningDetail, PreacherTeaching } from '../../../../shared/preacherLearning';

/*
 * The preachers the dashboard knows — from the engine, with a sample
 * fallback.
 *
 * This store used to be sample data end to end, and said so. It is now the
 * real thing: `load()` reads window.api.listPreacherProfiles() and
 * getPreacherStats(), and add / setActive / remove write through to
 * createPreacherProfile, setActivePreacher and deletePreacherProfile. That
 * is what the old PREACHERS tab did (src/screens/Preachers.tsx) and it is
 * why that tab can go.
 *
 * Two things the engine does NOT keep, which the surfaces here want:
 *
 *   history / recent   a trust reading per past service. The engine holds
 *                      only today's totals, so these stay empty until a
 *                      local service log exists. An empty array draws an
 *                      empty chart, which is honest; inventing a curve
 *                      would not be.
 *   misses / teaching  soundsLike, vocabulary and ignoreTails have engine
 *                      homes (preachers/vocabulary.ts, correctionLedger.ts)
 *                      but no read IPC yet. Same rule: empty, not invented.
 *
 * SAMPLE stays as the fallback for when there is no engine at all — the
 * design sandbox runs in a plain browser, and a board of empty cards is not
 * a useful thing to design against.
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
  accuracy: number | null;
  minutes: number;
}

/**
 * A word the engine keeps mis-hearing, and what it really is.
 *
 * Two kinds, and the difference matters to the operator:
 *   learned  the correction ledger built this alias itself, from a
 *            correction someone made during a service
 *   taught   a person typed it in before a service
 *
 * Both end up in the same table the resolver reads (see
 * electron/preachers/correctionLedger.ts aliases and
 * electron/preachers/vocabulary.ts terms) — the split exists so the screen
 * can say "the app worked this out" versus "you told it".
 */
export interface SoundsLike {
  /** What the recogniser produces — "rawmeans". */
  heard: string;
  /** What it means — "Romans". */
  means: string;
  source: 'learned' | 'taught';
  /** Times this alias has fired. 0 for one just typed in. */
  hits: number;
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
  learning?: PreacherLearningDetail;
  gates?: { trust: number; samples: number; services: number };
  engineMature?: boolean;
  engineEligible?: boolean;
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
  /** Words the engine mishears, learned and taught (see SoundsLike). */
  soundsLike: SoundsLike[];
  /**
   * Names, titles and church words the ASR mangles, boosted for this
   * preacher — electron/preachers/vocabulary.ts. Plain strings: the engine
   * matches anything that SOUNDS like one of them.
   */
  vocabulary: string[];
  /**
   * Words this preacher habitually adds after a reference ("amen", "say
   * verse ten") — stripped from the tail before resolving. Maps to
   * `ignoreTails` in electron/engine/commandConfig.ts.
   */
  ignoreTails: string[];
  /**
   * Whether this preacher's spoken commands ("next slide", "let us pray")
   * fire anything. Voice commands are on for the app by default and the
   * dashboard tile is the kill switch for all of them; this is the per
   * preacher exception — a guest who says "go on" every other sentence, or
   * a pastor who simply does not use them. Undefined means "follow the
   * app", which is how every existing profile reads.
   */
  voiceCommands?: boolean;
}

/* The same three defaults Settings stores (autoModeMinTrust / MinSamples /
   MinServices). Written once so the tile, the list and the profile cannot
   disagree about where the line is. */
export const GATES = { trust: 0.9, samples: 100, services: 5 } as const;

export function stageOf(p: Preacher): TrainingStage {
  if (p.engineEligible !== undefined) {
    if (p.engineEligible) return 'auto';
    if (p.engineMature) return 'mature';
    return p.samples > 0 ? 'training' : 'new';
  }
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
    soundsLike?: SoundsLike[];
    vocabulary?: string[];
    ignoreTails?: string[];
    voiceCommands?: boolean;
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
    soundsLike: s.soundsLike ?? [],
    vocabulary: s.vocabulary ?? [],
    ignoreTails: s.ignoreTails ?? [],
    voiceCommands: s.voiceCommands ?? true,
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
    soundsLike: [],
    vocabulary: [],
    ignoreTails: [],
    voiceCommands: true,
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
    /* The ledger's own alias table plus two a person typed in. "rawmeans"
       is the case this panel exists for: the recogniser is consistent about
       getting it wrong, so one entry fixes every Sunday after. */
    soundsLike: [
      { heard: 'rawmeans', means: 'Romans', source: 'learned', hits: 23 },
      { heard: 'rome and', means: 'Romans', source: 'learned', hits: 9 },
      { heard: 'thessa loanians', means: 'Thessalonians', source: 'taught', hits: 4 },
      { heard: 'fill ippians', means: 'Philippians', source: 'learned', hits: 6 },
      { heard: 'ecclesiastes tees', means: 'Ecclesiastes', source: 'taught', hits: 0 },
    ],
    vocabulary: ['Pastor Ayotomiwa', 'Bethel House', 'Deacon Femi', 'agape'],
    ignoreTails: ['amen', 'are you with me', 'say it with me'],
    voiceCommands: true,
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

const api = () => (typeof window === 'undefined' ? undefined : window.api);

/* No engine (the design sandbox in a plain browser) → the sample board, so
   there is something to design against. With an engine, start empty and let
   load() fill it: seeding real screens with invented preachers would put
   five people who do not exist in front of an operator. */
const hasEngine = () => !!api()?.listPreacherProfiles;

let state: PreachersState = hasEngine() || isEmptyPreview
  ? { preachers: [], activeId: null }
  : { preachers: SEED, activeId: 'pastor-dan' };

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

/**
 * One engine profile as this surface's Preacher.
 *
 * The stats the engine keeps (PreacherStats) are exactly the ones the gates
 * read — samples, services, precision, trustLowerBound,
 * correctionsLastService — so they map straight across. Everything the
 * engine does not track stays at its blank value rather than being guessed.
 */
function fromEngine(
  profile: { id: string; name: string },
  stats: PreacherStats | undefined,
  previous: Preacher | undefined,
): Preacher {
  const base = previous ?? blank(profile.id, profile.name, roleOf(profile.name));
  return {
    ...base,
    id: profile.id,
    name: stats?.name || profile.name,
    engineMature: stats?.mature ?? false,
    engineEligible: stats?.autoModeEligible ?? false,
    samples: stats?.samples ?? 0,
    services: stats?.services ?? 0,
    precision: stats?.precision ?? 0,
    trustLowerBound: stats?.trustLowerBound ?? 0,
    correctionsLastService: stats?.correctionsLastService ?? 0,
  };
}

/* The engine stores a name, not a role. The title in front of it is the
   only signal there is, and it is the one people actually type. */
function roleOf(name: string): PreacherRole {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase().replace(/\./g, '') ?? '';
  if (first === 'pastor' || first === 'pst' || first === 'rev' || first === 'dr') return 'pastor';
  if (first === 'min' || first === 'minister' || first === 'evang') return 'minister';
  return 'guest';
}

let loading: Promise<void> | null = null;

/**
 * Pull profiles and stats from the engine into the store.
 *
 * Both lists can know a preacher the other does not — a profile folder with
 * no services yet, or stats for someone whose profile was removed — so they
 * are merged by id rather than joined, the same way the old PREACHERS tab
 * did it. Existing rows are kept and updated in place so anything taught in
 * this session (a sounds-like row, a vocabulary word) is not dropped by a
 * refresh.
 */
export async function loadPreachers(): Promise<void> {
  const a = api();
  if (!a?.listPreacherProfiles) return;
  try {
    const [profiles, stats, settings] = await Promise.all([
      a.listPreacherProfiles(),
      a.getPreacherStats?.().catch(() => undefined) ?? Promise.resolve(undefined),
      a.getSettings?.(),
    ]);
    const statById = new Map((stats ?? []).map((x) => [x.id, x]));
    const prevById = new Map(state.preachers.map((p) => [p.id, p]));

    const merged: Preacher[] = (profiles ?? []).map((p) =>
      fromEngine(p, statById.get(p.id), prevById.get(p.id)),
    );
    for (const x of stats ?? []) {
      if (!merged.some((m) => m.id === x.id)) {
        merged.push(fromEngine({ id: x.id, name: x.name }, x, prevById.get(x.id)));
      }
    }

    /* An active id that no longer names anyone would leave the dashboard
       saying nobody is preaching while the engine thinks otherwise. */
    const wantedActive = settings?.activePreacherId ?? state.activeId;
    const activeId = merged.some((m) => m.id === wantedActive) ? wantedActive : null;
    await Promise.all(merged.map(async (p) => {
      if (!a.getPreacherLearning) return;
      try { Object.assign(p, learningFields(await a.getPreacherLearning(p.id))); } catch { /* Detail panel reports unavailable data. */ }
    }));
    commit({ preachers: merged, activeId });
  } catch {
    /* Leaving the last good list up beats blanking the board mid-service. */
  }
}

function learningFields(d: PreacherLearningDetail): Partial<Preacher> {
  const { name: _name, ...stats } = d.stats;
  return { ...stats, ...d.habits, recent: d.recent,
    learning: d, gates: d.gates, engineMature: d.stats.mature, engineEligible: d.stats.autoModeEligible,
    soundsLike: d.soundsLike, vocabulary: d.vocabulary, ignoreTails: d.ignoreTails, voiceCommands: d.voiceCommands, history: d.history };
}

export async function refreshPreacher(id: string): Promise<void> {
  const a = api();
  if (!a?.getPreacherLearning) throw new Error('Open the desktop app to use preacher learning.');
  const d = await a.getPreacherLearning(id);
  commit({ ...state, preachers: state.preachers.map((p) => p.id === id ? { ...p, ...learningFields(d), name: d.stats.name || p.name } : p) });
}

export async function saveTeaching(id: string, patch: Partial<PreacherTeaching>): Promise<void> {
  const a = api();
  if (!a?.savePreacherLearning) throw new Error('Open the desktop app to save teaching.');
  await a.savePreacherLearning(id, patch);
  await refreshPreacher(id);
}

/** Load once per session, on the first surface that asks. */
function ensureLoaded(): void {
  if (loading || !hasEngine()) return;
  loading = loadPreachers();
}

export function usePreachers(): PreachersState {
  /* The load is kicked off from an effect rather than at module scope: a
     store that fetches on import runs in tests and in the sandbox too. */
  useEffect(() => {
    ensureLoaded();
    const refreshImported = () => { void loadPreachers(); };
    window.addEventListener('trilorah-package-imported', refreshImported);
    return () => window.removeEventListener('trilorah-package-imported', refreshImported);
  }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Tell the store who the engine says is preaching, without a round trip. */
export function noteActivePreacher(id: string | null): void {
  if (state.activeId === id) return;
  commit({ ...state, activeId: id });
}

/** Collapses stray spaces so "pastor  dan " and "Pastor Dan" are one person. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function findByName(name: string): Preacher | undefined {
  const key = cleanName(name).toLowerCase();
  return state.preachers.find((p) => p.name.toLowerCase() === key);
}

/*
 * The three writes.
 *
 * Each one moves the local list FIRST and tells the engine after. The
 * operator pressing "set for today" thirty seconds before a service starts
 * should see it land instantly, not wait on a disk write — and if the
 * engine refuses, the reload that follows puts the truth back. The one
 * thing never done optimistically is inventing an id the engine did not
 * agree to, which is why create waits for its answer before settling.
 */

/** Adds a preacher at the top of the list, with no history. */
export async function addPreacher(name: string, role: PreacherRole): Promise<Preacher | null> {
  const clean = cleanName(name);
  if (!clean || findByName(clean)) return null;
  const base = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'preacher';
  let id = base;
  for (let n = 2; state.preachers.some((p) => p.id === id); n++) id = `${base}-${n}`;
  const a = api();
  if (a?.createPreacherProfile) {
    const result = await a.createPreacherProfile(id, clean);
    if (!result.success) throw new Error(result.error || 'Could not save this preacher. Please try again.');
    id = result.id ?? id;
  }
  const p = blank(id, clean, role);
  commit({ ...state, preachers: [p, ...state.preachers.filter((x) => x.id !== id)] });
  return p;
}

export function setActivePreacher(id: string) {
  if (state.activeId === id || !state.preachers.some((p) => p.id === id)) return;
  commit({ ...state, activeId: id });

  /* This is the call the whole tab removal turned on: it is what tells the
     engine whose vocabulary to load, whose correction ledger to write, and
     whose trust gates auto mode should read. Without it the app adapts to
     nobody. */
  const a = api();
  if (a?.setActivePreacher) {
    void a
      .setActivePreacher(id)
      .then((res) => {
        if (!res?.success) void loadPreachers();
      })
      .catch(() => undefined);
  }
}

export function removePreacher(id: string) {
  commit({
    preachers: state.preachers.filter((p) => p.id !== id),
    activeId: state.activeId === id ? null : state.activeId,
  });

  const a = api();
  if (a?.deletePreacherProfile) {
    void a.deletePreacherProfile(id).catch(() => undefined);
  }
}
