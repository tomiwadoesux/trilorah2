import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThinkingOrb, resolvePreset, MODE_DRAWS, type OrbState, type OrbSize } from 'thinking-orbs';
import { Button, Select, Slider, type SelectOption } from '../../ui';
import { Sheet, Group, Cell, Note, Spec, Stage } from '../Sheet';
import { RENDERERS, RendererBoundary, measureRenderer, type RendererId, type Weight } from '../orb/renderers';
import { FRAME_US, INK_WHITE, INK_TRI, type Ink } from '../orb/painters';
import { tierOf, TIER_INK } from '../orb/tiers';

/*
 * C-65 — Thinking orb.
 *
 * The one sheet in the gallery that is not ours. `thinking-orbs` came off
 * npm, so this sheet is an audition rather than a spec: does a monochrome
 * dotted canvas belong in a teal booth product, which of the nine states
 * has a job here, what does each one cost to run — and, since the answer
 * to that last one was "more than it should", whether the same nine
 * animations can be painted some lighter way.
 *
 * The cost question is the reason this sheet has machinery in it. The
 * package exposes its geometry engine (`MODE_FRAMES`) and its canvas
 * painters (`MODE_DRAWS`) separately from the React component, so every
 * weight shown below is measured on a real painter in this window — not
 * read off the README, and not guessed.
 */

/* ------------------------------------------------------------------ */
/* The nine                                                            */
/* ------------------------------------------------------------------ */

interface StateSpec {
  state: OrbState;
  /** What the animation actually depicts — the package's own description. */
  picture: string;
}

const STATES: StateSpec[] = [
  { state: 'working', picture: 'particles on tilted orbits' },
  { state: 'searching', picture: 'a scan meridian sweeps a dotted globe' },
  { state: 'solving', picture: 'bands scramble in quarter turns, then click back' },
  { state: 'listening', picture: 'a waveform rolls through latitude rings' },
  { state: 'connecting', picture: 'a constellation wires itself, packets on the edges' },
  { state: 'weaving', picture: 'three strands plait around the sphere' },
  { state: 'composing', picture: 'an undulating multi-band sash' },
  { state: 'breathing', picture: 'a face-on ring slowly morphing' },
  { state: 'shaping', picture: 'a dotted outline: circle → triangle → square' },
];

const SIZES: OrbSize[] = [64, 20];

const ORB_OPTIONS: SelectOption[] = STATES.map((s) => ({ value: s.state, label: s.state }));

/* ------------------------------------------------------------------ */
/* Weight — measured, not quoted                                       */
/* ------------------------------------------------------------------ */

/** Harness key. `stock` is the installed component's own painter. */
const rkey = (renderer: RendererId, state: OrbState, size: OrbSize) => `${renderer}:${state}@${size}`;
const key = (state: OrbState, size: OrbSize) => rkey('stock', state, size);

/** How many of this orb fit in one frame before nothing else gets to run. */
const atOnce = (w: Weight) => (w.mainUs <= 0 ? '∞' : String(Math.max(1, Math.floor(FRAME_US / w.mainUs))));

/**
 * Measure everything, one job per animation frame.
 *
 * The installed painter at both sizes goes first, so the meters under the
 * nine fill in before the comparison does. Chunked rather than looped:
 * sixty back-to-back measurements are a ~500ms block of main thread, which
 * would freeze every orb on the sheet at the exact moment you are looking
 * at them.
 */
function useOrbWeights() {
  const [weights, setWeights] = useState<Record<string, Weight>>({});
  const [pass, setPass] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const jobs: [RendererId, OrbState, OrbSize][] = [
      ...SIZES.flatMap((size) => STATES.map((s) => ['stock', s.state, size] as [RendererId, OrbState, OrbSize])),
      ...RENDERERS.filter((r) => r.id !== 'stock').flatMap((r) =>
        STATES.map((s) => [r.id, s.state, 64] as [RendererId, OrbState, OrbSize]),
      ),
    ];
    const out: Record<string, Weight> = {};
    let cancelled = false;
    let raf = 0;
    let i = 0;

    setDone(false);
    const step = async () => {
      if (cancelled) return;
      const job = jobs[i];
      i += 1;
      if (!job) {
        setDone(true);
        return;
      }
      try {
        out[rkey(...job)] = await measureRenderer(...job);
      } catch (err) {
        /* One renderer failing (no WebGL, p5 refusing to load) should
           not take the rest of the table with it. */
        console.warn('orb measure failed', job, err);
      }
      if (cancelled) return;
      setWeights({ ...out });
      raf = requestAnimationFrame(() => void step());
    };
    raf = requestAnimationFrame(() => void step());

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [pass]);

  const remeasure = useCallback(() => setPass((p) => p + 1), []);
  return { weights, done, remeasure };
}

