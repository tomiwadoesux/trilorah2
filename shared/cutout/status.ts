import type { CutoutDefinition } from './types';
import { CORE_ICONS } from './core';

export const STATUS_ICONS = {
  bell: { label: 'Notifications', category: 'Status', parts: [
    { name: 'bell', origin: [16, 5], motion: 'sway', markup: '<path fill-rule="evenodd" d="M14.5 3h3v3H21l5 5v9l3 3v2H3v-2l3-3v-9l5-5h3.5V3ZM12 9l-3 3v9h14v-9l-3-3h-8Z"/>' },
    { name: 'clapper', origin: [16, 26], motion: 'slide', markup: '<path d="M12 27h8l-2 3h-4Z"/>' },
  ] },
  warning: { label: 'Warning', category: 'Status', parts: [{ name: 'triangle', origin: [16, 17], motion: 'pulse', markup: '<path fill-rule="evenodd" d="m16 3 14 25H2L16 3Zm-1.5 8v8h3v-8h-3Zm0 11v3h3v-3h-3Z"/>' }] },
  info: { label: 'Information', category: 'Status', parts: [{ name: 'badge', origin: [16, 16], motion: 'pulse', markup: '<path fill-rule="evenodd" d="M9 3h14l6 6v14l-6 6H9l-6-6V9l6-6Zm5.5 5v3h3V8h-3Zm-2 6v3h2v7h5v-3h-2v-7h-5Z"/>' }] },
  help: { label: 'Help', category: 'Status', parts: [{ name: 'badge', origin: [16, 16], motion: 'pulse', markup: '<path fill-rule="evenodd" d="M9 3h14l6 6v14l-6 6H9l-6-6V9l6-6Zm3 5-2 2v3h3v-2h6v3l-4 2v4h3v-2.5l4-2V10l-2-2h-8Zm3 14v3h3v-3h-3Z"/>' }] },
  cloud: { label: 'Cloud', category: 'Devices', parts: [{ name: 'cloud', origin: [16, 21], motion: 'lift', markup: '<path fill-rule="evenodd" d="m13 5-5 5v3H6l-4 4v6l4 4h21l3-3v-8l-4-4h-4V9l-4-4h-5Zm1.5 3h2L19 10.5V15h6l2 2v6l-1 1H7l-2-2v-4l2-2h4v-4.5L14.5 8Z"/>' }] },
  wifi: { label: 'Wi-Fi', category: 'Devices', parts: [
    { name: 'outer-signal', origin: [16, 26], motion: 'pulse', markup: '<path d="M2 9.5 7.5 4h17L30 9.5l-2.5 2.5L23 7.5H9L4.5 12Z"/>' },
    { name: 'inner-signal', origin: [16, 26], motion: 'pulse', markup: '<path d="m7 16 5-5h8l5 5-2.5 2.5-4-4h-5l-4 4Z"/>' },
    { name: 'dot', origin: [16, 25], markup: '<path d="m16 21 4 4-4 4-4-4Z"/>' },
  ] },
  shield: { label: 'Trust', category: 'Status', parts: [
    { name: 'shield', origin: [16, 16], markup: '<path fill-rule="evenodd" d="m16 3 12 4v13l-5 6-7 4-7-4-5-6V7l12-4Zm0 3.5L7 9.5V19l4 4.5 5 3 5-3 4-4.5V9.5l-9-3Z"/>' },
    { name: 'check', origin: [16, 17], motion: 'press', markup: '<path d="m10 15 4 4 7-8 2.5 2-9.25 10-6.5-6Z"/>' },
  ] },
  lock: { label: 'Lock', category: 'Status', parts: [
    { name: 'shackle', origin: [16, 14], motion: 'lift', markup: '<path d="M9 14V7l4-4h6l4 4v7h-3V8.5L17.5 6h-3L12 8.5V14Z"/>' },
    { name: 'body', origin: [16, 22], markup: '<path fill-rule="evenodd" d="M6 13h20v12l-3 3H9l-3-3V13Zm8.5 5v6h3v-6h-3Z"/>' },
  ] },
  unlock: { label: 'Unlock', category: 'Status', parts: [
    { name: 'shackle', origin: [10, 14], motion: 'lift', markup: '<path d="M9 14V7l4-4h6l4 4v3h-3V8.5L17.5 6h-3L12 8.5V14Z"/>' },
    { name: 'body', origin: [16, 22], markup: '<path fill-rule="evenodd" d="M6 13h20v12l-3 3H9l-3-3V13Zm8.5 5v6h3v-6h-3Z"/>' },
  ] },
  eye: { label: 'Show', category: 'Status', parts: [
    { name: 'outline', origin: [16, 16], markup: '<path fill-rule="evenodd" d="m2 16 8-9h12l8 9-8 9H10l-8-9Zm9.5-6L6 16l5.5 6h9l5.5-6-5.5-6h-9Z"/>' },
    { name: 'pupil', origin: [16, 16], motion: 'slide', markup: '<path d="m13 12-1 1v6l1 1h6l1-1v-6l-1-1Z"/>' },
  ] },
  'eye-off': { label: 'Hide', category: 'Status', parts: [
    { name: 'outline', origin: [16, 16], markup: '<path d="m3 13 3 3 5.5 6h7l3 3H10l-8-9 1-3ZM11 7h11l8 9-4 4-2-2 2-2-5.5-6H14L11 7Z"/>' },
    { name: 'slash', origin: [16, 16], motion: 'press', markup: '<path d="m5 3 24 24-2 2L3 5Z"/>' },
  ] },
  volume: { label: 'Volume', category: 'Devices', parts: [
    { name: 'speaker', origin: [12, 16], markup: '<path d="M3 11h6l8-7v24l-8-7H3Z"/>' },
    { name: 'near-wave', origin: [18, 16], motion: 'pulse', markup: '<path d="m20 10 4 4v4l-4 4-2-2 3-3v-2l-3-3Z"/>' },
    { name: 'far-wave', origin: [18, 16], motion: 'pulse', markup: '<path d="m25 5 5 7v8l-5 7-2-2 4-6v-6l-4-6Z"/>' },
  ] },
  'volume-off': { label: 'Mute volume', category: 'Devices', parts: [
    { name: 'speaker', origin: [12, 16], markup: '<path d="M3 11h6l8-7v24l-8-7H3Z"/>' },
    { name: 'cross', origin: [25, 16], motion: 'press', markup: '<path d="m21 10 4 4 4-4 2 2-4 4 4 4-2 2-4-4-4 4-2-2 4-4-4-4Z"/>' },
  ] },
  loader: { label: 'Loading', category: 'Status', parts: [{ name: 'ring', origin: [16, 16], motion: 'turn', markup: '<path d="M10 3h12l7 7v12l-7 7H10l-7-7V10l4-4 2.5 2.5L6.5 12v8l5.5 5.5h8l5.5-5.5v-8L20 6.5H10Z"/>' }] },
  'microphone-off': { label: 'Mute microphone', category: 'Service', parts: [
    ...CORE_ICONS.microphone.parts.map(part => ({ ...part, motion: undefined })),
    { name: 'slash', origin: [16, 16], motion: 'press', markup: '<path d="m4 3 25 25-2 2L2 5Z"/>' },
  ] },
  heart: { label: 'Favourite', category: 'Actions', parts: [{ name: 'heart', origin: [16, 17], motion: 'pulse', markup: '<path d="M3 8 7 4h6l3 4 3-4h6l4 4v9L16 29 3 17Z"/>' }] },
  save: { label: 'Save', category: 'Actions', parts: [{ name: 'disk', origin: [16, 16], motion: 'press', markup: '<path fill-rule="evenodd" d="M4 4h19l5 5v19H4V4Zm6 0v10h12V4H10Zm0 16v5h12v-5H10Z"/><path d="M17 5h3v6h-3Z"/>' }] },
  filter: { label: 'Filter', category: 'Navigation', parts: [{ name: 'funnel', origin: [16, 16], motion: 'press', markup: '<path d="M3 4h26v4l-10 11v8l-6 3V19L3 8V4Z"/>' }] },
  sort: { label: 'Sort', category: 'Navigation', parts: [
    { name: 'lines', origin: [10, 16], markup: '<path d="M3 6h15v3H3ZM3 14h11v3H3ZM3 22h7v3H3Z"/>' },
    { name: 'arrow', origin: [24, 16], motion: 'slide', markup: '<path d="M22 5h3v17l3-3 2 2-6.5 7L17 21l2-2 3 3Z"/>' },
  ] },
  mail: { label: 'Message', category: 'Navigation', parts: [
    { name: 'envelope', origin: [16, 16], markup: '<path d="M3 10.5 16 19l13-8.5V25l-2 2H5l-2-2Z"/>' },
    { name: 'flap', origin: [16, 5], motion: 'lift', markup: '<path d="M3 7 5 5h22l2 2-13 8.5Z"/>' },
  ] },
  users: { label: 'People', category: 'Service', parts: [
    { name: 'back-person', origin: [24, 16], markup: '<path d="M22 5h4l3 3v4l-3 3h-4v-3l2-2V8l-2-2ZM24 18h3l3 3v7h-6v-6l-3-3Z"/>' },
    { name: 'front-person', origin: [13, 27], motion: 'lift', markup: '<path d="M10 3h6l4 4v6l-4 4h-6l-4-4V7ZM8 20h10l4 4v5H4v-5Z"/>' },
  ] },
  'check-circle': { label: 'Success', category: 'Status', parts: [{ name: 'badge', origin: [16, 16], motion: 'press', markup: '<path fill-rule="evenodd" d="M9 3h14l6 6v14l-6 6H9l-6-6V9l6-6Zm-.5 12 6 7.5 10-11-2.5-2-7.5 8.5-3.5-5-2.5 2Z"/>' }] },
  'error-circle': { label: 'Error', category: 'Status', parts: [{ name: 'badge', origin: [16, 16], motion: 'pulse', markup: '<path fill-rule="evenodd" d="M9 3h14l6 6v14l-6 6H9l-6-6V9l6-6Zm2 6L9 11l5 5-5 5 2 2 5-5 5 5 2-2-5-5 5-5-2-2-5 5-5-5Z"/>' }] },
  connection: { label: 'Connect', category: 'Devices', parts: [
    { name: 'plug', origin: [10, 12], motion: 'slide', markup: '<path d="M7 3h3v6h3V3h3v6h3v8l-4 4h-3v8H9v-8H6l-3-4V9h4V3Z"/>' },
    { name: 'signal', origin: [23, 15], motion: 'pulse', markup: '<path d="m24 7 5 5v8l-5 5-2-2 4-4v-6l-4-4Z"/>' },
  ] },
  'external-link': { label: 'Open externally', category: 'Navigation', parts: [
    { name: 'frame', origin: [16, 16], markup: '<path d="M4 7h10v3H7v15h15v-7h3v10H4Z"/>' },
    { name: 'arrow', origin: [22, 10], motion: 'slide', markup: '<path d="M18 3h11v11h-3V8l-12 12-2-2L24 6h-6Z"/>' },
  ] },
} as const satisfies Record<string, CutoutDefinition>;
