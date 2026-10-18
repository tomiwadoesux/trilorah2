#!/usr/bin/env node
/*
 * Capture real Trilorah UI for the website's product showcase
 * (web/src/app/home/showcase, images in web/public/showcase).
 *
 * Every picture is the real app, not a drawing of it:
 *
 *   - the desktop app's LiveHost with sample data, served by
 *     scripts/hero-service-source.mts on http://127.0.0.1:5181/?phase=<phase>
 *   - the phone remote, public/mobile-remote.html, served with sample data
 *     by scripts/remote-preview.mjs on http://localhost:4777/remote
 *
 * Both servers must already be running; this script starts nothing but a
 * headless Chrome (scripts/lib/headless-chrome.mjs) on a throwaway profile.
 *
 * What it does to the app is what an operator would do: open a tab, put a
 * background on the wall, press a lyric card into the preview, open the
 * mobile menu. Sample pictures are put on the media shelf through the app's
 * own store (mediaLibrary.importMedia), using pictures already in the repo and
 * served by the fixture's dev server — the app's bundled starter photographs,
 * the website's landscape and stills of the website's mountain scene.
 * Nothing presses go live: a caught verse is shown waiting in the preview.
 *
 *   node scripts/capture-showcase.mjs                     # all of them
 *   node scripts/capture-showcase.mjs --only media-library,mobile-menu
 *   node scripts/capture-showcase.mjs --out-dir /tmp/showcase
 */

import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { launchChrome, sleep } from './lib/headless-chrome.mjs';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next !== undefined && !next.startsWith('--') ? next : true;
}

const APP = 'http://127.0.0.1:5181';
const REMOTE = 'http://localhost:4777/remote';
const OUT_DIR = resolve(typeof arg('out-dir') === 'string' ? arg('out-dir') : 'web/public/showcase');
const ONLY = typeof arg('only') === 'string' ? new Set(arg('only').split(',')) : null;

/* The app's window size the hero capture uses too. */
const APP_W = 1600;
const APP_H = 940;
/* The mobile menu's window: a 1440p monitor. At this size the live box is
   large enough that the verse's last two lines sit clear below the open
   menu instead of being cut through by its edge. */
const MENU_W = 2560;
const MENU_H = 1440;

/* ------------------------------------------------------------------ */
/* Sample service text — the fixture's own sentences, in its order.    */
/* ------------------------------------------------------------------ */

const SAY = {
  lyric: 'Amazing grace, how sweet the sound, that saved a wretch like me.',
  introduction: 'Church, being still does not mean there is no trouble. It means knowing who is with us in the middle of it.',
  allusion: 'God is our refuge and strength, a very present help in trouble.',
  reference: 'Psalm forty-six, verse one. God is our refuge and strength, a very present help in trouble.',
  noise: 'When life feels loud, we can bring that noise to God.',
  next: 'Next verse. Therefore will not we fear, though the earth be removed, and though the mountains be carried into the midst of the sea;',
  final: 'Psalm forty-six, verse ten. Be still, and know that I am God.',
};

/* The sermon up to "be still": Psalm 46:1 said, "next verse" said, then
   Psalm 46:10 said last — so the transcript carries all three marks. The
   fixture takes ?history= (finished lines) and ?spoken= (the line still
   being heard); an empty spoken leaves the last finished line in the
   caption strip, where the newest words are drawn. */
const SERMON_QUERY = {
  history: JSON.stringify([SAY.introduction, SAY.allusion, SAY.reference, SAY.noise, SAY.next, SAY.final]),
  spoken: '',
};

/* ------------------------------------------------------------------ */
/* Pictures already on this machine, over http                         */
/* ------------------------------------------------------------------ */

const PICTURES = {
  valley: `${APP}/src/assets/backgrounds/valley.jpg`,
  sunset: `${APP}/src/assets/backgrounds/sunset.jpg`,
  waterfall: `${APP}/src/assets/backgrounds/waterfall.jpg`,
  mountains: `${APP}/src/assets/backgrounds/mountains.jpg`,
  bay: `${APP}/src/assets/backgrounds/bay.jpg`,
  /* The fixture serves the website's dark landscape at this path itself. */
  landscape: `${APP}/hero-landscape/dark.webp`,
  /* The fixture's dev server serves the whole repo root, so the website's
     pictures and the mountain-scene stills in artifacts/ come from it too. */
  landscapeDay: `${APP}/web/public/hero-landscape/light.webp`,
  greenSlopes: `${APP}/artifacts/mountain-green-slopes.jpg`,
  mistyPeak: `${APP}/artifacts/mountain-rocky-lit-dark.jpg`,
  nightPeaks: `${APP}/artifacts/mountain-slow-clouds-night.jpg`,
};

