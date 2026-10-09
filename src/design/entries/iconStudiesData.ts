export const STUDY_ICONS = [
  { id: 'bible', name: 'Bible', where: 'Scripture library · verse search' },
  { id: 'microphone', name: 'Microphone', where: 'Listening · song search · audio' },
  { id: 'songs', name: 'Songs', where: 'Song library · service schedule' },
  { id: 'search', name: 'Search', where: 'Scripture · songs · media' },
  { id: 'media', name: 'Media', where: 'Media library · live output' },
] as const;

export const STUDY_STYLES = [
  { id: 'contour', code: 'A', name: 'Contour', description: 'Balanced curves. Clear, open lines.', use: 'Everyday controls', weight: 1.85, cap: 'round', join: 'round' },
  { id: 'solid', code: 'B', name: 'Soft Solid', description: 'Softer forms. A confident silhouette.', use: 'Compact controls & active states', weight: 2, cap: 'round', join: 'round' },
  { id: 'duotone', code: 'C', name: 'Duotone', description: 'Soft grey fields. Crisp white detail.', use: 'Navigation & library sections', weight: 1.8, cap: 'round', join: 'round' },
  { id: 'cutout', code: 'D', name: 'Cutout', description: 'Bold geometry. Clean, angular cuts.', use: 'A strong, graphic identity', weight: 2, cap: 'square', join: 'miter' },
  { id: 'stencil', code: 'E', name: 'Stencil', description: 'Rounded strokes. Deliberate openings.', use: 'Distinctive navigation & buttons', weight: 3.1, cap: 'round', join: 'round' },
] as const;

export type StudyIcon = typeof STUDY_ICONS[number]['id'];
export type StudyStyle = typeof STUDY_STYLES[number]['id'];

