// A single scene runs inside a real, resizable viewport. Scaling the iframe
// externally keeps its CSS pixels, camera aspect, breakpoints and input aligned.
import { chosenView } from './camera-views.js';
import { previewDevices as presets } from './preview-devices.js';
const viewsKey = 'montfort-device-views-v1';
const preferenceKey = 'montfort-preview-device-v1';
const byId = id => document.getElementById(id);
let selected = 'window';
let rotated = false;
let scene;
let busy = false;
let jsonMode = 'current';
let savedViews = {};

function validPose(view) {
  return view && ['position', 'target', 'up'].every(key => Array.isArray(view[key]) && view[key].length === 3 && view[key].every(Number.isFinite))
    && Array.isArray(view.quaternion) && view.quaternion.length === 4 && view.quaternion.every(Number.isFinite)
    && Number.isFinite(view.fov) && view.fov >= 20 && view.fov <= 90
    && Number.isFinite(view.zoom) && view.zoom > 0 && Number.isFinite(view.scrollY);
}
try {
  const stored = JSON.parse(localStorage.getItem(viewsKey) || '{}');
  for (const [key, view] of Object.entries(stored)) if (validPose(view) && presets[view.device]) savedViews[key] = view;
  const preference = JSON.parse(localStorage.getItem(preferenceKey) || '{}');
  if (presets[preference.device]) {
    selected = preference.device;
    rotated = Boolean(preference.rotated);
  }
} catch { /* Storage is optional. */ }

document.body.dataset.studio = 'true';
const stage = document.createElement('div');
stage.id = 'preview-stage';
const caption = document.createElement('div');
caption.id = 'preview-caption';
const frame = document.createElement('div');
frame.id = 'preview-frame';
const iframe = document.createElement('iframe');
iframe.id = 'scene-preview';
iframe.title = 'Mountain scene preview';
frame.append(iframe);
stage.append(caption, frame);
document.body.prepend(stage);

function viewport() {
  const preset = presets[selected];
  let width = preset.width || innerWidth;
  let height = preset.height || innerHeight;
  if (selected !== 'window' && rotated) [width, height] = [height, width];
  return { width, height, aspect: width / height };
}
function orientation() { const { width, height } = viewport(); return width > height ? 'landscape' : 'portrait'; }
function slot() { return selected === 'window' ? 'window' : `${selected}-${orientation()}`; }
function label() { return `${presets[selected].label}${selected === 'window' ? '' : ` ${orientation()}`}`; }
function selectedView() { const { width, height } = viewport(); return chosenView(width, height, selected); }
function getView() {
  if (!scene) return null;
  return { ...scene.cameraEditor.getView(), device: selected, orientation: orientation(), viewport: viewport() };
}
function feedback(message) { byId('camera-feedback').textContent = message; }

function fitFrame() {
  const { width, height } = viewport();
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  const scale = Math.max(.05, Math.min(1, stage.clientWidth / width, Math.max(1, stage.clientHeight - 34) / height));
  iframe.style.transform = `scale(${scale})`;
  frame.style.width = `${width * scale}px`;
  frame.style.height = `${height * scale}px`;
  caption.textContent = `${label()} · ${width} × ${height} · ${Math.round(scale * 100)}% display size`;
  iframe.title = `${label()} mountain scene preview, ${width} by ${height}`;
  byId('preview-size').textContent = `${width} × ${height}`;
  byId('preview-device').value = selected;
  byId('preview-rotate').disabled = selected === 'window' || busy;
}

function updateSavedUI() {
  byId('camera-load').disabled = !savedViews[slot()];
  byId('clear-saved-view').hidden = !savedViews[slot()];
  const views = Object.values(savedViews);
  byId('copy-all-views').disabled = views.length === 0;
  byId('saved-views-status').textContent = views.length
    ? `Saved: ${views.map(view => `${presets[view.device].label}${view.device === 'window' ? '' : ` ${view.orientation}`}`).join(' · ')}`
    : 'Save a shot for each screen, then copy them together.';
}

