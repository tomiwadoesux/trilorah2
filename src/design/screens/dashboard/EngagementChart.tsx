import { useId } from 'react';
import { Panel } from '../parts';
import { useBoxSize } from './useBoxSize';

/*
 * The service so far — how the room responded, minute by minute.
 *
 * The only tile on the dashboard with a real data graphic, and it is drawn
 * with no axis lines and no gridlines on purpose: from across a dark booth
 * nobody reads a value off a chart, they read a SHAPE. The question this
 * answers is "is the room still with him", and the answer is the silhouette
 * of the two curves, not the numbers. The labels stay only so the shape has
 * a scale to sit in.
 */

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

interface Readout {
  /** Split out so the figure can carry the brightness and the words cannot. */
  figure: string;
  label: string;
}

const READOUTS: readonly Readout[] = [
  { figure: '35', label: 'following along' },
  { figure: '85%', label: 'detection accuracy' },
  { figure: '16', label: 'scriptures detected' },
];

const RED = '#ef5350';
const GREEN = '#66bb6a';
const TEAL = '#2f7f8f';

const LEGEND: readonly { swatch: string; label: string }[] = [
  { swatch: RED, label: '19 amens' },
  { swatch: GREEN, label: '23 bookmarks' },
  /* Flags are counted but not plotted: five points over thirty-six minutes
     is a flat line along the floor, which says less than the figure does. */
  { swatch: TEAL, label: '5 flags' },
];

/*
 * Thirty-six minutes of a real service, one value a step, index 0 at 35
 * minutes remaining. Hand-authored rather than generated — a service has a
 * story (a verse lands early, the middle is steady work, the altar call
 * takes the room) and noise does not.
 */
const AMENS: readonly number[] = [
  0, 0, 0.4, 0.8, 1.2, 1.5, 2.1, 2.4, 3.0, 3.4, 3.9, 4.3, 4.8, 5.2, 5.5, 5.4, 5.8, 5.6, 6.0, 5.9,
  6.2, 6.0, 6.3, 6.1, 6.4, 6.2, 6.5, 6.3, 6.6, 6.9, 7.2, 8.6, 10.4, 12.8, 15.2, 17.4, 19.0,
];

const BOOKMARKS: readonly number[] = [
  1.0, 3.2, 6.4, 9.2, 10.8, 11.0, 10.1, 8.6, 7.2, 6.3, 5.8, 5.4, 5.9, 6.6, 7.3, 7.9, 8.4, 8.1, 7.4,
  6.6, 6.0, 5.6, 5.9, 6.5, 7.2, 7.8, 8.6, 8.9, 8.4, 7.6, 6.9, 6.3, 5.9, 6.2, 6.6, 6.9, 7.0,
];

interface Series {
  key: string;
  hue: string;
  values: readonly number[];
}

/* Paint order, not legend order: bookmarks sit behind, because amens is the
   curve that matters at the end of a service and it must not be tinted by a
   fill drawn over it. */
const SERIES: readonly Series[] = [
  { key: 'bookmarks', hue: GREEN, values: BOOKMARKS },
  { key: 'amens', hue: RED, values: AMENS },
];

/** Time REMAINING, so the row counts down towards the end of the sermon. */
const X_LABELS = ['35m', '30m', '25m', '20m', '15m', '10m', '5m', '0m'] as const;
const Y_LABELS = [0, 5, 10, 15, 20] as const;
const Y_MAX = 20;

/* Chart chrome, in the chart's own coordinates — none of these is a metric
   the token set names, so they live here rather than pretending to be one. */
const Y_GUTTER = 26; /* room for the widest y label plus its gap */
const X_ROW = 16;
const TOP_PAD = 6; /* so the topmost y label has a middle to sit on */
const STROKE = 1.4;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

interface Pt {
  x: number;
  y: number;
}

function project(values: readonly number[], left: number, right: number, top: number, bottom: number): Pt[] {
  const last = values.length - 1;
  return values.map((v, i) => ({
    x: left + ((right - left) * i) / last,
    y: bottom - ((bottom - top) * v) / Y_MAX,
  }));
}