/** The heaviest orb at a given size — the bar below is drawn against it. */
function peakAt(weights: Record<string, Weight>, size: OrbSize): number {
  return STATES.reduce((max, s) => Math.max(max, weights[key(s.state, size)]?.mainUs ?? 0), 0);
}

/**
 * The weight readout: a bar relative to `peak`, and the absolute numbers
 * underneath. Both, because they answer different questions — "which of
 * these should I avoid" and "can I afford this one".
 */
function WeightMeter({ w, peak }: { w?: Weight; peak: number }) {
  if (!w) {
    return <div className="h-[22px] text-[10px] text-[var(--tri-ink-muted)]">measuring…</div>;
  }
  const tier = tierOf(w.share);
  return (
    <div className="space-y-1">
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[rgb(255_255_255_/_0.10)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${peak > 0 ? Math.max(2, (w.mainUs / peak) * 100) : 0}%`,
            background: TIER_INK[tier],
          }}
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[10px] leading-4">
        <span style={{ color: TIER_INK[tier] }}>{tier}</span>
        <span className="text-[var(--tri-ink-muted)]">{(w.share * 100).toFixed(1)}% of a frame</span>
        <span className="text-[rgb(229_243_242_/_0.4)]">
          {w.marks} marks · {Math.round(w.mainUs)}µs · {atOnce(w)} at once
        </span>
      </div>
    </div>
  );
}

/** Compact form of the same number, for a table row. */
function WeightChip({ w }: { w?: Weight }) {
  if (!w) return <span className="font-mono text-[10px] text-[var(--tri-ink-muted)]">…</span>;
  const tier = tierOf(w.share);
  return (
    <span className="font-mono text-[10px] whitespace-nowrap" style={{ color: TIER_INK[tier] }}>
      {tier} · {(w.share * 100).toFixed(1)}%
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Renderers — the same orb, six ways, side by side                   */
/* ------------------------------------------------------------------ */

const INK_OPTIONS: SelectOption[] = [
  { value: 'white', label: 'package white' },
  { value: 'tri', label: 'trilorah ink' },
];

/**
 * One column of the comparison: a renderer running for real, its harness
 * number against the installed one, and — where the renderer reports it —
 * what the instance on screen is actually costing right now.
 */
function RendererColumn({
  spec,
  state,
  ink,
  w,
  stock,
}: {
  spec: (typeof RENDERERS)[number];
  state: OrbState;
  ink: Ink;
  w?: Weight;
  stock?: Weight;
}) {
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => setLive(null), [state, ink, spec.id]);
  const tier = w ? tierOf(w.share) : null;
  const ratio = spec.id !== 'stock' && w && stock && w.mainUs > 0 ? stock.mainUs / w.mainUs : null;
  const { Component } = spec;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* Three lines of description, so every orb sits on the same row whatever its column says. */}
      <div className="min-h-[68px]">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] text-[var(--tri-ink)]">{spec.title}</span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-[rgb(229_243_242_/_0.35)]">
            {spec.thread}
          </span>
        </div>
        <div className="text-[10px] leading-snug text-[rgb(229_243_242_/_0.45)]">{spec.how}</div>
      </div>

      <div className="flex h-24 items-center justify-center rounded-[12px] bg-[rgb(255_255_255_/_0.025)]">
        <RendererBoundary resetKey={`${state}:${ink.join(',')}`}>
          <Component state={state} size={64} ink={spec.takesInk ? ink : INK_WHITE} onCost={setLive} />
        </RendererBoundary>
      </div>

      <div className="space-y-1.5">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-[rgb(255_255_255_/_0.10)]">
          {w && stock && (
            <div
              className="h-full rounded-full"
              style={{
                /* Against the installed painter, so the bar reads "this much of stock". */
                width: `${Math.max(2, Math.min(100, (w.mainUs / Math.max(stock.mainUs, 1)) * 100))}%`,
                background: TIER_INK[tier ?? 'light'],
              }}
            />
          )}
        </div>
        {w ? (
          <div className="space-y-0.5 font-mono text-[10px] leading-4">
            <div>
              <span style={{ color: TIER_INK[tier!] }}>{tier}</span>{' '}
              <span className="text-[var(--tri-ink-muted)]">{(w.share * 100).toFixed(1)}% of a frame</span>
            </div>
            <div className="text-[rgb(229_243_242_/_0.4)]">
              {spec.thread === 'worker'
                ? `0µs main · ${Math.round(w.workUs)}µs in the worker`
                : `${Math.round(w.mainUs)}µs · ${atOnce(w)} at once`}
            </div>
            <div className="text-[rgb(229_243_242_/_0.4)]">
              {ratio === null
                ? spec.id === 'stock'
                  ? 'the baseline'
                  : 'no main-thread cost'
                : ratio >= 1
                  ? `${ratio.toFixed(1)}× lighter than stock`
                  : `${(1 / ratio).toFixed(1)}× heavier than stock`}
            </div>
            <div className="text-[rgb(229_243_242_/_0.3)]">
              {live === null ? (spec.id === 'stock' ? 'component does not report' : 'live: …') : `live: ${Math.round(live)}µs`}
            </div>
          </div>
        ) : (
          <div className="font-mono text-[10px] text-[var(--tri-ink-muted)]">measuring…</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The exact reduced-motion frame                                      */
/* ------------------------------------------------------------------ */

/**
 * What a `prefers-reduced-motion` user sees.
 *
 * Not a mock: the component draws frame t=0.6 and stops, so this draws
 * frame t=0.6 and stops. `paused` would have given a different, arbitrary
 * frame — whatever instant the toggle happened to land on.
 */
function StillFrame({ state, size }: { state: OrbState; size: OrbSize }) {
  const ref = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const { mode, opts } = resolvePreset(state, size);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      MODE_DRAWS[mode](ctx, size, 0.6, true, opts);
    },
    [state, size],
  );
  return <canvas ref={ref} role="img" aria-label={`${state}, static frame`} style={{ width: size, height: size, display: 'block' }} />;
}

/* ------------------------------------------------------------------ */
/* Jobs — the assignment                                               */
/* ------------------------------------------------------------------ */

interface Job {
  id: string;
  /** The screen state this waiting moment belongs to. */
  where: string;
  /** What the app is doing while the orb is up. */
  moment: string;
  size: OrbSize;
  /** The pairing this sheet proposes — overridable, and remembered. */
  suggested: OrbState;
  /** Why this one, in one line. */
  because: string;
}

const JOBS: Job[] = [
  {
    id: 'asr-handshake',
    where: 'S-02b',
    moment: 'connecting to the transcriber',
    size: 20,
    suggested: 'connecting',
    because: 'a handshake, and the orb is literally wiring itself up',
  },
  {
    id: 'model-download',
    where: 'S-02b',
    moment: 'downloading the whisper model',
    size: 20,
    suggested: 'working',
    because: 'long and mechanical — but this one has a percentage, so it may want a bar instead',
  },
  {
    id: 'listening',
    where: 'S-02c',
    moment: 'listening, nothing detected yet',
    size: 20,
    suggested: 'listening',
    because: 'the commonest state of the whole service — it runs for an hour, so weight matters most here',
  },
  {
    id: 'resolve-ref',
    where: 'S-02d',
    moment: 'resolving a heard reference to a verse',
    size: 20,
    suggested: 'searching',
    because: 'a lookup in the Bible db; under a second, so it must read instantly',
  },
  {
    id: 'trust-gate',
    where: 'S-02f',
    moment: 'auto-mode deciding whether to push',
    size: 20,
    suggested: 'solving',
    because: 'the only moment the app is weighing something rather than fetching it',
  },
  {
    id: 'sermon-notes',
    where: 'Sermon panel',
    moment: 'the notes model summarising',
    size: 64,
    suggested: 'weaving',
    because: 'on-device generation, tens of seconds — the one place a 64px orb has room',
  },
  {
    id: 'service-review',
    where: 'S-02R',
    moment: 'building the end-of-service review',
    size: 64,
    suggested: 'composing',
    because: 'assembling a document out of parts, and nobody is waiting on it mid-service',
  },
  {
    id: 'qr-pairing',
    where: 'QR companion',
    moment: 'waiting for a phone to pair',
    size: 64,
    suggested: 'connecting',
    because: 'two things finding each other — held up on a screen for the room to see',
  },
  {
    id: 'prayer-idle',
    where: 'S-02h',
    moment: 'prayer mode, output black',
    size: 64,
    suggested: 'breathing',
    because: 'nothing is loading; this is the app saying it is still here, quietly',
  },
];

const JOBS_KEY = 'trilorah.orb-jobs.v1';
const IS_STATE = (v: unknown): v is OrbState => STATES.some((s) => s.state === v);

/*
 * Assignments persist. This sheet is where the pairing gets decided, and a
 * decision that evaporates on hot-reload is not a decision — you would be
 * re-picking nine dropdowns every time a component file is saved.
 */
function readJobs(): Record<string, OrbState> {
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, OrbState> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (IS_STATE(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function useJobAssignments() {
  const [assigned, setAssigned] = useState<Record<string, OrbState>>(readJobs);

  const assign = useCallback((jobId: string, state: OrbState) => {
    setAssigned((prev) => {
      const next = { ...prev, [jobId]: state };
      try {
        localStorage.setItem(JOBS_KEY, JSON.stringify(next));
      } catch {
        /* Private mode or a cleared store — the picker still works for this session. */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setAssigned({});
    try {
      localStorage.removeItem(JOBS_KEY);
    } catch {
      /* nothing to clear */
    }
  }, []);

  const orbFor = useCallback((job: Job) => assigned[job.id] ?? job.suggested, [assigned]);
  const changed = useMemo(
    () => JOBS.filter((j) => assigned[j.id] && assigned[j.id] !== j.suggested).length,
    [assigned],
  );

  return { orbFor, assign, reset, changed };
}

/* ------------------------------------------------------------------ */
/* Context mocks                                                       */
/* ------------------------------------------------------------------ */

/** The app's panel grey, already composited over the canvas. */
const PANEL = 'rgb(21 21 21)';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-[300px] overflow-hidden rounded-[16px]" style={{ background: PANEL, boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.06)' }}>
      <div className="border-b border-[rgb(255_255_255_/_0.06)] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--tri-ink-muted)]">
        {title}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The sheet                                                           */
/* ------------------------------------------------------------------ */

export function TriThinkingOrb() {
  const { weights, done, remeasure } = useOrbWeights();
  const { orbFor, assign, reset, changed } = useJobAssignments();
  const [speedPct, setSpeedPct] = useState(50);
  const [compareState, setCompareState] = useState<OrbState>('solving');
  const [inkChoice, setInkChoice] = useState<'white' | 'tri'>('white');
  const ink = inkChoice === 'tri' ? INK_TRI : INK_WHITE;

  /* 0–100 on the slider, 0.4×–1.6× on the orb, so the middle of the track
     is exactly 1.0× — the package's own tuning. A range that could not land
     on the baked speed would make "is this better than the default" an
     unanswerable question. */
  const speed = useMemo(() => 0.4 + (speedPct / 100) * 1.2, [speedPct]);

  const peak64 = peakAt(weights, 64);
  const peak20 = peakAt(weights, 20);

  /* Column sums for the matrix — the cost of all nine at once, per renderer. */
  const totals = useMemo(() => {
    const t: Partial<Record<RendererId, { main: number; work: number; n: number }>> = {};
    for (const r of RENDERERS) {
      let main = 0;
      let work = 0;
      let n = 0;
      for (const s of STATES) {
        const w = weights[rkey(r.id, s.state, 64)];
        if (!w) continue;
        main += w.mainUs;
        work += w.workUs;
        n += 1;
      }
      t[r.id] = { main, work, n };
    }
    return t;
  }, [weights]);

  return (
    <Sheet
      id="C-65"
      title="Thinking orb"
      status="draft"
      summary="thinking-orbs@0.3.1 — nine canvas animations, two tuned sizes, MIT, no dependencies. Off npm, not out of the Figma file: this sheet is the audition, and every weight below is measured live in this window."
    >
      <Group title="The nine · 64px" hint="chat-avatar scale — the size with room for detail">
        <Stage>
          <div className="grid gap-x-6 gap-y-7" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {STATES.map(({ state, picture }) => (
              <div key={state} className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <ThinkingOrb state={state} size={64} />
                  <div className="min-w-0">
                    <div className="text-[12px] text-[var(--tri-ink)]">{state}</div>
                    <div className="text-[10px] leading-snug text-[rgb(229_243_242_/_0.45)]">{picture}</div>
                  </div>
                </div>
                <WeightMeter w={weights[key(state, 64)]} peak={peak64} />
              </div>
            ))}
          </div>
        </Stage>
      </Group>

      <Group title="The nine · 20px" hint="inline-text scale — a separate design, not the 64 shrunk">
        <Stage>
          <div className="grid gap-x-6 gap-y-5" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {STATES.map(({ state }) => (
              <div key={state} className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <ThinkingOrb state={state} size={20} />
                  <span className="text-[11px] text-[var(--tri-ink)]">{state}</span>
                </div>
                <WeightMeter w={weights[key(state, 20)]} peak={peak20} />
              </div>
            ))}
          </div>
        </Stage>
      </Group>

      <Group
        title="Renderers"
        hint="the same engine, the same frame, painted six ways — pick a state and compare"
      >
        <Stage>
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <Select
                label="state"
                value={compareState}
                options={ORB_OPTIONS}
                onChange={(v) => setCompareState(v as OrbState)}
                className="max-w-[160px]"
              />
              <Select
                label="ink"
                value={inkChoice}
                options={INK_OPTIONS}
                onChange={(v) => setInkChoice(v as 'white' | 'tri')}
                className="max-w-[160px]"
              />
              <span className="pb-3 text-[10px] text-[var(--tri-ink-muted)]">
                stock cannot take the ink — that column stays white whatever you pick
              </span>
            </div>

            <div className="grid gap-x-5 gap-y-6" style={{ gridTemplateColumns: `repeat(${RENDERERS.length}, minmax(0, 1fr))` }}>
              {RENDERERS.map((spec) => (
                <RendererColumn
                  key={spec.id}
                  spec={spec}
                  state={compareState}
                  ink={ink}
                  w={weights[rkey(spec.id, compareState, 64)]}
                  stock={weights[key(compareState, 64)]}
                />
              ))}
            </div>
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>Same dots, five other brushes.</strong> Every column above runs the package's own
        engine — the geometry is untouched, which is why they all draw the same picture. Only the
        last step differs: how a list of 140 dots with a position, radius and brightness becomes
        pixels. The installed component does it the obvious way, one <code>arc()</code> and one{' '}
        <code>fill()</code> per dot with a colour string built for each. That step is where the
        cost lives, and it is the step the other five replace.
      </Note>

      <Group
        title="Weight · all nine × six renderers"
        hint={done ? 'measured on this machine, in this window, all by the same harness' : 'measuring…'}
      >
        <Stage>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button label="measure again" onClick={remeasure} />
              <span className="text-[10px] text-[var(--tri-ink-muted)]">
                main-thread µs per frame at 64px · one 60Hz frame is {Math.round(FRAME_US).toLocaleString()}µs · light &lt;1.5% · moderate &lt;4% · heavy above
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-[rgb(229_243_242_/_0.4)]">
                    <th className="py-2 pr-4 font-semibold">state</th>
                    <th className="py-2 pr-4 font-semibold">marks</th>
                    {RENDERERS.map((r) => (
                      <th key={r.id} className="py-2 pr-4 font-semibold">
                        {r.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono text-[11px] text-[var(--tri-ink)]">
                  {STATES.map(({ state }) => {
                    const stock = weights[key(state, 64)];
                    return (
                      <tr key={state} className="border-t border-[rgb(255_255_255_/_0.06)]">
                        <td className="py-2 pr-4">{state}</td>
                        <td className="py-2 pr-4 text-[var(--tri-ink-muted)]">{stock?.marks ?? '…'}</td>
                        {RENDERERS.map((r) => {
                          const w = weights[rkey(r.id, state, 64)];
                          return (
                            <td key={r.id} className="py-2 pr-4 align-top">
                              {w ? (
                                <div className="leading-4">
                                  <div style={{ color: TIER_INK[tierOf(w.share)] }}>
                                    {r.thread === 'worker' ? '0µs' : `${Math.round(w.mainUs)}µs`}
                                    <span className="text-[rgb(229_243_242_/_0.4)]"> · {(w.share * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="text-[10px] text-[rgb(229_243_242_/_0.35)]">
                                    {r.thread === 'worker' ? `${Math.round(w.workUs)}µs off-thread` : ''}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[var(--tri-ink-muted)]">…</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="border-t border-[rgb(255_255_255_/_0.12)]">
                    <td className="py-2 pr-4 text-[var(--tri-ink-muted)]">all nine at once</td>
                    <td className="py-2 pr-4" />
                    {RENDERERS.map((r) => {
                      const t = totals[r.id];
                      if (!t || t.n < STATES.length) {
                        return (
                          <td key={r.id} className="py-2 pr-4 text-[var(--tri-ink-muted)]">
                            …
                          </td>
                        );
                      }
                      const share = t.main / FRAME_US;
                      return (
                        <td key={r.id} className="py-2 pr-4 align-top">
                          <div style={{ color: TIER_INK[tierOf(share / 9)] }}>
                            {Math.round(t.main).toLocaleString()}µs
                            <span className="text-[rgb(229_243_242_/_0.4)]"> · {(share * 100).toFixed(0)}%</span>
                          </div>
                          {r.thread === 'worker' && (
                            <div className="text-[10px] text-[rgb(229_243_242_/_0.35)]">{Math.round(t.work).toLocaleString()}µs off-thread</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>What the weight is, and what it is not.</strong> Each number is the main-thread cost
        of one frame — the geometry plus the painting — run on a scratch surface by one harness with
        the same warm-up and the same budget for every cell, at this window's pixel ratio. It is{' '}
        <em>not</em> a GPU or compositing figure: WebGL's bar is short because the GPU is doing the
        work somewhere this harness cannot see, and the worker's is zero because the page does
        nothing per frame at all. Both are true and both are what matters — the operator's screen
        is the main thread. Every renderer still runs its own animation loop, so two orbs cost two
        of these; the "at once" figure is how many fit in a frame before the app has no time left
        for anything else. The "live" line is the instance you are looking at reporting its own
        cost from inside its loop; it runs higher than the harness because it is sharing the
        thread with everything else on this sheet.
      </Note>

      <Note>
        <strong>Where this leaves the method question.</strong> The floor is the engine: the
        geometry alone is roughly a sixth of a frame for all nine, and nothing that computes it in
        JavaScript beats that. WebGL reaches the floor — painting becomes free. Batched Canvas 2D
        gets about halfway there with no new technology. The DOM is the worst of the lot, because
        "CSS" here still means JavaScript writing 140 transforms a frame and the browser recalculating
        style for each — CSS is cheap only when the browser owns the whole motion, and it cannot own
        a depth-sorted scramble. p5 is Canvas 2D with a library in between, so it can only ever cost
        more than stock. And the worker is not a painter but a place: put WebGL there and the page's
        cost is zero, which on a live-service screen is the property that actually matters. Every
        column except stock also takes our ink — pick <em>trilorah ink</em> above and watch which
        one stays white.
      </Note>

      <Group
        title="Jobs"
        hint={changed > 0 ? `${changed} changed from the proposal — remembered` : 'pick a different orb and it sticks'}
      >
        <Stage>
          <div className="space-y-3">
            {JOBS.map((job) => {
              const state = orbFor(job);
              return (
                <div
                  key={job.id}
                  className="grid items-center gap-x-4 gap-y-2 border-b border-[rgb(255_255_255_/_0.06)] pb-3 last:border-0"
                  style={{ gridTemplateColumns: 'minmax(0, 1fr) 72px 160px minmax(0,110px)' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] text-[rgb(229_243_242_/_0.4)]">{job.where}</span>
                      <span className="text-[12px] text-[var(--tri-ink)]">{job.moment}</span>
                    </div>
                    <div className="text-[10px] leading-snug text-[rgb(229_243_242_/_0.45)]">{job.because}</div>
                  </div>
                  <div className="flex h-16 items-center justify-center">
                    <ThinkingOrb state={state} size={job.size} />
                  </div>
                  <Select
                    value={state}
                    options={ORB_OPTIONS}
                    onChange={(v) => assign(job.id, v as OrbState)}
                    className="max-w-[160px]"
                  />
                  <WeightChip w={weights[key(state, job.size)]} />
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-1">
              <Button label="reset to the proposal" onClick={reset} />
              <span className="text-[10px] text-[var(--tri-ink-muted)]">
                each orb is shown at the size that job would use — 20px inline, 64px where a panel has room
              </span>
            </div>
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>Nine states, nine jobs — which is suspicious.</strong> The package ships nine because
        nine is what an agent product needs; Trilorah has maybe four real waiting moments, and one of
        them (<code>listening</code>) runs for the whole service while the rest last under a second.
        A sub-second orb is a flash, not an animation — for those, resolving the reference and the
        trust gate, the honest answer may be no indicator at all. The pairing above is a proposal to
        argue with, which is why every row is a dropdown.
      </Note>

      <Group title="In place" hint="the two contexts that decide it — 20px in a line of text, 64px in a panel">
        <Stage>
          {/* Two columns on purpose. The 20px contexts stack on the left
              because they are the same question asked twice — an orb in a
              line of text — and the 64px panel sits alone on the right at
              the scale that gets its own space in the app. */}
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex flex-col gap-6">
            <Panel title="Transcript">
              <div className="space-y-2.5 text-[12px] text-[var(--tri-ink)]">
                <p className="text-[rgb(229_243_242_/_0.55)]">…turn with me to the book of Romans,</p>
                <p>chapter eight, verse twenty-eight.</p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--tri-ink-muted)]">
                  <ThinkingOrb state={orbFor(JOBS[3])} size={20} />
                  <span>finding the verse…</span>
                </div>
              </div>
            </Panel>

            <Panel title="Transport">
              <div className="flex items-center gap-2.5 text-[11px]">
                <ThinkingOrb state={orbFor(JOBS[2])} size={20} />
                <span className="text-[var(--tri-ink)]">listening</span>
                <span className="ml-auto font-mono text-[10px] text-[var(--tri-ink-muted)]">00:42:11</span>
              </div>
            </Panel>
            </div>

            <Panel title="Sermon">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <ThinkingOrb state={orbFor(JOBS[5])} size={64} />
                <div className="text-[12px] text-[var(--tri-ink)]">writing the summary</div>
                <div className="text-[10px] text-[var(--tri-ink-muted)]">on this machine · about 40 seconds</div>
              </div>
            </Panel>
          </div>
        </Stage>
      </Group>

      <Group title="Speed" hint="a multiplier on the baked tuning — 1.0× is the package's own">
        <Stage>
          <div className="space-y-5">
            <div className="max-w-[253px]">
              <Slider label={`speed ${speed.toFixed(2)}×`} value={speedPct} onChange={setSpeedPct} />
            </div>
            <div className="flex flex-wrap items-center gap-5">
              {STATES.map(({ state }) => (
                <div key={state} className="flex flex-col items-center gap-1.5">
                  <ThinkingOrb state={state} size={64} speed={speed} />
                  <span className="text-[10px] text-[var(--tri-ink-muted)]">{state}</span>
                </div>
              ))}
            </div>
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>Speed is the one knob worth turning.</strong> Trilorah is a booth product read across
        a room by someone who is also running a service — the default tuning is pitched at a chat UI
        an arm's length away. Slower reads as composure and costs nothing (the frame count is the
        same either way). Drag the slider to about 0.6× and compare: the same nine orbs stop looking
        like they are hurrying you.
      </Note>

      <Group title="Reduced motion" hint="the exact frame a prefers-reduced-motion user gets — t=0.6, drawn once">
        <Stage>
          <div className="flex flex-wrap items-end gap-5">
            {STATES.map(({ state }) => (
              <div key={state} className="flex flex-col items-center gap-1.5">
                <StillFrame state={state} size={64} />
                <span className="text-[10px] text-[var(--tri-ink-muted)]">{state}</span>
              </div>
            ))}
          </div>
        </Stage>
      </Group>

      <Group title="Sizes" hint="two presets ship; anything else is the 64 design scaled by CSS">
        <Stage>
          <Cell label="64 · 32 (css) · 20">
            <div className="flex items-end gap-5">
              <ThinkingOrb state="searching" size={64} />
              {/* The component's own width/height go in first and the caller's
                  style spreads over them, so a 64 can be pinned to any box.
                  The backing canvas stays 128px, so it stays crisp — but the
                  dot radii were tuned for 64 and read finer at 32. */}
              <ThinkingOrb state="searching" size={64} style={{ width: 32, height: 32 }} />
              <ThinkingOrb state="searching" size={20} />
            </div>
          </Cell>
        </Stage>
      </Group>

      <Group title="Theme" hint="auto reads data-theme off an ancestor — the sandbox is dark, so this is the inversion proof">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3 rounded-md p-6" style={{ background: '#0e0f0f' }}>
            <ThinkingOrb state="breathing" size={64} />
            <span className="text-[11px] text-[var(--tri-ink-muted)]">auto → dark substrate, light ink</span>
          </div>
          <div className="flex items-center gap-3 rounded-md bg-white p-6" data-theme="light">
            <ThinkingOrb state="breathing" size={64} theme="light" />
            <span className="text-[11px] text-neutral-500">pinned light substrate, dark ink</span>
          </div>
        </div>
      </Group>

      <Note>
        <strong>The stock orb cannot take our ink — but the others can.</strong> The package paints
        every dot <code>rgba(M,M,M,a)</code>: a single grey value mirrored on dark substrates, no
        colour prop, no CSS variable to reach. On the near-black stage it is white, and white is the
        one thing nothing else in Trilorah is — every other surface is that four-stop teal gradient
        with <code>#E5F3F2</code> ink. Because the engine and the painter are separate, every
        renderer in the comparison above holds its own brush, and the ink toggle there is the proof.
        So the choice is no longer "accept white or fork": it is which painter to keep.
      </Note>

      <Note>
        <strong>All nine ship whether you use one or nine.</strong> The painters are reached through a
        registry map, so a bundler cannot drop the eight states you did not import. That is 22.9kB raw
        / 7.7kB gzipped for the whole package, no dependencies — small enough that it does not matter,
        but worth knowing before anyone plans on tree-shaking down to a single state. p5, by contrast,
        is a 1MB dev dependency loaded on demand for the comparison column only; it is not in the app.
      </Note>

      <Spec
        rows={[
          ['package', 'thinking-orbs@0.3.1 · MIT · Jakub Antalik · orbs.jakubantalik.com'],
          ['weight', '22.9kB raw / 7.7kB gzip (3.8kB component + 19.1kB engine) · zero dependencies'],
          ['peer', 'react >=18 — this app is on 19.2.3'],
          ['renderer', 'plain 2D canvas arcs — no WebGL, no ctx.filter, no SVG filters · DPR capped at 2'],
          ['sizes', '64 and 20 only, separately tuned (own dot count, dot size, speed) — not a scale factor'],
          ['props', 'state · size · theme · speed · paused · aria-label · any canvas prop'],
          ['a11y', 'role="img" with a per-state label; reduced motion draws frame t=0.6 and stops'],
          ['idle cost', 'pauses offscreen (IntersectionObserver) and on tab hide; resumes in phase — the clock is performance.now()'],
          ['alternatives', 'src/design/orb/ — painters.ts (batched 2D, WebGL), orbWorker.ts (OffscreenCanvas), renderers.tsx (DOM, p5, harness)'],
        ]}
      />
    </Sheet>
  );
}
