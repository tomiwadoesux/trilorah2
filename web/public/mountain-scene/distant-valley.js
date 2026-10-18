// One existing instanced peak mesh and one existing cloud card are reused.
// The cloud bank sits in world space and depth-tests behind the main mountain.
const veilVertex = /* glsl */ `
uniform vec3 uValleyCenter;
uniform vec3 uValleyRight;
uniform vec2 uValleySize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 world = uValleyCenter + uValleyRight * (uv.x - .5) * uValleySize.x
    + vec3(0., (uv.y - .5) * uValleySize.y, 0.);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
}`;
const veilFragment = /* glsl */ `
precision highp float;
uniform sampler2D tNoise;
uniform float uStudyTime;
uniform vec3 uValleyMist;
varying vec2 vUv;
void main() {
  vec2 p = vec2(vUv.x * 3.6 - uStudyTime * .012, vUv.y);
  float broad = texture2D(tNoise, p * .23).r;
  float billow = texture2D(tNoise, p * .72).r;
  float center = .48 + (broad - .5) * .22;
  float height = abs(vUv.y - center);
  float bank = 1. - smoothstep(.035, .13, height + (billow - .5) * .08);
  float density = bank * (.70 + .20 * smoothstep(.38, .62, broad));
  float edge = smoothstep(0., .14, vUv.x) * (1. - smoothstep(.86, 1., vUv.x));
  gl_FragColor = vec4(uValleyMist * (.94 + .10 * billow), density * edge);
}`;

export function createDistantValley(app, terrain, clock) {
  const main = app.webgl.mainScene;
  let peaks;
  app.webgl.pages.Homepage.env.traverse(object => {
    if (object.name === 'instance-HomepagePeaks') peaks = object;
  });
  if (!peaks) throw new Error('Distant valley: peak mesh is missing.');
  const distant = peaks.clone();
  distant.name = 'Distant valley ridges';
  distant.position.set(0, 0, 0);
  distant.quaternion.set(0, 0, 0, 1);
  distant.scale.set(1, 1, 1);
  distant.count = 3;
  const matrix = app.webgl.camera.matrixWorld.clone();
  const position = app.webgl.camera.position.clone();
  const scale = position.clone();
  const rotation = app.webgl.camera.quaternion.clone();
  const up = position.clone().set(0, 1, 0);
  const ridges = [
    { position: [300, -8, 390], scale: [42, 34, 30], yaw: -.7 },
    { position: [150, -5, 210], scale: [19, 23, 18], yaw: .5 },
    { position: [65, -10, 330], scale: [30, 28, 26], yaw: 1.6 },
  ];
  ridges.forEach((ridge, index) => {
    matrix.compose(position.fromArray(ridge.position), rotation.setFromAxisAngle(up, ridge.yaw), scale.fromArray(ridge.scale));
    distant.setMatrixAt(index, matrix);
  });
  distant.instanceMatrix.needsUpdate = true;
  distant.computeBoundingBox();
  distant.computeBoundingSphere();
  const mist = terrain.uniforms.uRockHighlight.value.clone();
  // Homepage props are hidden in this option, so their existing material can
  // shade the distant instances without another texture or material copy.
  const original = Array.isArray(peaks.material) ? peaks.material[0] : peaks.material;
  const material = original;
  Object.assign(material.uniforms, original.uniforms, { uDistantMist: { value: mist } });
  material.fragmentShader = 'uniform vec3 uDistantMist;\n' + material.fragmentShader.replace(
    'gl_FragColor = vec4(outgoingLight, diffuseColor.a);',
    `outgoingLight = mix(outgoingLight * .65, uDistantMist, .57);
     vec3 distantWorld = cameraPosition + (vec4(-vViewPosition, 0.) * viewMatrix).xyz;
     diffuseColor.a *= smoothstep(-8., 20., distantWorld.y);
     gl_FragColor = vec4(outgoingLight, diffuseColor.a);`,
  );
  material.depthTest = true;
  material.depthWrite = false;
  material.transparent = true;
  material.needsUpdate = true;
  distant.material = material;
  distant.renderOrder = -3;
  main.add(distant);

  let source;
  main.clouds.traverse(object => { if (!source && object.isInstancedMesh && object.material?.uniforms?.tNoise) source = object; });
  if (!source) throw new Error('Distant valley: cloud card is missing.');
  const veil = source.clone();
  veil.name = 'Distant valley cloud bank';
  veil.count = 1;
  veil.frustumCulled = false;
  veil.material = source.material;
  veil.material.vertexShader = veilVertex;
  veil.material.fragmentShader = veilFragment;
  const veilColor = mist.clone();
  Object.assign(veil.material.uniforms, source.material.uniforms, {
    uStudyTime: clock,
    uValleyCenter: { value: position.clone().set(120, 18, 100) },
    uValleyRight: { value: position.clone().set(-1, 0, 0) },
    uValleySize: { value: source.material.uniforms.uSize.value.clone().set(700, 100) },
    uValleyMist: { value: veilColor },
  });
  veil.material.depthTest = true;
  veil.material.depthWrite = false;
  veil.material.transparent = true;
  veil.material.side = 2;
  veil.material.needsUpdate = true;
  veil.renderOrder = -2;
  main.add(veil);
  return {
    themeUniforms: [material.uniforms.uDistantMist, veil.material.uniforms.uValleyMist],
    setTheme(theme) {
      const hex = theme === 'dark' ? '#263b4c' : '#9caeb8';
      mist.set(hex);
      // This raw cloud shader outputs display RGB, unlike the lit peak shader.
      veilColor.set(theme === 'dark' ? '#53626e' : '#dce2e4').convertLinearToSRGB();
    },
    dispose() {
      main.remove(distant, veil);
      // Geometry and materials are owned by the source scene.
    },
  };
}
