#!/usr/bin/env node
/*
 * Screenshot and drive an already-running Electron window over CDP.
 *
 * main.ts opens the remote-debugging port when TRI_DEBUG_PORT is set — the
 * comment there calls this out as a dev affordance and this is the thing that
 * uses it. Nothing in the app reads this file; it exists so a change to a
 * surface can be LOOKED at rather than reasoned about.
 *
 *   TRI_DEBUG_PORT=9222 SANDBOX=1 npm start        # in one terminal
 *   node scripts/shot.mjs --out /tmp/live.png      # in another
 *
 * Targets are matched loosely by title or url, because Electron gives the
 * sandbox and the app and every projector output their own target and the
 * one you want is rarely the first.
 *
 *   --target design|app|output|<substring>   which window (default: design)
 *   --out <path>                             where the png goes
 *   --eval "<js>"                            run JS in the page first
 *   --click "<css selector>"                 click something, then shoot
 *   --hover "<css selector>"                 move the real pointer over it, then shoot
 *   --frames <n>                             force n frames first (see below)
 *   --wait <ms>                              settle time before the shot
 *   --list                                   just print the targets
 *
 * CDP is spoken directly over a WebSocket rather than through a driver
 * library: the whole protocol surface needed here is three commands, and a
 * headless-browser dependency for that is a lot of weight to carry for a
 * screenshot.
 */

import { writeFileSync } from 'node:fs';
import WebSocket from 'ws';

const PORT = process.env.TRI_DEBUG_PORT || '9222';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}

/* The three names that matter, so the common cases are a word rather than a
   substring anyone has to remember. Anything else is used as given. */
const ALIASES = {
  design: 'design.html',
  app: 'index.html',
  output: 'output.html',
};

async function targets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  if (!res.ok) throw new Error(`devtools endpoint said ${res.status}`);
  return (await res.json()).filter((t) => t.type === 'page');
}

/* One request/response pair per call, with the id matched back — CDP
   multiplexes everything over the one socket and replies out of order. */
function rpc(ws, seq, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = seq.next++;
    const onMessage = (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.id !== id) return;
      ws.off('message', onMessage);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
    };
    ws.on('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const list = await targets();

  if (arg('list')) {
    for (const t of list) console.log(`${t.title}\n  ${t.url}\n`);
    return;
  }

  const want = String(arg('target', 'design'));
  const needle = (ALIASES[want] || want).toLowerCase();
  const target =
    list.find((t) => t.url.toLowerCase().includes(needle)) ||
    list.find((t) => t.title.toLowerCase().includes(needle));

  if (!target) {
    console.error(`no window matching "${want}". open ones:`);
    for (const t of list) console.error(`  ${t.title} — ${t.url}`);
    process.exit(1);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  const seq = { next: 1 };
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  const js = arg('eval');
  if (typeof js === 'string') {
    const r = await rpc(ws, seq, 'Runtime.evaluate', {
      expression: js,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) console.error('eval threw:', r.exceptionDetails.text);
    else console.log('eval →', JSON.stringify(r.result?.value));
  }

  const click = arg('click');
  if (typeof click === 'string') {
    /* Dispatched as a real click on the element rather than as synthetic
       mouse events at a coordinate: React listens for click, and a
       coordinate would have to survive whatever moved since it was read. */
    const r = await rpc(ws, seq, 'Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(click)});
        if (!el) return 'not found';
        el.click();
        return 'clicked';
      })()`,
      returnByValue: true,
    });
    console.log(`click ${click} →`, r.result?.value);
  }

  const hover = arg('hover');
  if (typeof hover === 'string') {
    /* A real pointer move through CDP, not a synthetic mouseover: :hover
       styles only follow the platform's own pointer. */
    const r = await rpc(ws, seq, 'Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(hover)});
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      })()`,
      returnByValue: true,
    });
    const at = r.result?.value;
    if (!at) console.log(`hover ${hover} → not found`);
    else {
      await rpc(ws, seq, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
      console.log(`hover ${hover} → ${Math.round(at.x)},${Math.round(at.y)}`);
    }
  }

  /* A window behind other windows produces no frames, so CSS transitions
     and requestAnimationFrame never advance and every shot shows the start
     state. Each capture forces a frame; n of them, spaced out, carry an
     animation through — in this session, so a --hover is still in effect. */
  const frames = Number(arg('frames', 0));
  for (let i = 0; i < frames; i++) {
    await rpc(ws, seq, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await sleep(80);
  }

  await sleep(Number(arg('wait', 400)));

  const shot = await rpc(ws, seq, 'Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const out = String(arg('out', 'shot.png'));
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`${target.title} → ${out}`);
  ws.close();
}

main().catch((e) => {
  console.error(String(e.message || e));
  console.error(`\nis the app up with the port open?\n  TRI_DEBUG_PORT=${PORT} SANDBOX=1 npm start`);
  process.exit(1);
});
