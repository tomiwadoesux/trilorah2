// Backgrounds and interface colors match /hero's selected Carbon palette in
// src/app/hero/heroLooks.ts. Clouds and mist use nearby atmospheric shades.
// Vegetation accent source: --site-green in src/app/globals.css.
export const accentGreen = '#07271c';
export const themes = {
  light: {
    background: '#f0f1f3', ink: '#22252a', muted: '#5c6570', surface: '#ffffff', accent: '#07271c',
    lightColor: '#d6dadd', darkColor: '#cbd0d2',
    skyLight: '#f0f1f3', cloudLight: '#e5e8e9', cloudShadow: '#b5bdbe',
    skyLighting: [0.10, 0.56, 0.30], horizonMist: 0.42,
    rockKey: [0.92, 0.90, 0.86], rockFill: [0.36, 0.40, 0.44],
    rockIntensity: 1.30, rockExistingLight: 0.30,
  },
  dark: {
    background: '#060907', ink: '#edf3ee', muted: '#acb9ae', surface: '#141a16', accent: '#e4d87a',
    lightColor: '#252e2a', darkColor: '#0d1511',
    skyLight: '#26322c', cloudLight: '#3d4b45', cloudShadow: '#17201b',
    // A dark cloud ceiling and a diffuse opening within the app's Carbon colors.
    skyLighting: [0.04, 0.30, 0.45], horizonMist: 0.25,
    // Neutral night light keeps the exposed stone grey beside the yellow patches.
    rockKey: [0.36, 0.38, 0.40], rockFill: [0.24, 0.25, 0.26],
    rockIntensity: 0.95, rockExistingLight: 0.05,
  },
};

// Change these defaults, then use “Reset scene” to clear saved browser values.
export const defaults = Object.freeze({
  theme: 'light',
  cloudSpeed: 1.0,
  cloudDensity: 0.90,
  fov: 55,
  lightColor: themes.light.lightColor,
  darkColor: themes.light.darkColor,
});

// Raise the existing cloud banks across the mountain itself, not only its base.
export const cloudPlacement = { heightOffset: 25 };

// Preserve the source's virtual chapter dimensions and expose its first 200vh.
export const layout = { heroVh: 150, topChaptersVh: 1289.485677, scrollVh: 200 };