function mirrorControls() {
  if (!scene) return;
  const child = iframe.contentDocument;
  document.documentElement.dataset.theme = child.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]').content = child.querySelector('meta[name="theme-color"]').content;
  for (const input of document.querySelectorAll('#settings input, #camera-tools input')) {
    const source = input.id ? child.getElementById(input.id) : child.querySelector(`#settings input[name="${input.name}"]`);
    if (source && document.activeElement !== input) input.value = source.value;
  }
  for (const output of document.querySelectorAll('#settings output, #camera-tools output')) {
    const source = child.getElementById(output.id);
    if (source) output.textContent = source.textContent;
  }
  for (const id of ['theme-label', 'camera-status', 'interaction-hint']) byId(id).textContent = child.getElementById(id).textContent;
  for (const id of ['theme-toggle', 'camera-edit']) {
    byId(id).setAttribute('aria-pressed', child.getElementById(id).getAttribute('aria-pressed'));
    if (id === 'camera-edit') byId(id).textContent = child.getElementById(id).textContent;
  }
  byId('camera-tools').disabled = child.getElementById('camera-tools').disabled;
  if (jsonMode === 'current' && document.activeElement !== byId('camera-json')) byId('camera-json').value = JSON.stringify(getView(), null, 2);
  updateSavedUI();
}

async function resizeScene() {
  fitFrame();
  // ResizeObserver and the original renderer settle in the child's viewport.
  await new Promise(resolve => iframe.contentWindow.requestAnimationFrame(() => iframe.contentWindow.requestAnimationFrame(resolve)));
  // Refresh the original path's breakpoint-dependent look-at target as well.
  // Free-camera poses are applied separately after this resize has settled.
  if (scene) {
    const camera = scene.app.webgl.camera;
    camera.curveProgress = camera.curveProgress;
  }
}

async function changeDevice(device, turn = false) {
  if (!scene || busy) return;
  scene.cameraEditor.enable();
  selected = device;
  rotated = turn;
  busy = true;
  byId('preview-device').disabled = true;
  jsonMode = 'current';
  try {
    await resizeScene();
    scene.cameraEditor.setView(selectedView());
    feedback(`Your chosen ${label()} framing is loaded.`);
    try { localStorage.setItem(preferenceKey, JSON.stringify({ device: selected, rotated })); } catch { /* Optional. */ }
  } finally {
    busy = false;
    byId('preview-device').disabled = false;
    fitFrame();
    mirrorControls();
  }
}

byId('preview-device').addEventListener('change', event => changeDevice(event.target.value));
byId('preview-rotate').addEventListener('click', () => changeDevice(selected, !rotated));
byId('use-chosen-view').addEventListener('click', () => {
  if (!scene || busy) return;
  scene.cameraEditor.setView(selectedView());
  jsonMode = 'current';
  feedback(`Your chosen ${label()} framing applied.`);
  mirrorControls();
});

for (const id of ['theme-toggle', 'camera-edit', 'camera-zoom-in', 'camera-zoom-out', 'camera-reset-view', 'reset', 'restart']) {
  byId(id).addEventListener('click', () => {
    if (!scene || busy) return;
    jsonMode = 'current';
    iframe.contentDocument.getElementById(id).click();
    if (id === 'camera-reset-view') feedback('Returned to where you started exploring.');
    else if (id === 'camera-edit' || id === 'reset' || id === 'restart') feedback('');
    mirrorControls();
  });
}
for (const input of document.querySelectorAll('#settings input, #camera-tools input')) {
  input.addEventListener('input', () => {
    if (!scene || busy) return;
    jsonMode = 'current';
    const child = iframe.contentDocument;
    const target = input.id ? child.getElementById(input.id) : child.querySelector(`#settings input[name="${input.name}"]`);
    target.value = input.value;
    target.dispatchEvent(new iframe.contentWindow.Event('input', { bubbles: true }));
    mirrorControls();
  });
}
byId('settings').addEventListener('submit', event => event.preventDefault());

