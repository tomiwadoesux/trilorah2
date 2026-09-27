import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
  type ThinkingOrbsPillProps,
  STYLES, LOOP_ID, LOOP_INDEX, SPEED, REVERSE, START_AT, DOT_SCALE, SHOWS_PILL, SHOWS_LABEL, SCHEME,
  ACCENT_COLOR, INK_DARK, INK_LIGHT, KNOBS, BALL, GAP, PAD_TOP, PAD_RIGHT, PAD_BOTTOM, PAD_LEFT,
  FONT, FONT_SIZE, LABEL_OPACITY, MAX_DOTS, DOT_FLOATS,
  orbInk, orbPhase, packDots, ensureAccentShare, useOrbDark,
} from './ThinkingOrbsPill';

/*
 * The thinking orb, drawn as SVG by the same geometry the WebGPU one uses.
 *
 * ThinkingOrbsPill asks the GPU for an adapter before it draws anything.
 * Some church PCs have no working GPU driver, and there it cannot get one:
 * the bar shows an error sentence where the orb should be. This file never
 * asks. Every frame it runs the style's own geometry from ThinkingOrbsPill
 * (the same DRAWS, the same perspective, depth size and depth fade, the
 * same fit and the same accent share), and writes the dots it gets into a
 * small <svg>. So it is the same animation, not a lookalike, and it draws
 * on any machine that can draw a web page.
 *
 * Two ways to write the dots, picked by `render`:
 *
 *   paths    the default. Dots are grouped by colour and by one of twelve
 *            alpha steps, and each group is one <path> of circles. About
 *            two dozen nodes and one attribute write per group per frame.
 *            Groups paint dimmest first; depth fade makes the dimmest the
 *            farthest, so that is back to front.
 *   circles  one <circle> per dot, reassigned by index every frame so the
 *            depth order is simply DOM order. Exact alpha, ~150 nodes.
 *
 * It is cheap where the GPU one was not. Still states cost nothing: once
 * the speed has eased down to 0 (idle, output frozen) the orb draws its
 * last frame and stops asking for frames at all, where the GPU loop kept
 * submitting sixty a second to show the same picture. An orb that is
 * scrolled away or in a hidden window stops too, reduced motion holds
 * every orb still, and `fps` can cap the rate without changing how fast
 * it moves. Every mounted orb shares one requestAnimationFrame, not one
 * loop each.
 */

type RenderMode = 'circles' | 'paths';

export type SvgOrbsPillProps = ThinkingOrbsPillProps & {
  /** Frames per second at most. 0 or unset draws at the display's rate. */
  fps?: number;
  /** How the dots reach the DOM. See the header. */
  render?: RenderMode;
};

const DEFAULT_RENDER: RenderMode = 'paths';
const SVG_NS = 'http://www.w3.org/2000/svg';

/* Same as the WebGPU loop: how long a change of style or colour travels. */
const MORPH_MS = 520;
/* The speed eases exponentially and never lands; closer than this, it has. */
const SPEED_SETTLE = 1e-3;
/* rAF lands a little early or late; this much slack keeps a 30fps cap at 30. */
const FPS_SLACK_MS = 4;

/* Alpha steps for `paths`. A power curve, not linear: linear steps crush
   the dim back of the sphere into one level (or drop it), and the back
   being dimmer is half of what makes the ball read as round. Measured on
   the Live states: 12 steps at 1.6 average ~11% alpha error per dot. */
const LEVELS = 12;
const GAMMA = 1.6;
const INV_GAMMA = 1 / GAMMA;
const LEVEL_OPACITY = Array.from({ length: LEVELS }, (_, k) => Math.round(Math.pow((k + 1) / LEVELS, GAMMA) * 1000) / 1000);

/*
 * A dot's colour role. Outside a morph every dot is ink or accent. Inside
 * one, a dot is blending from one of those to one of those, or fading out
 * in the colour it had; dots of one role share one colour on any frame,
 * so the role is a stable group for `paths` even while colours move.
 */
