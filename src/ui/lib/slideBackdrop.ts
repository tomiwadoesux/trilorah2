/*
 * A dark, photographic stand-in for a slide's background.
 *
 * The projector puts words over a dimmed picture — a dark image, an overlay,
 * the text. A thumbnail that stands in for that render has to look like the
 * same thing, and a flat colour wash does not: it reads as an empty tile,
 * not as a slide with nothing loaded yet.
 *
 * There are no image assets in the app and the free tier runs with no
 * network, so the picture is drawn rather than fetched, as a small SVG.
 * Deterministic — the same seed is the same picture — because a card that
 * changes its own background on every render is not a preview of anything.
 *
 * Two styles, one palette. `facets` is pure gradients and polygons with no
 * filter at all, which the GPU composites for nothing; `smoke` runs fractal
 * noise, and it is the one to drop if a church laptop ever shows it. Built
 * once per (style, seed) and cached.
 */

export type BackdropStyle = 'smoke' | 'facets';

/**
 * The two that survived a side-by-side of six. Aurora, bokeh, a light leak
 * and a dusk horizon were drawn and judged against these on the songs grid
 * and did not earn a place; they are in git if a theme ever wants one.
 */
export const BACKDROP_STYLES: readonly BackdropStyle[] = ['smoke', 'facets'];

/**
 * Which drawing a kind of content wears. Not a per-card choice — the style
 * IS the category: a grid of faceted planes is music and a soft smoky frame
 * is scripture, so an operator glancing at the screen knows what they are
 * looking at before reading a word of it. Alternating them inside one grid
 * looked livelier and said nothing.
 */
export const BACKDROP_BY_CONTENT = {
  scripture: 'smoke',
  music: 'facets',
  /*
   * Presentations borrow the faceted drawing rather than getting a third of
   * their own, and the rule above is the reason it is safe to: the style is
   * the category so that a glance TELLS THEM APART, and a deck's wash is only
   * ever seen inside the presentations tab, where there is nothing to tell it
   * apart from. It also lasts seconds — the moment page one converts, a real
   * render replaces it — and a whole new backdrop style earning its keep for
   * a few seconds of a progress state is not a trade worth making. If a third
   * drawing is ever made, this is the line that adopts it.
   */
  presentation: 'facets',
} as const satisfies Record<string, BackdropStyle>;

interface Mood {
  /** The dark ground most of the frame settles into. */
  tint: string;
  /** The lit region — "where the light is". */
  glow: string;
  /**
   * What the smoke itself is. A pale relative of `glow`, never `glow` — lit
   * smoke SCATTERS light, so it is brighter than the air it hangs in.
   * Tinting the wisps with the glow colour painted them the same colour as
   * the ground behind them and they disappeared.
   */
  haze: string;
}

/*
 * Deep, desaturated, all sitting well under the text. Varied enough that a
 * grid of them reads as different photographs and not one tile repeated.
 */
const MOODS: Mood[] = [
  { tint: '#070c18', glow: '#1f3f6e', haze: '#93b4e8' }, // night sky
  { tint: '#0e0806', glow: '#6b2e18', haze: '#e8a682' }, // ember
  { tint: '#060b09', glow: '#1c4436', haze: '#8fcfb4' }, // forest
  { tint: '#0a0712', glow: '#432e78', haze: '#b7a2ea' }, // violet
  { tint: '#09090b', glow: '#3d3d46', haze: '#c2c6d0' }, // charcoal
  { tint: '#080d11', glow: '#2a5462', haze: '#8fc2d4' }, // sea
  { tint: '#100c06', glow: '#6a4c1e', haze: '#e6cd93' }, // amber
];

const W = 320;
const H = 180;

/* A tiny deterministic generator, so bokeh and facets scatter the same way
   for the same seed. Not Math.random, for the reason at the top. */
