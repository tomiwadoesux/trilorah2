// Manual framing and lighting controls; camera position changes only on input.
export function createCameraPlayground({ camera, terrain, toolbar, getViewport, onLayout, initialOpen = true }) {
  const toggle = document.createElement('button');
  toggle.id = 'camera-playground-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Camera & light';
  toggle.setAttribute('aria-controls', 'camera-playground');
  toggle.setAttribute('aria-expanded', String(initialOpen));
  toolbar.prepend(toggle);

  const lightingSliders = [
    { key: 'sunAzimuth', label: 'Sun direction', min: -180, max: 180, step: 1, suffix: '°' },
    { key: 'sunElevation', label: 'Sun height', min: 5, max: 85, step: 1, suffix: '°' },
    { key: 'sunStrength', label: 'Sun strength', min: 0, max: 3, step: .05, suffix: '×' },
    { key: 'ambientFill', label: 'Shadow fill', min: 0, max: 2, step: .05, suffix: '×' },
    { key: 'detail', label: 'Rock detail', min: 0, max: 2, step: .05, suffix: '×' },
    { key: 'haze', label: 'Terrain mist', min: 0, max: 1.5, step: .05, suffix: '×' },
  ];
  const panel = document.createElement('aside');
  panel.id = 'camera-playground';
  panel.className = 'scene-ui';
  panel.setAttribute('aria-label', 'Camera and light controls');
  panel.innerHTML = `
    <div class="playground-heading"><h2>Camera & light</h2><span>Angle locked</span></div>
    <p class="playground-intro">Slide to find your framing. The camera keeps the same viewing angle.</p>
    <section class="playground-section" aria-label="Camera position">
      <h3>Camera position</h3>
      <label for="camera-offset-x">Left / right <output id="camera-offset-x-value">0</output></label>
      <input id="camera-offset-x" data-offset="x" type="range" min="-80" max="80" step="0.5" value="0">
      <label for="camera-offset-y">Down / up <output id="camera-offset-y-value">0</output></label>
      <input id="camera-offset-y" data-offset="y" type="range" min="-60" max="60" step="0.5" value="0">
      <label for="camera-offset-z">Farther / closer <output id="camera-offset-z-value">0</output></label>
      <input id="camera-offset-z" data-offset="z" type="range" min="-80" max="80" step="0.5" value="0">
      <button id="camera-framing-reset" class="playground-reset" type="button">Reset position</button>
    </section>
    <section class="playground-section" aria-label="Mountain lighting">
      <h3>Mountain lighting</h3>
      <p class="lighting-help">Move the light across the ridges. Lower shadow fill for stronger contrast.</p>
      ${lightingSliders.map(slider => `
        <label for="terrain-${slider.key}">${slider.label} <output id="terrain-${slider.key}-value"></output></label>
        <input id="terrain-${slider.key}" data-lighting="${slider.key}" type="range" min="${slider.min}" max="${slider.max}" step="${slider.step}">`).join('')}
      <button id="terrain-light-reset" class="playground-reset" type="button">Reset lighting</button>
    </section>
    <div class="playground-actions">
      <button id="camera-framing-copy" type="button">Copy view & lighting</button>
      <output id="camera-playground-feedback" role="status"></output>
    </div>
    <details class="camera-export">
      <summary>View coordinates</summary>
      <textarea id="camera-framing-json" readonly spellcheck="false" rows="5" aria-label="Current camera and lighting JSON"></textarea>
    </details>`;
  document.body.append(panel);
  panel.hidden = !initialOpen;
  document.body.dataset.cameraPanel = initialOpen ? 'open' : 'closed';
  const byId = id => panel.querySelector(`#${id}`);
  const feedback = message => { byId('camera-playground-feedback').textContent = message; };
  const format = (value, digits = 1) => Number(value.toFixed(digits)).toString();
  let previousCameraFamily;

  function exportView() {
    const { device, orientation, viewport } = getViewport();
    return { ...camera.getView(), device, orientation, viewport,
      theme: document.documentElement.dataset.theme, lighting: terrain.getLighting() };
  }
  function refresh() {
    const state = camera.getControls();
    if (state.cameraView !== previousCameraFamily) feedback('');
    previousCameraFamily = state.cameraView;
    for (const axis of ['x', 'y', 'z']) {
      byId(`camera-offset-${axis}`).value = state.offset[axis];
      byId(`camera-offset-${axis}-value`).textContent = format(state.offset[axis]);
    }
    const lighting = terrain.getLighting();
    for (const slider of lightingSliders) {
      byId(`terrain-${slider.key}`).value = lighting[slider.key];
      byId(`terrain-${slider.key}-value`).textContent = `${format(lighting[slider.key], slider.suffix === '°' ? 0 : 2)}${slider.suffix}`;
    }
    byId('camera-framing-json').value = JSON.stringify(exportView(), null, 2);
  }
  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.dataset.cameraPanel = open ? 'open' : 'closed';
    onLayout();
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setOpen(false); toggle.focus(); }
  });
  panel.querySelectorAll('[data-offset]').forEach(input => input.addEventListener('input', () => {
    camera.setOffset({ [input.dataset.offset]: Number(input.value) });
    feedback('');
  }));
  panel.querySelectorAll('[data-lighting]').forEach(input => input.addEventListener('input', () => {
    terrain.setLighting({ [input.dataset.lighting]: Number(input.value) });
    feedback('');
  }));
  byId('camera-framing-reset').addEventListener('click', () => {
    camera.reset();
    feedback('Your original chosen position is restored.');
  });
  byId('terrain-light-reset').addEventListener('click', () => {
    terrain.resetLighting();
    feedback('Original lighting restored.');
  });
  byId('camera-framing-copy').addEventListener('click', async () => {
    const data = JSON.stringify(exportView(), null, 2);
    byId('camera-framing-json').value = data;
    try {
      await navigator.clipboard.writeText(data);
      feedback('View and lighting copied. Paste them into the chat.');
    } catch {
      panel.querySelector('.camera-export').open = true;
      byId('camera-framing-json').focus();
      byId('camera-framing-json').select();
      feedback('Select and copy the coordinates below.');
    }
  });
  camera.subscribe(refresh);
  terrain.subscribeLighting(refresh);
  refresh();
  onLayout();
  return { refresh };
}