/*
 * Catmull-Rom through every point, emitted as cubic beziers.
 *
 * A polyline reads as measurement — twelve little decisions the eye has to
 * add up — and this tile is asking to be glanced at. Tension 0.5 is the
 * classic ratio (the control point sits a sixth of the way along the
 * neighbours' chord); the clamp is what keeps a steep step from throwing a
 * control point past the baseline, which would bulge the filled area out
 * below the floor of the plot.
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

export function EngagementChart({ className }: { className?: string }) {
  /* The SVG is drawn at real pixels rather than stretched from a fixed
     viewBox: preserveAspectRatio="none" would scale the 1.4px stroke and the
     labels with the box, so the same chart would show a hairline on a wide
     artboard and a fat rule on a narrow one. */
  const { ref, width, height } = useBoxSize<HTMLDivElement>();
  /* Two of these tiles can be mounted at once in the sandbox, and duplicate
     SVG ids cross-wire the fills silently — the second chart quietly borrows
     the first one's gradient. React's ids carry colons, which are legal in a
     url() reference but trip enough tooling to be worth dropping. */
  const uid = useId().replace(/:/g, '');

  const plotLeft = Y_GUTTER;
  const plotRight = width;
  const plotTop = TOP_PAD;
  const plotBottom = height - X_ROW;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const ready = plotWidth > 80 && plotHeight > 32;

  const paths = ready
    ? SERIES.map((s) => {
        const pts = project(s.values, plotLeft, plotRight, plotTop, plotBottom);
        const line = smoothPath(pts, plotTop, plotBottom);
        return {
          ...s,
          line,
          area: `${line} L ${plotRight.toFixed(2)} ${plotBottom.toFixed(2)} L ${plotLeft.toFixed(2)} ${plotBottom.toFixed(2)} Z`,
        };
      })
    : [];

  return (
    <Panel className={className} bodyClass="pt-3">
      <div className="flex h-full flex-col gap-[var(--tri-gap)]">
        {/* (a) the day, and what the service has added up to so far */}
        <div className="flex shrink-0 items-baseline justify-between gap-[var(--tri-gap)]">
          <span className="shrink-0 text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.8)]">
            Sunday, 14th april
          </span>
          {/* One line, elided rather than wrapped: the head row keeping its
              height is worth more than the third fact on a narrow artboard,
              and an ellipsis says "there is more" where a mid-word cut just
              reads as a rendering fault from across the booth. */}
          <span className="min-w-0 truncate text-[length:var(--tri-size-eyebrow)] text-[rgb(229_243_242_/_0.5)]">
            {READOUTS.map((r, i) => (
              <span key={r.label}>
                {i > 0 && <Middot />}
                <span className="tabular-nums text-[rgb(229_243_242_/_0.82)]">{r.figure}</span>{' '}
                {r.label}
              </span>
            ))}
          </span>
        </div>

        {/* (b) legend — swatch, count, name */}
        <div className="flex shrink-0 items-center overflow-hidden whitespace-nowrap text-[length:var(--tri-size-eyebrow)] lowercase text-[rgb(229_243_242_/_0.55)]">
          {LEGEND.map((e, i) => (
            <span key={e.label} className="flex items-center">
              {i > 0 && <Middot />}
              <span
                aria-hidden
                className="mr-1.5 size-[8px] shrink-0 rounded-[2px]"
                style={{ backgroundColor: e.swatch }}
              />
              {e.label}
            </span>
          ))}
        </div>

        {/* (c) the plot — the region that absorbs whatever height is left */}
        {/* overflow-hidden because the svg is sized from state: for the one
            frame between the box shrinking and the measurement landing, the
            chart is still drawn at the old size and would otherwise paint
            out through the panel's own inset. */}
        <div ref={ref} className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {ready && (
            <svg
              width={width}
              height={height}
              role="img"
              aria-label="Congregation response through the service. Amens build slowly, hold steady through the middle, then climb hard over the last five minutes to nineteen. Bookmarks spike to eleven in the opening minutes, fall back, and undulate between five and nine for the rest, ending at seven."
              style={{ fontFamily: 'var(--tri-font)' }}
            >
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.hue} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={s.hue} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>

              <g aria-hidden fill={AXIS_INK} style={AXIS_TYPE} textAnchor="end">
                {Y_LABELS.map((v) => (
                  <text
                    key={v}
                    x={plotLeft - 6}
                    y={plotBottom - (plotHeight * v) / Y_MAX}
                    dominantBaseline="middle"
                  >
                    {v}
                  </text>
                ))}
              </g>

              <g aria-hidden fill={AXIS_INK} style={AXIS_TYPE}>
                {X_LABELS.map((label, i) => {
                  const last = X_LABELS.length - 1;
                  /* The end labels are anchored to the plot's edges rather
                     than centred on them, so neither hangs off the tile. */
                  const anchor = i === 0 ? 'start' : i === last ? 'end' : 'middle';
                  return (
                    <text
                      key={label}
                      x={plotLeft + (plotWidth * i) / last}
                      y={height - 4.5}
                      textAnchor={anchor}
                    >
                      {label}
                    </text>
                  );
                })}
              </g>

              {paths.map((s) => (
                <g key={s.key}>
                  <path d={s.area} fill={`url(#${uid}-${s.key})`} />
                  <path
                    d={s.line}
                    fill="none"
                    stroke={s.hue}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}
            </svg>
          )}
        </div>
      </div>
    </Panel>
  );
}
