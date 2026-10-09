// Run after npm run build: npx electron scripts/foreign-import-ui-smoke.cjs
// Real renderer/preload/IPC with an isolated profile and controlled native picker.
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) { if ([8081, 8082].includes(args[0])) args[0] = 0; return listen.apply(this, args); };
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-foreign-ui-'));
const artifacts = path.join(root, 'artifacts', 'foreign-import');
fs.mkdirSync(artifacts, { recursive: true });
const documents = path.join(profile, 'documents');
const originals = path.join(profile, 'originals');
fs.mkdirSync(documents); fs.mkdirSync(originals);
app.setPath('userData', profile); app.setPath('documents', documents); app.setAppPath(root);
process.chdir(profile);
for (const key of ['DEEPGRAM_API_KEY', 'HF_API_TOKEN', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DESIGN_MODE', 'SANDBOX']) delete process.env[key];
process.env.NODE_ENV = 'test';
fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({ remoteControlEnabled: false, asrProvider: 'whisper-local', slowPathEnabled: false, agentEnabled: false }));
const pro = path.join(originals, 'Sunday.pro6');
const png = path.join(originals, 'sky.png');
fs.writeFileSync(pro, `<RVPresentationDocument name="Sunday song" CCLISongTitle="Sunday song"><array><RVSlideGrouping name="Verse 1"><array><RVDisplaySlide><array><RVTextElement><NSString rvXMLIvarName="PlainText">${Buffer.from('First line\nSecond line').toString('base64')}</NSString></RVTextElement><RVImageElement source="sky.png"/></array></RVDisplaySlide></array></RVSlideGrouping></array></RVPresentationDocument>`);
fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xkAAAAASUVORK5CYII=', 'base64'));
let pickedFiles = [pro, png];
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: pickedFiles });
dialog.showSaveDialog = async () => ({ canceled: false, filePath: path.join(documents, 'Imported Sunday.tri') });
app.on('browser-window-created', (_event, win) => { win.webContents.setBackgroundThrottling(false); win.hide(); });
require('../dist-electron/main.js');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 120; i++) { const result = await fn(); if (result) return result; await wait(150); }
  throw new Error(`Timed out: ${label}`);
}
async function run() {
  await app.whenReady();
  const win = await until(() => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')), 'main window');
  const js = code => win.webContents.executeJavaScript(code);
  // Buttons mark busy/disabled with aria-disabled; wait for a live one before pressing it.
  const click = async label => {
    await until(() => js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled && b.getAttribute('aria-disabled') !== 'true'); if (!b) return false; b.click(); return true; })()`), `Button ${label}`);
  };
  await until(() => js(`!!window.api?.triInspectForeign && [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '.tri')`).catch(() => false), 'file controls');
  await js(`document.querySelector('[aria-label="close tour"]')?.click()`);
  await click('.tri'); await click('import from another app…');
  await until(() => js(`document.body.innerText.includes('Review import')`), 'import review');
  await js(`(() => { for (const d of document.querySelectorAll('details')) if (d.textContent.includes('Preview lyrics')) d.open = true; })()`);
  await wait(600);
  fs.writeFileSync(path.join(artifacts, 'review.png'), (await win.webContents.capturePage()).toPNG());
  await click('import selected');
  await until(() => js(`document.body.innerText.includes('Selected resources copied')`), 'import completion');
  const songs = await js('window.api.songs.list()');
  assert.ok(songs.some(song => song.title === 'Sunday song' && song.sections[0].lines[0] === 'First line'));
  const saved = await js('window.api.getSetting("triRendererState")');
  const media = saved.media.find(item => item.label === 'sky');
  assert.ok(media?.url.startsWith('local-media://'));
  fs.rmSync(originals, { recursive: true });
  const local = decodeURIComponent(media.url.replace('local-media://file', ''));
  assert.ok(fs.existsSync(local), 'media survives original file removal');
  const run = await js('window.api.getSetting("operatorRunV1")');
  assert.ok(run.segments.some(segment => segment.items.some(item => item.songId && item.lines?.includes('First line'))));
  // A second import must append every chosen document without dropping the
  // existing service, and persist the same run that the operator sees.
  const firstNotes = path.join(profile, 'First notes.md');
  const secondNotes = path.join(profile, 'Second notes.txt');
  fs.writeFileSync(firstNotes, 'Opening thought\nFirst scripture');
  fs.writeFileSync(secondNotes, 'Closing thought');
  pickedFiles = [firstNotes, secondNotes];
  await click('import from another app…');
  await until(() => js(`document.body.innerText.includes('Review import')`), 'second import review');
  await click('import selected');
  await until(() => js(`document.body.innerText.includes('Selected resources copied')`), 'second import completion');
  const appended = await js('window.api.getSetting("operatorRunV1")');
  assert.deepEqual(appended.segments.slice(0, run.segments.length), run.segments, 'the first service survives a second import');
  const newSegments = appended.segments.slice(run.segments.length);
  assert.deepEqual(newSegments.map(segment => segment.label), ['First notes', 'Second notes']);
  // A file the importer cannot place asks the operator; Import stays disabled until it is answered.
  const lyricFile = path.join(profile, 'Smoke Test Hymn.txt');
  fs.writeFileSync(lyricFile, 'Amazing grace how sweet the sound\nThat saved a wretch like me\n\nI once was lost but now am found\nWas blind but now I see');
  pickedFiles = [lyricFile];
  await click('import from another app…');
  await until(() => js(`document.body.innerText.includes('not sure about')`), 'import question');
  assert.equal(await js(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'import selected' && !b.disabled && b.getAttribute('aria-disabled') !== 'true')`), false, 'import waits for the answer');
  await wait(400);
  fs.writeFileSync(path.join(artifacts, 'question.png'), (await win.webContents.capturePage()).toPNG());
  await click('Song');
  await until(() => js(`document.body.innerText.includes('All questions answered')`), 'answer applied');
  await click('import selected');
  await until(() => js(`document.body.innerText.includes('Selected resources copied')`), 'third import completion');
  const taught = await js('window.api.songs.list()');
  assert.ok(taught.some(song => song.title === 'Smoke Test Hymn' && song.sections.length === 2), 'answered text became a song');
  assert.deepEqual(newSegments.flatMap(segment => segment.items.map(item => item.label)), ['Opening thought', 'First scripture', 'Closing thought']);
  const rendererRun = await js(`JSON.parse(localStorage.getItem('trilorah.run.v1'))`);
  assert.deepEqual(rendererRun.segments, appended.segments, 'renderer and saved runs agree');
  await click('save as…');
  await until(() => js('document.body.innerText.includes("Package name")'), 'save review');
  await click('save .tri');
  const savedFile = path.join(documents, 'Imported Sunday.tri');
  await until(() => fs.existsSync(savedFile), 'portable save');
  await until(() => js(`document.body.innerText.includes('Saved Untitled service.tri')`), 'save completion in the renderer');
  const inspected = await js(`window.api.triInspect(${JSON.stringify(savedFile)})`);
  assert.equal(inspected.error, undefined, 'the saved package opens successfully');
  const savedSegments = inspected.manifest.categories.service.flatMap(service => service.data.segments);
  assert.deepEqual(savedSegments.map(segment => segment.label), appended.segments.map(segment => segment.label), 'all imported segments survive portable save');
  assert.deepEqual(savedSegments.slice(run.segments.length).flatMap(segment => segment.items.map(item => item.label)), ['Opening thought', 'First scripture', 'Closing thought']);
  assert.ok(inspected.manifest.assets.length > 0, 'the saved package embeds media');
  await js(`window.api.triDiscardPreview(${JSON.stringify(inspected.token)})`);
  fs.writeFileSync(path.join(artifacts, 'imported.png'), (await win.webContents.capturePage()).toPNG());
  console.log('FOREIGN_IMPORT_UI_PASS', JSON.stringify({ checks: ['picker-less sniffing', 'native file picker', 'review and lyrics', 'real import transaction', 'song and run persistence', 'source-independent media', 'multiple selected note files', 'second import preserves the existing run', 'renderer and saved run agreement', 'lyric file asks a question and imports once answered', 'save as .tri', 'reopen saved package with all segments and embedded media'], screenshots: artifacts }));
  app.exit(0);
}
run().catch(async error => {
  console.error(error);
  const win = BrowserWindow.getAllWindows()[0];
  if (win) { fs.writeFileSync(path.join(artifacts, 'failure.png'), (await win.webContents.capturePage()).toPNG()); console.log('UI', await win.webContents.executeJavaScript('(document.querySelector("[role=dialog]") ?? document.body).innerText.slice(0, 4000)')); }
  app.exit(1);
});