const shelfItem = (id, label, url, collection, detail = 'from this laptop') => ({
  id, label, detail, url, collection, seed: 0, style: 'smoke', source: 'local', kind: 'photo',
});

/* ------------------------------------------------------------------ */
/* Page helpers                                                       */
/* ------------------------------------------------------------------ */

async function openApp(chrome, { phase, dpr = 2, width = APP_W, height = APP_H, query = {} }) {
  const page = await chrome.newPage({ width, height, dpr });
  const params = new URLSearchParams({ phase, ...query });
  await page.goto(`${APP}/?${params}`, { idleMs: 700, settleMs: 300 });
  await page.waitFor('[data-guide-area="operator"]', { timeoutMs: 20000 });
  await settle(page, 1200);
  return page;
}

/* Fonts, every <img> decoded, then a beat for transitions to land. */
async function settle(page, ms = 800) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) =>
        img.complete ? img.decode?.().catch(() => undefined) : new Promise((r) => { img.onload = img.onerror = r; }),
      ),
    );
    return true;
  });
  await sleep(ms);
}

/* Put pictures on the app's media shelf through its own store. */
async function shelve(page, items) {
  const ok = await page.evaluate(async (list) => {
    const library = await import('/src/design/screens/mediaLibrary.ts');
    return library.importMedia(list);
  }, items);
  if (!ok) throw new Error('the media shelf refused the sample pictures');
}

/*
 * Put a picture behind the words on the wall, the way an operator does it:
 * library → media → themes, then the card's "on the wall now" button. That
 * is chooseBackground(id, 'live'), which also sets it as the preview's
 * background. Leaves the library on `returnTo`.
 */
async function wallBackground(page, item, returnTo = 'library-scriptures') {
  await shelve(page, [{ ...item, collection: 'themes' }]);
  await page.click('[data-guide="library-media"]');
  await page.waitFor('[data-guide="media-view-themes"]');
  await page.click('[data-guide="media-view-themes"]');
  const wall = `[data-guide="media-wall"][aria-label="put ${item.label} on the wall now"]`;
  await page.waitFor(wall, { visible: false });
  await page.click(wall);
  await sleep(400);
  if (returnTo) await page.click(`[data-guide="${returnTo}"]`);
  await settle(page, 1200);
}

