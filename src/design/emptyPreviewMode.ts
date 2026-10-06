/** Dedicated, temporary first-install view; ordinary app and gallery keep their data. */
export const isEmptyPreview = typeof location !== 'undefined' && location.pathname.endsWith('/empty-preview.html');
