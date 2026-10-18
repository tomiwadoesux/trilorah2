/*
 * Drawing a catch's signal (owner, 2026-10-17): light round the edge of the
 * screen and a flash across it, after the one an iPhone shows when Siri
 * comes up. It is there to be caught out of the corner of the eye, so each
 * kind moves differently as well as being its own colour — the edge of
 * vision is good at movement and poor at colour.
 *
 * Plain DOM and the Web Animations API, so one copy draws inside the app's
 * window and in the see-through window main opens over the whole screen
 * (signal.html). Only opacity, transform and two registered angles move.
 * The names of the three are in shared/catchSignal.ts.
 */
import { SIGNAL_MS, type CatchSignal } from '../../shared/catchSignal';

const COLOURS: Record<CatchSignal, readonly [string, string, string]> = {
  sweep: ['#FFB83D', '#FF9416', '#FFE08A'],
  buzz: ['#3D8BFF', '#5BC0FF', '#6F7BFF'],
  slant: ['#FF5FA8', '#FF8AC4', '#E95BE0'],
};

const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

/* The edge's colours turn, and the slant's spread grows, as angles — which
   only animate once the browser knows they are angles. */
let registered = false;
function registerAngles() {
  if (registered || typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') return;
  registered = true;
  for (const name of ['--signal-turn', '--signal-spread']) {
    try {
      CSS.registerProperty({ name, syntax: '<angle>', inherits: true, initialValue: '0deg' });
    } catch {
      /* Already registered by an earlier copy of this module (a hot reload). */
    }
  }
}

/* A ring: the padding is the only part the mask lets through. */
const RING_MASK = 'mask-image:linear-gradient(#000 0 0),linear-gradient(#000 0 0);mask-clip:content-box,border-box;mask-composite:exclude;';
const TURNING = 'conic-gradient(from var(--signal-turn),var(--signal-c1),var(--signal-c2),var(--signal-c3),var(--signal-c1))';
/* Lit from the bottom-right corner both ways round, the fade at each tip
   closing to nothing as the two ends meet at the top left. The fade is set
   on each ring because it reads the spread, which moves on their parent. */
const FROM_CORNER = '--signal-fade:calc(24deg - var(--signal-spread) * 0.1333);'
  + 'background:conic-gradient(from var(--signal-corner),var(--signal-c3) 0deg,var(--signal-c1) var(--signal-spread),'
  + 'transparent calc(var(--signal-spread) + var(--signal-fade)),transparent calc(360deg - var(--signal-spread) - var(--signal-fade)),'
  + 'var(--signal-c1) calc(360deg - var(--signal-spread)),var(--signal-c3) 360deg);';

interface Size {
  w: number;
  h: number;
  /** The soft band's width, its blur, and the fine line's width. */
  band: number;
  blur: number;
  line: number;
}

function sizeOf(host: HTMLElement): Size {
  const w = host.clientWidth || window.innerWidth;
  const h = host.clientHeight || window.innerHeight;
  /* Wider on a big screen, and the blur kept near 20px: above that it gets
     expensive, and some church computers draw without a graphics card. */
  const band = Math.round(Math.max(10, Math.min(18, Math.min(w, h) * 0.018)));
  return { w, h, band, blur: Math.round(band * 1.1), line: Math.max(2, Math.round(band / 6)) };
}

function div(parent: HTMLElement, css: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;pointer-events:none;${css}`;
  parent.appendChild(el);
  return el;
}

/** The light round the edge: a soft band, and a fine bright line over it. */
function edge(layer: HTMLElement, size: Size, fill: string): HTMLDivElement {
  const light = div(layer, 'inset:0;opacity:0');
  const soft = div(light, `inset:0;filter:blur(${size.blur}px)`);
  div(soft, `inset:0;box-sizing:border-box;padding:${size.band}px;${fill};${RING_MASK}`);
  div(light, `inset:0;box-sizing:border-box;padding:${size.line}px;${fill};${RING_MASK}`);
  return light;
}

const BAND = 'background:linear-gradient(90deg,transparent,var(--signal-c1),transparent);opacity:0';

/** A band of light travelling from one place to another, brightest on the way. */
const crossing = (from: string, to: string): Keyframe[] => [
  { transform: from, opacity: 0 },
  { opacity: 0.32, offset: 0.3 },
  { opacity: 0.28, offset: 0.75 },
  { transform: to, opacity: 0 },
];

/** A flash across the screen, right to left. */
function flash(layer: HTMLElement, out: Animation[], delay: number) {
  const band = div(layer, `top:0;bottom:0;left:100%;width:40%;${BAND}`);
  out.push(band.animate(crossing('translateX(0)', 'translateX(-350%)'), { duration: 650, delay, easing: OUT, fill: 'backwards' }));
}

type Draw = (layer: HTMLElement, size: Size) => Animation[];

const MOVES: Record<CatchSignal, Draw> = {
  sweep(layer, size) {
    const out: Animation[] = [];
    flash(layer, out, 0);
    const light = edge(layer, size, `background:${TURNING}`);
    const timing = { duration: SIGNAL_MS.sweep, easing: 'ease-out' };
    out.push(light.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], timing));
    out.push(light.animate([{ '--signal-turn': '0deg' }, { '--signal-turn': '360deg' }], timing));
    return out;
  },
  buzz(layer, size) {
    const out: Animation[] = [];
    flash(layer, out, 0);
    flash(layer, out, 330);
    const light = edge(layer, size, `background:${TURNING}`);
    out.push(light.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0.12, offset: 0.34 }, { opacity: 1, offset: 0.48 }, { opacity: 0 }], { duration: SIGNAL_MS.buzz }));
    out.push(light.animate([{ '--signal-turn': '0deg' }, { '--signal-turn': '200deg' }], { duration: SIGNAL_MS.buzz }));
    return out;
  },
  slant(layer, size) {
    const out: Animation[] = [];
    const { w, h } = size;
    /* The band runs square to the diagonal, from past the bottom-right
       corner to past the top-left one. */
    const diagonal = Math.hypot(w, h);
    const bandW = Math.round(w * 0.4);
    const bandH = Math.round(diagonal * 2);
    const angle = ((Math.atan2(-h, -w) * 180) / Math.PI).toFixed(2);
    const reach = Math.round(diagonal / 2 + bandW / 2);
    const band = div(layer, `left:${(w - bandW) / 2}px;top:${(h - bandH) / 2}px;width:${bandW}px;height:${bandH}px;${BAND}`);
    out.push(band.animate(crossing(`rotate(${angle}deg) translateX(${-reach}px)`, `rotate(${angle}deg) translateX(${reach}px)`), { duration: 760, easing: OUT, fill: 'backwards' }));
    /* Where the bottom-right corner sits on the ring, measured from the top. */
    layer.style.setProperty('--signal-corner', `${(180 - (Math.atan2(w, h) * 180) / Math.PI).toFixed(2)}deg`);
    const light = edge(layer, size, FROM_CORNER);
    out.push(light.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: SIGNAL_MS.slant, easing: 'ease-out' }));
    out.push(light.animate([{ '--signal-spread': '0deg' }, { '--signal-spread': '180deg' }], { duration: 1000, easing: OUT, fill: 'forwards' }));
    return out;
  },
};

/* Reduced motion: the edge lights and goes, in its colour, without moving. */
const still: Draw = (layer, size) => {
  const light = edge(layer, size, `background:${TURNING}`);
  return [light.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { opacity: 0.9, offset: 0.7 }, { opacity: 0 }], { duration: 1200 })];
};

const playing = new WeakMap<HTMLElement, () => void>();

/**
 * Play one signal over `host`, which should cover the area to light (the
 * window, or the screen). A second signal on the same host replaces the
 * first. Resolves when the last frame has gone.
 */
export function playSignal(host: HTMLElement, signal: CatchSignal): Promise<void> {
  playing.get(host)?.();
  registerAngles();
  const size = sizeOf(host);
  const layer = div(host, 'inset:0;overflow:hidden');
  layer.setAttribute('aria-hidden', 'true');
  COLOURS[signal].forEach((colour, i) => layer.style.setProperty(`--signal-c${i + 1}`, colour));
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animations = (reduce ? still : MOVES[signal])(layer, size);
  return new Promise<void>((resolve) => {
    const stop = () => {
      animations.forEach((a) => a.cancel());
      layer.remove();
      if (playing.get(host) === stop) playing.delete(host);
      resolve();
    };
    playing.set(host, stop);
    void Promise.allSettled(animations.map((a) => a.finished)).then(stop);
  });
}
