// Keep a neutral texture for extracted materials that still expect tMouse.
// Clouds use wind only: there are no pointer listeners, uniforms or tick work.
export function disableCloudPointerFeedback(app) {
  const simulation = app.webgl.mouseComputation;
  if (!simulation) return;

  simulation.update = () => {};
  const renderer = app.webgl.renderer;
  const previousTarget = renderer.getRenderTarget();
  const previousColor = renderer.getClearColor(app.webgl.mainScene.background.clone());
  const previousAlpha = renderer.getClearAlpha();
  simulation.renderTarget1.setSize(1, 1);
  renderer.setRenderTarget(simulation.renderTarget1);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.setRenderTarget(previousTarget);
  renderer.setClearColor(previousColor, previousAlpha);
  simulation.renderTarget2.dispose();
  simulation.mesh.geometry.dispose();
  simulation.mesh.material.dispose();
}
