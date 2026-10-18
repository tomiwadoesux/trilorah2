import { a as app, E as events, G as siteShell, sceneUniforms } from './vendor/App.ST3WWojO.js';
import { defaults, layout, themes, cloudPlacement } from './config.js';
import { applyRockyTerrain } from './rocky-terrain.js';
import { cleanTerrainComposition } from './terrain-composition.js';
import { applyHeroAtmosphere } from './atmosphere.js';
import { disableCloudPointerFeedback } from './cloud-interaction.js';
import { applyWindyCloudBank } from './windy-clouds.js';
import { alpineLook, alpineView, prepareAlpineBackdrop } from './alpine-look.js';
import { createDistantValley } from './distant-valley.js';
import { createRenderBudget } from './render-budget.js';
import { createThemeTransition } from './theme-transition.js';

const presentation = document.documentElement.dataset.presentation === 'true';

const storageKey = 'montfort-scene-settings-v2';
const atmosphereRevision = 'app-carbon-backgrounds-v4';
const cloudRevision = 'windy-billowing-banks-v3';
const cloudSpeedRevision = 'travelling-cloud-shapes-v2';
const form = document.querySelector('#settings');
const loading = document.querySelector('#loading');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const options = { ...defaults };
let cameraEditor;
let terrain;
let atmosphere;
let distantValley;
let themeTransition;
let alpineBackdrop;
let appliedTheme;
let previousElapsed = null;
const ranges = { cloudSpeed: [0, 3], cloudDensity: [0, 2], fov: [20, 90] };
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
  for (const [key, value] of Object.entries(saved)) {
    if (key === 'theme' && ['light', 'dark'].includes(value)) options.theme = value;
    if (ranges[key] && typeof value === 'number' && Number.isFinite(value)) options[key] = Math.min(ranges[key][1], Math.max(ranges[key][0], value));
    if (['lightColor', 'darkColor'].includes(key) && /^#[0-9a-f]{6}$/i.test(value)) options[key] = value;
  }
  // Install the app-matched palette once; later studio edits still persist.
  if (saved.atmosphereRevision !== atmosphereRevision) {
    options.lightColor = themes[options.theme].lightColor;
    options.darkColor = themes[options.theme].darkColor;
    if (!saved.atmosphereRevision) options.cloudDensity = defaults.cloudDensity;
  }
  // Install the windy cloud preset once while preserving theme and camera settings.
  if (saved.cloudRevision !== cloudRevision) {
    options.cloudSpeed = defaults.cloudSpeed;
    options.cloudDensity = defaults.cloudDensity;
  }
  // Increase drift once while preserving the approved amount of cloud cover.
  if (saved.cloudSpeedRevision !== cloudSpeedRevision) options.cloudSpeed = defaults.cloudSpeed;
} catch { /* Storage is optional. */ }

document.querySelector('main').style.height = `${100 + layout.scrollVh}svh`;
document.querySelector('.hero').style.height = `${layout.heroVh}svh`;
document.querySelector('.top-chapters').style.height = `${layout.topChaptersVh}svh`;

// Reuse the original engine, camera spline, geometry and materials.
// Select the homepage without changing the browser URL.
app.beforeLoad = () => {
  const page = app.webgl.pages.Homepage;
  app.webgl.currentPage = page;
  app.webgl.nextPage = null;
  page.chaptersArr = [page.chapters.Hero, page.chapters.TopChapters];
  app.webgl.transitionSlideshow.init = () => {};
};

const cloudUniforms = {
  uStudyTime: { value: 0 },
  uStudyDensity: { value: 1 },
};

// Sculpt mountain banks; retain the original chapter-transition sheets.
// A separate cloud clock makes speed edits continuous instead of jumping every
// time a speed slider moves.
function makeCloudEditable(material, windy = false) {
  if (!material?.fragmentShader || material.userData.studyPatched) return;
  if (windy && applyWindyCloudBank(material, cloudUniforms)) return;
  const shader = material.fragmentShader;
  if (!shader.includes('vec4(color, alpha)')) return;
  const mainAt = shader.indexOf('void main()');
  if (mainAt < 0) return;
  const header = shader.slice(0, mainAt);
  const body = shader.slice(mainAt)
    .replace(/\buTime\b/g, 'uStudyTime')
    .replace(/vec4 mouseSample\s*=[^;]+;/g, '')
    .replace(/float mouse\s*=[^;]+;/g, 'float mouse = 0.;')
    .replace('dUv *= 1. + .03 * mouse;', '')
    .replace(/dUv \+= \.0[15] \* mouse;/g, '')
    // Break up the original solid middle band using its existing noise sample.
    .replace('alpha += smoothstep(0.2, .3, vUv.y)', 'alpha += (.16 + .12 * smoothness) * smoothstep(0.2, .3, vUv.y)')
    .replaceAll('vec4(color, alpha)', 'vec4(color, clamp(alpha * uStudyDensity * uStudyLayerOpacity, 0., 1.))');
  Object.assign(material.uniforms, cloudUniforms);
  // Broad diffuse sheets supply depth, while the shaped banks carry the visible
  // mist. Reduce the sheets so they no longer wash out the entire near mountain.
  material.uniforms.uStudyLayerOpacity = { value: shader.includes('alpha = cloud;') ? .32 : .65 };
  material.fragmentShader = `${header}\nuniform float uStudyTime, uStudyDensity, uStudyLayerOpacity;\n${body}`;
  material.userData.studyPatched = true;
  material.needsUpdate = true;
}

