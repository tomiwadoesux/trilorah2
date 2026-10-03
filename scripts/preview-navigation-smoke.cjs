// Run after npm run build: npx electron scripts/preview-navigation-smoke.cjs
// Uses an isolated profile and deterministic converted slides, without a microphone.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) { if ([8081, 8082].includes(args[0])) args[0] = 0; return listen.apply(this, args); };
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-preview-smoke-'));
app.setPath('userData', profile);
app.setAppPath(root);
process.env.NODE_ENV = 'test';
delete process.env.DESIGN_MODE;
app.on('browser-window-created', (_, win) => win.hide());
require('../dist-electron/main.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 100; i++) { const result = await fn(); if (result) return result; await wait(150); }
  throw new Error(`Timed out: ${label}`);
}
async function run() {
  await app.whenReady();
  const desktop = await until(() => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')), 'desktop');
  const js = code => desktop.webContents.executeJavaScript(code);
  await until(() => js('!!document.querySelector("[aria-label=\\"next verse\\"]")').catch(() => false), 'verse controls');
  await js(`document.querySelector('[aria-label="close tour"]')?.click()`);
  await js('window.api.openOutput()');
  let output = await until(() => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('output.html')), 'output');
  await until(() => output.webContents.executeJavaScript('!!window.api && !!document.querySelector("#output-root > div")').catch(() => false), 'output loaded');
  // A single click must publish the adjacent verse, without pressing Go live.
  await js('document.querySelector("[aria-label=\\"next verse\\"]").click()');
  const first = await until(() => js('window.api.getOutputContent().then(s => s.verse)'), 'next verse published');
  assert.ok(first.verse > 1);
  await until(() => output.webContents.executeJavaScript(`document.body.innerText.includes(${JSON.stringify(`${first.book} ${first.chapter}:${first.verse}`)})`), 'physical verse output');
  await until(() => js('!document.querySelector("[aria-label=\\"previous verse\\"]").disabled'), 'verse controls ready');
  await js('document.querySelector("[aria-label=\\"previous verse\\"]").click()');
  await until(() => js(`window.api.getOutputContent().then(s => s.verse?.verse === ${first.verse - 1})`), 'previous verse published');
  // Simulate conversion completion, then exercise the real import/save/library UI.
  const slides = [1, 2, 3].map(n => {
    const file = path.join(profile, `slide #${n} ?.svg`);
    fs.writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${['#123456', '#236745', '#452367'][n - 1]}"/><text x="60" y="190" fill="white" font-size="48">Smoke slide ${n}</text></svg>`);
    return file;
  });
  ipcMain.removeHandler('import-presentation');
  ipcMain.handle('import-presentation', () => ({ success: true, data: { title: 'Smoke PowerPoint', slides, pptxPath: '/fixture/Sunday.pptx' } }));
  await js('document.querySelector("[title=\\"import images, presentation slides, or songs\\"]").click()');
  await js('[...document.querySelectorAll("button")].find(b => b.textContent.includes("presentation slides"))?.click()');
  await until(() => js('document.body.innerText.includes("Smoke PowerPoint")'), 'imported deck in library');
  const library = JSON.parse(fs.readFileSync(path.join(profile, 'presentations.json'), 'utf8'));
  assert.deepEqual(library[0].slides, slides);
  await js('document.querySelector("[data-row=\\"0\\"] button").click()');
  await until(() => js('!!document.querySelector("[aria-label=\\"next slide\\"]")'), 'slide preview controls');
  await until(() => js('[...document.images].some(i => i.alt === "Smoke PowerPoint — slide 1" && i.naturalWidth > 0)'), 'preview image with special characters');
  assert.equal(await js('document.querySelector("[aria-label=\\"previous slide\\"]").disabled'), true);
  await js('document.querySelector("[aria-label=\\"next slide\\"]").click()');
  await until(() => js(`window.api.getOutputContent().then(s => s.content?.path === ${JSON.stringify(slides[1])})`), 'slide 2 published');
  await until(() => js('[...document.images].filter(i => i.alt === "Smoke PowerPoint — slide 2" && i.naturalWidth > 0).length === 2'), 'both panels show slide 2');
  await until(() => output.webContents.executeJavaScript('[...document.images].some(i => i.src.startsWith("data:image/") && i.naturalWidth > 0)'), 'physical slide output');
  await until(() => js('!document.querySelector("[aria-label=\\"next slide\\"]").disabled'), 'next enabled');
  await js('document.querySelector("[aria-label=\\"next slide\\"]").click()');
  await until(() => js(`window.api.getOutputContent().then(s => s.content?.path === ${JSON.stringify(slides[2])})`), 'slide 3 published');
  await until(() => js('document.querySelector("[aria-label=\\"next slide\\"]").disabled'), 'last slide bound');
  await js('document.querySelector("[aria-label=\\"previous slide\\"]").click()');
  await until(() => js(`window.api.getOutputContent().then(s => s.content?.path === ${JSON.stringify(slides[1])})`), 'previous slide published');
  // Reopening an output restores the current presentation image.
  await output.webContents.reload();
  await until(() => output.webContents.executeJavaScript('[...document.images].some(i => i.src.startsWith("data:image/") && i.naturalWidth > 0)').catch(() => false), 'restored slide output');
  // Arrow keys use the same navigation action.
  await js('document.querySelector("[aria-label=\\"previous slide\\"]").dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowLeft", bubbles:true, cancelable:true}))');
  await until(() => js(`window.api.getOutputContent().then(s => s.content?.path === ${JSON.stringify(slides[0])})`), 'keyboard previous slide');
  await until(() => js('[...document.images].filter(i => i.alt === "Smoke PowerPoint — slide 1" && i.naturalWidth > 0).length === 2'), 'both panels after keyboard');
  desktop.showInactive();
  await wait(500);
  const screenshot = path.join(profile, 'preview-navigation.png');
  fs.writeFileSync(screenshot, (await desktop.webContents.capturePage()).toPNG());
  console.log('PREVIEW_NAVIGATION_PASS', JSON.stringify({ screenshot, checks: ['verse next/previous publishes', 'import saved', 'special filename preview', 'both slide panels follow', 'physical output', 'slide bounds', 'output restoration', 'keyboard navigation'] }));
  app.exit(0);
}
run().catch(error => { console.error('PREVIEW_NAVIGATION_FAIL', error); app.exit(1); });
setTimeout(() => { console.error('PREVIEW_NAVIGATION_FAIL timeout'); app.exit(1); }, 90000).unref();
