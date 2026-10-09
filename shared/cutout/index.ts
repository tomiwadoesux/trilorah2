import { CORE_ICONS } from './core';
import { CONTROL_ICONS } from './controls';
import { SERVICE_ICONS } from './service';
import { STATUS_ICONS } from './status';
import type { CutoutDefinition } from './types';

export const CUTOUT_ICONS = { ...CORE_ICONS, ...CONTROL_ICONS, ...SERVICE_ICONS, ...STATUS_ICONS } as const;
export type CutoutIconName = keyof typeof CUTOUT_ICONS;
export type { CutoutCategory, CutoutDefinition, CutoutPart, CutoutMotion } from './types';
export const CUTOUT_NAMES = Object.keys(CUTOUT_ICONS) as CutoutIconName[];

const xml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);

/** Geometry is trusted local source only. Part selectors remain stable across exports. */
export function cutoutBody(name: CutoutIconName): string {
  const definition: CutoutDefinition = CUTOUT_ICONS[name];
  return definition.parts.map(part => {
    const [x, y] = part.origin ?? [16, 16];
    return `<g data-part="${xml(part.name)}"${part.motion ? ` data-motion="${part.motion}"` : ''} data-origin="${x} ${y}" fill="currentColor" stroke="none" style="transform-box:view-box;transform-origin:${x}px ${y}px">${part.markup}</g>`;
  }).join('');
}

export function cutoutSvg(name: CutoutIconName, options: { size?: number; label?: string; decorative?: boolean } = {}): string {
  const size = options.size ?? 32;
  if (!Number.isFinite(size) || size <= 0) throw new RangeError('Icon size must be a positive finite number.');
  const accessibility = options.decorative ? 'aria-hidden="true" focusable="false"' : `role="img" aria-label="${xml(options.label ?? CUTOUT_ICONS[name].label)}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" fill="currentColor" color="#ededed" class="tri-cutout-icon" data-icon="${name}" ${accessibility}>${cutoutBody(name)}</svg>`;
}
