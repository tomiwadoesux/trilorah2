import { previewDevices } from './preview-devices.js';
import { createCameraPlayground } from './camera-playground.js';

// Resize one fixed-camera scene; switching devices never starts another renderer.
const byId = id => document.getElementById(id);
const header = document.querySelector('header');
const buttons = [...document.querySelectorAll('[data-device]')];
let selected = 'window';
let rotated = false;
let scene;
let playground;

document.body.dataset.studio = 'true';
document.body.dataset.devicePreview = selected;
const stage = document.createElement('div');
stage.id = 'preview-stage';
const caption = document.createElement('div');
caption.id = 'preview-caption';
caption.setAttribute('role', 'status');
const frame = document.createElement('div');
frame.id = 'preview-frame';
const iframe = document.createElement('iframe');
iframe.id = 'scene-preview';
iframe.title = 'Mountain scene preview';
frame.append(iframe);
stage.append(caption, frame);
document.body.prepend(stage);

function fitFrame() {
  const fullWindow = selected === 'window';
  const preset = previewDevices[selected];
  let width = preset.width || innerWidth;
  let height = preset.height || innerHeight;
  if (!fullWindow && rotated) [width, height] = [height, width];
  document.body.dataset.devicePreview = selected;
  document.body.style.setProperty('--preview-top', `${header.getBoundingClientRect().bottom + 24}px`);
  const scale = fullWindow ? 1 : Math.min(1,
    stage.clientWidth / width, Math.max(1, stage.clientHeight - caption.offsetHeight - 14) / height);
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  iframe.style.transform = `scale(${scale})`;
  frame.style.width = `${width * scale}px`;
  frame.style.height = `${height * scale}px`;
  const orientation = width > height ? 'landscape' : 'portrait';
  caption.textContent = `${preset.label} · ${width} × ${height} · ${orientation}`;
  iframe.title = `${preset.label} mountain preview, ${width} by ${height}`;
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.device === selected)));
  byId('device-rotate').disabled = fullWindow;
  // Explicit device selection also preserves the chosen pose when rotated.
  scene?.cameraEditor.setDevice(selected);
  playground?.refresh();
}

buttons.forEach(button => button.addEventListener('click', () => {
  selected = button.dataset.device;
  rotated = false;
  fitFrame();
}));
byId('device-rotate').addEventListener('click', () => {
  rotated = !rotated;
  fitFrame();
});

function mirrorTheme() {
  const child = iframe.contentDocument;
  document.documentElement.dataset.theme = child.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]').content = child.querySelector('meta[name="theme-color"]').content;
  byId('theme-label').textContent = child.getElementById('theme-label').textContent;
  byId('theme-toggle').setAttribute('aria-pressed', child.getElementById('theme-toggle').getAttribute('aria-pressed'));
  byId('theme-toggle').setAttribute('aria-label', byId('theme-label').textContent);
  playground?.refresh();
}
byId('theme-toggle').addEventListener('click', () => {
  if (!scene) return;
  iframe.contentDocument.getElementById('theme-toggle').click();
  mirrorTheme();
});

window.addEventListener('message', event => {
  if (event.source !== iframe.contentWindow || event.origin !== location.origin) return;
  if (event.data?.type === 'mountain-scene-error') {
    byId('loading').textContent = 'The scene could not load. Reload this page with WebGL enabled.';
    return;
  }
  if (event.data?.type !== 'mountain-scene-ready' || scene) return;
  scene = iframe.contentWindow.mountainScene;
  window.mountainScene = scene;
  playground = createCameraPlayground({
    initialOpen: document.documentElement.dataset.look !== 'alpine',
    camera: scene.cameraEditor,
    terrain: scene.terrain,
    toolbar: document.querySelector('.scene-toolbar'),
    getViewport: () => {
      const width = parseFloat(iframe.style.width);
      const height = parseFloat(iframe.style.height);
      return { device: selected, orientation: width > height ? 'landscape' : 'portrait',
        viewport: { width, height, aspect: width / height } };
    },
    onLayout: fitFrame,
  });
  fitFrame();
  mirrorTheme();
  new MutationObserver(mirrorTheme).observe(iframe.contentDocument.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] });
  byId('loading').hidden = true;
  document.body.dataset.sceneReady = 'true';
});
window.addEventListener('resize', fitFrame);
new ResizeObserver(fitFrame).observe(header);
new ResizeObserver(fitFrame).observe(stage);
fitFrame();
iframe.src = './index.html?view=final&embedded=1' + (new URLSearchParams(location.search).get('look') === 'alpine' ? '&look=alpine' : '');
const reducedGlow = matchMedia('(prefers-reduced-motion: reduce)');
let glowPlaying = true;
function syncGlow() {
  const playing = glowPlaying && !reducedGlow.matches;
  if (iframe.contentDocument) iframe.contentDocument.documentElement.dataset.glowMotion = playing ? 'playing' : 'paused';
  byId('glow-toggle').disabled = reducedGlow.matches;
  byId('glow-toggle').setAttribute('aria-pressed', String(playing));
  byId('glow-toggle').textContent = reducedGlow.matches ? 'Reduced motion' : playing ? 'Pause glow' : 'Animate glow';
}
byId('glow-toggle').addEventListener('click', () => { glowPlaying = !glowPlaying; syncGlow(); });
reducedGlow.addEventListener('change', syncGlow);
iframe.addEventListener('load', syncGlow);
syncGlow();