const ROLE_INK = 0;
const ROLE_ACCENT = 1;
const ROLE_BLEND = 2; // + 2 * oldIsAccent + newIsAccent -> 2..5
const ROLE_FADING = 6; // + oldIsAccent -> 6..7
const ROLES = 8;
const BUCKETS = LEVELS * ROLES;

/* Scratch shared by every orb. The ticker steps orbs one at a time and
   each step is done with these before the next starts. */
const CUR = new Float32Array(MAX_DOTS * DOT_FLOATS);
const PREV = new Float32Array(MAX_DOTS * DOT_FLOATS);
const ROLE = new Uint8Array(MAX_DOTS);
const BUCKET_D: string[] = new Array<string>(BUCKETS).fill('');
const BUCKET_FILL = new Int32Array(BUCKETS);

type Knobs = { n: number; sp: number; pv: number; dz: number; df: number; yw: number; pc: number; sn: number; op: number };

/* What packDots reads, plus what the loop needs. Same shape as the
   WebGPU component's settings so packDots sees what it always saw. */
type Settings = {
  index: number;
  /** Style and colours: when this changes, the orb morphs. */
  key: string;
  speed: number;
  reverse: boolean;
  startAt: number;
  dotScale: number;
  knobs: Knobs;
  dot: number[];
  accent: number[];
  ball: number;
  fps: number;
  render: RenderMode;
};

type Look = { index: number; dot: number[]; accent: number[] };

const round2 = (v: number) => Math.round(v * 100) / 100;

function rgbAt(buf: Float32Array, o: number): number {
  const r = Math.round(buf[o + 4] * 255), g = Math.round(buf[o + 5] * 255), b = Math.round(buf[o + 6] * 255);
  return ((r < 0 ? 0 : r > 255 ? 255 : r) << 16) | ((g < 0 ? 0 : g > 255 ? 255 : g) << 8) | (b < 0 ? 0 : b > 255 ? 255 : b);
}

const hexOf = (rgb: number) => '#' + (0x1000000 | rgb).toString(16).slice(1);

/* packDots stores colours as float32, so compare against the float32
   rounding of the accent, exactly as ensureAccentShare does. */
function isAccentAt(buf: Float32Array, o: number, a0: number, a1: number, a2: number) {
  return buf[o + 4] === a0 && buf[o + 5] === a1 && buf[o + 6] === a2;
}

/* ------------------------------------------------------------------ */
/* Renderers                                                           */
/* ------------------------------------------------------------------ */

interface Renderer {
  kind: RenderMode;
  draw(buf: Float32Array, roles: Uint8Array, count: number): void;
  destroy(): void;
}

function pathRenderer(svg: SVGSVGElement): Renderer {
  /* One slot per (alpha level, role), created the first time it has dots
     and kept. DOM order is level-major so dim paints under bright. */
  const nodes: (SVGPathElement | null)[] = new Array<SVGPathElement | null>(BUCKETS).fill(null);
  const lastD: string[] = new Array<string>(BUCKETS).fill('');
  const lastFill = new Int32Array(BUCKETS).fill(-1);

  const create = (b: number) => {
    const el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('fill-opacity', String(LEVEL_OPACITY[Math.floor(b / ROLES)]));
    let next: SVGPathElement | null = null;
    for (let j = b + 1; j < BUCKETS && !next; j++) next = nodes[j];
    svg.insertBefore(el, next);
    nodes[b] = el;
    return el;
  };

  return {
    kind: 'paths',
    draw(buf, roles, count) {
      for (let b = 0; b < BUCKETS; b++) BUCKET_D[b] = '';
      for (let i = 0; i < count; i++) {
        const o = i * DOT_FLOATS;
        const a = buf[o + 3];
        const r = round2(buf[o + 2]);
        if (a <= 0.004 || r <= 0) continue;
        let lv = Math.round(Math.pow(a, INV_GAMMA) * LEVELS);
        lv = lv < 1 ? 1 : lv > LEVELS ? LEVELS : lv;
        const b = (lv - 1) * ROLES + roles[i];
        if (BUCKET_D[b] === '') BUCKET_FILL[b] = rgbAt(buf, o);
        /* A circle as two half-arcs from its left edge. Same sweep both
           times, so overlapping dots in one path union, never punch holes. */
        const d = r + r;
        BUCKET_D[b] += 'M' + round2(buf[o] - r) + ' ' + round2(buf[o + 1])
          + 'a' + r + ' ' + r + ' 0 1 0 ' + d + ' 0'
          + 'a' + r + ' ' + r + ' 0 1 0 ' + -d + ' 0';
      }
      for (let b = 0; b < BUCKETS; b++) {
        const d = BUCKET_D[b];
        if (d === lastD[b]) continue;
        let el = nodes[b];
        if (d === '') {
          el?.removeAttribute('d');
        } else {
          el = el ?? create(b);
          if (BUCKET_FILL[b] !== lastFill[b]) {
            el.setAttribute('fill', hexOf(BUCKET_FILL[b]));
            lastFill[b] = BUCKET_FILL[b];
          }
          el.setAttribute('d', d);
        }
        lastD[b] = d;
      }
    },
    destroy() {
      for (const el of nodes) el?.remove();
    },
  };
}

