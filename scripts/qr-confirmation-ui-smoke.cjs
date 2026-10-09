// Run after npm run build. Exercises the real renderer with projection intercepted.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) { if ([8081, 8082].includes(args[0])) args[0] = 0; return listen.apply(this, args); };
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-qr-confirm-'));
const artifacts = path.join(root, 'artifacts', 'qr-confirmation');
fs.mkdirSync(artifacts, { recursive: true });
app.setPath('userData', profile); app.setAppPath(root);
process.chdir(profile);
for (const key of ['DEEPGRAM_API_KEY', 'HF_API_TOKEN', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DESIGN_MODE', 'SANDBOX']) delete process.env[key];
process.env.NODE_ENV = 'test';
fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({ remoteControlEnabled: false, asrProvider: 'whisper-local', slowPathEnabled: false, agentEnabled: false }));
app.on('browser-window-created', (_event, win) => { win.webContents.setBackgroundThrottling(false); win.hide(); });
require('../dist-electron/main.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 120; i++) { const result = await fn(); if (result) return result; await wait(100); }
  throw new Error(`Timed out: ${label}`);
}
async function run() {
  await app.whenReady();
  let shows = 0, clears = 0;
  ipcMain.removeHandler('show-qr');
  ipcMain.handle('show-qr', () => { shows++; return { success: true }; });
  ipcMain.removeHandler('clear-media');
  ipcMain.handle('clear-media', () => { clears++; return { success: true }; });
  const win = await until(() => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')), 'main window');
  const js = code => win.webContents.executeJavaScript(code);
  const selector = 'button[title="show the phone code on the projector"]';
  const open = async () => {
    await until(() => js(`!!document.querySelector(${JSON.stringify(selector)})`).catch(() => false), 'QR button');
    await js(`document.querySelector(${JSON.stringify(selector)}).click()`);
  };
  const dialogOpen = () => js(`!!document.querySelector('dialog[open]')`);
  const click = label => js(`(() => { const button = [...document.querySelectorAll('dialog button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!button) throw new Error('Missing button'); button.click(); })()`);
  const clear = async () => {
    await until(() => js(`!!document.querySelector('button[title="take the phone code off the projector"]')`), 'QR is up');
    await js(`document.querySelector('button[title="take the phone code off the projector"]').click()`);
    await until(() => js(`!!document.querySelector(${JSON.stringify(selector)})`), 'QR cleared');
  };
  await until(() => js(`!!window.api?.showQr`).catch(() => false), 'bridge');
  await js(`document.querySelector('[aria-label="close tour"]')?.click()`);
  await open(); await until(dialogOpen, 'confirmation');
  assert.equal(shows, 0, 'opening confirmation does not project');
  assert.equal(await js('document.activeElement.textContent.trim()'), 'Discard', 'safe initial keyboard focus');
  assert.ok(await js(`document.querySelector('dialog').textContent.includes('on the projector for the congregation')`));
  // A hidden macOS window can capture an old frame without its native top layer.
  win.showInactive();
  await wait(500);
  fs.writeFileSync(path.join(artifacts, 'confirmation.png'), (await win.webContents.capturePage()).toPNG());
  win.hide();
  await click('Don’t show again'); await click('Discard');
  await until(async () => !await dialogOpen(), 'discard');
  assert.equal(shows, 0);
  assert.equal(await js(`localStorage.getItem('trilorah.qrProjection.skipConfirmation')`), null, 'discard does not save the toggle');
  await open(); await until(dialogOpen, 'confirmation after discard');
  assert.equal(await js(`document.querySelector('dialog [role="switch"]').getAttribute('aria-checked')`), 'false');
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await until(async () => !await dialogOpen(), 'Escape cancels');
  assert.equal(shows, 0);
  await open(); await until(dialogOpen, 'confirmation after Escape');
  await click('Yes'); await until(() => shows === 1, 'confirmed projection');
  assert.equal(await js(`localStorage.getItem('trilorah.qrProjection.skipConfirmation')`), null);
  await clear(); assert.equal(clears, 1);
  await open(); await until(dialogOpen, 'confirmation repeats without opt-out');
  await click('Don’t show again'); await click('Yes');
  await until(() => shows === 2, 'opt-out projection');
  assert.equal(await js(`localStorage.getItem('trilorah.qrProjection.skipConfirmation')`), 'true');
  await clear(); assert.equal(clears, 2);
  await new Promise(resolve => {
    win.webContents.once('did-finish-load', resolve);
    win.webContents.reload();
  });
  await until(() => js(`!!window.api?.showQr && !!document.querySelector(${JSON.stringify(selector)})`).catch(() => false), 'reloaded app');
  await open(); await until(() => shows === 3, 'remembered preference');
  assert.equal(await dialogOpen(), false, 'confirmation is skipped after reload');
  await clear();
  await js(`localStorage.removeItem('trilorah.qrProjection.skipConfirmation')`);
  await open(); await until(dialogOpen, 'confirmation before output changes');
  win.webContents.send('on-show-media', path.join(profile, 'another-picture.png'), 'photo');
  await until(async () => !await dialogOpen(), 'another live item cancels stale confirmation');
  assert.equal(shows, 3, 'new live content is not replaced by a stale confirmation');
  console.log('QR_CONFIRMATION_UI_PASS', JSON.stringify({ checks: ['projector destination text', 'no projection before Yes', 'Discard', 'Escape', 'safe keyboard focus', 'toggle discarded on cancellation', 'Yes', 'confirmation repeats by default', 'opt-out survives reload', 'QR removal stays immediate', 'stale confirmation cancels when output changes'], screenshot: path.join(artifacts, 'confirmation.png') }));
  app.exit(0);
}
run().catch(async error => {
  console.error(error);
  const win = BrowserWindow.getAllWindows()[0];
  if (win) { fs.writeFileSync(path.join(artifacts, 'failure.png'), (await win.webContents.capturePage()).toPNG()); console.log(await win.webContents.executeJavaScript('document.body.innerText.slice(-5000)')); }
  app.exit(1);
});
