const savedViewKey = 'montfort-camera-view-v1';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const degrees = 180 / Math.PI;

// Use the renderer's built-in orbitControls guard without changing its camera
// curves. The scene keeps rendering while this editor owns the camera pose.
export function createCameraEditor({ app, events, options, applyOptions, saveOptions, scrollManager }) {
  const camera = app.webgl.camera;
  const canvas = app.$canvas || document.querySelector('canvas');
  const panel = document.querySelector('#camera-controls');
  const byId = id => document.getElementById(id);
  const vector = () => camera.position.clone();
  const lenis = scrollManager?.lenis;
  let enabled = false;
  let pose;
  let entryView;
  let previousControls;
  let previousUp;
  let previousZoom;
  let wasStopped;
  let previousTouchAction;
  let lastReadout = 0;
  const pointers = new Map();
  const guard = { isCameraEditor: true };

  function capture() {
    camera.updateMatrixWorld();
    const intendedTarget = vector().copy(camera.targetLookAt).add(camera.chapterLookAt);
    const distance = clamp(camera.position.distanceTo(intendedTarget), 20, 800);
    const target = camera.getWorldDirection(vector()).multiplyScalar(distance).add(camera.position);
    return {
      position: camera.position.toArray(), target: target.toArray(),
      quaternion: camera.quaternion.toArray(), up: camera.up.toArray(),
      fov: camera.fov, zoom: camera.zoom, scrollY: window.scrollY,
    };
  }

  function getView() {
    if (enabled) pose.scrollY = window.scrollY;
    const view = enabled ? structuredClone(pose) : capture();
    view.scrollProgress = clamp(window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), 0, 1);
    return view;
  }

  function renderPose() {
    camera.position.fromArray(pose.position);
    camera.quaternion.fromArray(pose.quaternion);
    camera.up.fromArray(pose.up);
    if (camera.fov !== pose.fov || camera.zoom !== pose.zoom) {
      camera.fov = pose.fov;
      camera.zoom = pose.zoom;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }

  function spherical(view = pose) {
    const offset = vector().fromArray(view.position).sub(vector().fromArray(view.target));
    const distance = Math.max(.001, offset.length());
    return {
      distance,
      yaw: Math.atan2(offset.x, offset.z) * degrees,
      pitch: Math.asin(clamp(offset.y / distance, -1, 1)) * degrees,
    };
  }

  function aim() {
    camera.position.fromArray(pose.position);
    camera.up.fromArray(pose.up);
    camera.lookAt(vector().fromArray(pose.target));
    pose.quaternion = camera.quaternion.toArray();
    renderPose();
  }

  function orbit({ distance, yaw, pitch }) {
    const azimuth = yaw / degrees;
    const elevation = clamp(pitch, -85, 85) / degrees;
    const radius = Math.max(.1, distance);
    const horizontal = radius * Math.cos(elevation);
    pose.position = vector().fromArray(pose.target).add(vector().set(
      horizontal * Math.sin(azimuth), radius * Math.sin(elevation), horizontal * Math.cos(azimuth),
    )).toArray();
    aim();
    updateReadout();
  }

  function dolly(factor) {
    const direction = vector().fromArray(pose.position).sub(vector().fromArray(pose.target));
    const currentDistance = direction.length();
    const distance = clamp(currentDistance * factor, Math.min(20, currentDistance), Math.max(800, currentDistance));
    direction.setLength(distance);
    pose.position = direction.add(vector().fromArray(pose.target)).toArray();
    renderPose();
    updateReadout();
  }

  function pan(dx, dy) {
    renderPose();
    const distance = spherical().distance;
    const scale = 2 * distance * Math.tan(pose.fov * Math.PI / 360) / Math.max(1, canvas.clientHeight) / pose.zoom;
    const offset = vector().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(-dx * scale)
      .addScaledVector(vector().setFromMatrixColumn(camera.matrixWorld, 1), dy * scale);
    pose.position = vector().fromArray(pose.position).add(offset).toArray();
    pose.target = vector().fromArray(pose.target).add(offset).toArray();
    renderPose();
    updateReadout();
  }

  function updateReadout() {
    const view = getView();
    const angles = spherical(view);
    for (const [name, value] of Object.entries({ distance: angles.distance, yaw: angles.yaw, pitch: angles.pitch, fov: view.fov })) {
      const input = byId(`camera-${name}`);
      if (document.activeElement !== input) input.value = value;
      byId(`camera-${name}-value`).textContent = `${value.toFixed(1)}${name === 'distance' ? '' : '°'}`;
    }
    for (const [index, axis] of ['x', 'y', 'z'].entries()) {
      for (const [prefix, values] of [['camera-', view.position], ['camera-target-', view.target]]) {
        const input = byId(prefix + axis);
        if (document.activeElement !== input) input.value = values[index].toFixed(3);
      }
    }
    const json = byId('camera-json');
    if (document.activeElement !== json) json.value = JSON.stringify(view, null, 2);
  }

  function refresh() {
    if (enabled) {
      pose.fov = options.fov;
      renderPose();
    }
    updateReadout();
  }

  function setModeUI() {
    byId('camera-edit').textContent = enabled ? 'Return to scroll' : 'Explore camera';
    byId('camera-edit').setAttribute('aria-pressed', String(enabled));
    byId('camera-status').textContent = enabled ? 'Free camera' : 'Scroll view';
    byId('camera-tools').disabled = !enabled;
    byId('interaction-hint').textContent = enabled ? 'Drag to rotate · Scroll to zoom' : 'Scroll to explore';
    document.body.dataset.cameraMode = enabled ? 'free' : 'scroll';
    canvas.style.cursor = enabled ? 'grab' : '';
  }

  function enter(view = capture()) {
    if (!enabled) {
      previousControls = camera.orbitControls;
      previousUp = camera.up.clone();
      previousZoom = camera.zoom;
      wasStopped = !!lenis?.isStopped;
      previousTouchAction = canvas.style.touchAction;
      lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
      lenis?.stop();
      camera.orbitControls = guard;
      canvas.style.touchAction = 'none';
      enabled = true;
      entryView = structuredClone(view);
    }
    pose = structuredClone(view);
    options.fov = pose.fov;
    renderPose();
    applyOptions();
    setModeUI();
    updateReadout();
  }

  function reset() {
    if (!enabled) return;
    pointers.clear();
    camera.orbitControls = previousControls;
    camera.up.copy(previousUp);
    camera.zoom = previousZoom;
    camera.updateProjectionMatrix();
    canvas.style.touchAction = previousTouchAction;
    enabled = false;
    if (!wasStopped) lenis?.start();
    setModeUI();
    updateReadout();
  }

  function validView(view) {
    const array = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
    return view && array(view.position, 3) && array(view.target, 3) && array(view.quaternion, 4) && array(view.up, 3)
      && Number.isFinite(view.fov) && view.fov >= 20 && view.fov <= 90
      && Number.isFinite(view.zoom) && view.zoom > 0 && Number.isFinite(view.scrollY)
      && view.quaternion.some(value => value !== 0);
  }

  function readSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(savedViewKey));
      return validView(saved) ? saved : null;
    } catch { return null; }
  }

  function setView(view) {
    if (!validView(view) || (view.scrollProgress !== undefined && !Number.isFinite(view.scrollProgress))) return false;
    // Device previews can resize faster than Lenis's debounced resize handler.
    lenis?.resize();
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const scrollY = view.scrollProgress !== undefined
      ? clamp(view.scrollProgress, 0, 1) * maxScroll
      : clamp(view.scrollY, 0, maxScroll);
    if (lenis) lenis.scrollTo(scrollY, { immediate: true, force: true });
    else window.scrollTo({ top: scrollY, behavior: 'instant' });
    enter({ ...view, scrollY });
    byId('camera-feedback').textContent = 'Camera view applied.';
    return true;
  }

  function enable() {
    if (!enabled) enter();
  }

  byId('camera-edit').addEventListener('click', () => enabled ? reset() : enter());
  byId('camera-zoom-in').addEventListener('click', () => dolly(.85));
  byId('camera-zoom-out').addEventListener('click', () => dolly(1 / .85));
  for (const name of ['distance', 'yaw', 'pitch']) {
    byId(`camera-${name}`).addEventListener('input', event => {
      if (enabled) orbit({ ...spherical(), [name]: Number(event.target.value) });
    });
  }
  byId('camera-fov').addEventListener('input', event => {
    options.fov = Number(event.target.value);
    applyOptions();
    saveOptions();
  });
  for (const [index, axis] of ['x', 'y', 'z'].entries()) {
    for (const [prefix, property] of [['camera-', 'position'], ['camera-target-', 'target']]) {
      const input = byId(prefix + axis);
      input.addEventListener('input', () => {
        if (!enabled || input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
        pose[property][index] = clamp(input.valueAsNumber, -5000, 5000);
        if (vector().fromArray(pose.position).distanceToSquared(vector().fromArray(pose.target)) < .01) pose.target[2] -= 1;
        aim();
        updateReadout();
      });
    }
  }
  byId('camera-reset-view').addEventListener('click', () => {
    enter(entryView);
    byId('camera-feedback').textContent = 'Returned to where you started exploring.';
  });
  byId('camera-copy').addEventListener('click', async () => {
    const json = byId('camera-json');
    json.value = JSON.stringify(getView(), null, 2);
    try {
      await navigator.clipboard.writeText(json.value);
      byId('camera-feedback').textContent = 'Camera setup copied. Paste it to reuse this view.';
    } catch {
      json.focus();
      json.select();
      byId('camera-feedback').textContent = 'Select and copy the camera setup below.';
    }
  });
  byId('camera-save').addEventListener('click', () => {
    try {
      localStorage.setItem(savedViewKey, JSON.stringify(getView()));
      byId('camera-load').disabled = false;
      byId('camera-feedback').textContent = 'View saved in this browser.';
    } catch { byId('camera-feedback').textContent = 'Storage is unavailable. Use Copy view instead.'; }
  });
  byId('camera-load').disabled = !readSaved();
  byId('camera-load').addEventListener('click', () => {
    const saved = readSaved();
    if (!saved) return;
    const scrollY = clamp(saved.scrollY, 0, document.documentElement.scrollHeight - innerHeight);
    if (lenis) lenis.scrollTo(scrollY, { immediate: true, force: true });
    else window.scrollTo({ top: scrollY, behavior: 'instant' });
    enter({ ...saved, scrollY });
    byId('camera-feedback').textContent = 'Saved view loaded.';
  });

  canvas.addEventListener('contextmenu', event => { if (enabled) event.preventDefault(); });
  canvas.addEventListener('pointerdown', event => {
    if (!enabled || event.button > 2) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', event => {
    if (!enabled || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    const before = [...pointers.values()];
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...pointers.values()];
    if (after.length === 2) {
      const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      pan((after[0].x + after[1].x - before[0].x - before[1].x) / 2,
        (after[0].y + after[1].y - before[0].y - before[1].y) / 2);
      if (distance(after) > 1 && distance(before) > 1) dolly(distance(before) / distance(after));
    } else if (after.length === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (event.shiftKey || event.buttons & 2 || event.buttons & 4) pan(dx, dy);
      else {
        const current = spherical();
        orbit({ ...current, yaw: current.yaw - dx * .25, pitch: current.pitch + dy * .25 });
      }
    }
  });
  function release(event) {
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (enabled && !pointers.size) canvas.style.cursor = 'grab';
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', event => pointers.delete(event.pointerId));
  canvas.addEventListener('wheel', event => {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    dolly(Math.exp(clamp(pixels, -150, 150) * .0015));
  }, { passive: false });

  app.state.on(events.TICK, () => {
    if (enabled) renderPose();
    const now = performance.now();
    if (panel.open && now - lastReadout > 120) {
      lastReadout = now;
      updateReadout();
    }
  });
  setModeUI();
  updateReadout();
  return { get enabled() { return enabled; }, refresh, reset, getView, setView, enable };
}
