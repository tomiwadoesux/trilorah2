import { accentGreen, themes } from './config.js';

// Concept 01: exposed charcoal rock. Array colors are linear-light RGB values;
// theme accent colors are sRGB hex values, converted by Three's Color.set.
// Reuses the loaded rock/normal/noise textures; no extra assets or render passes.
export const rockyTerrainStyle = {
  shadow: [0.025, 0.035, 0.038],
  highlight: [0.10, 0.12, 0.125],
  moss: accentGreen,
  mossStrength: 0.94,
  roughness: 0.90,
  normalStrength: 1.05,
  keyDirection: [0.22, 0.68, -0.70],
};

// Y is up; azimuth starts at +Z and turns toward +X. Derive the initial angles
// from the approved light vector so opening the controls does not relight it.
const degrees = 180 / Math.PI;
const keyLength = Math.hypot(...rockyTerrainStyle.keyDirection);
export const terrainLightingDefaults = Object.freeze({
  sunAzimuth: Math.atan2(rockyTerrainStyle.keyDirection[0], rockyTerrainStyle.keyDirection[2]) * degrees,
  sunElevation: Math.asin(rockyTerrainStyle.keyDirection[1] / keyLength) * degrees,
  sunStrength: 1,
  ambientFill: 1,
  haze: 1,
  detail: 1,
});

export const terrainLightingLimits = Object.freeze({
  sunAzimuth: Object.freeze([-180, 180]),
  sunElevation: Object.freeze([5, 85]),
  sunStrength: Object.freeze([0, 3]),
  ambientFill: Object.freeze([0, 2]),
  haze: Object.freeze([0, 1.5]),
  detail: Object.freeze([0, 2]),
});

const appliedMaterials = new WeakMap();

