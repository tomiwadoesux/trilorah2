// Sculpt the existing instanced cloud cards into wind-driven banks. Five noise
// reads replace the old six; this adds no meshes, textures or render passes.
const bankShader = /* glsl */ `
precision highp float;
uniform float uChapter, uTransition;
uniform vec2 uResolution;
uniform sampler2D tNoise;
uniform float uStudyTime, uStudyDensity;
uniform vec3 uAtmosphereCloudLight, uAtmosphereCloudShadow;
varying float vSeed, vRatio;
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec2 screen = gl_FragCoord.xy / uResolution;
  float seed = fract(vSeed * .0371);

  // The silhouette AND its detail share this travelling coordinate system.
  // Nearby layers pass faster; no time-varying threshold makes clouds appear
  // out of nowhere. Aspect correction keeps the puffs round on phone screens.
  float travel = uStudyTime * mix(.042, .068, seed)
    + .025 * sin(uStudyTime * .19 + seed * 6.283);
  vec2 p = screen * vec2(uResolution.x / uResolution.y, 1.);
  p.x += seed * 12. - travel;
  vec2 textureUv = p + vec2(seed * 3.7, seed * 1.9);
  float broad = texture2D(tNoise, textureUv * .18).r;
  float billow = texture2D(tNoise, textureUv * .60 + broad * .025).r;
  float wisps = texture2D(tNoise, textureUv * 1.4).r;

  // Each cell contains an irregular cluster of overlapping rounded lobes.
  // Its edges are empty before the cell wraps, so it can pass out of frame
  // continuously rather than dissolving, resetting or sliding a flat sheet.
  float cell = floor((p.x + 1.5) / 3.);
  float variation = fract(sin(cell * 127.1 + seed * 311.7) * 43758.5453);
  vec2 q = vec2(p.x - cell * 3., p.y - mix(.24, .55, variation));
  q.x /= mix(.82, 1.12, seed);
  float shape = length((q - vec2(0., -.025)) / vec2(.72, .19));
  shape = min(shape, length((q - vec2(-.24, .055)) / vec2(.34, .25)));
  shape = min(shape, length((q - vec2(.19, .085)) / vec2(.40, .28)));
  shape += (broad - .5) * .52 + (billow - .5) * .24 + (wisps - .5) * .06;
  float bank = 1. - smoothstep(.65, 1.18, shape);
  float lowMist = (1. - smoothstep(.34, .86, screen.y))
    * (.025 + .015 * broad);
  float density = lowMist + .78 * bank * (.68 + .32 * broad);

  // Adjacent samples approximate a sun-facing rounded surface. Thin fringes
  // catch light; thicker cores shade themselves instead of looking flat white.
  float lightBroad = texture2D(tNoise, (textureUv + vec2(-.026, .035)) * .18).r;
  float lightBillow = texture2D(tNoise, (textureUv + vec2(-.026, .035)) * .60 + lightBroad * .025).r;
  float facing = clamp(.58 + q.y * bank * .7 + (broad - lightBroad) * 4.0
    + (billow - lightBillow) * 1.5, .16, 1.);
  float silverEdge = (1. - smoothstep(.10, .48, density)) * .15;
  float shade = clamp(facing - density * .22 + silverEdge, .12, .95);
  vec3 color = mix(uAtmosphereCloudShadow, uAtmosphereCloudLight, shade);

  float edge = smoothstep(0., .16, vUv.x) * (1. - smoothstep(.84, 1., vUv.x));
  edge *= smoothstep(0., .18, vUv.y) * (1. - smoothstep(.78, 1., vUv.y));
  float alpha = (1. - exp(-density * 2.15 * uStudyDensity)) * edge;
  alpha *= 1. - smoothstep(.65, .98, screen.y);
  alpha *= 1. - smoothstep(2.2, 2.3, uChapter - .3 * screen.y);
  alpha *= 1. - smoothstep(.3, 1., uTransition);
  alpha *= min(1., smoothstep(.88, .96, vNormal.b) + 1. - smoothstep(0., .05, uTransition));
  gl_FragColor = vec4(color, alpha);
}
`;

export function applyWindyCloudBank(material, cloudUniforms) {
  // Homepage transition sheets and diffuse cards have different varyings and
  // keep their existing adapter. Only the nine mountain cloud cards use this.
  if (!material?.fragmentShader?.includes('varying float vSeed, vRatio;')) return false;
  Object.assign(material.uniforms, cloudUniforms);
  material.fragmentShader = bankShader;
  material.userData.studyPatched = true;
  material.needsUpdate = true;
  return true;
}