async function copy(data, message) {
  const text = JSON.stringify(data, null, 2);
  byId('camera-json').value = text;
  try { await navigator.clipboard.writeText(text); feedback(message); }
  catch {
    byId('camera-json').focus();
    byId('camera-json').select();
    feedback('Select and copy the setup in the text box.');
  }
}
byId('camera-copy').addEventListener('click', () => {
  if (!scene) return;
  jsonMode = 'current';
  copy(getView(), `${label()} camera and screen size copied.`);
});
byId('camera-save').addEventListener('click', () => {
  if (!scene || busy) return;
  const view = getView();
  savedViews[slot()] = view;
  jsonMode = 'current';
  try {
    localStorage.setItem(viewsKey, JSON.stringify(savedViews));
    feedback(`${label()} view saved.`);
  } catch { feedback('View kept for this session. Copy it to keep a permanent record.'); }
  updateSavedUI();
});
byId('camera-load').addEventListener('click', () => {
  if (!scene || !savedViews[slot()] || busy) return;
  scene.cameraEditor.setView(savedViews[slot()]);
  jsonMode = 'current';
  feedback(`Saved ${label()} view loaded.`);
  mirrorControls();
});
byId('clear-saved-view').addEventListener('click', () => {
  if (!scene || busy) return;
  delete savedViews[slot()];
  try { localStorage.setItem(viewsKey, JSON.stringify(savedViews)); } catch { /* Session only. */ }
  jsonMode = 'current';
  feedback(`Saved ${label()} view removed. Your current framing is unchanged.`);
  mirrorControls();
});
byId('copy-all-views').addEventListener('click', () => {
  jsonMode = 'all';
  copy({ version: 1, views: Object.values(savedViews) }, 'All saved device views copied. Paste them into the chat.');
});
byId('export').addEventListener('click', () => {
  if (!scene) return;
  const data = { ...scene.options, layout: scene.layout, camera: getView(), deviceViews: Object.values(savedViews) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mountain-scene-views.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  byId('feedback').textContent = 'Settings and device views exported.';
});

for (const panel of document.querySelectorAll('#controls, #camera-controls')) {
  panel.addEventListener('toggle', () => {
    if (panel.open) document.querySelectorAll('#controls, #camera-controls').forEach(other => {
      if (other !== panel) other.open = false;
    });
  });
}
function showUI(visible) {
  document.querySelectorAll('.scene-ui').forEach(element => { element.hidden = !visible; });
  byId('restore-ui').hidden = visible;
}
document.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.matches('input, textarea, select')) showUI(document.querySelector('header').hidden);
});
byId('restore-ui').addEventListener('click', () => showUI(true));
window.addEventListener('resize', async () => {
  if (selected === 'window' && scene) {
    await resizeScene();
    if (selected === 'window') {
      scene.cameraEditor.setView(selectedView());
      mirrorControls();
    }
  } else fitFrame();
});
new ResizeObserver(fitFrame).observe(stage);

window.addEventListener('message', async event => {
  if (event.source !== iframe.contentWindow || event.origin !== location.origin) return;
  if (event.data?.type === 'mountain-scene-error') {
    byId('loading').textContent = 'The scene could not load. Reload this page with WebGL enabled.';
    return;
  }
  if (event.data?.type !== 'mountain-scene-ready' || scene) return;
  scene = iframe.contentWindow.mountainScene;
  window.mountainScene = scene;
  window.mountainStudio = { getView, getSavedViews: () => structuredClone(savedViews), changeDevice };
  await resizeScene();
  scene.cameraEditor.setView(selectedView());
  feedback('Your chosen framing is loaded. Device switches always restore your selected shots.');
  byId('loading').hidden = true;
  document.body.dataset.sceneReady = 'true';
  mirrorControls();
  setInterval(() => { if (!document.hidden) mirrorControls(); }, 120);
});

fitFrame();
updateSavedUI();
iframe.src = './index.html?embedded=1';