const surfaceShader = /* glsl */ `
uniform sampler2D tRockDiffuse, tAlpineMask;
uniform float uTerrainAlpine;
uniform vec3 uRockShadow, uRockHighlight, uRockMoss, uRockGreen;
uniform float uRockNight;
uniform float uRockMossStrength, uRockRoughness, uRockNormalStrength;
uniform vec3 uRockKeyDirection, uRockKeyColor, uRockFillColor;
uniform float uRockKeyIntensity, uRockExistingLight, uRockFillStrength, uRockHazeStrength;

vec3 rockySurface(vec2 uv, vec3 localPosition, vec3 faceNormal) {
  // Different scales break up repetition while the stretched sample adds strata.
  vec3 grain = texture2D(tRockDiffuse, uv * vec2(11., 16.)).rgb;
  vec3 strata = texture2D(tRockDiffuse, uv * vec2(3.5, 29.) + vec2(.23, .41)).rgb;
  float stone = dot(mix(grain, strata, .38), vec3(.2126, .7152, .0722));
  vec3 color = mix(uRockShadow, uRockHighlight, smoothstep(.04, .53, stone));
  if (uTerrainAlpine > .5) {
    float snow = texture2D(tAlpineMask, vec2(uv.x, 1. - uv.y)).r;
    vec3 alpineStone = mix(vec3(.065, .074, .084), vec3(.26, .27, .29), smoothstep(.04, .53, stone));
    return mix(alpineStone, vec3(.72, .77, .84), smoothstep(.15, .85, snow));
  }
  float patches = texture2D(tPerlin, uv * 3.1 + vec2(.17, .31)).r;
  vec3 worldNormal = normalize((vec4(normalize(faceNormal), 0.) * viewMatrix).xyz);
  float slopes = smoothstep(.05, .65, worldNormal.y);
  float belowSummit = 1. - smoothstep(30., 53., localPosition.y);
  float moss = smoothstep(.64, .81, patches) * belowSummit
    * (.3 + .7 * slopes) * uRockMossStrength;
  float grainBrightness = .8 + .5 * grain.g;
  vec3 daySurface = mix(color, uRockGreen * grainBrightness, moss);
  // A pale accent makes even weak moss blends look yellow. Select only the
  // visibly green part of the original day surface, keeping its grey rock clear.
  float greenDominance = (daySurface.g - max(daySurface.r, daySurface.b))
    / max(daySurface.g, .0001);
  // Retain the approved green-only selection, but feather its inside edge and
  // carry the existing stone grain through the pigment instead of painting it flat.
  float accentPatch = smoothstep(.08, .40, greenDominance);
  float rockGrain = mix(.70, 1.30, smoothstep(.04, .60, stone));
  vec3 texturedGreen = uRockGreen * rockGrain;
  daySurface = mix(color, texturedGreen, moss);
  float pigmentGrain = mix(.22, .78, smoothstep(.10, .40, grain.g))
    * mix(.65, 1., smoothstep(.10, .40, strata.g));
  vec3 nightSurface = mix(color * 1.65, uRockMoss * pigmentGrain, accentPatch * .80);
  return mix(daySurface, nightSurface, uRockNight);
}

vec3 lightRock(vec3 existingLight, vec3 albedo, vec3 detailNormal, vec3 faceNormal) {
  // World-space sunlight reveals slopes independently of the camera position.
  vec3 viewNormal = normalize(mix(faceNormal, detailNormal, .32));
  vec3 worldNormal = normalize((vec4(viewNormal, 0.) * viewMatrix).xyz);
  // A small wrap keeps the terminator soft without flattening the shadow faces.
  float key = clamp((dot(worldNormal, normalize(uRockKeyDirection)) + .10) / 1.10, 0., 1.);
  float sky = .5 + .5 * worldNormal.y;
  vec3 keyTint = uRockKeyColor;
  if (uTerrainAlpine > .5) {
    vec3 worldPosition = cameraPosition + (vec4(-vViewPosition, 0.) * viewMatrix).xyz;
    // Warm light reaches the summit; lower slopes sit in cool valley shade.
    float summit = smoothstep(-2., 43., worldPosition.y);
    vec3 valleyLight = mix(vec3(.20, .28, .34), vec3(.025, .09, .20), uRockNight);
    keyTint = mix(valleyLight, uRockKeyColor, summit);
    key *= mix(.65, 1., summit);
  }
  vec3 illumination = keyTint * key * uRockKeyIntensity
    + uRockFillColor * (.14 + .24 * sky) * uRockFillStrength;
  return existingLight * uRockExistingLight + albedo * illumination;
}

float terrainHaze(vec3 viewPosition) {
  // vViewPosition is in eye space for every mesh, including transformed peaks.
  // Recover world height using the view rotation, not the peak's local y value.
  float distanceToFace = max(viewPosition.z, 0.);
  vec3 worldPosition = cameraPosition + (vec4(-viewPosition, 0.) * viewMatrix).xyz;
  float distanceMist = smoothstep(140., 650., distanceToFace);
  float valleyMist = (1. - smoothstep(-6., 32., worldPosition.y))
    * smoothstep(55., 220., distanceToFace);
  return clamp(.012 + .42 * distanceMist + .06 * valleyMist, 0., .56);
}
`;

function replaceRequired(shader, pattern, replacement, label) {
  const changed = shader.replace(pattern, replacement);
  if (changed === shader) throw new Error(`Rocky terrain: missing ${label} shader section.`);
  return changed;
}

function addSurfaceShader(shader) {
  return replaceRequired(shader, 'void main() {', `${surfaceShader}\nvoid main() {`, 'main');
}

function addTerrainLighting(shader) {
  // Near ridges remain crisp; progressively softer far peaks create depth.
  return replaceRequired(shader,
    /float depth = computeDepth\(gl_FragCoord\.z, uFogNear, uFogFar\);\s*depth = smoothstep\(0\.01, \.[36], depth\);\s*depth \*= 1\. - transition;\s*outgoingLight = mix\(outgoingLight, uLightColor, depth\);/,
    `outgoingLight = lightRock(outgoingLight, diffuseColor.rgb, normal, vNormal);
     float depth = terrainHaze(vViewPosition) * uRockHazeStrength * (1. - transition);
     outgoingLight = mix(outgoingLight, uLightColor, depth);`, 'terrain lighting and haze');
}

