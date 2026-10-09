import type { CutoutDefinition } from './types';

/** The five approved Original Cutout drawings. Geometry is intentionally fixed. */
export const CORE_ICONS = {
  bible: { label: 'Bible', category: 'Service', parts: [{ name: 'cover', origin: [16, 28], motion: 'lift', markup: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M9 3.5h17.5v25H9l-4.5-4.5V8L9 3.5Zm6.5 4v3h-3v2.5h3v5h2.5v-5h3v-2.5h-3v-3h-2.5ZM9 22v3.5h14.5V22H9Z"/>' }] },
  microphone: { label: 'Microphone', category: 'Service', parts: [
    { name: 'capsule', origin: [16, 12], motion: 'pulse', markup: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M13 3.5h6L22 6.5V18l-3 3h-6l-3-3V6.5l3-3Zm.5 4v2h5v-2h-5Zm0 4.5v2h5v-2h-5Z"/>' },
    { name: 'stand', origin: [16, 28.5], markup: '<path fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter" d="M6.5 15v5L11 24.5h10l4.5-4.5v-5M16 25v3M12 28.5h8" stroke-width="2.5"/>' },
  ] },
  songs: { label: 'Songs', category: 'Service', parts: [{ name: 'notes', origin: [24, 6], motion: 'sway', markup: '<path fill="currentColor" stroke="none" d="m12 6.5 15-3v18l-3.5 3.5h-4l-2.5-2.5v-2l3-3h4V10l-9 1.8V25l-3.5 3.5h-4L5 26v-2l3-3h4V6.5Z"/>' }] },
  search: { label: 'Search', category: 'Navigation', parts: [
    { name: 'lens', origin: [13.75, 13.5], motion: 'pulse', markup: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M9 3.5h9L24 9.5v8L18 23.5H9L3.5 18V9L9 3.5Zm1.5 3.5L7 10.5v6l3.5 3.5h6l4-4v-5l-4-4h-6Z"/>' },
    { name: 'handle', origin: [20, 21], markup: '<path fill="currentColor" stroke="none" d="m21.5 20 6.5 6-2.6 2.6-6.5-6Z"/>' },
  ] },
  media: { label: 'Media', category: 'Service', parts: [{ name: 'frame', origin: [16, 16], motion: 'lift', markup: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M7 4.5h18l4 4v15l-4 4H7l-4-4v-15l4-4Zm12 4v4h4v-4h-4ZM6 22.5l2 2h16l2-2-5-6-4 4-6-7-5 6v3Z"/>' }] },
} as const satisfies Record<string, CutoutDefinition>;
