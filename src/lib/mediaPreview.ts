import type { ThemeMedia } from '../design/screens/mediaLibrary';
import type { LiveItem } from '../design/screens/projector';

/** Local and online media replace the staged content in exactly the same way. */
export function mediaPreview(media: ThemeMedia, baseUrl = typeof document === 'undefined' ? undefined : document.baseURI): LiveItem | null {
  let path = media.url;
  // Bundled URLs must keep their web meaning when sent through the same
  // preview/output path as imported filesystem images.
  if (path && baseUrl && !/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    const relative = baseUrl.startsWith('file:') && path.startsWith('/') ? `.${path}` : path;
    path = new URL(relative, baseUrl).href;
  }
  return media.url ? {
    source: 'media', id: media.id, label: media.label, path,
    mediaKind: media.kind ?? 'photo', origin: 'operator',
  } : null;
}
