import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Select, type SelectOption } from '../../ui';
import { Sheet, Group, Cell, Note, Spec, Stage } from '../Sheet';
import ThinkingOrbsPill, { ThinkingOrbsGallery } from '../orb/ThinkingOrbsPill';
import SvgOrbsPill from '../orb/SvgOrbsPill';
import { ORB_BY_STATE, STATUS_ORB_INK, type OrbLook, type OrbPick } from '../orb/statusLooks';
import { HoverGallery } from '../orb/HoverGallery';
import { ORB2_STYLES, measureOrb2, hasWebGPU, type Orb2Weight } from '../orb/orb2';
import { measureRenderer, type Weight } from '../orb/renderers';
import { FRAME_US } from '../orb/painters';
import { tierOf, TIER_INK } from '../orb/tiers';

/*
 * C-65b — Thinking orb 2.
 *
 * A second orb system, dropped in as one file: thirty-eight looping
 * dot-sphere animations, a pill with a label around them, rendered as
 * instanced quads on WebGPU. Where C-65 is a package off npm, this is a
 * component with its own colour props and its own opinions about what a
 * loading indicator is — a sentence, not just a spinner.
 *
 * Same questions as C-65: what does each one cost, and is the method the
 * light one. The reference numbers from C-65 are measured again here, in
 * this window, so the two sheets never compare stale figures.
 */

type OrbState = 'working' | 'searching' | 'solving' | 'listening' | 'connecting' | 'weaving' | 'composing' | 'breathing' | 'shaping';
const ORB1_STATES: OrbState[] = ['working', 'searching', 'solving', 'listening', 'connecting', 'weaving', 'composing', 'breathing', 'shaping'];

const STYLE_OPTIONS: SelectOption[] = ORB2_STYLES.map((s) => ({ value: s.id, label: `${s.name.toLowerCase()} · ${s.label.toLowerCase()}` }));

/** Trilorah's ink and accent, for the columns that can take them. */
const TRI = { dot: '#E5F3F2', accent: '#E4D87A', pill: '#151515', label: '#E5F3F2' };

/* ------------------------------------------------------------------ */
/* Weight                                                              */
/* ------------------------------------------------------------------ */

interface Reference {
  stock: number[];
  webgl: number[];
}

/**
 * All 38 styles, one per animation frame, then the C-65 reference set
 * (stock and WebGL for the nine states) so the comparison at the bottom is
 * measured by the same harness in the same window, not quoted.
 */
/*
 * Measured once per page, not once per mount. Every remount of this sheet —
 * a hot update, a trip to another sheet and back — used to re-run all 56
 * measurements: 4,000-odd GPU submits and a ~300ms stall, each time. The
 * numbers do not change between mounts; only "remeasure" should pay again.
 */
let benchCache: { weights: Record<number, Orb2Weight>; reference: Reference } | null = null;