/* Union of several elements' boxes, in document CSS px, grown by `pad`. */
async function unionRect(page, selectors, pad = 0) {
  const r = await page.evaluate((sels) => {
    const boxes = sels.map((s) => {
      const el = document.querySelector(s);
      if (!el) throw new Error(`no element for ${s}`);
      return el.getBoundingClientRect();
    });
    const x = Math.min(...boxes.map((b) => b.left));
    const y = Math.min(...boxes.map((b) => b.top));
    const right = Math.max(...boxes.map((b) => b.right));
    const bottom = Math.max(...boxes.map((b) => b.bottom));
    return { x: x + scrollX, y: y + scrollY, width: right - x, height: bottom - y };
  }, selectors);
  return { x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

const out = (name) => resolve(OUT_DIR, `${name}.webp`);

/* The workspace to the right of the operator rail: preview, live, the
   library and the catches beside it. Measured, so a layout change moves
   the clip with it. */
async function workspaceRect(page, { bottom = null } = {}) {
  const r = await unionRect(page, ['section[data-guide-area="preview"]', 'section[data-guide-area="live"]', '[data-guide-area="library"]']);
  const viewport = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const top = r.y;
  const left = r.x;
  const right = viewport.w - 5;
  const end = bottom ?? viewport.h - 5;
  return { x: left, y: top, width: right - left, height: end - top };
}

/* ------------------------------------------------------------------ */
/* The captures                                                       */
/* ------------------------------------------------------------------ */

const CAPTURES = {
  /* Front of row 1: the preacher transcript as the sermon reaches "be
     still" — Psalms 46:1 and Psalms 46:10 marked where they were said, and
     the "Next verse" command marked between them. */
  async 'verse-transcript'(chrome) {
    const page = await openApp(chrome, { phase: 'last-staged', dpr: 3, query: SERMON_QUERY });
    await settle(page, 2500);
    /* The card plus the rail's own 5px of ground around it, so the words
       are not hard against the edge; the buttons under it are left out. */
    await page.screenshot({ out: out('verse-transcript'), selector: 'section.preaching-card', margin: 5 });
    /* The published file was then trimmed by hand: rows 100–218 (the tail of an
       earlier sentence, "present help in trouble.") were cut so the card opens on
       Psalms 46:1, leaving 900×1069. A fresh capture brings that line back; trim it
       again, or update ScriptureRow's height and scripture-row.css's crop. */
    return page;
  },

  /* Back of row 1: the operator workspace with Psalm 46:10 staged in the
     preview and waiting on go live, while 46:2 is still on the wall. */
  async 'verse-workspace'(chrome) {
    const page = await openApp(chrome, { phase: 'last-staged', dpr: 2, query: SERMON_QUERY });
    await wallBackground(page, shelfItem('hillside-morning', 'Hillside morning', PICTURES.landscapeDay, 'themes'));
    await page.screenshot({ out: out('verse-workspace'), clip: await workspaceRect(page) });
    return page;
  },

  /* Front of row 2: song search heard "Amazing grace" and found it — the
     catches pane down to the found song, nothing below. */
  async 'songs-catches'(chrome) {
    const page = await openApp(chrome, { phase: 'song-staged', dpr: 3 });
    await page.waitFor('section.catch-songs');
    const clip = await page.evaluate(() => {
      /* The catches pane itself, from its top to just under the found song.
         Its search field is left out: the field is wider than the pane and
         taking it whole would pull in the edge of the verse table beside it. */
      const pane = document.querySelector('.catches-pane[data-guide-area="catches"]').getBoundingClientRect();
      const found = document.querySelector('section.catch-songs').getBoundingClientRect();
      const left = Math.ceil(pane.left) + 1;
      const right = found.right + (found.left - left);
      return { x: left, y: pane.top, width: right - left, height: found.bottom + 22 - pane.top };
    });
    await settle(page, 600);
    await page.screenshot({ out: out('songs-catches'), clip });
    return page;
  },

  /* Back of row 2: Amazing Grace open in the songs library, verse 1 on the
     wall and verse 2 pressed into the preview, waiting. */
  async 'songs-workspace'(chrome) {
    const page = await openApp(chrome, { phase: 'song-live', dpr: 2 });
    await wallBackground(page, shelfItem('starter-valley', 'Yosemite valley', PICTURES.valley, 'themes', 'Jon Sullivan · public domain'), 'library-songs');
    await page.waitFor('[data-guide="song-slide"][aria-label="Preview Verse 2"]');
    await page.click('[data-guide="song-slide"][aria-label="Preview Verse 2"]');
    await settle(page, 1200);
    const cards = await unionRect(page, ['article.song-section-card']);
    const clip = await workspaceRect(page, { bottom: cards.y + cards.height + 28 });
    await page.screenshot({ out: out('songs-workspace'), clip });
    return page;
  },

  /* Back of row 3: the library's media tab, zoomed in — a full page of the
     media shelf (the app pages it five pictures at a time). */
  async 'media-library'(chrome) {
    /* A little taller than the others, so a whole page of the bento fits
       without the rail scrolling. */
    const page = await openApp(chrome, { phase: 'image-ready', dpr: 3, height: 975 });
    await shelve(page, [
      shelfItem('show-valley', 'Yosemite valley', PICTURES.valley, 'media', 'Jon Sullivan · public domain'),
      shelfItem('hero-landscape', 'Quiet landscape', PICTURES.landscape, 'media', 'sample service image'),
      shelfItem('show-sunset', 'Sunset over the sea', PICTURES.sunset, 'media', 'Deshna Subramanian · CC0'),
      shelfItem('show-waterfall', 'Forest waterfall', PICTURES.waterfall, 'media', 'Martin Eklund · CC0'),
      shelfItem('show-mountains', 'Yosemite mountains', PICTURES.mountains, 'media', 'Dexter Perkins · CC0'),
      shelfItem('show-bay', 'Bellingham bay', PICTURES.bay, 'media', 'US EPA · public domain'),
      shelfItem('show-landscape-day', 'Hillside morning', PICTURES.landscapeDay, 'media'),
      shelfItem('show-green-slopes', 'Green slopes', PICTURES.greenSlopes, 'media'),
      shelfItem('show-misty-peak', 'Misty peak', PICTURES.mistyPeak, 'media'),
      shelfItem('show-night-peaks', 'Night peaks', PICTURES.nightPeaks, 'media'),
    ]);
    await page.click('[data-guide="library-media"]');
    await page.waitFor('[data-guide="media-card"]');
    await settle(page, 1500);
    const clip = await unionRect(page, ['[data-guide-area="library"]', '[data-guide-area="media"]']);
    await page.screenshot({ out: out('media-library'), clip });
    return page;
  },

  /* Back of row 5: the header's mobile menu open over the live pane, with
     the pointer on "Mobile remote". */
  async 'mobile-menu'(chrome) {
    /* A larger window than the others (MENU_W), so the verse reads beside
       and below the open menu. */
    const page = await openApp(chrome, { phase: 'last-live', dpr: 3, width: MENU_W, height: MENU_H, query: SERMON_QUERY });
    await wallBackground(page, shelfItem('starter-valley', 'Yosemite valley', PICTURES.valley, 'themes', 'Jon Sullivan · public domain'));
    /* A pointer press, not a DOM click: opened from the keyboard the menu
       rings its first row as focused, and the picture would show two rows lit. */
    await page.mouseClick('[data-guide="mobile-tools"]');
    await page.waitFor('[data-guide="mobile-remote"]');
    await sleep(500);
    await page.hover('[data-guide="mobile-remote"]');
    await settle(page, 900);
    const live = await unionRect(page, ['section[data-guide-area="live"]']);
    const right = await page.evaluate(() => innerWidth);
    const clip = { x: live.x, y: 0, width: right - live.x, height: live.y + live.height };
    await page.screenshot({ out: out('mobile-menu'), clip });
    return page;
  },

  /* Front of row 5: the real phone remote, paired (a mock token skips the
     pairing screen on the preview server). */
  async 'phone-remote'(chrome) {
    const page = await chrome.newPage({ width: 390, height: 844, dpr: 3, mobile: true });
    await page.goto(REMOTE, { idleMs: 600, settleMs: 300 });
    await page.evaluate(() => { localStorage.setItem('trilorah.remote.token', 'mock-token'); return true; });
    await page.reload({ idleMs: 800, settleMs: 300 });
    await settle(page, 2000);
    await page.screenshot({ out: out('phone-remote') });
    return page;
  },

  /* Optional: the dashboard's outputs card ("floor plan"). The fixture has
     no outputs engine, so an engine-shaped status is answered through
     window.api.getOutputsStatus, using the displays of the app's own sample
     (outputs/types.ts SAMPLE): wall, stream and stage on their displays,
     the timer output switched off. Sample data, not a real room. */
  async 'outputs-tile'(chrome) {
    const page = await openApp(chrome, { phase: 'last-live', dpr: 3, query: SERMON_QUERY });
    await page.evaluate(() => {
      const status = {
        displays: [
          { id: 1, name: 'this laptop', w: 1512, h: 982, primary: true },
          { id: 2, name: 'Epson EB-2247U', w: 1920, h: 1080, primary: false },
          { id: 3, name: 'BlackMagic HDMI', w: 1920, h: 1080, primary: false },
          { id: 4, name: 'Dell P2419H', w: 1920, h: 1080, primary: false },
        ],
        outputs: [
          { id: 'main', role: 'projector', open: true, displayId: 2, fullscreen: true, chosenDisplayId: null },
          { id: 'alternate', role: 'stream', open: true, displayId: 3, fullscreen: true, chosenDisplayId: null },
          { id: 'third', role: 'stage', open: true, displayId: 4, fullscreen: true, chosenDisplayId: null },
          { id: 'timer', role: 'timer', open: false, displayId: null, fullscreen: false, chosenDisplayId: null, disabled: true },
        ],
        screenState: 'live',
      };
      window.api.getOutputsStatus = async () => status;
      return true;
    });
    await page.click('[data-guide="view-dashboard"]');
    await page.waitFor('[data-guide="dashboard-outputs"]');
    await settle(page, 2000);
    await page.screenshot({ out: out('outputs-tile'), selector: '[data-guide="dashboard-outputs"]' });
    return page;
  },
};

/* ------------------------------------------------------------------ */

await mkdir(OUT_DIR, { recursive: true });
const chrome = await launchChrome();
let failed = 0;
try {
  for (const [name, capture] of Object.entries(CAPTURES)) {
    if (ONLY && !ONLY.has(name)) continue;
    try {
      const page = await capture(chrome);
      await page.close();
      console.log(out(name));
    } catch (error) {
      failed += 1;
      console.error(`${name}: ${error.message}`);
    }
  }
} finally {
  await chrome.close();
}
if (failed) process.exitCode = 1;
