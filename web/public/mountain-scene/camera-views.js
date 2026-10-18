// Chosen by the user in the camera studio, 15 October 2026.
// Preserve full precision and reference viewport dimensions for future edits.
export const chosenViews = {
  web: {
    position: [192.76073105106505, 17.752491274829737, -100.07008628456867],
    target: [-11.325105348100607, 1.0183314238296717, 47.66342134093377],
    quaternion: [-0.015077910075678576, 0.8901203603368311, 0.029528333541274394, 0.45451785252050886],
    up: [0, 1, 0], fov: 50, zoom: 1, scrollY: 0, scrollProgress: 0,
    device: 'window', orientation: 'landscape',
    viewport: { width: 1920, height: 963, aspect: 1.9937694704049844 },
  },
  ipad: {
    position: [206.49898377708814, 28.37390827990414, -122.8896161918332],
    target: [-11.325105348100607, 1.0183314238296717, 47.66342134093377],
    quaternion: [-0.021571026908020062, 0.8979336046184649, 0.04428640714222528, 0.4373655755057282],
    up: [0, 1, 0], fov: 55, zoom: 1, scrollY: 0, scrollProgress: 0,
    device: 'ipad', orientation: 'portrait',
    viewport: { width: 834, height: 1194, aspect: 0.6984924623115578 },
  },
  phone: {
    position: [276.23963757729393, 7.91885877539559, -113.05108126699832],
    target: [-11.325105348100607, 1.0183314238296717, 47.66342134093377],
    quaternion: [-0.005299076333408093, 0.8624663770355205, 0.00903205694124947, 0.5060060179688046],
    up: [0, 1, 0], fov: 55, zoom: 1, scrollY: 0, scrollProgress: 0,
    device: 'phone', orientation: 'portrait',
    viewport: { width: 390, height: 844, aspect: 0.46208530805687204 },
  },
};

export function cameraViewKey(width, height, device = 'window') {
  if (device === 'phone' || device === 'ipad') return device;
  if (device === 'laptop' || device === 'desktop') return 'web';
  if (width <= 767 || (width <= 960 && height <= 600)) return 'phone';
  return width <= 1199 ? 'ipad' : 'web';
}

export function chosenView(width, height, device) {
  return structuredClone(chosenViews[cameraViewKey(width, height, device)]);
}