function circleRenderer(svg: SVGSVGElement): Renderer {
  /* The list arrives sorted back to front; circle i always takes dot i,
     so paint order is DOM order and nothing tracks which dot is which. */
  const pool: SVGCircleElement[] = [];
  const cx: number[] = [], cy: number[] = [], cr: number[] = [], op: number[] = [], fill: number[] = [];

  return {
    kind: 'circles',
    draw(buf, _roles, count) {
      for (let i = 0; i < count; i++) {
        let el = pool[i];
        if (!el) {
          el = document.createElementNS(SVG_NS, 'circle');
          svg.appendChild(el);
          pool.push(el);
          cx.push(NaN); cy.push(NaN); cr.push(NaN); op.push(NaN); fill.push(-1);
        }
        const o = i * DOT_FLOATS;
        const x = round2(buf[o]), y = round2(buf[o + 1]), r = round2(buf[o + 2]), a = round2(buf[o + 3]);
        const c = rgbAt(buf, o);
        if (x !== cx[i]) { el.setAttribute('cx', String(x)); cx[i] = x; }
        if (y !== cy[i]) { el.setAttribute('cy', String(y)); cy[i] = y; }
        if (r !== cr[i]) { el.setAttribute('r', String(r)); cr[i] = r; }
        if (a !== op[i]) { el.setAttribute('fill-opacity', String(a)); op[i] = a; }
        if (c !== fill[i]) { el.setAttribute('fill', hexOf(c)); fill[i] = c; }
      }
      /* r = 0 draws nothing; the circle waits for the next dot. */
      for (let i = count; i < pool.length; i++) {
        if (cr[i] !== 0) { pool[i].setAttribute('r', '0'); cr[i] = 0; }
      }
    },
    destroy() {
      for (const el of pool) el.remove();
    },
  };
}

/* ------------------------------------------------------------------ */
/* One orb's clock                                                     */
/* ------------------------------------------------------------------ */

class OrbRunner {
  visible = true;
  /** Last frame's timestamp; -1 means "no dt yet" after a start or a pause. */
  last = -1;
  private styleTime = 0;
  private speed: number;
  private key = '';
  private cur: Look | null = null;
  private prev: Look | null = null;
  private morphStart = 0;
  private renderer: Renderer | null = null;
  readonly svg: SVGSVGElement;
  private readonly get: () => Settings;

  constructor(svg: SVGSVGElement, get: () => Settings) {
    this.svg = svg;
    this.get = get;
    this.speed = get().speed;
  }