function useOrb2Weights() {
  const [weights, setWeights] = useState<Record<number, Orb2Weight>>(() => benchCache?.weights ?? {});
  const [reference, setReference] = useState<Reference | null>(() => benchCache?.reference ?? null);
  const [pass, setPass] = useState(0);
  const [done, setDone] = useState(() => benchCache !== null);

  useEffect(() => {
    if (pass === 0 && benchCache) return;
    let cancelled = false;
    let raf = 0;
    const out: Record<number, Orb2Weight> = {};
    const ref: Reference = { stock: [], webgl: [] };
    const jobs: (() => Promise<void>)[] = [
      ...ORB2_STYLES.map((_, i) => async () => {
        out[i] = await measureOrb2(i, 64);
        if (!cancelled) setWeights({ ...out });
      }),
      ...ORB1_STATES.map((state) => async () => {
        const w: Weight = await measureRenderer('stock', state, 64);
        ref.stock.push(w.mainUs);
      }),
      ...ORB1_STATES.map((state) => async () => {
        const w: Weight = await measureRenderer('webgl', state, 64);
        ref.webgl.push(w.mainUs);
      }),
    ];
    let i = 0;
    setDone(false);
    setReference(null);
    const step = async () => {
      if (cancelled) return;
      const job = jobs[i];
      i += 1;
      if (!job) {
        benchCache = { weights: { ...out }, reference: ref };
        setReference(ref);
        setDone(true);
        return;
      }
      try {
        await job();
      } catch (err) {
        console.warn('orb2 measure failed', err);
      }
      if (cancelled) return;
      raf = requestAnimationFrame(() => void step());
    };
    raf = requestAnimationFrame(() => void step());
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [pass]);

  const remeasure = useCallback(() => setPass((p) => p + 1), []);
  return { weights, reference, done, remeasure };
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function WeightMeter({ w, peak }: { w?: Orb2Weight; peak: number }) {
  if (!w) return <div className="h-[22px] text-[10px] text-[var(--tri-ink-muted)]">measuring…</div>;
  const tier = tierOf(w.share);
  return (
    <div className="space-y-1">
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[rgb(255_255_255_/_0.10)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${peak > 0 ? Math.max(2, (w.mainUs / peak) * 100) : 0}%`, background: TIER_INK[tier] }}
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[10px] leading-4">
        <span style={{ color: TIER_INK[tier] }}>{tier}</span>
        <span className="text-[var(--tri-ink-muted)]">{(w.share * 100).toFixed(1)}% of a frame</span>
        <span className="text-[rgb(229_243_242_/_0.4)]">
          {w.dots} dots · {Math.round(w.mainUs)}µs ({Math.round(w.geoUs)}µs geometry) · {Math.max(1, Math.floor(FRAME_US / w.mainUs))} at once
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The sheet                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* SVG · no GPU                                                        */
/* ------------------------------------------------------------------ */

/** A fixed box, so the orb's own 100%-wide field cannot stretch the grid. */
const box = (px: number) => ({ width: px, height: px, minHeight: px });

type Look = { style: string; accent: string; speed: number; opacity: number };

/**
 * The same look drawn both ways, WebGPU on the left and SVG on the right,
 * with identical props. `hold` remounts both at speed 0: each starts its
 * clock at zero, so a held pair shows the SAME frame and any difference
 * between the two is the renderer, not the timing.
 */
function OrbPair({ look, ball, dots = 1, fps = 0, hold, dotColor = STATUS_ORB_INK }: {
  look: Look;
  ball: number;
  dots?: number;
  fps?: number;
  hold: boolean;
  dotColor?: string;
}) {
  const common = {
    style: look.style,
    dotColor,
    accent: look.accent,
    speed: hold ? 0 : look.speed,
    startAt: hold ? 0.3 : 0,
    dotOpacity: look.opacity,
    showsPill: false,
    showsLabel: false,
    ball,
    dots,
    scheme: 'dark' as const,
    containerStyle: box(ball),
  };
  const k = `${look.style}-${hold ? 'h' : 'm'}`;
  return (
    <div className="flex items-center gap-2">
      <ThinkingOrbsPill key={`g-${k}`} {...common} />
      <SvgOrbsPill key={`s-${k}`} {...common} fps={fps} />
    </div>
  );
}

const COLOUR_NAME: Record<string, string> = { '#ef5350': 'red', '#ffa726': 'orange', '#66bb6a': 'green' };

/** The bar's orb as it ships: 30px, 90 dots, 30fps. */
function BarOrb({ look, pick, moving = true }: { look: OrbLook; pick: OrbPick; moving?: boolean }) {
  return (
    <SvgOrbsPill
      style={pick.style}
      startAt={look.speed === 0 ? (pick.startAt ?? 0) : 0.3}
      dotColor={STATUS_ORB_INK}
      accent={look.accent}
      speed={moving ? look.speed : 0}
      dotOpacity={look.opacity}
      showsPill={false}
      showsLabel={false}
      ball={30}
      dots={0.6}
      fps={30}
      scheme="dark"
      containerStyle={box(30)}
    />
  );
}

/**
 * Every state's pool, from the bar's own table. A row plays while it is
 * pointed at (or all of them, with "play all"); each style is shown
 * enlarged and at the size the bar ships. Still states stay still.
 */
function StatusPools() {
  const [hot, setHot] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  return (
    <>
      <div className="mb-4">
        <Button label={all ? 'hold all' : 'play all'} onClick={() => setAll((v) => !v)} />
      </div>
      <div className="flex flex-col">
        {Object.entries(ORB_BY_STATE).map(([name, look]) => {
          const moving = look.speed !== 0 && (all || hot === name);
          return (
            <div
              key={name}
              onPointerEnter={() => setHot(name)}
              onPointerLeave={() => setHot((h) => (h === name ? null : h))}
              className="flex items-center gap-6 border-t border-white/[0.06] py-3 first:border-t-0"
            >
              <div className="w-36 shrink-0">
                <div className="font-mono text-[11px] text-neutral-200">{name}</div>
                <div className="font-mono text-[9px] text-neutral-500">
                  {COLOUR_NAME[look.accent] ?? look.accent} · {look.speed === 0 ? 'still' : `speed ${look.speed}`}
                </div>
              </div>
              <div className="flex flex-wrap gap-8">
                {look.pool.map((p) => (
                  <div key={p.style} className="flex flex-col items-center gap-1.5">
                    <div className="flex items-end gap-2">
                      <SvgOrbsPill
                        style={p.style}
                        startAt={look.speed === 0 ? (p.startAt ?? 0) : 0.3}
                        dotColor={STATUS_ORB_INK}
                        accent={look.accent}
                        speed={moving ? look.speed : 0}
                        dotOpacity={look.opacity}
                        showsPill={false}
                        showsLabel={false}
                        ball={56}
                        scheme="dark"
                        containerStyle={box(56)}
                      />
                      <BarOrb look={look} pick={p} moving={moving} />
                    </div>
                    <span className="font-mono text-[9px] text-neutral-500">{p.style}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * One session's worth of picks, rolled locally the way the bar rolls them
 * (never the same style as last roll where the pool has another), so the
 * sheet can show what "stop and start again" does without touching the
 * app's own session.
 */
function rollSession(prev: Record<string, OrbPick> | null): Record<string, OrbPick> {
  const out: Record<string, OrbPick> = {};
  for (const [name, look] of Object.entries(ORB_BY_STATE)) {
    const before = prev?.[name];
    const choices = look.pool.length > 1 && before ? look.pool.filter((p) => p.style !== before.style) : look.pool;
    out[name] = choices[Math.floor(Math.random() * choices.length)] ?? look.pool[0];
  }
  return out;
}

function RolledSession() {
  const [picks, setPicks] = useState<Record<string, OrbPick>>(() => rollSession(null));
  return (
    <>
      <div className="mb-4">
        <Button label="stop and start again" onClick={() => setPicks((p) => rollSession(p))} />
      </div>
      <div className="grid gap-x-4 gap-y-5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {Object.entries(ORB_BY_STATE).map(([name, look]) => (
          <div key={name} className="flex flex-col items-center gap-1.5">
            <BarOrb look={look} pick={picks[name]} />
            <div className="text-center font-mono text-[10px] leading-tight text-neutral-300">{name}</div>
            <div className="-mt-1 text-center font-mono text-[9px] leading-tight text-neutral-500">{picks[name].style}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * One style as an SVG orb that plays while pointed at and freezes where it
 * stopped. Speed eases, so it starts and stops like the bar does.
 */
function SvgStyleCell({ id, name, playing, selected, onSelect }: {
  id: string;
  name: string;
  playing: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={() => onSelect(id)}
      className={
        'flex flex-col items-center gap-1.5 rounded-md py-2 transition-colors duration-150 ' +
        (selected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')
      }
    >
      <SvgOrbsPill
        style={id}
        speed={playing || hover ? 1 : 0}
        startAt={0.3}
        dotColor={TRI.dot}
        accent={TRI.accent}
        showsPill={false}
        showsLabel={false}
        ball={64}
        scheme="dark"
        containerStyle={box(64)}
      />
      <span className="font-mono text-[10px] text-neutral-400">{name.toLowerCase()}</span>
    </button>
  );
}

export function TriThinkingOrb2() {
  const { weights, reference, done, remeasure } = useOrb2Weights();
  const [selected, setSelected] = useState('twinkle');
  const [playAllSvg, setPlayAllSvg] = useState(false);
  const [holdPairs, setHoldPairs] = useState(false);
  const [hoverCost, setHoverCost] = useState<{ us: number; moving: number } | null>(null);
  const [sortByWeight, setSortByWeight] = useState(false);
  const gpu = hasWebGPU();

  const index = Math.max(0, ORB2_STYLES.findIndex((s) => s.id === selected));
  const style = ORB2_STYLES[index];

  const peak = useMemo(() => Object.values(weights).reduce((m, w) => Math.max(m, w.mainUs), 0), [weights]);
  const measured = useMemo(() => Object.values(weights), [weights]);
  const order = useMemo(() => {
    const idx = ORB2_STYLES.map((_, i) => i);
    if (!sortByWeight) return idx;
    return idx.sort((a, b) => (weights[a]?.mainUs ?? Infinity) - (weights[b]?.mainUs ?? Infinity));
  }, [sortByWeight, weights]);

  const lightest = measured.length ? ORB2_STYLES[Number(Object.keys(weights).reduce((a, b) => (weights[Number(a)].mainUs <= weights[Number(b)].mainUs ? a : b)))] : null;
  const heaviest = measured.length ? ORB2_STYLES[Number(Object.keys(weights).reduce((a, b) => (weights[Number(a)].mainUs >= weights[Number(b)].mainUs ? a : b)))] : null;
  const med = median(measured.map((w) => w.mainUs));

  return (
    <Sheet
      id="C-65b"
      title="Thinking orb 2"
      status="draft"
      summary="ThinkingOrbsPill.tsx — thirty-eight dotted-sphere loops, each with a verb, in a pill. WebGPU instanced quads, ~150 dots regardless of size, colour as props. Vendored as-is; every weight below is measured live in this window."
    >
      {!gpu && (
        <Note>
          <strong>WebGPU is not available in this window.</strong> The orbs will not draw, and the
          weights below are geometry + pack only — the real frame also uploads two buffers and
          submits a pass.
        </Note>
      )}

      <Group
        title="WebGPU vs SVG"
        hint="the same style, the same props, drawn both ways — left is the WebGPU orb, right is the SVG one"
      >
        <Stage>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <Select label="style" value={selected} options={STYLE_OPTIONS} onChange={setSelected} className="max-w-[300px]" />
            <Button label={holdPairs ? 'play' : 'hold on one frame'} onClick={() => setHoldPairs((v) => !v)} />
          </div>
          <div className="flex flex-wrap items-start gap-10">
            <div className="flex flex-col items-center gap-2">
              <div className="flex w-[336px] justify-between font-mono text-[10px] uppercase tracking-wide text-neutral-500">
                <span className="w-40 text-center">webgpu</span>
                <span className="w-40 text-center">svg</span>
              </div>
              <OrbPair
                look={{ style: selected, accent: TRI.accent, speed: 1, opacity: 1 }}
                dotColor={TRI.dot}
                ball={160}
                hold={holdPairs}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Cell label="webgpu · pill + label, as shipped">
                <div className="inline-flex">
                  <ThinkingOrbsPill key={`pg-${selected}-${holdPairs}`} style={selected} scheme="dark" speed={holdPairs ? 0 : 1} startAt={holdPairs ? 0.3 : 0} />
                </div>
              </Cell>
              <Cell label="svg · pill + label">
                <div className="inline-flex">
                  <SvgOrbsPill key={`ps-${selected}-${holdPairs}`} style={selected} scheme="dark" speed={holdPairs ? 0 : 1} startAt={holdPairs ? 0.3 : 0} />
                </div>
              </Cell>
            </div>
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>Left is WebGPU, right is SVG, with identical props.</strong> "Hold on one frame" stops
        both on the same frame, so any difference is the renderer, not the timing; moving, they can
        drift a few milliseconds apart because the WebGPU one starts its clock only once the GPU
        answers. The app itself only ever draws the SVG one. On a PC with no GPU driver the left
        side is empty and the right side still draws.
      </Note>

      <Group
        title="The Live bar · one session"
        hint="what the bar would wear in one service, one style per state; press the button to roll the next service"
      >
        <Stage>
          <RolledSession />
        </Stage>
      </Group>

      <Group
        title="The Live bar · every state's pool"
        hint="each state's styles, enlarged and at bar size (30px); point at a row to play it"
      >
        <Stage>
          <StatusPools />
        </Stage>
      </Group>

      <Note>
        <strong>A state is a colour and a family of motions, not one animation.</strong> The first
        time a state comes up in a service the bar picks one style from its pool and keeps it for
        the rest of that service, so listening never changes shape mid-sermon. Stopping ends the
        service: start again and every state rolls afresh, never landing on the same style as last
        time. The name on hover is always the state's. Listening, in preview, live and auto live
        follow each other in the same green, so they never share a style; states in other colours
        borrow freely. Idle and output frozen are still, on a frame picked to read as a calm sphere,
        and a still SVG orb draws once and then costs nothing.
      </Note>

      <Group
        title="All 38 · svg"
        hint="hover one to play it, click to load it into the pill below"
      >
        <Stage>
          <div className="mb-3">
            <Button label={playAllSvg ? 'hold all' : 'play all'} onClick={() => setPlayAllSvg((v) => !v)} />
          </div>
          <div className="grid gap-x-2 gap-y-3" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
            {ORB2_STYLES.map((s) => (
              <SvgStyleCell
                key={s.id}
                id={s.id}
                name={s.name}
                playing={playAllSvg}
                selected={s.id === selected}
                onSelect={setSelected}
              />
            ))}
          </div>
        </Stage>
      </Group>

      <Group
        title="Hover to play"
        hint={
          hoverCost
            ? `${hoverCost.moving} moving · ${Math.round(hoverCost.us)}µs a frame · ${(hoverCost.us / FRAME_US * 100).toFixed(1)}% of a frame`
            : 'hover a card — it runs while the pointer is on it, and freezes where it stopped'
        }
      >
        <Stage>
          <HoverGallery
            selected={selected}
            onSelect={setSelected}
            columns={8}
            dotColor={TRI.dot}
            accent={TRI.accent}
            pill="rgb(21 21 21)"
            labelColor={TRI.label}
            onCost={(us, moving) => setHoverCost({ us, moving })}
          />
        </Stage>
      </Group>

      <Note>
        <strong>The grid is still until you point at it.</strong> Hovering a card starts that orb
        turning; leaving freezes it on the frame it reached; hovering again carries on from there
        rather than snapping back to the start. Nothing else on the grid is moving, so the eye has
        one thing to follow and the card you are asking about is the one that answers.
        <br />
        <strong>It is cheaper than one always-running orb.</strong> Every cell owns a fixed slot in
        the dot buffer, so a frozen card costs nothing at all — its dots already sit on the GPU, and
        a still frame needs no geometry and no upload. Only the hovered cell is re-packed, so the
        per-frame cost is one style's geometry no matter how many cards are on screen. The shipped
        gallery below re-packs all thirty-eight stills together whenever anything changes, which is
        fine for a resize and would be ~3.4ms — a fifth of a frame — if it happened per frame. That
        is the whole reason for the slots.
      </Note>

      <Group title="All 38 · as shipped" hint="click one to run it — the other thirty-seven are stills at a shared phase, all on one canvas">
        <Stage>
          {/* Eight columns × five rows holds all 38 without the gallery's
              own scrollbar. Left to auto-fit it picks seven at this width
              and hides the last row behind a scroll. Cell height is the
              component's: 64 ball + 24 + 30 label, 10 gap, 12 pad. */}
          <ThinkingOrbsGallery selected={selected} onSelect={setSelected} scheme="dark" columns={8} height={12 * 2 + 5 * 118 + 4 * 10} />
        </Stage>
      </Group>

      <Note>
        <strong>Clicking a cell also copies</strong> <code>&lt;ThinkingOrbsPill style="…" /&gt;</code>{' '}
        to your clipboard — that is the component's own behaviour, not the sandbox's. The cell says
        "Copied" for a moment. Worth knowing before it overwrites something you were holding.
      </Note>

      <Group title="The pill" hint="the form it ships in — a 46px ball and a verb, IBM Plex Mono, in its own capsule">
        <Stage>
          <div className="grid gap-x-8 gap-y-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            <div className="space-y-5">
              <Select
                label="style"
                value={selected}
                options={STYLE_OPTIONS}
                onChange={setSelected}
                className="max-w-[300px]"
              />
              <div>
                <div className="text-[12px] text-[var(--tri-ink)]">
                  {style.name} <span className="text-[var(--tri-ink-muted)]">· {style.motion}</span>
                </div>
                <div className="mt-1 max-w-[46ch] text-[10px] leading-snug text-[rgb(229_243_242_/_0.45)]">{style.desc}</div>
              </div>
              <div className="max-w-[360px]">
                <WeightMeter w={weights[index]} peak={peak} />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Cell label="as shipped · pill + label">
                <div className="inline-flex">
                  <ThinkingOrbsPill key={`a-${selected}`} style={selected} scheme="dark" />
                </div>
              </Cell>
              <Cell label="pill, no label · bare">
                <div className="inline-flex">
                  <ThinkingOrbsPill key={`b-${selected}`} style={selected} scheme="dark" showsLabel={false} />
                </div>
                <div className="inline-flex">
                  <ThinkingOrbsPill key={`c-${selected}`} style={selected} scheme="dark" showsPill={false} />
                </div>
              </Cell>
              <Cell label="svg · same geometry, no gpu · the one the live bar uses">
                <div className="inline-flex">
                  <SvgOrbsPill key={`s-${selected}`} style={selected} scheme="dark" />
                </div>
                <div className="inline-flex">
                  <SvgOrbsPill key={`t-${selected}`} style={selected} scheme="dark" showsPill={false} ball={30} dots={0.6} fps={30} />
                </div>
              </Cell>
              <Cell label="in trilorah ink · #E5F3F2 dots, #E4D87A accent, panel grey">
                <div className="inline-flex">
                  <ThinkingOrbsPill
                    key={`d-${selected}`}
                    style={selected}
                    scheme="dark"
                    dotColor={TRI.dot}
                    accent={TRI.accent}
                    pill={TRI.pill}
                    labelColor={TRI.label}
                    label={style.label.replace('...', '…').toLowerCase()}
                  />
                </div>
              </Cell>
            </div>
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>This one takes our ink without being asked.</strong> <code>dotColor</code>,{' '}
        <code>accent</code>, <code>pill</code> and <code>labelColor</code> are props, with a light-scheme
        set beside them. The accent is the idea C-65 does not have: a second colour that marks the{' '}
        <em>event</em> in each loop — the crest of the wave, the tooth of the ratchet, the head of the
        chase — so the orb is not just moving, it is pointing at something. In Trilorah that colour
        is already spoken for: <code>#E4D87A</code> is the yellow the font and position cards use for
        "selected", and it reads the same way here.
      </Note>

      <Group
        title="Weight · all 38"
        hint={done ? 'measured on this machine, in this window' : 'measuring…'}
      >
        <Stage>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <Button label="measure again" onClick={remeasure} />
              <Button label={sortByWeight ? 'gallery order' : 'sort by weight'} onClick={() => setSortByWeight((v) => !v)} />
              <span className="text-[10px] text-[var(--tri-ink-muted)]">
                main-thread µs per frame at 64px · one 60Hz frame is {Math.round(FRAME_US).toLocaleString()}µs · light &lt;1.5% · moderate &lt;4% · heavy above
              </span>
            </div>

            {measured.length === ORB2_STYLES.length && lightest && heaviest && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10px] text-[var(--tri-ink-muted)]">
                <span>
                  lightest <span className="text-[var(--tri-ink)]">{lightest.name}</span> {Math.round(weights[ORB2_STYLES.indexOf(lightest)].mainUs)}µs
                </span>
                <span>
                  median <span className="text-[var(--tri-ink)]">{Math.round(med)}µs</span> · {((med / FRAME_US) * 100).toFixed(1)}% of a frame
                </span>
                <span>
                  heaviest <span className="text-[var(--tri-ink)]">{heaviest.name}</span> {Math.round(weights[ORB2_STYLES.indexOf(heaviest)].mainUs)}µs
                </span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-[rgb(229_243_242_/_0.4)]">
                    <th className="py-2 pr-4 font-semibold">#</th>
                    <th className="py-2 pr-4 font-semibold">style</th>
                    <th className="py-2 pr-4 font-semibold">says</th>
                    <th className="py-2 pr-4 font-semibold">dots</th>
                    <th className="py-2 pr-4 font-semibold">geometry</th>
                    <th className="py-2 pr-4 font-semibold">frame</th>
                    <th className="py-2 pr-4 font-semibold">of a frame</th>
                    <th className="py-2 font-semibold">bar</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[11px] text-[var(--tri-ink)]">
                  {order.map((i) => {
                    const s = ORB2_STYLES[i];
                    const w = weights[i];
                    const tier = w ? tierOf(w.share) : null;
                    const on = s.id === selected;
                    return (
                      <tr
                        key={s.id}
                        className={`cursor-pointer border-t border-[rgb(255_255_255_/_0.06)] ${on ? 'bg-[rgb(255_255_255_/_0.04)]' : ''}`}
                        onClick={() => setSelected(s.id)}
                      >
                        <td className="py-1.5 pr-4 text-[rgb(229_243_242_/_0.35)]">{i}</td>
                        <td className="py-1.5 pr-4">{s.name}</td>
                        <td className="py-1.5 pr-4 text-[var(--tri-ink-muted)]">{s.label}</td>
                        <td className="py-1.5 pr-4 text-[var(--tri-ink-muted)]">{w ? w.dots : '…'}</td>
                        <td className="py-1.5 pr-4 text-[var(--tri-ink-muted)]">{w ? `${Math.round(w.geoUs)}µs` : '…'}</td>
                        <td className="py-1.5 pr-4" style={{ color: tier ? TIER_INK[tier] : undefined }}>
                          {w ? `${Math.round(w.mainUs)}µs` : '…'}
                        </td>
                        <td className="py-1.5 pr-4" style={{ color: tier ? TIER_INK[tier] : undefined }}>
                          {w ? `${tier} · ${(w.share * 100).toFixed(1)}%` : '…'}
                        </td>
                        <td className="py-1.5 align-middle">
                          <div className="h-[3px] w-[120px] overflow-hidden rounded-full bg-[rgb(255_255_255_/_0.10)]">
                            {w && (
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${peak > 0 ? Math.max(2, (w.mainUs / peak) * 100) : 0}%`, background: TIER_INK[tier!] }}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-[12px] bg-[rgb(255_255_255_/_0.025)] px-4 py-3 font-mono text-[10px] leading-5 text-[var(--tri-ink-muted)]">
              <div className="text-[9px] uppercase tracking-widest text-[rgb(229_243_242_/_0.35)]">for reference · C-65 thinking-orbs, same harness, this window, the nine states at 64px</div>
              {reference ? (
                <>
                  <div>
                    stock (Canvas 2D) <span className="text-[var(--tri-ink)]">{Math.round(Math.min(...reference.stock))}–{Math.round(Math.max(...reference.stock))}µs</span>, median{' '}
                    <span className="text-[var(--tri-ink)]">{Math.round(median(reference.stock))}µs</span>
                  </div>
                  <div>
                    WebGL points <span className="text-[var(--tri-ink)]">{Math.round(Math.min(...reference.webgl))}–{Math.round(Math.max(...reference.webgl))}µs</span>, median{' '}
                    <span className="text-[var(--tri-ink)]">{Math.round(median(reference.webgl))}µs</span>
                  </div>
                  {measured.length === ORB2_STYLES.length && (
                    <div>
                      this system, median <span className="text-[var(--tri-ink)]">{Math.round(med)}µs</span> —{' '}
                      {med < median(reference.stock)
                        ? `${(median(reference.stock) / med).toFixed(1)}× lighter than C-65 stock`
                        : `${(med / median(reference.stock)).toFixed(1)}× heavier than C-65 stock`}
                      {', '}
                      {med < median(reference.webgl)
                        ? `${(median(reference.webgl) / med).toFixed(1)}× lighter than C-65 on WebGL`
                        : `${(med / median(reference.webgl)).toFixed(1)}× heavier than C-65 on WebGL`}
                    </div>
                  )}
                </>
              ) : (
                <div>measuring…</div>
              )}
            </div>
          </div>
        </Stage>
      </Group>

      <Note>
        <strong>The method is already the light one.</strong> This is what C-65's WebGL column was
        reaching for, done properly: each dot is an instanced quad (six vertices, one{' '}
        <code>draw(6, count)</code>), its positions come from a storage buffer, and the edge is a
        true area-coverage integral (<code>coverageScale</code>) rather than a <code>smoothstep</code>{' '}
        — so a 0.6px dot at 46px is the right brightness instead of a blob or a hole. Painting costs
        the main thread nothing worth measuring. What is left is the geometry: every style builds
        ~150 points, projects them and <em>sorts by depth</em> every frame, and that is the floor —
        the "geometry" column is most of the "frame" column. Cost is independent of size: the 46px
        pill and a 300px hero run the same 150 dots.
      </Note>

      <Note>
        <strong>Three things the file does not do that C-65 does.</strong> No{' '}
        <code>prefers-reduced-motion</code> handling — the loop runs regardless. The pill has no
        offscreen pause: only the gallery watches an IntersectionObserver, so a pill scrolled out of
        view keeps submitting frames. And every <code>ThinkingOrbsPill</code> requests its own{' '}
        <code>GPUDevice</code> — four pills on this sheet are four devices, where the gallery draws
        all 38 through one. None of these is hard to add; all three would need adding before it
        goes near the Live screen. Also on first use of each style the component probes 20 frames
        to fit the orb in its box — a one-off hitch, cached after.
      </Note>

      <Note>
        <strong>Nine verbs versus thirty-eight.</strong> C-65 ships nine and Trilorah has about four
        real waiting moments. This ships thirty-eight, each with its own word, and most of the words
        belong to a coding agent — Parsing, Formatting, Verifying, Routing. The ones that fit a booth
        are few and specific: <em>Twinkle</em> "Listening", <em>Band</em> "Searching",{' '}
        <em>Breathe</em> "Thinking", <em>Converge</em> "Reasoning" for the trust gate, and{' '}
        <em>Nest</em> "Reading" for the notes model. The pill form is the real gain: the label is
        part of the component, so the app cannot show an orb without saying what it is waiting for.
      </Note>

      <Spec
        rows={[
          ['source', 'ThinkingOrbsPill.tsx — vendored to src/design/orb/, one export line added, "use client" removed'],
          ['renderer', 'WebGPU — instanced quads from a storage buffer, premultiplied blend, coverage-integral AA, DPR capped at 2'],
          ['styles', '38 · ~150 dots each (120–170) · periods 3.2–6.2s · every loop closes'],
          ['pill', '46px ball · 9px gap · 7/22/7/8 padding · radius 999 · IBM Plex Mono 14px at 74%'],
          ['colour', 'dotColor · accent · pill · labelColor, with a *Light set for light scheme · scheme auto/light/dark'],
          ['knobs', 'speed · reverse · startAt · dotScale · dots · spread · perspective · depthSize · depthFade · dotOpacity · spin · turn · tilt'],
          ['gallery', 'one canvas for all 38, stills + one live · IntersectionObserver · click copies a snippet'],
          ['support', 'Chromium 113+ (Electron: yes) · Safari 26+ · Firefox 141+ Windows only — falls back to a text error'],
          ['a11y', 'none — no role, no label, no reduced-motion path'],
        ]}
      />
    </Sheet>
  );
}
