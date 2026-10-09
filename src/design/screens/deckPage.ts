/*
 * A stand-in for one page of an imported deck.
 *
 * The real thing is a PNG that LibreOffice and pdftoppm produced from the
 * operator's own file. There are none in the sandbox, so the page is drawn —
 * and drawn deliberately UNLIKE slideBackdrop, which is this app rendering a
 * slide of its own. A page lifted out of a PowerPoint is a white ground, a
 * black heading and a red accent bar somebody chose in 2014, and the instant
 * the grid shows one the operator knows which cards Trilorah made and which
 * came out of an import. A stand-in dressed in our own output would have
 * hidden the one distinction these cards exist to make.
 *
 * One theme per deck, held across all its pages, because that is what a deck
 * is: a template with content poured through it. Deterministic and cached,
 * for the reason slideBackdrop gives — a card that redraws itself on every
 * render is not a preview of anything.
 */

const W = 320;
const H = 180;

const SANS = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, Times New Roman, serif';

interface Theme {
  /** Gradients the ground needs. */
  defs: string;
  /** The full-bleed ground. */
  ground: string;
  /** Headings. */
  ink: string;
  /** Body and subtitle — never the heading colour, or the page has no order. */
  quiet: string;
  /** The rule and the bullet marks. The one colour a church deck commits to. */
  accent: string;
  family: string;
  /** A band across the top, the way the stock templates do it. */
  band: boolean;
}

/*
 * Four templates, picked to look like four different people's files. Two
 * light and two dark on purpose: a grid of decks that were all dark read as
 * one imported thing in different crops, and half the decks a church is
 * handed are white with black text.
 */
const THEMES: Theme[] = [
  {
    /* The default Office deck. */
    defs: '',
    ground: `<rect width="${W}" height="${H}" fill="#f5f4f1"/>`,
    ink: '#15171b',
    quiet: '#5d626b',
    accent: '#b03a2e',
    family: SANS,
    band: true,
  },
  {
    /* Navy and gold — the conference-session look. */
    defs: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#152744"/><stop offset="1" stop-color="#0a1424"/></linearGradient>`,
    ground: `<rect width="${W}" height="${H}" fill="url(#g)"/>`,
    ink: '#f2f5fa',
    quiet: '#a9b7ce',
    accent: '#d9b45a',
    family: SERIF,
    band: false,
  },
  {
    /* Paper and ink — bulletins and orders of service. */
    defs: '',
    ground: `<rect width="${W}" height="${H}" fill="#efe8da"/>`,
    ink: '#2b2013',
    quiet: '#6d5b43',
    accent: '#8a6a2f',
    family: SERIF,
    band: false,
  },
  {
    /* Charcoal minimal — whoever on the team owns a Mac. */
    defs: '',
    ground: `<rect width="${W}" height="${H}" fill="#1b1d21"/>`,
    ink: '#f0f1f3',
    quiet: '#99a0a8',
    accent: '#5aa9a0',
    family: SANS,
    band: false,
  },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Greedy wrap. SVG text does not wrap itself and a heading that ran off the
   right edge would be the one part of the drawing that never happens in a
   real deck — PowerPoint shrinks it to fit. */
function wrapText(raw: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of raw.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

interface BlockOptions {
  x: number;
  y: number;
  size: number;
  fill: string;
  family: string;
  max: number;
  weight?: number;
  lines?: number;
  tracking?: number;
}

function block(raw: string, o: BlockOptions): { svg: string; lines: number } {
  const ls = wrapText(raw, o.max).slice(0, o.lines ?? 2);
  const step = Math.round(o.size * 1.2);
  const tspans = ls
    .map((l, i) => `<tspan x="${o.x}" dy="${i === 0 ? 0 : step}">${esc(l)}</tspan>`)
    .join('');
  return {
    svg: `<text x="${o.x}" y="${o.y}" font-family="${o.family}" font-size="${o.size}" font-weight="${o.weight ?? 400}" letter-spacing="${o.tracking ?? 0}" fill="${o.fill}">${tspans}</text>`,
    lines: ls.length,
  };
}

const wrap = (t: Theme, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${t.defs}</defs>${t.ground}${t.band ? `<rect width="${W}" height="6" fill="${t.accent}"/>` : ''}${body}</svg>`;

/*
 * Page one — the title slide. Set from the middle out: the title block is
 * placed so that one line and two lines both sit centred, rather than
 * pinning the first line and letting a long name push the rule off the foot.
 */
function titlePage(t: Theme, title: string, subtitle?: string): string {
  const guess = wrapText(title, 22).slice(0, 2).length;
  const top = guess > 1 ? 72 : 86;
  const head = block(title, {
    x: 26,
    y: top,
    size: 22,
    weight: 700,
    fill: t.ink,
    family: t.family,
    max: 22,
    tracking: -0.3,
  });
  const ruleY = top + (head.lines - 1) * 26 + 16;
  const sub = subtitle
    ? block(subtitle, { x: 26, y: ruleY + 24, size: 11, fill: t.quiet, family: t.family, max: 44, lines: 1 }).svg
    : '';
  return wrap(
    t,
    `${head.svg}<rect x="26" y="${ruleY}" width="38" height="2" fill="${t.accent}"/>${sub}`,
  );
}

/*
 * Every page after the first — a heading and bullets, which is what the
 * inside of a church deck is roughly always made of. The page number in the
 * corner is not decoration: it is the thing that tells the operator the card
 * is showing page nine of a real file and not a cover repeated.
 */
function bulletPage(t: Theme, heading: string, bullets: string[], page: number): string {
  const head = block(heading, {
    x: 26,
    y: 40,
    size: 15,
    weight: 700,
    fill: t.ink,
    family: t.family,
    max: 34,
    lines: 1,
  });
  const rows = bullets.slice(0, 4).map((b, i) => {
    const y = 76 + i * 24;
    return `<circle cx="30" cy="${y - 4}" r="2.5" fill="${t.accent}"/>${
      block(b, { x: 42, y, size: 11, fill: t.quiet, family: t.family, max: 42, lines: 1 }).svg
    }`;
  });
  return wrap(
    t,
    `${head.svg}<rect x="26" y="52" width="${W - 52}" height="1" fill="${t.accent}" opacity="0.35"/>${rows.join(
      '',
    )}<text x="${W - 20}" y="${H - 14}" font-family="${t.family}" font-size="8" fill="${t.quiet}" text-anchor="end">${page + 1}</text>`,
  );
}

/** What a deck's pages are made of. Page one is the title; the rest cycle. */
export interface DeckPageSpec {
  title: string;
  subtitle?: string;
  sections: { heading: string; bullets: string[] }[];
}

/* Include the content so edits and decks sharing a theme get their own image. */
const cache = new Map<string, string>();

/**
 * Page `page` of the deck seeded at `seed`, as a data URI, stable across
 * calls. Page 0 is the title slide; the rest walk the spec's sections.
 */
export function deckPage(seed: number, page: number, spec: DeckPageSpec): string {
  const key = JSON.stringify([seed, page, spec]);
  let uri = cache.get(key);
  if (!uri) {
    const theme = THEMES[Math.abs(Math.floor(seed)) % THEMES.length];
    let svg: string;
    if (page <= 0 || spec.sections.length === 0) {
      svg = titlePage(theme, spec.title, spec.subtitle);
    } else {
      const section = spec.sections[(page - 1) % spec.sections.length];
      svg = bulletPage(theme, section.heading, section.bullets, page);
    }
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    cache.set(key, uri);
  }
  return uri;
}