  /** Draw a frame. Returns whether the orb wants another one. */
  step(now: number): boolean {
    const s = this.get();

    /* The cap skips frames but the clock below reads the real gap, so a
       capped orb moves at the same speed, just in fewer steps. */
    if (s.fps > 0 && this.last >= 0 && now - this.last + FPS_SLACK_MS < 1000 / s.fps) return true;
    const maxDt = s.fps > 0 ? Math.max(0.1, 2 / s.fps) : 0.1;
    const dt = this.last < 0 ? 0 : Math.min(maxDt, Math.max(0, (now - this.last) / 1000));
    this.last = now;

    /* Time is accumulated, and the speed eases, as in the WebGPU loop: a
       state that sets speed 0 stops the ball where it is, not at phase 0. */
    const still = reduceMotion;
    if (still) {
      this.speed = 0;
    } else {
      this.speed += (s.speed - this.speed) * Math.min(1, dt * 6);
      if (Math.abs(s.speed - this.speed) < SPEED_SETTLE) this.speed = s.speed;
    }
    this.styleTime += dt * this.speed;

    if (s.key !== this.key) {
      /* Morph from what was on screen, not from what the previous render
         said, so a render that changes nothing cannot cancel a morph. */
      this.prev = this.key && this.cur && !still ? this.cur : null;
      this.morphStart = now;
      this.key = s.key;
      this.cur = { index: s.index, dot: s.dot, accent: s.accent };
    }

    if (!this.renderer || this.renderer.kind !== s.render) {
      this.renderer?.destroy();
      this.renderer = s.render === 'circles' ? circleRenderer(this.svg) : pathRenderer(this.svg);
    }

    const size = s.ball;
    const time = this.styleTime;
    const phaseOf = (index: number) => orbPhase(STYLES[index].period, 1, time, s.reverse, s.startAt);

    let count = packDots(s, phaseOf(s.index), size, CUR);
    ensureAccentShare(CUR, count, s.accent, s.dot);
    const a0 = Math.fround(s.accent[0]), a1 = Math.fround(s.accent[1]), a2 = Math.fround(s.accent[2]);
    for (let i = 0; i < count; i++) ROLE[i] = isAccentAt(CUR, i * DOT_FLOATS, a0, a1, a2) ? ROLE_ACCENT : ROLE_INK;

    /* The morph, as in the WebGPU loop: each dot travels from where the
       old style puts it to where the new one does, index-matched, over
       MORPH_MS with an ease-out. Dots only one list has fade in place. */
    let morphing = false;
    const prev = this.prev;
    if (prev && now - this.morphStart < MORPH_MS) {
      morphing = true;
      const u = (now - this.morphStart) / MORPH_MS;
      const m = 1 - Math.pow(1 - u, 3);
      const pcount = packDots(
        { index: prev.index, dot: prev.dot, accent: prev.accent, knobs: s.knobs, dotScale: s.dotScale },
        phaseOf(prev.index), size, PREV,
      );
      ensureAccentShare(PREV, pcount, prev.accent, prev.dot);
      const p0 = Math.fround(prev.accent[0]), p1 = Math.fround(prev.accent[1]), p2 = Math.fround(prev.accent[2]);
      const n = Math.max(count, pcount);
      for (let i = 0; i < n; i++) {
        const o = i * DOT_FLOATS;
        const hasNew = i < count, hasOld = i < pcount;
        if (hasNew && hasOld) {
          const oldAcc = isAccentAt(PREV, o, p0, p1, p2) ? 1 : 0;
          ROLE[i] = ROLE_BLEND + 2 * oldAcc + (ROLE[i] === ROLE_ACCENT ? 1 : 0);
          for (let k = 0; k < 7; k++) CUR[o + k] = PREV[o + k] + (CUR[o + k] - PREV[o + k]) * m;
        } else if (hasOld) {
          ROLE[i] = ROLE_FADING + (isAccentAt(PREV, o, p0, p1, p2) ? 1 : 0);
          for (let k = 0; k < 7; k++) CUR[o + k] = PREV[o + k];
          CUR[o + 3] = PREV[o + 3] * (1 - m);
        } else {
          CUR[o + 3] = CUR[o + 3] * m;
        }
      }
      count = n;
    } else if (prev) {
      this.prev = null;
    }

    this.renderer.draw(CUR, ROLE, count);

    /* Keep going while moving, easing, or morphing. A still orb has just
       drawn its last frame and costs nothing until something changes. */
    const moving = !still && (this.speed !== 0 || s.speed !== 0);
    return moving || morphing;
  }

