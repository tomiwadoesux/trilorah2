import { themes } from './config.js';

// Reuses the existing sky mesh and noise texture. No added images, geometry or
// render passes. Cloud silhouettes use the original meshes and noise textures.
const skyShader = /* glsl */ `
precision highp float;
uniform sampler2D tNoise;
uniform vec2 uResolution;
uniform float uStudyTime;
uniform vec3 uAtmosphereSkyLight, uAtmosphereSkyDark, uAtmosphereFog;
uniform vec3 uAtmosphereBackdrop;
uniform vec3 uAtmosphereSkyLighting;
uniform float uAtmosphereHorizonMist;
varying vec2 vUv;

void main() {
  vec2 screen = gl_FragCoord.xy / uResolution;
  vec2 uv = vUv * vec2(3.5, 5.);
  vec2 drift = vec2(-.002, .0006) * uStudyTime;
  float broad = texture2D(tNoise, uv * .65 + drift).r;
  float detail = texture2D(tNoise, uv * 2.1 + drift * 1.4 + broad * .16).g;
  float wisps = texture2D(tNoise, uv * 5.4 + drift * 1.8).r;
  float weather = smoothstep(.20, .76, broad * .56 + detail * .34 + wisps * .10);
  // A diffuse opening on the left, with a heavier overhead cloud ceiling.
  float opening = 1. - smoothstep(.08, .70, length((screen - vec2(.27, .73)) * vec2(1., 1.25)));
  float light = clamp(dot(uAtmosphereSkyLighting, vec3(1., weather, opening)), 0., 1.);
  vec3 color = mix(uAtmosphereSkyDark, uAtmosphereSkyLight, light);
  color = mix(color, uAtmosphereFog, uAtmosphereHorizonMist * (1. - smoothstep(.05, .6, screen.y)));
  // The clear upper sky meets the exact app background; texture returns gradually
  // toward the cloud banks, avoiding a differently colored panel behind the scene.
  color = mix(color, uAtmosphereBackdrop, smoothstep(.40, .94, screen.y));
  gl_FragColor = vec4(color, 1.);
}
`;

export function applyHeroAtmosphere(app, sceneUniforms, clock) {
  // Unlike the terrain PBR shader, these raw sky/cloud shaders do not encode
  // linear output. Keep display colors separate from the linear terrain fog.
  const displayColor = hex => sceneUniforms.uLightColor.value.clone().set(hex).convertLinearToSRGB();
  const uniforms = {
    uAtmosphereSkyLight: { value: displayColor(themes.light.skyLight) },
    uAtmosphereBackdrop: { value: displayColor(themes.light.background) },
    uAtmosphereSkyDark: { value: displayColor(themes.light.darkColor) },
    uAtmosphereFog: { value: displayColor(themes.light.lightColor) },
    uAtmosphereCloudLight: { value: displayColor(themes.light.cloudLight) },
    uAtmosphereCloudShadow: { value: displayColor(themes.light.cloudShadow) },
    uAtmosphereSkyLighting: { value: app.webgl.camera.position.clone().fromArray(themes.light.skyLighting) },
    uAtmosphereHorizonMist: { value: themes.light.horizonMist },
    uStudyTime: clock,
  };
  const sky = app.webgl.mainScene.sky.material;
  sky.fragmentShader = skyShader;
  Object.assign(sky.uniforms, uniforms);
  sky.needsUpdate = true;

  const materials = new Set();
  for (const group of [app.webgl.mainScene.clouds, app.webgl.pages.Homepage.chapters.TopChapters.clouds]) {
    group.traverse(object => {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material?.fragmentShader?.includes('vec4(color, alpha)')) materials.add(material);
      }
    });
  }
  for (const material of materials) {
    let shader = material.fragmentShader;
    shader = shader.replace(
      'vec3 color = mix(vec3(0.82,0.86,0.88), 1.1 * vec3(0.961,0.969,0.976), cloudDarkness);',
      'vec3 color = mix(uAtmosphereCloudShadow, uAtmosphereCloudLight, clamp(cloudDarkness, 0., 1.));',
    ).replace(
      'vec3 color = mix(vec3(0.737,0.773,0.8), vec3(0.961,0.969,0.976), clamp(clouds, 0., 1.));',
      'vec3 color = mix(uAtmosphereCloudShadow, uAtmosphereCloudLight, clamp(clouds, 0., 1.));',
    ).replace('color *= vec3(.8, .85, .87);', '')
      .replace('vec3(.95, 1., .9)', 'uAtmosphereCloudLight')
      .replace('void main()', 'uniform vec3 uAtmosphereCloudLight, uAtmosphereCloudShadow;\nvoid main()');
    material.fragmentShader = shader;
    Object.assign(material.uniforms, {
      uAtmosphereCloudLight: uniforms.uAtmosphereCloudLight,
      uAtmosphereCloudShadow: uniforms.uAtmosphereCloudShadow,
    });
    if (material.uniforms.uLightColor) material.uniforms.uLightColor = uniforms.uAtmosphereFog;
    material.needsUpdate = true;
  }

  return {
    uniforms,
    setTheme(theme, lightColor, darkColor) {
      const palette = themes[theme];
      uniforms.uAtmosphereSkyLighting.value.fromArray(palette.skyLighting);
      uniforms.uAtmosphereHorizonMist.value = palette.horizonMist;
      for (const [key, hex] of Object.entries({
        uAtmosphereSkyLight: palette.skyLight,
        uAtmosphereBackdrop: palette.background,
        uAtmosphereSkyDark: darkColor,
        uAtmosphereFog: lightColor,
        uAtmosphereCloudLight: palette.cloudLight,
        uAtmosphereCloudShadow: palette.cloudShadow,
      })) uniforms[key].value.set(hex).convertLinearToSRGB();
    },
  };
}
