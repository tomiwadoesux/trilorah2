import type { CutoutDefinition } from './types';

/** Original Cutout controls on the shared 32-unit grid. */
export const CONTROL_ICONS = {
  settings: {
    label: 'Settings', category: 'Actions',
    parts: [{ name: 'gear', origin: [16, 16], motion: 'turn', markup: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M13 3h6v4l2 1 3-3 3 3-3 3 1 2h4v6h-4l-1 2 3 3-3 3-3-3-2 1v4h-6v-4l-2-1-3 3-3-3 3-3-1-2H3v-6h4l1-2-3-3 3-3 3 3 2-1V3Zm.5 8L11 13.5v5l2.5 2.5h5l2.5-2.5v-5l-2.5-2.5h-5Z"/>' }],
  },
  trash: {
    label: 'Delete', category: 'Actions',
    parts: [
      { name: 'body', origin: [16, 28], markup: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M7 13.5h18V25l-3 3H10l-3-3V13.5Zm4 2.5v8h3v-8h-3Zm7 0v8h3v-8h-3Z"/>' },
      { name: 'lid', origin: [16, 11], motion: 'lift', markup: '<path fill="currentColor" stroke="none" d="M6 8.5h5V5l2-2h6l2 2v3.5h5V11H6V8.5Zm8-3v3h4v-3h-4Z" fill-rule="evenodd"/>' },
    ],
  },
  reset: {
    label: 'Reset', category: 'Actions',
    parts: [{ name: 'return-arrow', origin: [16, 16], motion: 'turn', markup: '<path fill="currentColor" stroke="none" d="m11 3-8 8 8 8v-6h8.5l5.5 5.5v3L21.5 25h-10L8 21.5V19H4v4l6 6h13l6-6v-6l-8-8H11V3Z"/>' }],
  },
  'chevron-down': {
    label: 'Chevron down', category: 'Navigation',
    parts: [{ name: 'chevron', origin: [16, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="m5 11 3-3 8 8 8-8 3 3-11 11L5 11Z"/>' }],
  },
  'chevron-left': {
    label: 'Chevron left', category: 'Navigation',
    parts: [{ name: 'chevron', origin: [16, 16], motion: 'slide', markup: '<path fill="currentColor" stroke="none" d="m21 5 3 3-8 8 8 8-3 3-11-11L21 5Z"/>' }],
  },
  'chevron-right': {
    label: 'Chevron right', category: 'Navigation',
    parts: [{ name: 'chevron', origin: [16, 16], motion: 'slide', markup: '<path fill="currentColor" stroke="none" d="m11 5 11 11-11 11-3-3 8-8-8-8 3-3Z"/>' }],
  },
  'chevron-up': {
    label: 'Chevron up', category: 'Navigation',
    parts: [{ name: 'chevron', origin: [16, 16], motion: 'lift', markup: '<path fill="currentColor" stroke="none" d="m5 21 11-11 11 11-3 3-8-8-8 8-3-3Z"/>' }],
  },
  pencil: {
    label: 'Edit', category: 'Actions',
    parts: [
      { name: 'barrel', origin: [3, 29], motion: 'sway', markup: '<path fill="currentColor" stroke="none" d="m7.5 18.5 11-11 6 6-11 11-6-6Z"/>' },
      { name: 'tip', origin: [3, 29], motion: 'sway', markup: '<path fill="currentColor" stroke="none" d="m7.75 18.25 6 6L3 29l4.75-10.75Z"/>' },
      { name: 'cap', origin: [3, 29], motion: 'sway', markup: '<path fill="currentColor" stroke="none" d="M20.5 5.5 23 3h2.5L29 6.5V9l-2.5 2.5-6-6Z"/>' },
    ],
  },
  plus: {
    label: 'Add', category: 'Actions',
    parts: [{ name: 'plus', origin: [16, 16], motion: 'pulse', markup: '<path fill="currentColor" stroke="none" d="M14 5h4v9h9v4h-9v9h-4v-9H5v-4h9V5Z"/>' }],
  },
  minus: {
    label: 'Remove', category: 'Actions',
    parts: [{ name: 'minus', origin: [16, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M5 14h22v4H5v-4Z"/>' }],
  },
  scan: {
    label: 'Scan', category: 'Actions',
    parts: [
      { name: 'corners', origin: [16, 16], markup: '<path fill="currentColor" stroke="none" d="M4 12V7l3-3h5v3H8L7 8v4H4Zm16-8h5l3 3v5h-3V8l-1-1h-4V4Zm8 16v5l-3 3h-5v-3h4l1-1v-4h3ZM12 28H7l-3-3v-5h3v4l1 1h4v3Z"/>' },
      { name: 'beam', origin: [16, 16], motion: 'scan', markup: '<path fill="currentColor" stroke="none" d="M9 14.5h14v3H9v-3Z"/>' },
    ],
  },
  grip: {
    label: 'Drag handle', category: 'Actions',
    parts: [{ name: 'grip', origin: [16, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M7.5 3H12l1.5 1.5v4L12 10H7.5L6 8.5v-4L7.5 3ZM20 3h4.5L26 4.5v4L24.5 10H20l-1.5-1.5v-4L20 3ZM7.5 12.5H12l1.5 1.5v4L12 19.5H7.5L6 18v-4l1.5-1.5ZM20 12.5h4.5L26 14v4l-1.5 1.5H20L18.5 18v-4l1.5-1.5ZM7.5 22H12l1.5 1.5v4L12 29H7.5L6 27.5v-4L7.5 22ZM20 22h4.5l1.5 1.5v4L24.5 29H20l-1.5-1.5v-4L20 22Z"/>' }],
  },
  check: {
    label: 'Check', category: 'Status',
    parts: [{ name: 'check', origin: [16, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="m4 16 3-3 6 6L25 7l3 3-15 15-9-9Z"/>' }],
  },
  history: {
    label: 'History', category: 'Navigation',
    parts: [
      { name: 'return-ring', origin: [16, 16], markup: '<path fill="currentColor" stroke="none" d="M12 4h10l7 7v10l-7 7H11l-7-7v-5h3v3.5l5.5 5.5h8l5.5-5.5v-7L20.5 7h-7L9 11.5H13V14H3V4h3v6l6-6Z"/>' },
      { name: 'hands', origin: [16, 16], motion: 'turn', markup: '<path fill="currentColor" stroke="none" d="M14.5 10h3v5.5l5 3-1.5 2.5-6.5-4V10Z"/>' },
    ],
  },
  pause: {
    label: 'Pause', category: 'Actions',
    parts: [
      { name: 'left-bar', origin: [10.5, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M7 5h7v22H7V5Z"/>' },
      { name: 'right-bar', origin: [21.5, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M18 5h7v22h-7V5Z"/>' },
    ],
  },
  play: {
    label: 'Play', category: 'Actions',
    parts: [{ name: 'triangle', origin: [16, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M8 4 28 16 8 28V4Z"/>' }],
  },
  stop: {
    label: 'Stop', category: 'Actions',
    parts: [{ name: 'square', origin: [16, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M7 5h18l2 2v18l-2 2H7l-2-2V7l2-2Z"/>' }],
  },
  import: {
    label: 'Import', category: 'Actions',
    parts: [
      { name: 'frame', origin: [22, 16], markup: '<path fill="currentColor" stroke="none" d="M15 3h10l4 4v18l-4 4H15v-3h8.5l2.5-2.5v-15L23.5 6H15V3Z"/>' },
      { name: 'inbound-arrow', origin: [12, 16], motion: 'slide', markup: '<path fill="currentColor" stroke="none" d="M3 14h11l-4-4 2.5-2.5L21 16l-8.5 8.5L10 22l4-4H3v-4Z"/>' },
    ],
  },
  export: {
    label: 'Export', category: 'Actions',
    parts: [
      { name: 'frame', origin: [22, 16], markup: '<path fill="currentColor" stroke="none" d="M15 3h10l4 4v18l-4 4H15v-3h8.5l2.5-2.5v-15L23.5 6H15V3Z"/>' },
      { name: 'outbound-arrow', origin: [12, 16], motion: 'slide', markup: '<path fill="currentColor" stroke="none" d="M20 14H9l4-4-2.5-2.5L2 16l8.5 8.5L13 22l-4-4h11v-4Z"/>' },
    ],
  },
  download: {
    label: 'Download', category: 'Actions',
    parts: [
      { name: 'tray', origin: [16, 29], markup: '<path fill="currentColor" stroke="none" d="M3 20h3v4.5L7.5 26h17l1.5-1.5V20h3v6l-3 3H6l-3-3v-6Z"/>' },
      { name: 'down-arrow', origin: [16, 13], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M14 3h4v12l4-4 3 3-9 9-9-9 3-3 4 4V3Z"/>' },
    ],
  },
  upload: {
    label: 'Upload', category: 'Actions',
    parts: [
      { name: 'tray', origin: [16, 29], markup: '<path fill="currentColor" stroke="none" d="M3 20h3v4.5L7.5 26h17l1.5-1.5V20h3v6l-3 3H6l-3-3v-6Z"/>' },
      { name: 'up-arrow', origin: [16, 13], motion: 'lift', markup: '<path fill="currentColor" stroke="none" d="M14 23V11l-4 4-3-3 9-9 9 9-3 3-4-4v12h-4Z"/>' },
    ],
  },
  close: {
    label: 'Close', category: 'Actions',
    parts: [{ name: 'cross', origin: [16, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="m7 4 9 9 9-9 3 3-9 9 9 9-3 3-9-9-9 9-3-3 9-9-9-9 3-3Z"/>' }],
  },
  split: {
    label: 'Split', category: 'Actions',
    parts: [{ name: 'forked-arrows', origin: [16, 20], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M3 3h10v3H8.5l7.5 7.5L23.5 6H19V3h10v10h-3V8.5l-8 8V29h-4V16.5l-8-8V13H3V3Z"/>' }],
  },
  merge: {
    label: 'Merge', category: 'Actions',
    parts: [{ name: 'merged-arrow', origin: [16, 18], motion: 'lift', markup: '<path fill="currentColor" stroke="none" d="m7 12 9-9 9 9-3 3-4-4v6.5l9 9-3 3-8-8-8 8-3-3 9-9V11l-4 4-3-3Z"/>' }],
  },
  copy: {
    label: 'Copy', category: 'Actions',
    parts: [
      { name: 'back-sheet', origin: [14, 15], markup: '<path fill="currentColor" stroke="none" d="M7 3h15l3 3v1h-4.5l-1-1h-11L6 8.5v13L8.5 24v3H7l-4-4V7l4-4Z"/>' },
      { name: 'front-sheet', origin: [20, 20], motion: 'lift', markup: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M15 10h10l4 4v12l-3 3H15l-4-4V14l4-4Zm1 6v3h8v-3h-8Zm0 6v3h8v-3h-8Z"/>' },
    ],
  },
  clipboard: {
    label: 'Clipboard', category: 'Actions',
    parts: [
      { name: 'board', origin: [16, 29], markup: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M8 6h1.5v7h13V6H24l4 4v15l-4 4H8l-4-4V10l4-4Zm1 10v3h14v-3H9Zm0 6v3h10v-3H9Z"/>' },
      { name: 'clip', origin: [16, 8], motion: 'lift', markup: '<path fill="currentColor" stroke="none" d="M12 5l2-2h4l2 2v5h-8V5Z"/>' },
    ],
  },
  'arrow-right': {
    label: 'Arrow right', category: 'Navigation',
    parts: [{ name: 'arrow', origin: [16, 16], motion: 'slide', markup: '<path fill="currentColor" stroke="none" d="M4 14h16l-7-7 3-3 12 12-12 12-3-3 7-7H4v-4Z"/>' }],
  },
  'arrow-left': {
    label: 'Arrow left', category: 'Navigation',
    parts: [{ name: 'arrow', origin: [16, 16], motion: 'slide', markup: '<path fill="currentColor" stroke="none" d="M28 14H12l7-7-3-3L4 16l12 12 3-3-7-7h16v-4Z"/>' }],
  },
  'arrow-up': {
    label: 'Arrow up', category: 'Navigation',
    parts: [{ name: 'arrow', origin: [16, 16], motion: 'lift', markup: '<path fill="currentColor" stroke="none" d="M14 28V12l-7 7-3-3L16 4l12 12-3 3-7-7v16h-4Z"/>' }],
  },
  'arrow-down': {
    label: 'Arrow down', category: 'Navigation',
    parts: [{ name: 'arrow', origin: [16, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M14 4v16l-7-7-3 3 12 12 12-12-3-3-7 7V4h-4Z"/>' }],
  },
  expand: {
    label: 'Expand', category: 'Actions',
    parts: [{ name: 'outward-corners', origin: [16, 16], motion: 'pulse', markup: '<path fill="currentColor" stroke="none" d="M3 3h10v3H6v7H3V3Zm16 0h10v10h-3V6h-7V3Zm10 16v10H19v-3h7v-7h3ZM13 29H3V19h3v7h7v3Z"/>' }],
  },
  minimize: {
    label: 'Minimize', category: 'Actions',
    parts: [{ name: 'inward-corners', origin: [16, 16], motion: 'press', markup: '<path fill="currentColor" stroke="none" d="M5 13h8V5l-2.5 2.5L6 3 3 6l4.5 4.5L5 13Zm22 6h-8v8l2.5-2.5L26 29l3-3-4.5-4.5L27 19Z"/>' }],
  },
  undo: {
    label: 'Undo', category: 'Actions',
    parts: [{ name: 'return-arrow', origin: [16, 16], motion: 'sway', markup: '<path fill="currentColor" stroke="none" d="m12 3-9 9 9 9 3-3-4-4h8.5l5.5 5.5V28h4V18l-8-8H11l4-4-3-3Z"/>' }],
  },
  redo: {
    label: 'Redo', category: 'Actions',
    parts: [{ name: 'return-arrow', origin: [16, 16], motion: 'sway', markup: '<path fill="currentColor" stroke="none" d="m20 3 9 9-9 9-3-3 4-4h-8.5L7 19.5V28H3V18l8-8h10l-4-4 3-3Z"/>' }],
  },
  more: {
    label: 'More options', category: 'Actions',
    parts: [
      { name: 'first-dot', origin: [7, 16], motion: 'pulse', markup: '<path fill="currentColor" stroke="none" d="M5 14h4v4H5v-4Z"/>' },
      { name: 'middle-dot', origin: [16, 16], motion: 'pulse', markup: '<path fill="currentColor" stroke="none" d="M14 14h4v4h-4v-4Z"/>' },
      { name: 'last-dot', origin: [25, 16], motion: 'pulse', markup: '<path fill="currentColor" stroke="none" d="M23 14h4v4h-4v-4Z"/>' },
    ],
  },
} as const satisfies Record<string, CutoutDefinition>;
