// Run after npm run build: npx electron scripts/tri-package-smoke.cjs
// Real preload/IPC and renderer; isolated profile, mocked native file pickers.
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) { if ([8081, 8082].includes(args[0])) args[0] = 0; return listen.apply(this, args); };
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-tri-smoke-'));
const artifacts = path.join(root, 'artifacts', 'tri-package');
fs.mkdirSync(artifacts, { recursive: true });
const documents = path.join(profile, 'documents');
fs.mkdirSync(documents);
app.setPath('userData', profile);
app.setPath('documents', documents);
app.setAppPath(root);
process.chdir(profile);
for (const key of ['DEEPGRAM_API_KEY', 'HF_API_TOKEN', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DESIGN_MODE', 'SANDBOX']) delete process.env[key];
process.env.NODE_ENV = 'test';
const image = path.join(profile, 'original background.svg');
fs.writeFileSync(image, '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#164e63"/></svg>');
const url = `local-media://file/${image.replace(/\\/g, '/')}`;
const song = { id: 'fixture-song', title: 'Portable Song', sections: [{ label: 'Chorus', lines: ['A song that travels'] }], source: 'imported', createdAt: 1, updatedAt: 1 };
const run = [{ key: 'worship', type: 'worship', label: 'Portable worship', items: [{ key: 'song', source: 'song', label: song.title, songId: song.id, lines: song.sections[0].lines }, { key: 'photo', source: 'media', label: 'Portable background', path: image, preview: url, mediaKind: 'photo' }] }];
const theme = { backgroundId: 'fixture-photo', dimness: 42, blur: 2, shadow: 77, font: 'serif', size: 3, verseSize: 2, refGap: 1.25, layout: 'bottom-right', safeMargin: 12.5 };
const media = [{ id: 'fixture-photo', label: 'Portable background', detail: 'fixture', seed: 0, style: 'smoke', source: 'local', url, kind: 'photo' }];
const config = { remoteControlEnabled: false, asrProvider: 'whisper-local', slowPathEnabled: false, agentEnabled: false, operatorRunV1: { segments: run, updatedAt: Date.now() }, triRendererState: { media, customDecks: [] }, triThemeLayout: theme, defaultBackgroundUrl: url, textTransition: 'fade', textTransitionMs: 900 };
fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify(config));
fs.writeFileSync(path.join(profile, 'songs.json'), JSON.stringify({ version: 1, songs: [song], deletedSeeds: [] }));
const write = (folder, id, value) => { fs.mkdirSync(path.join(profile, folder), { recursive: true }); fs.writeFileSync(path.join(profile, folder, `${id}.json`), JSON.stringify(value)); };
write('preacher-profiles', 'fixture-pastor', { id: 'fixture-pastor', name: 'Pastor Portable', favoriteVerses: [], commonTopics: ['faith'], sermonHistory: [], createdAt: '2026-10-03', updatedAt: '2026-10-03' });
write('preacher-teaching', 'fixture-pastor', { soundsLike: [{ heard: 'rawmeans', means: 'Romans', source: 'taught', hits: 0 }], vocabulary: ['Bethel House'], ignoreTails: ['amen'], voiceCommands: true });
write('preacher-ledgers', 'fixture-pastor', { preacherId: 'fixture-pastor', name: 'Pastor Portable', samples: [{ heard: 'rawmeans', correctedTo: 'Romans', source: 'operator', ts: 1 }], aliases: { rwmns: 'Romans' }, services: [{ id: 'old-service', date: '2026-09-20', verificationVersion: 2, detections: 110, confirmed: 110, corrections: 0, endedAt: 2 }], mature: false, autoModeEnabled: false, verificationVersion: 2, reviews: [] });
const file = path.join(documents, 'Portable Sunday.tri');
dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
app.on('browser-window-created', (_event, win) => { win.webContents.setBackgroundThrottling(false); win.hide(); });
require('../dist-electron/main.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 100; i++) { const value = await fn(); if (value) return value; await wait(150); }
  throw new Error(`Timed out: ${label}`);
}
async function runSmoke() {
  await app.whenReady();
  const win = await until(() => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')), 'desktop');
  const js = code => win.webContents.executeJavaScript(code);
  const click = async text => {
    const found = await js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled); if (!b) return false; b.click(); return true; })()`);
    assert.equal(found, true, `Button: ${text}`);
  };
  await until(() => js(`!!window.api?.triCatalog && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='.tri')`).catch(() => false), 'package control');
  await js(`document.querySelector('[aria-label="close tour"]')?.click()`);
  await until(() => js('document.body.innerText.toLowerCase().includes("portable worship")'), 'run hydration');
  await click('.tri');
  await click('save as…');
  await until(() => js('document.body.innerText.includes("Package name")'), 'save contents');
  await click('select all');
  await js(`(() => { const input = [...document.querySelectorAll('input')].find(i => i.maxLength === 160); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Portable Sunday'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await wait(250);
  await js(`document.querySelector('[aria-label="close tour"]')?.click()`);
  await wait(1600);
  fs.writeFileSync(path.join(artifacts, 'package-contents.png'), (await win.webContents.capturePage()).toPNG());
  await click('save .tri');
  await until(() => fs.existsSync(file) && js('document.body.innerText.includes("Saved Portable Sunday")'), 'saved archive');
  assert.equal(fs.readFileSync(file).subarray(0, 2).toString(), 'PK');
  const first = await js('window.api.triInspect()');
  assert.ok(first.manifest.assets.length >= 1);
  assert.equal(first.manifest.categories.preachers[0].data.teaching.soundsLike[0].means, 'Romans');
  assert.equal(first.manifest.categories.themes.find(i => i.id === 'layout').data.safeMargin, 12.5);
  // None of the source media remains available when the package is opened.
  fs.unlinkSync(image);
  await click('open .tri');
  await until(() => js('document.body.innerText.includes("Import from Portable Sunday")'), 'import review');
  await js(`(() => { const label = [...document.querySelectorAll('label')].find(l=>l.textContent.includes('Replace my current')); label?.querySelector('input')?.click(); })()`);
  await wait(200);
  await click('open service');
  await until(() => js('document.body.innerText.includes("Opened Portable Sunday")'), 'opened service');
  const loaded = await js('window.api.getSetting("operatorRunV1")');
  assert.notEqual(loaded.segments[0].items[0].songId, song.id);
  assert.ok(fs.existsSync(loaded.segments[0].items[1].path));
  assert.equal(fs.readFileSync(loaded.segments[0].items[1].path, 'utf8').includes('svg'), true);
  const profiles = await js('window.api.listPreacherProfiles()');
  assert.equal(profiles.length, 2);
  const imported = profiles.find(p => p.id !== 'fixture-pastor');
  const learned = await js(`window.api.getPreacherLearning(${JSON.stringify(imported.id)})`);
  assert.equal(learned.soundsLike[0].means, 'Romans');
  assert.equal(learned.vocabulary[0], 'Bethel House');
  assert.equal((await js('window.api.triStatus()')).path, file);
  const savedTheme = await js('JSON.parse(localStorage.getItem("trilorah_theme_layout"))');
  assert.equal(savedTheme.safeMargin, 12.5);
  assert.equal(savedTheme.layout, 'bottom-right');
  // Force the same renderer change event used by edits, exercising real autosave.
  await js('window.dispatchEvent(new Event("trilorah-theme-changed"))');
  await until(() => js('document.body.innerText.includes("· Saved")'), 'autosave');
  const reopened = await js('window.api.triInspect()');
  assert.ok(reopened.manifest.categories.preachers.some(item => item.id === imported.id));
  assert.ok(reopened.manifest.assets.length >= 1);
  fs.writeFileSync(path.join(artifacts, 'package-opened.png'), (await win.webContents.capturePage()).toPNG());
  console.log('TRI_PACKAGE_PASS', JSON.stringify({ checks: ['real save/open dialogs and IPC', 'actual ZIP', 'source-independent media', 'song relationships', 'preacher teaching', 'full theme layout', 'autosave reopened package'], screenshots: artifacts, isolatedProfile: profile }));
  app.exit(0);
}
runSmoke().catch(async error => {
  console.error(error);
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    fs.writeFileSync(path.join(artifacts, 'failure.png'), (await win.webContents.capturePage()).toPNG());
    console.log('UI', await win.webContents.executeJavaScript('document.body.innerText.slice(-6000)'));
  }
  app.exit(1);
});
