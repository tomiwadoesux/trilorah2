import { useId } from 'react';
import { Panel } from '../parts';
import { useBoxSize } from './useBoxSize';

/*
 * Is it getting better?
 *
 * That is the only question a church actually has about this product, and
 * every other tile answers something about today instead. This one answers
 * it the only way it can be honestly answered — by putting the last several
 * services next to each other and letting the eye do the comparing.
 *
 * Two lines on one axis. Accuracy is what the engine got right; trust is the
 * Wilson lower bound on that same number, which is what the auto-mode gate
 * actually reads. They are the same measurement seen with and without the
 * benefit of the doubt, so the DISTANCE between them is the real content:
 * early on the engine has been right most of the time but has barely been
 * asked, and the gap is wide; every service since has narrowed it, because
 * a lower bound rises on evidence even when the estimate above it holds
 * still. Nobody has to be told what a confidence interval is to read a gap
 * closing.
 *
 * The gate is drawn because a climbing line means nothing without something
 * to climb towards. With it, the tile states a position in one glance: this
 * preacher is most of the way to hands-free and not there yet.
 *
 * Drawn the way EngagementChart is drawn — no axis lines, no gridlines,
 * shape over values. From across a dark booth nobody reads a percentage off
 * a chart; they read whether the lines go up.
 */

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

/**
 * One service's worth of adaptation state.
 *
 * The two numeric fields are the same 0–1 fractions as `precision` and
 * `trustLowerBound` on `PreacherStats` in shared/types.ts, so wiring this to
 * a real history is a matter of mapping stored PreacherStats snapshots onto
 * this shape — the tile does no arithmetic on them beyond projection.
 */
export interface TrustPoint {
  /** Short service label for the axis — a date, not an index. */
  label: string;
  /** PreacherStats.precision — share of references the engine got right. */
  precision: number;
  /** PreacherStats.trustLowerBound — the number the auto-mode gate reads. */
  trustLowerBound: number;
}

/**
 * Placeholder history, shaped EXACTLY like the real thing, so wiring later
 * is a one-line swap for a prop or a query.
 *
 * Hand-authored rather than generated, because a profile's history has a
 * story and noise does not: the first three services are volatile (few
 * samples, so one bad Sunday moves precision a long way and the lower bound
 * barely moves at all), the middle four are the steady work of a vocabulary
 * filling in, and the last is the best yet — and still short of the gate.
 * Trust is below accuracy at every point by construction; a lower bound that
 * crossed its own estimate would be a bug, not a good week.
 */
const HISTORY: readonly TrustPoint[] = [
  { label: '2 mar', precision: 0.62, trustLowerBound: 0.31 },
  { label: '9 mar', precision: 0.55, trustLowerBound: 0.34 },
  { label: '16 mar', precision: 0.71, trustLowerBound: 0.46 },
  { label: '23 mar', precision: 0.74, trustLowerBound: 0.55 },
  { label: '30 mar', precision: 0.79, trustLowerBound: 0.62 },
  { label: '6 apr', precision: 0.81, trustLowerBound: 0.67 },
  { label: '13 apr', precision: 0.83, trustLowerBound: 0.71 },
  { label: '20 apr', precision: 0.85, trustLowerBound: 0.74 },
];

/*
 * The auto-mode threshold the trust line is climbing towards.
 *
 * 0.9 because that is what the engine actually gates on —
 * DEFAULT_THRESHOLDS.autoModeMinTrust in electron/preachers/correctionLedger.ts.
 * It is restated here rather than imported because the renderer does not
 * reach into main-process modules; when this tile is wired to real history
 * the threshold should come down the same channel as the numbers, since a
 * chart drawing a gate the engine has since moved is worse than no gate.
 *
 * Trust alone does not open auto mode — the ledger also wants 100 samples
 * across 5 services — so the gate is drawn as the last condition to fall,
 * not the only one. It is the one the operator can watch move.
 */
const GATE = 0.9;

/* Mint is the trust line because mint is what this system says "good" with
   everywhere else — the connected dot, the auto pill, the lit meter bar.
   Accuracy is drawn in ink rather than a second hue: it is context for the
   mint line, not a rival to it, and a third colour on a tile whose whole
   point is one line approaching one threshold would be a third argument. */