  destroy() {
    this.renderer?.destroy();
    this.renderer = null;
  }
}

/* ------------------------------------------------------------------ */
/* The shared ticker                                                   */
/* ------------------------------------------------------------------ */

/* Every mounted orb, and the ones that currently want frames. One rAF
   serves them all and stops asking when none do. */
const mounted = new Set<OrbRunner>();
const ticking = new Set<OrbRunner>();
const byElement = new WeakMap<Element, OrbRunner>();
let raf = 0;
let io: IntersectionObserver | null = null;
let motionQuery: MediaQueryList | null = null;
let reduceMotion = false;

function safeStep(r: OrbRunner, now: number): boolean {
  try {
    return r.step(now);
  } catch (err) {
    console.error('[SvgOrbsPill] frame failed', err);
    return false;
  }
}

function tick(now: number) {
  raf = 0;
  if (document.hidden) return;
  for (const r of ticking) {
    if (!r.visible || !safeStep(r, now)) ticking.delete(r);
  }
  schedule();
}

function schedule() {
  if (!raf && ticking.size > 0 && !document.hidden) raf = requestAnimationFrame(tick);
}

/** Ask for frames: something changed, or the orb came back into view. */
function wake(r: OrbRunner) {
  if (!mounted.has(r) || !r.visible) return;
  if (!ticking.has(r)) {
    r.last = -1; // no jump for the time it spent asleep
    ticking.add(r);
  }
  schedule();
}

function onVisibility() {
  if (document.hidden) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    return;
  }
  for (const r of ticking) r.last = -1;
  schedule();
}

function onMotion() {
  reduceMotion = !!motionQuery?.matches;
  for (const r of mounted) wake(r);
}

function onIntersect(entries: IntersectionObserverEntry[]) {
  for (const e of entries) {
    const r = byElement.get(e.target);
    if (!r) continue;
    r.visible = e.isIntersecting;
    if (r.visible) wake(r);
    else ticking.delete(r);
  }
}

function attach(r: OrbRunner) {
  if (mounted.size === 0) {
    document.addEventListener('visibilitychange', onVisibility);
    if (typeof window.matchMedia === 'function') {
      motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      motionQuery.addEventListener('change', onMotion);
      reduceMotion = motionQuery.matches;
    }
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(onIntersect, { rootMargin: '64px' });
    }
  }
  mounted.add(r);
  byElement.set(r.svg, r);
  io?.observe(r.svg);
  /* First frame now, before paint, so the ball is never empty. */
  if (safeStep(r, performance.now())) {
    ticking.add(r);
    schedule();
  }
}

