import { cameraViewKey, chosenView } from './camera-views.js';
import { cameraLocalAxes, clampCameraOffset, translateCameraView } from './camera-position.js';

// Sliders translate each chosen view while retaining its exact facing and lens.
// Reapply the static pose on the scene tick after the original camera update.
export function createPresentationCamera({ app, events, options, scrollManager, getBaseView = chosenView }) {
  const camera = app.webgl.camera;
  const states = new Map();
  const listeners = new Set();
  const previousControls = camera.orbitControls;
  let base;
  let view;
  let axes;
  let offset;
  let viewKey;
  let device = 'window';
  let disposed = false;
  camera.orbitControls = { isPresentationCamera: true };
  scrollManager?.lenis?.scrollTo(0, { immediate: true, force: true });
  scrollManager?.lenis?.stop();

  function renderPose() {
    if (disposed) return;
    translateCameraView(base, offset, view, axes);
    options.fov = view.fov;
    camera.position.fromArray(view.position);
    camera.quaternion.fromArray(view.quaternion);
    camera.up.fromArray(view.up);
    if (camera.fov !== view.fov || camera.zoom !== view.zoom) {
      camera.fov = view.fov;
      camera.zoom = view.zoom;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }

  function resize() {
    if (disposed) return;
    const nextKey = cameraViewKey(innerWidth, innerHeight, device);
    const changed = nextKey !== viewKey;
    if (changed) {
      viewKey = nextKey;
      base = getBaseView(innerWidth, innerHeight, device);
      view = structuredClone(base);
      axes = cameraLocalAxes(base.quaternion);
      if (!states.has(viewKey)) states.set(viewKey, { x: 0, y: 0, z: 0 });
      offset = states.get(viewKey);
    }
    document.body.dataset.cameraView = viewKey;
    renderPose();
    if (changed) notifyControls();
  }

  function getControls() {
    return { offset: { ...offset }, cameraView: viewKey };
  }

  function notifyControls() {
    if (!listeners.size) return;
    const controls = getControls();
    listeners.forEach(listener => listener(controls));
  }

  function setOffset(partial = {}) {
    for (const axis of ['x', 'y', 'z']) {
      if (Number.isFinite(partial[axis])) offset[axis] = partial[axis];
    }
    clampCameraOffset(offset, offset);
    renderPose();
    notifyControls();
    return getControls();
  }

  resize();
  app.state.on(events.RESIZE, resize);
  app.state.on(events.TICK, renderPose);
  return {
    get enabled() { return true; },
    refresh: renderPose,
    getControls,
    subscribe(listener) {
      listeners.add(listener);
      listener(getControls());
      return () => listeners.delete(listener);
    },
    setOffset,
    reset() {
      Object.assign(offset, { x: 0, y: 0, z: 0 });
      renderPose();
      notifyControls();
      return structuredClone(view);
    },
    setDevice(value) {
      if (!['window', 'phone', 'ipad', 'laptop', 'desktop'].includes(value)) return;
      if (value === device) return getControls();
      device = value;
      resize();
      return getControls();
    },
    getView() {
      return {
        ...structuredClone(view),
        cameraAdjustment: {
          ...getControls(), coordinateSpace: 'camera-local',
        },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      app.state.off(events.RESIZE, resize);
      app.state.off(events.TICK, renderPose);
      listeners.clear();
      camera.orbitControls = previousControls;
    },
  };
}
