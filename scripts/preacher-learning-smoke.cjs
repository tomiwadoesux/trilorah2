// npm run build && npx electron scripts/preacher-learning-smoke.cjs
// Isolated profile + synthetic microphone audio; no real microphone, paid API or public service.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'artifacts', 'preacher-learning');
fs.mkdirSync(artifacts, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-preacher-smoke-'));
app.setPath('userData', profile);
app.setAppPath(root);
process.chdir(profile); // Do not read the developer's .env.local or service credentials.
for (const key of ['DEEPGRAM_API_KEY', 'HF_API_TOKEN', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'DESIGN_MODE', 'SANDBOX']) delete process.env[key];
process.env.NODE_ENV = 'test';
fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({ remoteControlEnabled: false, asrProvider: 'whisper-local', slowPathEnabled: false, agentEnabled: false }));
const audio = path.join(artifacts, 'reference.wav');
if (fs.existsSync(audio)) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  app.commandLine.appendSwitch('use-file-for-fake-audio-capture', audio);
}
app.on('browser-window-created', (_, win) => win.hide());
require('../dist-electron/main.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const value = await fn(); if (value) return value; await wait(250); }
  throw new Error('Timed out waiting for preacher-learning check');
}
async function run() {
  await app.whenReady();
  const win = await until(() => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('/index.html')));
  const js = (code) => win.webContents.executeJavaScript(code);
  await until(() => js('!!window.api && !!document.querySelector("[data-view=profile]")').catch(() => false));
  await js('window.api.createPreacherProfile("qa-pastor", "Pastor Test")');
  await js('window.api.createPreacherProfile("qa-guest", "Guest Test")');
  await js('window.api.setActivePreacher("qa-pastor")');
  const teaching = { soundsLike: [{ heard: 'rawmeans', means: 'Romans', source: 'taught', hits: 0 }], vocabulary: ['Bethel House'], ignoreTails: ['amen'], voiceCommands: false };
  await js(`window.api.savePreacherLearning('qa-pastor', ${JSON.stringify(teaching)})`);
  let detail = await js('window.api.getPreacherLearning("qa-pastor")');
  assert.equal(detail.voiceCommands, false);
  assert.equal(detail.soundsLike[0].means, 'Romans');
  assert.equal((await js('window.api.getPreacherLearning("qa-guest")')).voiceCommands, true);
  const miss = await js('window.api.addMissedReference("qa-pastor", "rawmeans eight one")');
  await js('window.api.endService({preacherId:"qa-pastor"})');
  await js('window.api.setActivePreacher("qa-guest")');
  await js(`window.api.resolveReviewItem(${JSON.stringify(miss.id)}, 'amended', {book:'Romans',chapter:8,verse:1})`);
  detail = await js('window.api.getPreacherLearning("qa-pastor")');
  assert.equal(detail.stats.samples, 0); // Misses are not detected-verse precision.
  assert.equal(detail.serviceOpen, false); // A late answer did not open a new service.
  assert.equal(detail.reviews.length, 0);
  assert.equal((await js('window.api.getPreacherLearning("qa-guest")')).stats.samples, 0);
  await assert.rejects(js(`window.api.resolveReviewItem(${JSON.stringify(miss.id)}, 'confirmed')`));
  const pending = await js('window.api.addMissedReference("qa-pastor", "first john four eight")');
  await js('window.api.setActivePreacher("qa-pastor")');
  await js('window.api.useOfflineSpeech()');
  const loaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  win.webContents.reload();
  await loaded;
  await until(() => js('!!document.querySelector("[data-view=profile]")').catch(() => false));
  await js('document.querySelector("[data-view=profile]").click()');
  await until(() => js('document.body.innerText.includes("Try a few references")'));
  await js('document.querySelector("[aria-label=\"close tour\"]")?.click()');
  detail = await js('window.api.getPreacherLearning("qa-pastor")');
  assert.equal(detail.reviews[0].id, pending.id);
  assert.equal(detail.voiceCommands, false);
  await wait(500);
  fs.writeFileSync(path.join(artifacts, 'profile.png'), (await win.webContents.capturePage()).toPNG());
  if (fs.existsSync(audio)) {
    const before = await js('window.api.getScreenState()');
    await js('window.api.startPreacherSoundCheck("qa-pastor", 0)');
    const check = await until(async () => {
      const state = await js('window.api.getPreacherSoundCheck()');
      return state && ['finished', 'error'].includes(state.status) ? state : null;
    }, 240000);
    assert.equal(check.status, 'finished', check.message);
    assert.equal(check.matches, true, JSON.stringify(check));
    assert.equal(await js('window.api.getScreenState()'), before);
    assert.equal((await js('window.api.getPreacherLearning("qa-pastor")')).stats.samples, 0);
    console.log('REAL LOCAL ASR:', JSON.stringify(check));
  }
  console.log('PASS: preacher teaching, persisted review, attribution, offline mode, UI reload and isolated sound check.');
  console.log('Isolated test profile:', profile);
  app.exit(0);
}
run().catch((e) => { console.error(e); app.exit(1); });