function rng(seed: number): () => number {
  let x = (seed * 2654435761 + 1013904223) >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const wrap = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;

/* The floor every style shares: a bottom-weighted vignette, so the foot of
   the frame — where the text ends and the ring is — is always the darkest. */
const VIGNETTE_DEF = `<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient>`;
const VIGNETTE = `<rect width="${W}" height="${H}" fill="url(#v)"/>`;

/* ------------------------------------------------------------------ */

/**
 * Lit smoke over a glow — the scripture frame.
 *
 * Three things make it read as a photograph rather than as noise on a
 * gradient. The wisps are TINTED with the mood's pale `haze` (feFlood +
 * composite) instead of left white, so the frame keeps its colour instead of
 * greying out — pale, not the glow itself, because smoke scatters light and
 * has to be brighter than the air it hangs in. Their alpha ramp is steep, so there are clean dark gaps
 * between them — flat haze everywhere is fog, and fog has no shape. And they
 * are MASKED to the lit region, so the smoke lives where the light is and
 * the corners stay clean black, which is what a lens actually does.
 *
 * Held back on purpose — both the glow and the wisps sit over black at
 * reduced opacity, so the frame is a dark ground with a suggestion of light
 * and smoke in it, not a picture competing with a paragraph of scripture.
 * The two opacities (the #g rect, the #c rect) are the knobs.
 *
 * Still one turbulence pass, plus a flood and a composite that cost nothing
 * next to it. No blur: at this frequency four octaves are already soft, and
 * a Gaussian here would double the price of the only filtered frame left in
 * the app.
 */
function smoke(m: Mood, seed: number): string {
  const cx = 26 + ((seed * 37) % 48);
  const cy = 20 + ((seed * 53) % 40);
  return wrap(
    `<radialGradient id="g" cx="${cx}%" cy="${cy}%" r="78%"><stop offset="0" stop-color="${m.glow}"/><stop offset="0.5" stop-color="${m.tint}"/><stop offset="1" stop-color="#000"/></radialGradient>
<radialGradient id="mk" cx="${cx}%" cy="${cy}%" r="72%"><stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="lit"><rect width="${W}" height="${H}" fill="url(#mk)"/></mask>
<filter id="c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.011 0.019" numOctaves="4" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.85 0.85 0.85 0 -0.92" result="a"/><feFlood flood-color="${m.haze}" result="f"/><feComposite in="f" in2="a" operator="in"/></filter>
<filter id="n" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${seed + 1}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.2 0.2 0.2 0 -0.02"/></filter>${VIGNETTE_DEF}`,
    `<rect width="${W}" height="${H}" fill="#000"/><rect width="${W}" height="${H}" fill="url(#g)" opacity="0.7"/><g mask="url(#lit)"><rect width="${W}" height="${H}" filter="url(#c)" opacity="0.18"/></g><rect width="${W}" height="${H}" filter="url(#n)" opacity="0.22"/>${VIGNETTE}`,
  );
}

/** Low-poly facets: a few big translucent planes catching the light. */
function facets(m: Mood, seed: number): string {
  const r = rng(seed);
  const polys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const x = r() * W;
    const y = r() * H;
    const s = 90 + r() * 160;
    const a = r() * Math.PI * 2;
    const pts = [0, 1, 2]
      .map((k) => {
        const ang = a + (k * Math.PI * 2) / 3 + (r() - 0.5) * 0.6;
        return `${(x + Math.cos(ang) * s).toFixed(0)},${(y + Math.sin(ang) * s).toFixed(0)}`;
      })
      .join(' ');
    const light = r() > 0.5;
    polys.push(
      `<polygon points="${pts}" fill="${light ? '#fff' : '#000'}" opacity="${(light ? 0.03 + r() * 0.05 : 0.15 + r() * 0.2).toFixed(3)}"/>`,
    );
  }
  return wrap(
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.glow}"/><stop offset="0.6" stop-color="${m.tint}"/><stop offset="1" stop-color="#000"/></linearGradient>${VIGNETTE_DEF}`,
    `<rect width="${W}" height="${H}" fill="url(#g)"/>${polys.join('')}${VIGNETTE}`,
  );
}

const BUILDERS: Record<BackdropStyle, (m: Mood, seed: number) => string> = { smoke, facets };

const cache = new Map<string, string>();

/**
 * The backdrop for seed `n` in `style` — a data URI, stable across calls.
 * Pass a card's index and neighbouring cards come out as different pictures.
 */
export function slideBackdrop(seed: number, style: BackdropStyle = 'smoke'): string {
  const key = `${style}:${Math.floor(seed)}`;
  let uri = cache.get(key);
  if (!uri) {
    const mood = MOODS[Math.abs(Math.floor(seed)) % MOODS.length];
    const svg = BUILDERS[style](mood, Math.floor(seed));
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    cache.set(key, uri);
  }
  return uri;
}