const TRUST = '#8fd3c0';
const ACCURACY = 'rgb(229 243 242 / 0.38)';
const GATE_INK = '#e4d87a';

/* Chart chrome, in the chart's own coordinates — none of these is a metric
   the token set names, so they live here rather than pretending to be one. */
const Y_GUTTER = 26; /* room for the widest y label plus its gap */
const X_ROW = 16;
const TOP_PAD = 6; /* so the topmost y label has a middle to sit on */
const STROKE = 1.4;
/* The plot stops short of the right edge, which EngagementChart does not
   need to: this chart ends on a dot, and a dot centred on the last pixel of
   the svg loses its right half to the clip. HEAD_R + a hair of its stroke. */
const RIGHT_PAD = 4;
const HEAD_R = 2.6;
/* The gate is chrome, not data, so it is drawn thinner than either series
   and dashed — it is a rule the lines are measured against, and at the same
   weight it would read as a third reading that never changes. */
const GATE_STROKE = 1;

const Y_LABELS = [0, 50, 100] as const;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

interface Pt {
  x: number;
  y: number;
}

/* The axis is the full 0–100, not a zoomed window on 30–90. A trimmed axis
   would make the same climb look twice as steep, and this tile's entire job
   is to be believed. */
function project(
  values: readonly number[],
  left: number,
  right: number,
  top: number,
  bottom: number,
): Pt[] {
  const last = values.length - 1;
  return values.map((v, i) => ({
    x: left + ((right - left) * i) / (last || 1),
    y: bottom - (bottom - top) * v,
  }));
}

/*
 * Catmull-Rom through every point, emitted as cubic beziers — the same curve
 * EngagementChart draws, for the same reason: a polyline reads as
 * measurement, eight little decisions the eye has to add up, and this tile is
 * asking to be glanced at. Tension 0.5 is the classic ratio; the clamp keeps
 * a steep step from throwing a control point past the top or the floor of the
 * plot, which would bow a line out through the axis labels.
 */
const TENSION = 0.5;

