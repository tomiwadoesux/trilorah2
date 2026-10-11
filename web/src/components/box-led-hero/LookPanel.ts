// Development-only panel for the box and its glow. Every control comes from LOOK_CONTROLS,
// so a knob added there shows up here. Save writes the look into look.json through
// /api/dev/hero-look; Copy puts it on the clipboard as JSON.
import GUI, { type Controller } from 'lil-gui';
import {
  LOOK_CONTROLS,
  SAVED_LOOK,
  factoryLook,
  sanitizeLook,
  type HeroLook,
  type LookControl as Control,
} from './look';

export function mountLookPanel({
  container,
  look,
  onChange,
  onReplay,
}: {
  container: HTMLElement;
  look: HeroLook;
  onChange(look: HeroLook): void;
  onReplay(): void;
}) {
  const state = structuredClone(look) as unknown as Record<string, Record<string, unknown>>;
  const gui = new GUI({ title: 'Box & glow (dev only)', container, width: 300 });
  // The hero's pointer handling leaves anything marked data-hero-ui alone.
  gui.domElement.dataset.heroUi = '';
  Object.assign(gui.domElement.style, {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: '20',
    maxHeight: 'calc(100% - 32px)',
    overflowY: 'auto',
  });

  gui.add({ replay: onReplay }, 'replay').name('▶ Replay opening');

  for (const [group, { title, fields }] of Object.entries(LOOK_CONTROLS)) {
    const folder = gui.addFolder(title);
    if (group !== 'box') folder.close();
    for (const [key, control] of Object.entries(fields) as [string, Control][]) {
      const values = state[group];
      const controller =
        control.kind === 'number'
          ? folder.add(values, key, control.min, control.max, control.step)
          : control.kind === 'colour'
            ? folder.addColor(values, key)
            : control.kind === 'choice'
              ? folder.add(values, key, control.options)
              : folder.add(values, key);
      controller.name(control.label);
    }
  }
  gui.onChange(() => onChange(sanitizeLook(state)));

  const load = (next: HeroLook) => {
    for (const [group, values] of Object.entries(next)) Object.assign(state[group], values);
    for (const controller of gui.controllersRecursive()) controller.updateDisplay();
    onChange(sanitizeLook(state));
  };
  const flash = (controller: Controller, label: string, message: string) => {
    controller.name(message);
    window.setTimeout(() => controller.name(label), 1600);
  };

  const actions = gui.addFolder('Save');
  const buttons = {
    save: async () => {
      try {
        const response = await fetch('/api/dev/hero-look', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sanitizeLook(state)),
        });
        flash(saveButton, 'Save to code (look.json)', response.ok ? 'Saved ✓' : `Save failed (${response.status})`);
      } catch {
        flash(saveButton, 'Save to code (look.json)', 'Save failed');
      }
    },
    copy: async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(sanitizeLook(state), null, 2));
        flash(copyButton, 'Copy as JSON', 'Copied ✓');
      } catch {
        flash(copyButton, 'Copy as JSON', 'Copy failed');
      }
    },
    revert: () => load(SAVED_LOOK),
    factory: () => load(factoryLook()),
  };
  const saveButton = actions.add(buttons, 'save').name('Save to code (look.json)');
  const copyButton = actions.add(buttons, 'copy').name('Copy as JSON');
  actions.add(buttons, 'revert').name('Undo changes since last save');
  actions.add(buttons, 'factory').name('Reset to the original example');

  return { destroy: () => gui.destroy() };
}
