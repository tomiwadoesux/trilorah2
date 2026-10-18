// All translations use the chosen camera's axes. Positive Z moves forward,
// without turning the camera or changing its field of view.
export const cameraOffsetLimits = { x: [-80, 80], y: [-60, 60], z: [-80, 80] };

export function clampCameraOffset(value, output = { x: 0, y: 0, z: 0 }) {
  output.x = Math.max(-80, Math.min(80, Number.isFinite(value.x) ? value.x : 0));
  output.y = Math.max(-60, Math.min(60, Number.isFinite(value.y) ? value.y : 0));
  output.z = Math.max(-80, Math.min(80, Number.isFinite(value.z) ? value.z : 0));
  return output;
}

export function cameraLocalAxes(quaternion) {
  const [x, y, z, w] = quaternion;
  return {
    right: [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)],
    up: [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)],
    forward: [-2 * (x * z + y * w), -2 * (y * z - x * w), -(1 - 2 * (x * x + y * y))],
  };
}

// Supply an existing output and cached axes on a render tick to avoid allocation.
export function translateCameraView(base, offset, output = structuredClone(base), axes = cameraLocalAxes(base.quaternion)) {
  for (let i = 0; i < 3; i++) {
    const delta = axes.right[i] * offset.x + axes.up[i] * offset.y + axes.forward[i] * offset.z;
    output.position[i] = base.position[i] + delta;
    output.target[i] = base.target[i] + delta;
  }
  return output;
}