function smoothPath(pts: readonly Pt[], top: number, bottom: number): string {
  if (pts.length < 2) return '';
  const clamp = (v: number) => Math.min(bottom, Math.max(top, v));
  const at = (n: number) => n.toFixed(2);

  let d = `M ${at(pts[0].x)} ${at(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1] ?? pts[i];
    const a = pts[i];
    const b = pts[i + 1];
    const next = pts[i + 2] ?? b;
    const c1x = a.x + ((b.x - prev.x) * TENSION) / 3;
    const c1y = clamp(a.y + ((b.y - prev.y) * TENSION) / 3);
    const c2x = b.x - ((next.x - a.x) * TENSION) / 3;
    const c2y = clamp(b.y - ((next.y - a.y) * TENSION) / 3);
    d += ` C ${at(c1x)} ${at(c1y)}, ${at(c2x)} ${at(c2y)}, ${at(b.x)} ${at(b.y)}`;
  }
  return d;
}

/* ------------------------------------------------------------------ */

/** The separator between two facts on a line. Dim enough to be punctuation. */
function Middot() {
  return (
    <span aria-hidden className="px-1 text-[rgb(229_243_242_/_0.22)]">
      ·
    </span>
  );
}

const AXIS_INK = 'rgb(229 243 242 / 0.4)';
const AXIS_TYPE = {
  fontSize: 'var(--tri-size-eyebrow)',
  fontVariantNumeric: 'tabular-nums',
} as const;

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function TrustTrendTile({ className }: { className?: string }) {
  /* Real pixels rather than a stretched viewBox: preserveAspectRatio="none"
     would scale the 1.4px stroke and the labels with the box, so the same
     chart would show a hairline on a wide artboard and a fat rule on a
     narrow one. */
  const { ref, width, height } = useBoxSize<HTMLDivElement>();
  /* Two of these can be mounted at once in the sandbox and duplicate SVG ids
     cross-wire silently. React's ids carry colons, which are legal in a
     url() reference but trip enough tooling to be worth dropping. */
  const uid = useId().replace(/:/g, '');

  /* A history of one point has no shape and a history of none has no tile.
     The placeholder is eight, but the export invites a real array in, and a
     brand-new preacher's first Sunday is exactly the case where a chart of
     his progress does not exist yet. Everything below reads `latest`, so it
     is the one thing checked before anything else is computed. */
  const latest = HISTORY.length > 0 ? HISTORY[HISTORY.length - 1] : undefined;
  const gap = latest ? Math.max(0, GATE - latest.trustLowerBound) : 0;

  const plotLeft = Y_GUTTER;
  const plotRight = width - RIGHT_PAD;
  const plotTop = TOP_PAD;
  const plotBottom = height - X_ROW;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  /* Two points is the fewest that can be drawn as a line; below that
     smoothPath returns '' and the plot is an empty box with axis labels,
     which reads as a fault rather than as "not yet". */
  const ready = plotWidth > 80 && plotHeight > 32 && HISTORY.length >= 2;

  const y = (v: number) => plotBottom - plotHeight * v;

  const accuracyLine = ready
    ? smoothPath(
        project(HISTORY.map((p) => p.precision), plotLeft, plotRight, plotTop, plotBottom),
        plotTop,
        plotBottom,
      )
    : '';
  const trustPts = ready
    ? project(HISTORY.map((p) => p.trustLowerBound), plotLeft, plotRight, plotTop, plotBottom)
    : [];
  const trustLine = ready ? smoothPath(trustPts, plotTop, plotBottom) : '';
  const head = trustPts[trustPts.length - 1];

  return (
    <Panel className={className} bodyClass="pt-3" unavailable="builds up after a few services with this preacher">
      <div className="flex h-full flex-col gap-[var(--tri-gap)]">
        {/* (a) the span, and where the climb has got to */}
        <div className="flex shrink-0 items-baseline justify-between gap-[var(--tri-gap)]">
          <span className="shrink-0 text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.8)]">
            {HISTORY.length === 1 ? 'First service' : `Last ${HISTORY.length} services`}
          </span>
          {/* One line, elided rather than wrapped — an ellipsis says "there is
              more" where a mid-word cut reads as a rendering fault. */}
          <span className="min-w-0 truncate text-[length:var(--tri-size-eyebrow)] text-[rgb(229_243_242_/_0.5)]">
            {latest ? (
              <>
                <span className="tabular-nums text-[rgb(229_243_242_/_0.82)]">
                  {pct(latest.precision)}
                </span>{' '}
                accurate
                <Middot />
                <span className="tabular-nums text-[rgb(229_243_242_/_0.82)]">
                  {pct(latest.trustLowerBound)}
                </span>{' '}
                trusted
                <Middot />
                {/* The gap to the gate, said in words, because it is the one
                    figure here that is a decision rather than a reading. Once
                    it closes the sentence has to change: "0% to auto" is a
                    number where the answer is a state. */}
                {gap > 0 ? (
                  <>
                    <span className="tabular-nums text-[rgb(229_243_242_/_0.82)]">{pct(gap)}</span>{' '}
                    to auto
                  </>
                ) : (
                  <span className="text-[#8fd3c0]">clears the gate</span>
                )}
              </>
            ) : (
              'no services yet'
            )}
          </span>
        </div>

        {/* (b) legend — swatch, name. The gate gets a dash rather than a
            square, so it reads as the line it is. */}
        <div className="flex shrink-0 items-center overflow-hidden whitespace-nowrap text-[length:var(--tri-size-eyebrow)] lowercase text-[rgb(229_243_242_/_0.55)]">
          <span className="flex items-center">
            <span
              aria-hidden
              className="mr-1.5 size-[8px] shrink-0 rounded-[2px]"
              style={{ backgroundColor: TRUST }}
            />
            trust
          </span>
          <Middot />
          <span className="flex items-center">
            <span
              aria-hidden
              className="mr-1.5 size-[8px] shrink-0 rounded-[2px]"
              style={{ backgroundColor: ACCURACY }}
            />
            accuracy
          </span>
          <Middot />
          <span className="flex items-center">
            <span
              aria-hidden
              className="mr-1.5 h-[2px] w-[10px] shrink-0 rounded-[1px]"
              style={{ backgroundColor: GATE_INK }}
            />
            auto at {pct(GATE)}
          </span>
        </div>

        {/* (c) the plot — the region that absorbs whatever height is left */}
        {/* overflow-hidden because the svg is sized from state: for the one
            frame between the box shrinking and the measurement landing, the
            chart is still drawn at the old size and would otherwise paint out
            through the panel's own inset. */}
        <div ref={ref} className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {ready && (
            <svg
              width={width}
              height={height}
              role="img"
              /* Described rather than tabulated: a screen reader hearing eight
                 pairs of numbers learns less than one hearing the shape, and
                 the shape is what the sighted reader gets too. Built from the
                 data so it cannot drift from the line once this is wired. */
              aria-label={`Detection accuracy and trust across the last ${HISTORY.length} services. Accuracy is volatile early, then climbs steadily to ${pct(
                latest?.precision ?? 0,
              )}. Trust starts far below it, closes most of the gap over the later services, and stands at ${pct(
                latest?.trustLowerBound ?? 0,
              )}${
                gap > 0
                  ? ` — still ${pct(gap)} short of the ${pct(GATE)} auto-mode gate.`
                  : `, at or above the ${pct(GATE)} auto-mode gate.`
              }`}
              style={{ fontFamily: 'var(--tri-font)' }}
            >
              <defs>
                {/* The trust line's own fill. Only it gets one: two filled
                    bands this close together on one axis would overlap into
                    a colour neither of them is, and accuracy is here as the
                    ceiling trust is rising towards, not as a second area. */}
                <linearGradient id={`${uid}-trust`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TRUST} stopOpacity={0.34} />
                  <stop offset="100%" stopColor={TRUST} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <g aria-hidden fill={AXIS_INK} style={AXIS_TYPE} textAnchor="end">
                {Y_LABELS.map((v) => (
                  <text key={v} x={plotLeft - 6} y={y(v / 100)} dominantBaseline="middle">
                    {v}
                  </text>
                ))}
              </g>

              <g aria-hidden fill={AXIS_INK} style={AXIS_TYPE}>
                {HISTORY.map((p, i) => {
                  const last = HISTORY.length - 1;
                  /* Only the ends are labelled. Eight dates along a tile that
                     may be a third of the bento wide would collide, and the
                     span is already stated above — these two exist so the
                     shape has a beginning and an end, not so a value can be
                     looked up. */
                  if (i !== 0 && i !== last) return null;
                  return (
                    <text
                      key={p.label}
                      x={plotLeft + (plotWidth * i) / last}
                      y={height - 4.5}
                      textAnchor={i === 0 ? 'start' : 'end'}
                    >
                      {p.label}
                    </text>
                  );
                })}
              </g>

              {/* The gate, under both series: a line the data crosses should
                  pass behind it, or the day trust finally clears it would be
                  drawn with the gate sitting on top of the reading. */}
              <line
                x1={plotLeft}
                x2={plotRight}
                y1={y(GATE)}
                y2={y(GATE)}
                stroke={GATE_INK}
                strokeWidth={GATE_STROKE}
                strokeDasharray="3 4"
                strokeOpacity={0.55}
              />

              <path
                d={accuracyLine}
                fill="none"
                stroke={ACCURACY}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d={`${trustLine} L ${plotRight.toFixed(2)} ${plotBottom.toFixed(2)} L ${plotLeft.toFixed(2)} ${plotBottom.toFixed(2)} Z`}
                fill={`url(#${uid}-trust)`}
              />
              <path
                d={trustLine}
                fill="none"
                stroke={TRUST}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Where it stands now. The one dot on the chart, because the
                  latest service is the only point anybody is looking for. */}
              {head && <circle cx={head.x} cy={head.y} r={HEAD_R} fill={TRUST} />}
            </svg>
          )}
        </div>
      </div>
    </Panel>
  );
}