function applyOptions() {
  app.webgl.camera.parallaxIntensity = 0;
  app.webgl.camera.fov = options.fov;
  app.webgl.camera.updateProjectionMatrix();
  cloudUniforms.uStudyDensity.value = options.cloudDensity;
  const applyPalette = () => {
    sceneUniforms.uLightColor.value.set(options.lightColor);
    sceneUniforms.uDarkColor.value.set(options.darkColor);
    atmosphere?.setTheme(options.theme, options.lightColor, options.darkColor);
    terrain?.setTheme(options.theme);
    distantValley?.setTheme(options.theme);
  };
  if (themeTransition && appliedTheme !== options.theme) {
    themeTransition.retarget(applyPalette, { reducedMotion: reducedMotion.matches });
  } else {
    themeTransition?.finish();
    applyPalette();
  }
  appliedTheme = options.theme;
  document.documentElement.dataset.theme = options.theme;
  for (const key of ['background', 'ink', 'muted', 'surface', 'accent']) {
    document.documentElement.style.setProperty(`--${key}`, themes[options.theme][key]);
  }
  const toggle = document.querySelector('#theme-toggle');
  toggle.setAttribute('aria-pressed', String(options.theme === 'dark'));
  document.querySelector('#theme-label').textContent = options.theme === 'dark' ? 'Light mode' : 'Dark mode';
  document.querySelector('meta[name="theme-color"]').content = themes[options.theme].background;
  for (const [key, value] of Object.entries(options)) {
    const input = form.elements.namedItem(key);
    if (input) input.value = value;
    const output = document.querySelector(`#${key}-value`);
    if (output) output.textContent = key === 'fov' ? `${value}°` : value.toFixed(2);
  }
  cameraEditor?.refresh();
}

function saveOptions() {
  try { localStorage.setItem(storageKey, JSON.stringify({ ...options, atmosphereRevision, cloudRevision, cloudSpeedRevision })); } catch { /* Optional. */ }
}

