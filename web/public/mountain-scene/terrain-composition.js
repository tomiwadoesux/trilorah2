// The source scene uses two cropped foreground peaks as compositing props.
// The user's lower camera angles expose their open bases and overlapping faces.
// Keep the continuous Mountain and the distant valley peak; omit only those
// two props at runtime. The original GLB and chosen camera poses stay intact.
export function cleanTerrainComposition(app) {
  let backdrop;
  app.webgl.pages.Homepage.env.traverse(object => {
    if (!object.isInstancedMesh || object.name !== 'instance-HomepagePeaks') return;
    if (object.userData.studyBackdropOnly) {
      backdrop = object;
      return;
    }
    const matrices = object.instanceMatrix.array;
    let backgroundIndex = -1;
    for (let i = 0; i < object.count; i++) {
      const offset = i * 16;
      // Match the authored distant peak transform rather than relying on the
      // loader's order when it combines the three instances.
      if (Math.abs(matrices[offset + 12] + 201.6277008) < .1
        && Math.abs(matrices[offset + 13] + 35.9869041) < .1
        && Math.abs(matrices[offset + 14] - 438.0147705) < .1) {
        backgroundIndex = i;
        break;
      }
    }
    if (backgroundIndex < 0) throw new Error('Mountain scene: distant peak transform not found.');
    matrices.copyWithin(0, backgroundIndex * 16, backgroundIndex * 16 + 16);
    object.count = 1;
    object.instanceMatrix.needsUpdate = true;
    object.renderOrder = -2;
    object.computeBoundingBox();
    object.computeBoundingSphere();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      // A transparent feathered base must not write invisible occluders.
      material.depthTest = true;
      material.depthWrite = false;
    }
    object.userData.studyBackdropOnly = true;
    backdrop = object;
  });
  if (!backdrop) throw new Error('Mountain scene: background peak group not found.');
  return backdrop;
}
