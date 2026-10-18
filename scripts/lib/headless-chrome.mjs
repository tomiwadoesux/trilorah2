/*
 * A small headless Chrome driver, spoken over CDP directly.
 *
 * Same idea as scripts/shot.mjs: the protocol surface a screenshot needs is a
 * handful of commands, so this talks to the browser over the 'ws' package
 * instead of pulling in a driver library. The browser is the system Chrome,
 * started headless against a throwaway profile so nothing here touches the
 * owner's own Chrome data, and the profile is removed again on the way out.
 *
 *   const chrome = await launchChrome();
 *   try {
 *     const page = await chrome.newPage({ width: 1440, height: 900, dpr: 2 });
 *     await page.goto('http://localhost:3003/home');
 *     await page.screenshot({ out: '/tmp/home.webp', selector: '#scripture' });
 *   } finally {
 *     await chrome.close();
 *   }
 */

import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, extname } from 'node:path';
import WebSocket from 'ws';

export const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Every live browser this process started, so an exit or a crash can still
   kill them and take their profiles with them. */
const running = new Set();
let exitHooked = false;

function hookExit() {
  if (exitHooked) return;
  exitHooked = true;
  const killAll = () => {
    for (const browser of running) browser.killSync();
  };
  process.on('exit', killAll);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      killAll();
      process.exit(130);
    });
  }
  process.on('uncaughtException', (error) => {
    console.error(error);
    killAll();
    process.exit(1);
  });
  process.on('unhandledRejection', (error) => {
    console.error(error);
    killAll();
    process.exit(1);
  });
}

/* Chrome writes "<port>\n<browser ws path>" here once it is listening. */
async function readDevToolsPort(profile, child, timeoutMs = 20000) {
  const file = join(profile, 'DevToolsActivePort');
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`Chrome exited early (code ${child.exitCode})`);
    try {
      const text = await readFile(file, 'utf8');
      const [port, path] = text.trim().split('\n');
      if (port && path) return { port: Number(port), path };
    } catch {
      /* not written yet */
    }
    await sleep(50);
  }
  throw new Error('Chrome never reported its DevTools port');
}

/* One socket, many sessions: requests carry an id and, for page targets, a
   sessionId; replies come back out of order and are matched by id. */
