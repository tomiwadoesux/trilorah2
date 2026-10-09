import type { StudyIcon } from './iconStudiesData';

// Split keeps each subject readable as a small arrangement of solid slabs.
// All gaps and counters are transparent on the shared 32-unit study grid.
export const SPLIT_PATHS: Record<StudyIcon, string> = {
  bible: `<path fill="currentColor" stroke="none" d="M7.5 4v24H4V7.5L7.5 4Z"/><path fill="currentColor" stroke="none" fill-rule="evenodd" d="M10.5 4h13l4 4v20H10.5V4Zm6.5 4v4h-3.5v3H17v6h3v-6h3.5v-3H20V8h-3Z"/>`,
  microphone: `<path fill="currentColor" stroke="none" d="M13 3h6l3 3v4H10V6l3-3ZM10 13h12v3l-3 3h-6l-3-3v-3ZM4.5 13h3v5.5l4 4h9l4-4V13h3v6.75l-5.75 5.75H17.5v.5h5v3h-13v-3h5v-.5h-4.25L4.5 19.75V13Z"/>`,
  songs: `<path fill="currentColor" stroke="none" d="M11 4h15l2 2v2H11V4ZM11 11h3v15l-3 3H6l-3-3v-2l3-3h5V11ZM25 11h3v12l-3 3h-5l-3-3v-2l3-3h5v-7Z"/>`,
  search: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M9 3h9l5.5 5.5v9L18 23H9l-5.5-5.5v-9L9 3Zm1.5 3.5L7 10v6l3.5 3.5h6L20 16v-6l-3.5-3.5h-6Z"/><path fill="currentColor" stroke="none" d="m24 21.5 5 5-2.5 2.5-5-5 2.5-2.5Z"/>`,
  media: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M7 4h18l3 3v5H4V7l3-3Zm13 2v4h4V6h-4Z"/><path fill="currentColor" stroke="none" d="m4 22 7-7 7 7 4-4 6 6v1l-3 3H7l-3-3v-3Z"/>`,
};

// Open Cut sends the defining negative shape out through the silhouette:
// the page channel, grille slot, beam notch, lens aperture, or landscape.
export const OPEN_CUT_PATHS: Record<StudyIcon, string> = {
  bible: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M8 3h19v19H9v3h18v4H8l-4-4V7l4-4Zm6.5 5v3H11v3h3.5v6h3v-6H21v-3h-3.5V8h-3Z"/>`,
  microphone: `<path fill="currentColor" stroke="none" d="M13 3h6l3 3v3h-7v3h7v4l-3 3h-6l-3-3V6l3-3ZM4.5 13h3v5.5l4 4h9l4-4V13h3v6.75l-5.75 5.75H17.5v.5h5v3h-13v-3h5v-.5h-4.25L4.5 19.75V13Z"/>`,
  songs: `<path fill="currentColor" stroke="none" d="M11 4h15l2 2v16l-4 4h-5l-3-3v-2l3-3h6v-8h-4V7h-3v3h-4v15l-4 4H6l-3-3v-2l3-3h5V4Z"/>`,
  search: `<path fill="currentColor" stroke="none" d="M9 3h9l6 6v9l-1.5 1.5 6.5 6.5-3 3-8.5-8.5 3-3v-7L17 7h-6.5L7 10.5v6l3.5 3.5H15v4H9l-6-6V9l6-6Z"/>`,
  media: `<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M7 4h18l4 4v13l-7-7-5 5-6-6-5 5v5l2 2h21l-3 3H7l-4-4V8l4-4Zm13 4v4h4V8h-4Z"/>`,
};