// Original geometry on one 32-unit grid. Each family has a consistent
// construction rule; every knockout is transparent, never a background patch.
// These same paths supply the live preview and all standalone SVG exports.
export const STUDY_PATHS: Record<StudyStyle, Record<StudyIcon, string>> = {
  contour: {
    bible: `<path d="M16 9C12.5 6.2 8.4 5.2 3.5 6.5v18c4.8-1.3 9-.3 12.5 2.5 3.5-2.8 7.7-3.8 12.5-2.5v-18C23.6 5.2 19.5 6.2 16 9Z"/><path d="M16 9v18M9.5 11.5v8M6.5 14.5h6M20 12.5c1.4-.6 2.8-.8 4.5-.7M20 17c1.4-.6 2.8-.8 4.5-.7"/>`,
    microphone: `<rect x="10.5" y="3.5" width="11" height="16.5" rx="5.5"/><path d="M6.5 14.5v1a9.5 9.5 0 0 0 19 0v-1M16 25v3.5M11.5 28.5h9"/>`,
    songs: `<path d="M12 23V8l14-3v15M12 12l14-3"/><ellipse cx="8" cy="24" rx="4" ry="3" transform="rotate(-18 8 24)"/><ellipse cx="22" cy="21" rx="4" ry="3" transform="rotate(-18 22 21)"/>`,
    search: `<circle cx="13.75" cy="13.75" r="9.25"/><path d="m20.5 20.5 7 7"/>`,
    media: `<rect x="3.5" y="5.5" width="25" height="21" rx="4"/><circle cx="21.5" cy="11.5" r="2"/><path d="m4 22 7.5-8 6.5 7 4-4 6.5 6"/>`,
  },
  solid: {
    bible: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M10 3.5h13a3.5 3.5 0 0 1 3.5 3.5v21.5H10A5.5 5.5 0 0 1 4.5 23V9A5.5 5.5 0 0 1 10 3.5Zm5.75 4v3.25H12.5v2.5h3.25V18h2.5v-4.75h3.25v-2.5h-3.25V7.5h-2.5ZM10 22.5a1.75 1.75 0 0 0 0 3.5h13.5v-3.5H10Z"/>`,
    microphone: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M10 9a6 6 0 0 1 12 0v6a6 6 0 0 1-12 0V9Zm4-1.5v2h4v-2h-4Zm0 4v2h4v-2h-4Z"/><path d="M6.5 15v.5a9.5 9.5 0 0 0 19 0V15M16 25v3.5M11.5 28.5h9" stroke-width="2.6"/>`,
    songs: `<path fill="currentColor" stroke="none" d="M12 7.5c0-.7.5-1.3 1.2-1.5l12-2.5c.9-.2 1.8.5 1.8 1.5v15.5c0 2.4-2.6 4.3-5.6 4.3-2.5 0-4-1.3-4-3.1 0-2.3 2.7-4.2 5.6-4.2.4 0 .8 0 1 .1V10l-9 1.9v12c0 2.4-2.6 4.3-5.6 4.3-2.5 0-4-1.3-4-3.1 0-2.3 2.7-4.2 5.6-4.2.4 0 .8 0 1 .1V7.5Z"/>`,
    search: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M13.5 3.5a10 10 0 1 0 6.2 17.85l6.2 6.25a2 2 0 1 0 2.8-2.8l-6.4-6.35A10 10 0 0 0 13.5 3.5Zm0 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z"/>`,
    media: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M8 4.5h16a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-13a5 5 0 0 1 5-5Zm13.25 3.75a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 22.5c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-1.25l-4.25-4.75-4.25 4-6.25-7L6 20v2.5Z"/>`,
  },
  duotone: {
    bible: `<path d="M16 9C12.5 6.2 8.4 5.2 3.5 6.5v18c4.8-1.3 9-.3 12.5 2.5 3.5-2.8 7.7-3.8 12.5-2.5v-18C23.6 5.2 19.5 6.2 16 9Z" fill="currentColor" fill-opacity=".22" stroke="none"/><path d="M16 9v18M3.5 21.5v3c4.8-1.3 9-.3 12.5 2.5 3.5-2.8 7.7-3.8 12.5-2.5v-3M9.5 11.5v8M6.5 14.5h6M20 12.5c1.4-.6 2.8-.8 4.5-.7M20 17c1.4-.6 2.8-.8 4.5-.7"/>`,
    microphone: `<rect x="10" y="3.5" width="12" height="17" rx="6" fill="currentColor" fill-opacity=".22" stroke="none"/><path d="M14 8.5h4M14 12.5h4M6.5 14.5v1a9.5 9.5 0 0 0 19 0v-1M16 25v3.5M11.5 28.5h9"/>`,
    songs: `<path d="m12 7.5 14-3V10l-14 3Z" fill="currentColor" fill-opacity=".22" stroke="none"/><path d="M12 23V7.5l14-3V20"/><ellipse cx="8" cy="24" rx="4.5" ry="3.3" transform="rotate(-18 8 24)" fill="currentColor" stroke="none"/><ellipse cx="22" cy="21" rx="4.5" ry="3.3" transform="rotate(-18 22 21)" fill="currentColor" stroke="none"/>`,
    search: `<circle cx="13.75" cy="13.75" r="9.75" fill="currentColor" fill-opacity=".22" stroke="none"/><path d="M9 13.75A4.75 4.75 0 0 1 13.75 9M21 21l6.5 6.5" stroke-width="2.4"/>`,
    media: `<rect x="3.5" y="5.5" width="25" height="21" rx="4" fill="currentColor" fill-opacity=".22" stroke="none"/><circle cx="21.5" cy="11.5" r="2.2" fill="currentColor" stroke="none"/><path d="m4 22 7.5-8 6.5 7 4-4 6.5 6M4 23.5c0 1.7 1.3 3 3 3h18c1.7 0 3-1.3 3-3"/>`,
  },
  cutout: {
    bible: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M9 3.5h17.5v25H9l-4.5-4.5V8L9 3.5Zm6.5 4v3h-3v2.5h3v5h2.5v-5h3v-2.5h-3v-3h-2.5ZM9 22v3.5h14.5V22H9Z"/>`,
    microphone: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M13 3.5h6L22 6.5V18l-3 3h-6l-3-3V6.5l3-3Zm.5 4v2h5v-2h-5Zm0 4.5v2h5v-2h-5Z"/><path d="M6.5 15v5L11 24.5h10l4.5-4.5v-5M16 25v3M12 28.5h8" stroke-width="2.5"/>`,
    songs: `<path fill="currentColor" stroke="none" d="m12 6.5 15-3v18l-3.5 3.5h-4l-2.5-2.5v-2l3-3h4V10l-9 1.8V25l-3.5 3.5h-4L5 26v-2l3-3h4V6.5Z"/>`,
    search: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M9 3.5h9L24 9.5v8L18 23.5H9L3.5 18V9L9 3.5Zm1.5 3.5L7 10.5v6l3.5 3.5h6l4-4v-5l-4-4h-6Z"/><path fill="currentColor" stroke="none" d="m21.5 20 6.5 6-2.6 2.6-6.5-6Z"/>`,
    media: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M7 4.5h18l4 4v15l-4 4H7l-4-4v-15l4-4Zm12 4v4h4v-4h-4ZM6 22.5l2 2h16l2-2-5-6-4 4-6-7-5 6v3Z"/>`,
  },
  stencil: {
    bible: `<path d="M12.5 7.5c-2.4-1-5.2-1.3-8-.5v17.5c3.8-1 7-.2 10 2.1M19.5 7.5c2.4-1 5.2-1.3 8-.5v17.5c-1.7-.5-3.5-.6-5.5-.1M16 12v15"/><path d="M10.5 12v7M8.5 15h4" stroke-width="2"/>`,
    microphone: `<path d="M11 9.5V8.5a5 5 0 0 1 10 0v7a5 5 0 0 1-10 0M6 16a10 10 0 0 0 4.5 7.6M26 16a10 10 0 0 1-4.5 7.6M16 23v5.5M12 28.5h8"/>`,
    songs: `<path d="M12.5 14.5V8.5L25 6v14.5M12.5 21v3"/><ellipse cx="8.5" cy="24.5" rx="4.4" ry="3.2" transform="rotate(-18 8.5 24.5)" fill="currentColor" stroke="none"/><ellipse cx="21" cy="21" rx="4.4" ry="3.2" transform="rotate(-18 21 21)" fill="currentColor" stroke="none"/>`,
    search: `<path d="M22 12.5a9 9 0 1 0-9.5 10.25M20 20l7.5 7.5"/>`,
    media: `<path d="M16 5.5H8a4.5 4.5 0 0 0-4.5 4.5v12A4.5 4.5 0 0 0 8 26.5h16a4.5 4.5 0 0 0 4.5-4.5V10a4.5 4.5 0 0 0-4.5-4.5h-2"/><path d="m8 21 5-6 5 6h5" stroke-width="2.5"/><circle cx="22" cy="12" r="2" fill="currentColor" stroke="none"/>`,
  },
};

export function studySvg(icon: StudyIcon, style: StudyStyle, size = 32) {
  const family = STUDY_STYLES.find(item => item.id === style)!;
  const label = STUDY_ICONS.find(item => item.id === icon)!.name;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="${family.weight}" stroke-linecap="${family.cap}" stroke-linejoin="${family.join}" color="#efefec" role="img" aria-label="${label} — ${family.name}">${STUDY_PATHS[style][icon]}</svg>`;
}