function detach(r: OrbRunner) {
  mounted.delete(r);
  ticking.delete(r);
  byElement.delete(r.svg);
  io?.unobserve(r.svg);
  r.destroy();
  if (mounted.size === 0) {
    document.removeEventListener('visibilitychange', onVisibility);
    motionQuery?.removeEventListener('change', onMotion);
    motionQuery = null;
    io?.disconnect();
    io = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
}

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

/**
 * ThinkingOrbsPill with the dots in SVG. Same props, same defaults, same
 * pill; swap the import and nothing else changes. No GPU needed.
 */
export default function SvgOrbsPill({
  label,
  style = LOOP_ID,
  showsPill = SHOWS_PILL,
  showsLabel = SHOWS_LABEL,
  speed = SPEED,
  reverse = REVERSE,
  startAt = START_AT,
  dotScale = DOT_SCALE,
  dots = KNOBS.n,
  spread = KNOBS.sp,
  perspective = KNOBS.pv,
  depthSize = KNOBS.dz,
  depthFade = KNOBS.df,
  dotOpacity = KNOBS.op,
  spin = KNOBS.sn,
  turn = KNOBS.yw / (Math.PI / 180),
  tilt = KNOBS.pc / (Math.PI / 180),
  scheme = SCHEME,
  accent = ACCENT_COLOR,
  dotColor = INK_DARK.dot,
  pill: pillDark = INK_DARK.pill,
  labelColor = INK_DARK.label,
  dotColorLight = INK_LIGHT.dot,
  pillLight = INK_LIGHT.pill,
  labelColorLight = INK_LIGHT.label,
  className,
  containerStyle,
  ball = BALL,
  fps = 0,
  render = DEFAULT_RENDER,
}: SvgOrbsPillProps) {
  const isDark = useOrbDark(scheme);
  const ink = isDark ? dotColor : dotColorLight;
  const pill = isDark ? pillDark : pillLight;
  const labelInk = isDark ? labelColor : labelColorLight;

  const index = useMemo(() => {
    const i = STYLES.findIndex((s) => s.id === style);
    return i < 0 ? LOOP_INDEX : i;
  }, [style]);
  const word = label ?? STYLES[index].label;

  const dot = useMemo(() => orbInk(ink), [ink]);
  const acc = useMemo(() => orbInk(accent), [accent]);
  const settings = useMemo<Settings>(() => ({
    index,
    key: index + '|' + ink + '|' + accent,
    speed,
    reverse,
    startAt,
    dotScale,
    knobs: {
      n: dots,
      sp: spread,
      pv: perspective,
      dz: depthSize,
      df: depthFade,
      yw: turn * (Math.PI / 180),
      pc: tilt * (Math.PI / 180),
      sn: spin,
      op: dotOpacity,
    },
    dot,
    accent: acc,
    ball,
    fps: fps > 0 ? fps : 0,
    render: render === 'circles' ? 'circles' : 'paths',
  }), [index, ink, accent, speed, reverse, startAt, dotScale, dots, spread, perspective, depthSize, depthFade,
    turn, tilt, spin, dotOpacity, dot, acc, ball, fps, render]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const settingsRef = useRef<Settings>(settings);
  const runnerRef = useRef<OrbRunner | null>(null);

  /* A new settings object means a real change (it is memoised), so only
     then does a still orb draw again. Parent re-renders cost nothing. */
  useLayoutEffect(() => {
    settingsRef.current = settings;
    const r = runnerRef.current;
    if (r) wake(r);
  }, [settings]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = new OrbRunner(svg, () => settingsRef.current);
    runnerRef.current = r;
    attach(r);
    return () => {
      detach(r);
      if (runnerRef.current === r) runnerRef.current = null;
    };
  }, []);

  const field: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    minHeight: ball + (showsPill ? PAD_TOP + PAD_BOTTOM : 0),
    ...containerStyle,
  };

  return (
    <div className={className} style={field}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: GAP,
          paddingTop: showsPill ? PAD_TOP : 0,
          paddingBottom: showsPill ? PAD_BOTTOM : 0,
          paddingLeft: showsPill ? (showsLabel ? PAD_LEFT : PAD_TOP) : 0,
          paddingRight: showsPill ? (showsLabel ? PAD_RIGHT : PAD_TOP) : 0,
          borderRadius: 999,
          background: showsPill ? pill : 'transparent',
        }}
      >
        {/* Children are written by the runner, not React: the svg is
            rendered empty and React never reconciles inside it. */}
        <svg
          ref={svgRef}
          width={ball}
          height={ball}
          viewBox={`0 0 ${ball} ${ball}`}
          aria-hidden="true"
          style={{ display: 'block', width: ball, height: ball, overflow: 'hidden', contain: 'strict' }}
        />
        {showsPill && showsLabel ? (
          <span
            style={{
              fontFamily: FONT,
              fontSize: FONT_SIZE,
              lineHeight: 1,
              color: labelInk,
              opacity: LABEL_OPACITY,
              whiteSpace: 'nowrap',
            }}
          >
            {word}
          </span>
        ) : null}
      </div>
    </div>
  );
}