function patchMountain(material) {
  let shader = addSurfaceShader(material.fragmentShader);
  // Replace the snow mask, snow-white base and other page albedo branches as one
  // block. The existing lightmap, PBR lighting, distance fog and fades stay below.
  shader = replaceRequired(shader,
    /vec4 baseColorMapSample = vec4\(\.98, \.98, 1\., 1\.\);[\s\S]*?diffuseColor \*= baseColorMapSample;/,
    `vec4 mixMapSample = vec4(0.);
     vec3 totalEmissiveRadiance = vec3(0.);
     diffuseColor.rgb *= rockySurface(vUv, vPosition, vNormal);`, 'mountain snow albedo');
  shader = replaceRequired(shader,
    /nTex2\.xy \*= mix\([^;]+;/,
    'nTex2.xy *= uRockNormalStrength;', 'snow-masked rock normal');
  // Remove moving snow brightening and its changing normal. Cloud animation is
  // a separate material and is deliberately untouched by this adapter.
  shader = replaceRequired(shader,
    /\/\* Windy snow \*\/[\s\S]*?normal = mix\(perturbedNormal, transitionNormal, transitionWave\);/,
    'normal = mix(normal, transitionNormal, transitionWave);', 'windy snow');
  shader = replaceRequired(shader,
    'float roughness = clamp(uRoughness, 0.04, 1.0);',
    'float roughness = clamp(uRockRoughness, 0.04, 1.0);', 'mountain roughness');
  material.fragmentShader = addTerrainLighting(shader);
}

function patchPeaks(material) {
  let shader = addSurfaceShader(material.fragmentShader);
  // These three extra peaks have a baked snowy color map. Retain only its broad
  // light/shadow information, then color the entire surface with exposed rock.
  shader = replaceRequired(shader,
    /vec2 sUv = gl_FragCoord\.xy \/ uResolution;[\s\S]*?diffuseColor\.rgb = mix\(diffuseColor\.rgb, vec3\(1\.\), windySnow\);/,
    `float bakedShade = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
     diffuseColor.rgb = rockySurface(vUv, vPosition, vNormal)
       * mix(.46, 1.12, smoothstep(.08, .95, bakedShade));`, 'peak snow albedo');
  shader = replaceRequired(shader,
    'normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(tPerlin, 6. * vUv, 2.));',
    `normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(tPerlin, 6. * vUv, .45 * uRockNormalStrength / ${rockyTerrainStyle.normalStrength}));`, 'peak normal');
  shader = replaceRequired(shader,
    'float roughness = clamp(armSample.g * uRoughness, 0.04, 1.0);',
    'float roughness = clamp(uRockRoughness, 0.04, 1.0);', 'peak roughness');
  material.fragmentShader = addTerrainLighting(shader);
  material.normalMapTransform.repeat.set(10, 16);
  material.normalMapTransform.update();
}

export function applyRockyTerrain(app, { alpine = false, beforeLightingChange = () => {} } = {}) {
  const mountain = app.webgl.mainScene.mountains.mountainMaterial;
  if (appliedMaterials.has(mountain)) return appliedMaterials.get(mountain);
  const rockTexture = app.core.assetsManager.get('snowyRock');
  if (!rockTexture?.isTexture) throw new Error('Rocky terrain: the rock texture is not loaded.');

  const color = values => mountain.uniforms.uColor.value.clone().setRGB(...values);
  const uniforms = {
    tRockDiffuse: { value: rockTexture },
    tAlpineMask: { value: app.core.assetsManager.get('snowRockMix') },
    uTerrainAlpine: { value: alpine ? 1 : 0 },
    uRockShadow: { value: color(rockyTerrainStyle.shadow) },
    uRockHighlight: { value: color(rockyTerrainStyle.highlight) },
    uRockMoss: { value: mountain.uniforms.uColor.value.clone().set(rockyTerrainStyle.moss) },
    uRockGreen: { value: mountain.uniforms.uColor.value.clone().set(rockyTerrainStyle.moss) },
    uRockNight: { value: 0 },
    uRockMossStrength: { value: rockyTerrainStyle.mossStrength },
    uRockRoughness: { value: rockyTerrainStyle.roughness },
    uRockNormalStrength: { value: rockyTerrainStyle.normalStrength },
    uRockKeyDirection: { value: app.webgl.camera.position.clone().fromArray(rockyTerrainStyle.keyDirection) },
    uRockKeyColor: { value: color(themes.light.rockKey) },
    uRockFillColor: { value: color(themes.light.rockFill) },
    uRockKeyIntensity: { value: themes.light.rockIntensity },
    uRockExistingLight: { value: themes.light.rockExistingLight },
    uRockFillStrength: { value: 1 },
    uRockHazeStrength: { value: 1 },
  };
  const peaks = new Set();
  app.webgl.pages.Homepage.env.traverse(object => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material?.fragmentShader?.includes('diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.), windySnow);')) {
        peaks.add(material);
      }
    }
  });
  if (peaks.size === 0) throw new Error('Rocky terrain: the homepage peak materials are not loaded.');

  patchMountain(mountain);
  for (const peak of peaks) patchPeaks(peak);
  let activePalette = themes.light;
  const themeDefaults = {
    light: { ...terrainLightingDefaults, sunAzimuth: alpine ? 135 : 162.55, sunElevation: 52, ...(alpine ? { haze: 0 } : {}) },
    dark: { ...terrainLightingDefaults, sunAzimuth: -125, sunElevation: 16, ...(alpine ? { haze: 0 } : {}) },
  };
  const themeLighting = { light: { ...themeDefaults.light }, dark: { ...themeDefaults.dark } };
  let activeTheme = null;
  const lighting = { ...themeDefaults.light };
  const lightingListeners = new Set();
  const syncLighting = () => {
    const azimuth = lighting.sunAzimuth / degrees;
    const elevation = lighting.sunElevation / degrees;
    const horizontal = Math.cos(elevation);
    // Only changes to controls/themes update uniforms; no render-tick work.
    uniforms.uRockKeyDirection.value.set(
      Math.sin(azimuth) * horizontal * keyLength,
      Math.sin(elevation) * keyLength,
      Math.cos(azimuth) * horizontal * keyLength,
    );
    uniforms.uRockKeyIntensity.value = activePalette.rockIntensity * lighting.sunStrength;
    uniforms.uRockExistingLight.value = activePalette.rockExistingLight * lighting.ambientFill;
    uniforms.uRockFillStrength.value = lighting.ambientFill;
    uniforms.uRockHazeStrength.value = lighting.haze;
    uniforms.uRockNormalStrength.value = rockyTerrainStyle.normalStrength * lighting.detail;
  };
  const state = {
    type: 'dark-rock', uniforms, materials: [mountain, ...peaks],
    setTheme(theme) {
      theme = theme === 'dark' ? 'dark' : 'light';
      if (activeTheme !== theme) {
        if (activeTheme) themeLighting[activeTheme] = { ...lighting };
        Object.assign(lighting, themeLighting[theme]);
        activeTheme = theme;
      }
      const basePalette = themes[theme] || themes.light;
      const palette = alpine ? { ...basePalette,
        rockKey: theme === 'dark' ? [1.10, .66, .40] : [.98, 1.02, 1.08],
        rockFill: theme === 'dark' ? [.055, .12, .23] : [.30, .36, .42],
        rockIntensity: theme === 'dark' ? 1.15 : 1.45, rockExistingLight: 0,
      } : basePalette;
      activePalette = palette;
      uniforms.uRockMoss.value.set(palette.accent);
      uniforms.uRockNight.value = theme === 'dark' ? 1 : 0;
      uniforms.uRockKeyColor.value.setRGB(...palette.rockKey);
      uniforms.uRockFillColor.value.setRGB(...palette.rockFill);
      syncLighting();
      for (const listener of lightingListeners) listener({ ...lighting });
    },
    getLighting() {
      return { ...lighting };
    },
    setLighting(partial = {}) {
      beforeLightingChange();
      let changed = false;
      for (const [key, limits] of Object.entries(terrainLightingLimits)) {
        if (!Number.isFinite(partial?.[key])) continue;
        const value = Math.max(limits[0], Math.min(limits[1], partial[key]));
        if (lighting[key] !== value) {
          lighting[key] = value;
          changed = true;
        }
      }
      if (changed) {
        syncLighting();
        for (const listener of lightingListeners) listener({ ...lighting });
      }
      return { ...lighting };
    },
    resetLighting() {
      return state.setLighting(themeDefaults[activeTheme || 'light']);
    },
    subscribeLighting(listener) {
      lightingListeners.add(listener);
      listener({ ...lighting });
      return () => lightingListeners.delete(listener);
    },
  };
  for (const material of state.materials) {
    Object.assign(material.uniforms, uniforms);
    material.userData.rockyTerrain = true;
    material.needsUpdate = true;
  }
  appliedMaterials.set(mountain, state);
  return state;
}
