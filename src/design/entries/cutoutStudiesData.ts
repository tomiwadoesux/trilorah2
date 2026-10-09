import { STUDY_ICONS, STUDY_PATHS, type StudyIcon } from './iconStudiesData';
import { OPEN_CUT_PATHS, SPLIT_PATHS } from './cutoutOpenVariants';

export const CUTOUT_STYLES = [
  { id: 'original', code: '01', name: 'Original', description: 'The Cutout you chose. Our starting point.', use: 'The reference for this study', weight: 2, cap: 'square', join: 'miter' },
  { id: 'chisel', code: '02', name: 'Chisel', description: 'Broad faces. A few decisive corner cuts.', use: 'The cleanest everyday direction', weight: 2.5, cap: 'square', join: 'miter' },
  { id: 'wedge', code: '03', name: 'Wedge', description: 'Tapered ends. Strong triangular openings.', use: 'An expressive, graphic identity', weight: 2.5, cap: 'square', join: 'miter' },
  { id: 'split', code: '04', name: 'Split', description: 'Separate pieces. Space does the drawing.', use: 'Distinctive library navigation', weight: 2.5, cap: 'square', join: 'miter' },
  { id: 'open-cut', code: '05', name: 'Open Cut', description: 'Inner openings break through an edge.', use: 'A lighter, more open silhouette', weight: 2.5, cap: 'square', join: 'miter' },
  { id: 'stepped', code: '06', name: 'Stepped', description: 'Square turns. Bold architectural shapes.', use: 'A modular, recognisable identity', weight: 2.5, cap: 'square', join: 'miter' },
] as const;

export type CutoutStyle = typeof CUTOUT_STYLES[number]['id'];

export const CUTOUT_PATHS: Record<CutoutStyle, Record<StudyIcon, string>> = {
  original: STUDY_PATHS.cutout,
  chisel: {
    bible: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M5 4h18l4 4v20H9l-4-4V4Zm10 3.5v3.25h-3.5v2.5H15v5.25h3v-5.25h3.5v-2.5H18V7.5h-3ZM8.5 22v3H24v-3H8.5Z"/>`,
    microphone: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M10 4h9l3 3v11l-3 3h-9V4Zm3 4v3h6V8h-6Zm0 6v3h6v-3h-6Z"/><path fill="currentColor" stroke="none" d="M5 14h3v7l3 3h10l3-3v-7h3v8.5L22.5 27h-5v2h-3v-2h-5L5 22.5V14Z"/>`,
    songs: `<path fill="currentColor" stroke="none" d="M12 4h15v17l-4 4h-6v-7h7v-7h-9v13l-4 4H5v-7h7V4Z"/>`,
    search: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M8 4h16v15l-5 5H4V8l4-4Zm1.5 4L8 9.5V20h9.5l2.5-2.5V8H9.5Z"/><path fill="currentColor" stroke="none" d="m21.5 19 7 7-3 3-7-7Z"/>`,
    media: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M3 5h22l4 4v18H7l-4-4V5Zm17 3v4h4V8h-4ZM6 23.5h20v-2.25l-5-5.75-4 4-6-7-5 6.5v4.5Z"/>`,
  },
  wedge: {
    bible: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M5 4h22v19l-6 6H5V4Zm10 3v3h-3v3h3v6h3v-6h4v-3h-4V7h-3ZM9 22v4h11l4-4H9Z"/>`,
    microphone: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="m9 4 14 3v10l-7 5-7-5V4Zm3 3.5v3l8 2v-3l-8-2Zm0 6v2.5l5 1.5v-2.5L12 13.5Z"/><path fill="currentColor" stroke="none" d="M4 14h3v6l9 5 9-5v-6h3v8l-10.5 6v1h-3v-1L4 22v-8Z"/>`,
    songs: `<path fill="currentColor" stroke="none" d="m12 8 16-5v17l-7 6-4-4 7-5V10l-8 2.5V24l-8 5-4-4 8-5V8Z"/>`,
    search: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="m13.5 3 11 6v9l-11 6L3 18V9l10.5-6Zm0 4.5L7 11v5l6.5 3.5L20 16v-5l-6.5-3.5Z"/><path fill="currentColor" stroke="none" d="m21 19 8 10-11-7Z"/>`,
    media: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M3 5h26v17l-5 5H3V5Zm19 3-3 3 3 3 3-3-3-3ZM6 24h17l3-3-4-5-5 5-5-9-6 8v4Z"/>`,
  },
  split: SPLIT_PATHS,
  'open-cut': OPEN_CUT_PATHS,
  stepped: {
    bible: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M9 4h18v24H9v-3H5V7h4V4Zm6 4v3h-3v3h3v5h3v-5h4v-3h-4V8h-3ZM9 22v3h15v-3H9Z"/>`,
    microphone: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M13 3h6v3h3v12h-3v3h-6v-3h-3V6h3V3Zm0 5v3h6V8h-6Zm0 6v2h6v-2h-6Z"/><path fill="currentColor" stroke="none" d="M4 14h3v7h4v3h10v-3h4v-7h3v10h-4v3h-6v2h-4v-2H8v-3H4V14Z"/>`,
    songs: `<path fill="currentColor" stroke="none" d="M12 7h7V4h9v16h-3v4h-8v-7h7v-6H15v13h-3v4H4v-7h8V7Z"/>`,
    search: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M8 3h12v4h4v13h-4v4H8v-4H4V7h4V3Zm3 4v3H8v7h3v3h6v-3h3v-7h-3V7h-6Z"/><path fill="currentColor" stroke="none" d="M20 20h5v4h4v5h-5v-4h-4Z"/>`,
    media: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M7 4h18v3h4v17h-4v4H7v-4H3V7h4V4Zm13 4v4h4V8h-4ZM6 20v4h20v-4h-3v-4h-4v4h-4v-4h-3v-3H9v7H6Z"/>`,
  },
};

export function cutoutSvg(icon: StudyIcon, style: CutoutStyle, size = 32) {
  const family = CUTOUT_STYLES.find(item => item.id === style)!;
  const label = STUDY_ICONS.find(item => item.id === icon)!.name;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="${family.weight}" stroke-linecap="${family.cap}" stroke-linejoin="${family.join}" color="#efefec" role="img" aria-label="${label} — Cutout ${family.name}">${CUTOUT_PATHS[style][icon]}</svg>`;
}
