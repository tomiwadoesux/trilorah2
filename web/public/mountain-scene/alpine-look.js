// Alpine alternative with clouds restricted to the distant valley. The backdrop is ordinary CSS behind an alpha canvas.
export const alpineLook = new URLSearchParams(location.search).get('look') === 'alpine';

export function alpineView(app, width, height, device) {
  const camera = app.webgl.camera;
  const narrow = device === 'phone' || (device === 'window' && width < 768);
  const position = camera.curve.getPoint(.25);
  const target = (narrow ? camera.lookAtPointsMobile : camera.lookAtPoints)[1].clone();
  const up = camera.up.clone().set(0, 1, 0);
  const rotation = camera.matrixWorld.clone().lookAt(position, target, up);
  const quaternion = camera.quaternion.clone().setFromRotationMatrix(rotation);
  return { position: position.toArray(), target: target.toArray(), up: up.toArray(),
    quaternion: quaternion.toArray(), fov: 55, zoom: 1, scrollY: 0, scrollProgress: 0,
    sceneLook: 'alpine', viewport: { width, height, aspect: width / height } };
}

export function prepareAlpineBackdrop(app) {
  const main = app.webgl.mainScene;
  main.background = null;
  app.webgl.renderer.setClearColor(0x000000, 0);
  main.sky.visible = false;
  main.clouds.visible = false;
  main.transitionClouds.visible = false;
  main.flares.visible = false;
  // The trading camera uses the continuous mountain without homepage props.
  app.webgl.pages.Homepage.env.visible = false;
  app.webgl.pages.Homepage.chapters.TopChapters.clouds.visible = false;
  const backdrop = document.createElement('div');
  backdrop.className = 'alpine-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  const layer = (name, parent = backdrop) => {
    const element = document.createElement('div');
    element.className = `alpine-${name}`;
    parent.append(element);
    return element;
  };
  layer('sky-day');
  const nightSky = layer('sky-night');
  const sun = layer('sun-position');
  const dayHalo = layer('halo-day', sun);
  const nightHalo = layer('halo-night', sun);
  const rayPosition = layer('ray-position');
  layer('rays', rayPosition);
  const speckPosition = layer('speck-position');
  layer('specks', speckPosition);
  document.querySelector('#canvas-wrapper').prepend(backdrop);
  return {
    setNight(amount, position = amount) {
      // Driven by the same progress as the light uniforms. Gradients stay
      // painted; only their opacity and layer transforms change during travel.
      nightSky.style.opacity = String(amount);
      dayHalo.style.opacity = String(1 - amount);
      nightHalo.style.opacity = String(amount);
      sun.style.transform = `translate3d(${-24 + position * 49}%, ${-18 + position * 23}%, 0)`;
      rayPosition.style.transform = `translate3d(${position * 35}%, 0, 0)`;
      speckPosition.style.opacity = String(.12 + amount * .88);
    },
  };
}
