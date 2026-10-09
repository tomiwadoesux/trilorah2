import type { CutoutDefinition } from './types';

/** Original service glyphs: solid silhouettes, 45° cuts, transparent knockouts. */
export const SERVICE_ICONS = {
  broadcast: {
    label: 'Broadcast', category: 'Service',
    parts: [
      { name: 'signal', origin: [16, 16], markup: '<path d="M14 12h4l2 2v4l-2 2h-4l-2-2v-4Z"/>' },
      { name: 'waves', origin: [16, 16], markup: '<path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter" d="m9 9-4 4v6l4 4m14-14 4 4v6l-4 4M5 4l-4 6v12l4 6M27 4l4 6v12l-4 6"/>' },
    ],
  },
  sparkle: {
    label: 'Sparkle', category: 'Actions',
    parts: [
      { name: 'spark', origin: [18, 18], motion: 'pulse', markup: '<path d="m18 7 3.5 7.5L29 18l-7.5 3.5L18 29l-3.5-7.5L7 18l7.5-3.5Z"/>' },
      { name: 'glint', origin: [7, 7], motion: 'turn', markup: '<path d="m7 3 1.5 2.5L11 7 8.5 8.5 7 11 5.5 8.5 3 7l2.5-1.5Z"/>' },
    ],
  },
  note: {
    label: 'Notes', category: 'Service',
    parts: [
      { name: 'sheet', origin: [16, 29], markup: '<path fill-rule="evenodd" d="M8 3h13l6 6v20H5V6l3-3Zm0 3v20h16V11h-5V6H8Z"/>' },
      { name: 'text', origin: [16, 18], motion: 'scan', markup: '<path d="M11 13h10v3H11Zm0 6h7v3h-7Z"/>' },
    ],
  },
  presentation: {
    label: 'Presentation', category: 'Service',
    parts: [
      { name: 'screen', origin: [16, 12.5], markup: '<path fill-rule="evenodd" d="M6 3h20l3 3v16H3V6l3-3Zm0 3v13h20V6H6Z"/>' },
      { name: 'content', origin: [16, 16], motion: 'scan', markup: '<path d="M9 12h3v4H9Zm5.5-3h3v7h-3Zm5.5 1.5h3V16h-3Z"/>' },
      { name: 'stand', origin: [16, 22], markup: '<path d="M14.5 22h3v4H24v3H8v-3h6.5Z"/>' },
    ],
  },
  qr: {
    label: 'QR symbol', category: 'Service',
    parts: [
      { name: 'finder-top-left', origin: [8, 8], markup: '<path fill-rule="evenodd" d="M3 3h10v10H3V3Zm2.5 2.5v5h5v-5h-5Z"/>' },
      { name: 'finder-top-right', origin: [24, 8], markup: '<path fill-rule="evenodd" d="M19 3h10v10H19V3Zm2.5 2.5v5h5v-5h-5Z"/>' },
      { name: 'finder-bottom-left', origin: [8, 24], markup: '<path fill-rule="evenodd" d="M3 19h10v10H3V19Zm2.5 2.5v5h5v-5h-5Z"/>' },
      { name: 'data', origin: [22.5, 22.5], motion: 'pulse', markup: '<path d="M16 16h8v3h-5v5h-3Zm10 0h3v8h-3Zm-5 5h3v3h-3Zm-5 5h8v3h-8Zm10 0h3v3h-3Z"/>' },
    ],
  },
  operator: {
    label: 'Operator', category: 'Service',
    parts: [
      { name: 'screen', origin: [16, 12.5], markup: '<path fill-rule="evenodd" d="M6 3h20l3 3v16H3V6l3-3Zm0 3v13h20V6H6Z"/>' },
      { name: 'live-arrow', origin: [16, 13], motion: 'lift', markup: '<path d="m16 8.5 5 5-2 2-1.5-1.5v2.5h-3V14L13 15.5l-2-2Z"/>' },
      { name: 'stand', origin: [16, 27.5], markup: '<path d="M14.5 22h3v4H23v3H9v-3h5.5Z"/>' },
    ],
  },
  dashboard: {
    label: 'Dashboard', category: 'Navigation',
    parts: [
      { name: 'primary-tile', origin: [8.75, 10.75], motion: 'press', markup: '<path d="M6 3h8.5v15.5H3V6Z"/>' },
      { name: 'top-tile', origin: [23.25, 6.75], markup: '<path d="M17.5 3H26l3 3v4.5H17.5Z"/>' },
      { name: 'bottom-tile', origin: [8.75, 25.25], markup: '<path d="M3 21.5h11.5V29H6l-3-3Z"/>' },
      { name: 'secondary-tile', origin: [23.25, 21.25], markup: '<path d="M17.5 13.5H29V26l-3 3h-8.5Z"/>' },
    ],
  },
  profile: {
    label: 'Profile', category: 'Navigation',
    parts: [
      { name: 'head', origin: [16, 9.5], motion: 'sway', markup: '<path d="M12 3h8l3 3v6l-4 4h-6l-4-4V6Z"/>' },
      { name: 'shoulders', origin: [16, 29], markup: '<path d="M10 19h12l7 7v3H3v-3Z"/>' },
    ],
  },
  globe: {
    label: 'Globe', category: 'Navigation',
    parts: [
      { name: 'sphere', origin: [16, 16], motion: 'turn', markup: '<path fill-rule="evenodd" d="M16 3a13 13 0 1 1 0 26 13 13 0 0 1 0-26ZM11 7l-4 4 3 3h3l4-3V7h-6ZM9 17l-1 2 2 2v4h3l2-5-2-3H9ZM23 8h-3v5l-2 3v6l2 2 3-3v-4h3v-5l-3-4Z"/>' },
    ],
  },
  laptop: {
    label: 'Laptop', category: 'Devices',
    parts: [
      { name: 'screen', origin: [16, 22], markup: '<path fill-rule="evenodd" d="M8 3h16l3 3v16H5V6l3-3Zm0 3v13h16V6H8Z"/>' },
      { name: 'content', origin: [16, 12.5], motion: 'scan', markup: '<path d="M11 10h10v3H11Z"/>' },
      { name: 'base', origin: [16, 27], markup: '<path d="M3 25h9l1 1h6l1-1h9v1l-3 3H6l-3-3Z"/>' },
    ],
  },
  phone: {
    label: 'Phone', category: 'Devices',
    parts: [
      { name: 'body', origin: [16, 16], markup: '<path fill-rule="evenodd" d="M11 3h10l3 3v20l-3 3H11l-3-3V6l3-3Zm0 4v18h10V7H11Z"/>' },
      { name: 'home', origin: [16, 21], motion: 'press', markup: '<path d="M14.5 19.5h3v3h-3Z"/>' },
    ],
  },
  soundwave: {
    label: 'Sound wave', category: 'Service',
    parts: [
      { name: 'bar-left', origin: [4.5, 16], motion: 'pulse', markup: '<path d="M3 12h3v8H3Z"/>' },
      { name: 'bar-mid-left', origin: [10.25, 16], motion: 'pulse', markup: '<path d="M8.75 7h3v18h-3Z"/>' },
      { name: 'bar-center', origin: [16, 16], motion: 'pulse', markup: '<path d="M14.5 3h3v26h-3Z"/>' },
      { name: 'bar-mid-right', origin: [21.75, 16], motion: 'pulse', markup: '<path d="M20.25 7h3v18h-3Z"/>' },
      { name: 'bar-right', origin: [27.5, 16], motion: 'pulse', markup: '<path d="M26 12h3v8h-3Z"/>' },
    ],
  },
  'add-song': {
    label: 'Add song', category: 'Actions',
    parts: [
      { name: 'note', origin: [11, 22], motion: 'sway', markup: '<path d="M11 4h3v19l-4 4H6l-3-3v-3l3-3h5Z"/>' },
      { name: 'plus', origin: [23.5, 10.5], motion: 'turn', markup: '<path d="M22 5h3v4h4v3h-4v4h-3v-4h-4V9h4Z"/>' },
    ],
  },
  'video-play': {
    label: 'Play video', category: 'Service',
    parts: [
      { name: 'frame', origin: [16, 16], markup: '<path fill-rule="evenodd" d="M6 5h20l3 3v16l-3 3H6l-3-3V8l3-3Zm0 3v16h20V8H6Z"/>' },
      { name: 'play', origin: [16, 16], motion: 'press', markup: '<path d="m11 10 11 6-11 6Z"/>' },
    ],
  },
  clock: {
    label: 'Clock', category: 'Service',
    parts: [
      { name: 'face', origin: [16, 16], markup: '<path fill-rule="evenodd" d="M10 3h12l7 7v12l-7 7H10l-7-7V10l7-7Zm1.5 3L6 11.5v9l5.5 5.5h9l5.5-5.5v-9L20.5 6h-9Z"/>' },
      { name: 'hour-hand', origin: [16, 16], motion: 'turn', markup: '<path d="M14.5 14.5H23v3h-8.5Z"/>' },
      { name: 'minute-hand', origin: [16, 16], motion: 'turn', markup: '<path d="M14.5 8h3v9.5h-3Z"/>' },
    ],
  },
  prayer: {
    label: 'Prayer', category: 'Service',
    parts: [
      { name: 'hand-left', origin: [13, 21], motion: 'sway', markup: '<path d="M11 3h3.5v17.5L7 28H3v-4l5-5v-6Z"/>' },
      { name: 'hand-right', origin: [19, 21], motion: 'sway', markup: '<path d="M17.5 3H21l3 10v6l5 5v4h-4l-7.5-7.5Z"/>' },
    ],
  },
  gift: {
    label: 'Gift', category: 'Giving',
    parts: [
      { name: 'bow', origin: [16, 11], markup: '<path fill-rule="evenodd" d="M5 3h7l4 4 4-4h7v6l-3 3H8L5 9V3Zm3 3v3h6l-3-3H8Zm13 0-3 3h6V6h-3Z"/>' },
      { name: 'lid', origin: [16, 14], motion: 'lift', markup: '<path d="M3 12h11.5v4H3Zm14.5 0H29v4H17.5Z"/>' },
      { name: 'base', origin: [16, 29], markup: '<path d="M5 19h9.5v10H8l-3-3Zm12.5 0H27v7l-3 3h-6.5Z"/>' },
    ],
  },
  cup: {
    label: 'Communion cup', category: 'Service',
    parts: [
      { name: 'bowl', origin: [16, 20], markup: '<path fill-rule="evenodd" d="M6 3h20v11l-7 7h-6l-7-7V3Zm3 3v6.5l5.5 5.5h3l5.5-5.5V6H9Z"/>' },
      { name: 'contents', origin: [16, 13], motion: 'sway', markup: '<path d="M9 10h14v2.5L17.5 18h-3L9 12.5Z"/>' },
      { name: 'stem', origin: [16, 27.5], markup: '<path d="M14.5 21h3v5H24v3H8v-3h6.5Z"/>' },
    ],
  },
  palette: {
    label: 'Palette', category: 'Actions',
    parts: [
      { name: 'palette', origin: [16, 16], motion: 'sway', markup: '<path fill-rule="evenodd" d="M11 3h10l8 8v6l-4 4h-5l-2 2v3l-3 3h-5l-7-7V11l8-8Zm0 4-1 1v2l1 1h2l1-1V8l-1-1h-2Zm8 0-1 1v2l1 1h2l1-1V8l-1-1h-2Zm5 6-1 1v2l1 1h2l1-1v-2l-1-1h-2ZM7 15l-1 1v2l1 1h2l1-1v-2l-1-1H7Zm3 8-1 1v2l1 1h2l1-1v-2l-1-1h-2Z"/>' },
    ],
  },
  bank: {
    label: 'Bank', category: 'Giving',
    parts: [
      { name: 'roof', origin: [16, 13], motion: 'lift', markup: '<path d="m16 3 13 8v3H3v-3Z"/>' },
      { name: 'columns', origin: [16, 26], markup: '<path d="M5 17h3v9H5Zm9.5 0h3v9h-3Zm9.5 0h3v9h-3Z"/>' },
      { name: 'foundation', origin: [16, 27.5], markup: '<path d="M3 26h26v3H3Z"/>' },
    ],
  },
  link: {
    label: 'Link', category: 'Actions',
    parts: [
      { name: 'link-left', origin: [12, 20], motion: 'slide', markup: '<path d="M13 11H9l-6 6v6l6 6h6l6-6v-4h-3v3l-4 4h-4l-4-4v-4l4-4h3Z"/>' },
      { name: 'link-right', origin: [20, 12], markup: '<path d="M19 21h4l6-6V9l-6-6h-6l-6 6v4h3v-3l4-4h4l4 4v4l-4 4h-3Z"/>' },
      { name: 'connection', origin: [16, 16], markup: '<path d="m11 19 8-8 2 2-8 8Z"/>' },
    ],
  },
  headphones: {
    label: 'Headphones', category: 'Devices',
    parts: [
      { name: 'band', origin: [16, 16], markup: '<path d="M3 18v-8l7-7h12l7 7v8h-3v-7l-5-5H11l-5 5v7Z"/>' },
      { name: 'earcup-left', origin: [6.5, 21], motion: 'pulse', markup: '<path d="M3 16h7v13H6l-3-3Z"/>' },
      { name: 'earcup-right', origin: [25.5, 21], motion: 'pulse', markup: '<path d="M22 16h7v10l-3 3h-4Z"/>' },
    ],
  },
  tuning: {
    label: 'Adjustments', category: 'Actions',
    parts: [
      { name: 'tracks', origin: [16, 16], markup: '<path d="M3 5.5h26v3H3Zm0 9h26v3H3Zm0 9h26v3H3Z"/>' },
      { name: 'slider-top', origin: [12, 7], motion: 'slide', markup: '<path d="M10.5 3h3L15 4.5v5L13.5 11h-3L9 9.5v-5Z"/>' },
      { name: 'slider-middle', origin: [22, 16], motion: 'slide', markup: '<path d="M20.5 12h3l1.5 1.5v5L23.5 20h-3L19 18.5v-5Z"/>' },
      { name: 'slider-bottom', origin: [14, 25], motion: 'slide', markup: '<path d="M12.5 21h3l1.5 1.5v5L15.5 29h-3L11 27.5v-5Z"/>' },
    ],
  },
  'hand-coins': {
    label: 'Giving', category: 'Giving',
    parts: [
      { name: 'coin', origin: [19, 9.5], motion: 'lift', markup: '<path fill-rule="evenodd" d="M15 3h7l4 4v5l-4 4h-7l-4-4V7l4-4Zm1.5 3-2.5 2.5v2l2.5 2.5h4l2.5-2.5v-2L20.5 6h-4Z"/>' },
      { name: 'hand', origin: [7, 24], markup: '<path fill-rule="evenodd" d="m3 20 4-4h5l6 4h4l4-3 3 3-7 8H11l-4 1-4-5v-4Zm8 1v3h8v-3h-8Z"/>' },
    ],
  },
  calendar: {
    label: 'Calendar', category: 'Service',
    parts: [
      { name: 'body', origin: [16, 17.5], markup: '<path fill-rule="evenodd" d="M6 6h20l3 3v17l-3 3H6l-3-3V9l3-3Zm0 7v13h20V13H6Z"/>' },
      { name: 'binding', origin: [16, 6], markup: '<path d="M9 3h3v6H9Zm11 0h3v6h-3Z"/>' },
      { name: 'days', origin: [16, 19], motion: 'scan', markup: '<path d="M9 17h4v4H9Zm10 0h4v4h-4Z"/>' },
    ],
  },
  folder: {
    label: 'Folder', category: 'Navigation',
    parts: [
      { name: 'tab', origin: [10, 11], motion: 'lift', markup: '<path d="M3 4h9l4 4h10l3 3v3H3Z"/>' },
      { name: 'body', origin: [16, 29], markup: '<path fill-rule="evenodd" d="M3 11h26v14l-4 4H3V11Zm3 3v12h17l3-3v-9H6Z"/>' },
    ],
  },
  language: {
    label: 'Language', category: 'Actions',
    parts: [
      { name: 'latin', origin: [9, 13], motion: 'lift', markup: '<path fill-rule="evenodd" d="M7.5 3h3L15 22h-3l-1-4H7l-1 4H3L7.5 3ZM9 8l-1.5 7h3L9 8Z"/>' },
      { name: 'han', origin: [23, 19], markup: '<path d="M21.5 8h3v3h-3ZM17 14h12v3H17Zm2 3h3l2 5 5 5-2 2-5-5-3-7Zm6 0h3l-3 7-6 5-2-2 6-5 2-5Z"/>' },
    ],
  },
} as const satisfies Record<string, CutoutDefinition>;