try {
  const wrapper = document.querySelector('#canvas-wrapper');
  // Request transparency before the extracted renderer acquires this canvas.
  // Only the alternate look needs CSS visible behind the mountain.
  if (alpineLook) wrapper.querySelector('canvas').getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  await app.init(wrapper, wrapper.querySelector('canvas'));
  disableCloudPointerFeedback(app);
  const renderBudget = createRenderBudget({ app, wrapper, onResume: () => {
    previousElapsed = null;
  } });
  terrain = applyRockyTerrain(app, { alpine: alpineLook, beforeLightingChange: () => themeTransition?.finish() });
  cleanTerrainComposition(app);
  atmosphere = applyHeroAtmosphere(app, sceneUniforms, cloudUniforms.uStudyTime);
  app.webgl.mainScene.clouds.position.y += cloudPlacement.heightOffset;
  app.webgl.mainScene.clouds.updateMatrixWorld(true);
  for (const group of [app.webgl.mainScene.clouds, app.webgl.pages.Homepage.chapters.TopChapters.clouds]) {
    group.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => makeCloudEditable(material, group === app.webgl.mainScene.clouds));
    });
  }
  app.state.emit(events.ATTACH);
  app.state.emit(events.RESIZE, app.tools.viewport.infos);
  siteShell.scrollManager.init();
  const createCamera = presentation
    ? (await import('./presentation-camera.js')).createPresentationCamera
    : (await import('./camera-editor.js')).createCameraEditor;
  cameraEditor = createCamera({ app, events, options, applyOptions, saveOptions, scrollManager: siteShell.scrollManager, ...(alpineLook ? { getBaseView: (width, height, device) => alpineView(app, width, height, device) } : {}) });
  applyOptions();
  if (alpineLook) {
    alpineBackdrop = prepareAlpineBackdrop(app);
    distantValley = createDistantValley(app, terrain, cloudUniforms.uStudyTime);
    distantValley.setTheme(options.theme);
  }
  const syncBackdrop = () => {
    const night = terrain.uniforms.uRockNight.value;
    alpineBackdrop?.setNight(night, reducedMotion.matches ? Number(options.theme === 'dark') : night);
  };
  themeTransition = createThemeTransition({
    uniforms: [
      sceneUniforms.uLightColor, sceneUniforms.uDarkColor,
      ...['uRockMoss', 'uRockNight', 'uRockKeyDirection', 'uRockKeyColor', 'uRockFillColor',
        'uRockKeyIntensity', 'uRockExistingLight', 'uRockFillStrength', 'uRockHazeStrength',
        'uRockNormalStrength'].map(key => terrain.uniforms[key]),
      ...Object.entries(atmosphere.uniforms).filter(([key]) => key !== 'uStudyTime').map(([, uniform]) => uniform),
      ...(distantValley?.themeUniforms || []),
    ],
    direction: terrain.uniforms.uRockKeyDirection,
    onUpdate: syncBackdrop,
  });
  syncBackdrop();
  saveOptions();
  app.state.on(events.TICK, ({ et }) => {
    const elapsed = previousElapsed === null ? 0 : Math.max(0, et - previousElapsed);
    previousElapsed = et;
    themeTransition.tick(elapsed);
    if (!reducedMotion.matches) cloudUniforms.uStudyTime.value += elapsed * options.cloudSpeed;
    if (reducedMotion.matches) {
      // Retain explicit scroll control without the delayed camera drift.
      app.webgl.lerpedScrollProgress = window.scrollY;
    }
  });
  renderBudget.start();
  loading.hidden = true;
  document.body.dataset.sceneReady = 'true';
  // This is deliberately exposed: inspect models and uniforms in DevTools.
  window.mountainScene = { app, options, defaults, layout, cloudUniforms, sceneUniforms, cameraEditor, terrain, atmosphere, distantValley, renderBudget, applyOptions };
  if (window.parent !== window) window.parent.postMessage({ type: 'mountain-scene-ready' }, location.origin);

  document.querySelector('#theme-toggle').addEventListener('click', () => {
    options.theme = options.theme === 'dark' ? 'light' : 'dark';
    options.lightColor = themes[options.theme].lightColor;
    options.darkColor = themes[options.theme].darkColor;
    applyOptions();
    saveOptions();
  });

  // A studio and clean preview can be open together. Keep their atmosphere in
  // sync without importing another device's lens, framing, or cloud controls.
  window.addEventListener('storage', event => {
    if (event.key !== storageKey || !event.newValue) return;
    try {
      const saved = JSON.parse(event.newValue);
      if (!['light', 'dark'].includes(saved.theme)) return;
      options.theme = saved.theme;
      for (const key of ['lightColor', 'darkColor']) {
        options[key] = saved.atmosphereRevision === atmosphereRevision && /^#[0-9a-f]{6}$/i.test(saved[key])
          ? saved[key] : themes[saved.theme][key];
      }
      applyOptions();
    } catch { /* Ignore invalid settings from another preview. */ }
  });

  form.addEventListener('input', event => {
    const { name, type, value } = event.target;
    if (!(name in options)) return;
    options[name] = type === 'range' ? Number(value) : value;
    applyOptions();
    saveOptions();
  });
  form.addEventListener('submit', event => event.preventDefault());
  document.querySelector('#reset').addEventListener('click', () => {
    cameraEditor.reset();
    Object.assign(options, defaults);
    applyOptions();
    saveOptions();
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('#feedback').textContent = 'Original settings restored.';
  });
  document.querySelector('#export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...options, layout, camera: cameraEditor.getView() }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mountain-scene-settings.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.querySelector('#feedback').textContent = 'Settings exported.';
  });
  reducedMotion.addEventListener('change', applyOptions);
} catch (error) {
  loading.textContent = 'The scene could not load. Reload this page with WebGL enabled.';
  document.body.dataset.sceneReady = 'error';
  console.error('Mountain scene failed:', error);
  if (window.parent !== window) window.parent.postMessage({ type: 'mountain-scene-error' }, location.origin);
}

const progress = document.querySelector('#progress');
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
function updateProgress() {
  const value = Math.max(0, Math.min(100, window.scrollY / Math.max(1, maxScroll()) * 100));
  progress.value = value;
  document.querySelector('#progress-value').textContent = `${Math.round(value)}%`;
}
progress.addEventListener('input', () => window.scrollTo({ top: Number(progress.value) / 100 * maxScroll(), behavior: 'instant' }));
window.addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', updateProgress);
document.querySelector('#restart').addEventListener('click', () => {
  cameraEditor?.reset();
  window.scrollTo({ top: 0, behavior: 'instant' });
});
for (const panel of document.querySelectorAll('#controls, #camera-controls')) {
  panel.addEventListener('toggle', () => {
    if (panel.open) document.querySelectorAll('#controls, #camera-controls').forEach(other => {
      if (other !== panel) other.open = false;
    });
  });
}
function setUiVisible(visible) {
  document.querySelectorAll('.scene-ui').forEach(element => { element.hidden = !visible; });
  document.querySelector('#restore-ui').hidden = visible;
}
document.addEventListener('keydown', event => {
  if (event.key.toLowerCase() !== 'h' || event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input, textarea')) return;
  setUiVisible(document.querySelector('header').hidden);
});
document.querySelector('#restore-ui').addEventListener('click', () => setUiVisible(true));