class Connection {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    this.listeners = new Set();
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject, method } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else resolve(msg.result);
        return;
      }
      if (msg.method) for (const fn of this.listeners) fn(msg);
    });
    ws.on('close', () => {
      for (const { reject, method } of this.pending.values()) reject(new Error(`${method}: socket closed`));
      this.pending.clear();
    });
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = this.next++;
      this.pending.set(id, { resolve, reject, method });
      const message = { id, method, params };
      if (sessionId) message.sessionId = sessionId;
      this.ws.send(JSON.stringify(message));
    });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export class Page {
  constructor(conn, sessionId, targetId) {
    this.conn = conn;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.inflight = new Map();
    this.lastNetwork = Date.now();
    this.loadFired = false;
    this.viewport = { width: 1440, height: 900, dpr: 2 };
    conn.on((msg) => {
      if (msg.sessionId !== this.sessionId) return;
      const p = msg.params || {};
      switch (msg.method) {
        case 'Network.requestWillBeSent':
          this.inflight.set(p.requestId, p.request?.url);
          this.lastNetwork = Date.now();
          break;
        case 'Network.loadingFinished':
        case 'Network.loadingFailed':
          this.inflight.delete(p.requestId);
          this.lastNetwork = Date.now();
          break;
        case 'Page.loadEventFired':
          this.loadFired = true;
          break;
        case 'Runtime.exceptionThrown':
          if (process.env.SHOT_DEBUG) console.error('[page exception]', p.exceptionDetails?.exception?.description || p.exceptionDetails?.text);
          break;
        case 'Runtime.consoleAPICalled':
          if (process.env.SHOT_DEBUG) console.error(`[console.${p.type}]`, (p.args || []).map((a) => a.value ?? a.description).join(' '));
          break;
        default:
      }
    });
  }

  send(method, params) {
    return this.conn.send(method, params, this.sessionId);
  }

  async init() {
    await Promise.all([
      this.send('Page.enable'),
      this.send('Runtime.enable'),
      this.send('Network.enable'),
      this.send('DOM.enable'),
    ]);
  }

  async setViewport({ width = 1440, height = 900, dpr = 2, mobile = false } = {}) {
    this.viewport = { width, height, dpr, mobile };
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile,
      screenWidth: width,
      screenHeight: height,
    });
    if (mobile) await this.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }

  /* Add a script that runs before any page script on every navigation. */
  async addInitScript(source) {
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  /* Load, then wait until no request has been in flight for `idleMs`, then
     for fonts. A dev server keeps an HMR socket open; websockets are not
     counted because they never "finish". */
  async goto(url, { timeoutMs = 30000, idleMs = 500, settleMs = 300 } = {}) {
    this.loadFired = false;
    this.inflight.clear();
    await this.send('Page.navigate', { url });
    await this.waitForLoad({ timeoutMs, idleMs });
    await this.evaluate('document.fonts ? document.fonts.ready.then(() => true) : true').catch(() => {});
    if (settleMs) await sleep(settleMs);
  }

  async reload({ timeoutMs = 30000, idleMs = 500, settleMs = 300 } = {}) {
    this.loadFired = false;
    this.inflight.clear();
    await this.send('Page.reload', { ignoreCache: false });
    await this.waitForLoad({ timeoutMs, idleMs });
    await this.evaluate('document.fonts ? document.fonts.ready.then(() => true) : true').catch(() => {});
    if (settleMs) await sleep(settleMs);
  }

  async waitForLoad({ timeoutMs = 30000, idleMs = 500 } = {}) {
    const started = Date.now();
    while (!this.loadFired) {
      if (Date.now() - started > timeoutMs) throw new Error('page load timed out');
      await sleep(50);
    }
    await this.waitForNetworkIdle({ idleMs, timeoutMs: Math.max(2000, timeoutMs - (Date.now() - started)) });
  }

  async waitForNetworkIdle({ idleMs = 500, timeoutMs = 15000 } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.inflight.size === 0 && Date.now() - this.lastNetwork >= idleMs) return;
      await sleep(50);
    }
    /* Not fatal: a long poll or an analytics beacon can keep one request
       open forever, and the page is almost always drawn by now. */
    if (process.env.SHOT_DEBUG) console.error('[network idle timed out]', [...this.inflight.values()]);
  }

  /* Evaluate an expression (or a function source) in the page and return its
     JSON value. Promises are awaited. */
  async evaluate(expression, ...args) {
    let source = expression;
    if (typeof expression === 'function') {
      source = `(${expression.toString()})(...${JSON.stringify(args)})`;
    }
    const r = await this.send('Runtime.evaluate', {
      expression: source,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error(`evaluate threw: ${d.exception?.description || d.text}`);
    }
    return r.result?.value;
  }

  async waitFor(selector, { timeoutMs = 10000, visible = true } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const found = await this.evaluate(
        (sel, vis) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          if (!vis) return true;
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.height > 0;
        },
        selector,
        visible,
      );
      if (found) return true;
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${selector}`);
  }

  /* Document-relative rect of an element, CSS pixels. */
  async rect(selector) {
    const r = await this.evaluate((sel) => {
      const el = typeof sel === 'string' ? document.querySelector(sel) : null;
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left + window.scrollX, y: b.top + window.scrollY, width: b.width, height: b.height };
    }, selector);
    if (!r) throw new Error(`no element for ${selector}`);
    return r;
  }

  async scrollIntoView(selector) {
    await this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`no element for ${sel}`);
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    }, selector);
  }

  /* A DOM click (React listens for click). */
  async click(selector) {
    const ok = await this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.click();
      return true;
    }, selector);
    if (!ok) throw new Error(`no element to click for ${selector}`);
  }

  /* A real pointer: press and release at the centre of the element. Use when
     a component listens for pointerdown / mousedown rather than click. */
  async mouseClick(selector) {
    const at = await this.center(selector);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });
  }

  /* Move the platform pointer over the element so :hover styles apply. */
  async hover(selector) {
    const at = await this.center(selector);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
  }

  async center(selector) {
    const at = await this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, selector);
    if (!at) throw new Error(`no element for ${selector}`);
    return at;
  }

  async key(key, { code = key, keyCode } = {}) {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  }

  /* Screenshot. `clip` is in document CSS pixels; `selector` clips to that
     element's box grown by `margin`. `full` captures the whole page. The
     format follows `out`'s extension unless given. */
  async screenshot({ out, clip, selector, margin = 0, full = false, format, quality = 92 } = {}) {
    const ext = out ? extname(out).slice(1).toLowerCase() : 'png';
    const fmt = format || (ext === 'jpg' ? 'jpeg' : ext === 'webp' || ext === 'jpeg' ? ext : 'png');
    let region = clip;
    if (selector) {
      const r = await this.rect(selector);
      region = { x: r.x - margin, y: r.y - margin, width: r.width + margin * 2, height: r.height + margin * 2 };
    }
    if (full) {
      const size = await this.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
      }));
      region = { x: 0, y: 0, width: size.width, height: size.height };
    }
    /* Capturing beyond the viewport makes Chrome lay the page out at its full
       height for the shot, which resizes 100vh layouts (the app is one). Only
       do it when the region really leaves the visible viewport. */
    let beyond = full;
    if (region && !full) {
      const vv = await this.evaluate(() => ({
        x: window.visualViewport.pageLeft,
        y: window.visualViewport.pageTop,
        width: window.visualViewport.width,
        height: window.visualViewport.height,
      }));
      beyond =
        region.x < vv.x - 0.5 ||
        region.y < vv.y - 0.5 ||
        region.x + region.width > vv.x + vv.width + 0.5 ||
        region.y + region.height > vv.y + vv.height + 0.5;
    }
    const params = { format: fmt, captureBeyondViewport: beyond, fromSurface: true };
    if (fmt !== 'png') params.quality = quality;
    if (region) {
      params.clip = {
        x: Math.max(0, Math.round(region.x)),
        y: Math.max(0, Math.round(region.y)),
        width: Math.round(region.width),
        height: Math.round(region.height),
        scale: 1,
      };
    }
    const r = await this.send('Page.captureScreenshot', params);
    const bytes = Buffer.from(r.data, 'base64');
    if (out) {
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, bytes);
    }
    return bytes;
  }

  async close() {
    await this.conn.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {});
  }
}

export async function launchChrome({ args = [], executable = CHROME_PATH } = {}) {
  hookExit();
  const profile = await mkdtemp(join(tmpdir(), 'tri-shot-'));
  const child = spawn(
    executable,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      '--disable-background-networking',
      '--disable-component-update',
      '--mute-audio',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      /* Keep the throwaway profile tiny: this machine runs close to a full
         disk, and a page's media would otherwise land in the HTTP cache. */
      '--disk-cache-size=1',
      '--media-cache-size=1',
      '--disable-gpu-shader-disk-cache',
      '--disable-breakpad',
      '--disable-crash-reporter',
      ...args,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let stderr = '';
  child.stderr.on('data', (d) => {
    stderr += d;
    if (stderr.length > 20000) stderr = stderr.slice(-10000);
  });

  let closed = false;
  const browser = {
    profile,
    child,
    killSync() {
      if (closed) return;
      closed = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      try {
        /* Synchronous: this also runs from process 'exit', where nothing async finishes. */
        rmSync(profile, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
      running.delete(browser);
    },
  };
  running.add(browser);

  let conn;
  try {
    const { port, path } = await readDevToolsPort(profile, child);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    conn = new Connection(ws);
  } catch (error) {
    browser.killSync();
    throw new Error(`${error.message}\n${stderr.slice(-2000)}`);
  }

  browser.conn = conn;

  browser.newPage = async ({ width = 1440, height = 900, dpr = 2, mobile = false } = {}) => {
    const { targetId } = await conn.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await conn.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(conn, sessionId, targetId);
    await page.init();
    await page.setViewport({ width, height, dpr, mobile });
    return page;
  };

  browser.close = async () => {
    if (closed) return;
    try {
      await Promise.race([conn.send('Browser.close'), sleep(1500)]);
    } catch {
      /* fall through to kill */
    }
    try {
      conn.ws.close();
    } catch {
      /* ignore */
    }
    await Promise.race([new Promise((r) => child.once('exit', r)), sleep(2000)]);
    closed = true;
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
    running.delete(browser);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };

  return browser;
}

/* Run `fn(chrome)` and always close Chrome and remove its profile after,
   whatever happens inside. */
export async function withChrome(fn, options) {
  const chrome = await launchChrome(options);
  try {
    return await fn(chrome);
  } finally {
    await chrome.close();
  }
}
