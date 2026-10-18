#!/usr/bin/env node
/*
 * Screenshot a web page (or one element of it) with headless system Chrome.
 *
 *   node scripts/shot-web.mjs --url http://localhost:3003/home --selector '#scripture' --out /tmp/row.png
 *   node scripts/shot-web.mjs --url http://localhost:3003/home --width 390 --full --out /tmp/home-390.png
 *
 *   --url <url>          page to load (required)
 *   --selector <css>     scroll it into view, wait for the reveal, shoot its box
 *   --margin <px>        extra CSS px around the selector's box (default 16)
 *   --width <px>         viewport width (default 1440); height is 900 (or --height)
 *   --height <px>        viewport height (default 900)
 *   --dpr <n>            deviceScaleFactor (default 2)
 *   --full               the whole page instead of the viewport
 *   --wait <ms>          extra settle time before the shot (default 1600 with --selector, 600 otherwise)
 *   --out <path>         .png, .webp or .jpg (default: scratch png in the OS temp dir)
 *
 * Prints the output path. Chrome runs on a throwaway profile that is removed
 * on exit, so it never shares the owner's own Chrome data.
 */

import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { launchChrome, sleep } from './lib/headless-chrome.mjs';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next !== undefined && !next.startsWith('--') ? next : true;
}

const url = arg('url');
if (typeof url !== 'string') {
  console.error('usage: node scripts/shot-web.mjs --url <url> [--selector <css>] [--width 1440] [--dpr 2] [--full] [--out file.png]');
  process.exit(2);
}
const selector = typeof arg('selector') === 'string' ? arg('selector') : null;
const width = Number(arg('width', 1440));
const height = Number(arg('height', 900));
const dpr = Number(arg('dpr', 2));
const full = arg('full') === true;
const margin = Number(arg('margin', 16));
const wait = Number(arg('wait', selector ? 1600 : 600));
const out = resolve(typeof arg('out') === 'string' ? arg('out') : join(tmpdir(), `shot-web-${Date.now()}.png`));

const chrome = await launchChrome();
try {
  const page = await chrome.newPage({ width, height, dpr, mobile: width < 768 });
  await page.goto(url, { idleMs: 700 });

  if (full) {
    /* Walk down the page once so every scroll-triggered reveal fires before
       the whole-page capture, then return to the top. */
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += Math.round(height * 0.6)) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await sleep(120);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(wait);
    await page.screenshot({ out, full: true });
  } else if (selector) {
    await page.waitFor(selector, { visible: false });
    await page.scrollIntoView(selector);
    await sleep(wait);
    /* The rect is read after the reveal, so a translateY entrance has landed. */
    await page.screenshot({ out, selector, margin });
  } else {
    await sleep(wait);
    await page.screenshot({ out });
  }
  console.log(out);
} finally {
  await chrome.close();
}
