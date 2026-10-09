import { expect, it } from 'vitest';
import { mediaPreview } from './mediaPreview';
import { publishLiveItem } from './publishLiveItem';
import { vi } from 'vitest';
import type { ThemeMedia } from '../design/screens/mediaLibrary';
import { mediaImageSource } from './mediaImage';

it.each(['photo', 'video'] as const)('stages downloaded %s content using its saved file, not its thumbnail', async kind => {
  const media: ThemeMedia = { id: 'online-pick', label: 'New selection', kind, source: 'local', url: 'local-media://file/saved/new.webm', poster: 'https://example.test/thumbnail.jpg', seed: 0, style: 'smoke', detail: '' };
  const item = mediaPreview(media)!;
  expect(item).toMatchObject({ source: 'media', path: media.url, mediaKind: kind, origin: 'operator' });
  const showMedia = vi.fn().mockResolvedValue({ success: true });
  const clearMedia = vi.fn();
  await publishLiveItem(item, { showMedia, clearMedia } as unknown as Window['api']);
  expect(showMedia).toHaveBeenCalledWith(media.url, kind);
  expect(clearMedia).not.toHaveBeenCalled();
});

it.each([
  ['/src/assets/backgrounds/valley.jpg', 'http://localhost:5173/design.html', 'http://localhost:5173/src/assets/backgrounds/valley.jpg'],
  ['/assets/valley-123.jpg', 'file:///Applications/Trilorah/dist/design.html', 'file:///Applications/Trilorah/dist/assets/valley-123.jpg'],
])('resolves bundled %s before staging or publishing', (url, base, expected) => {
  const media: ThemeMedia = { id: 'starter-valley', label: 'Valley', url, source: 'local', seed: 0, style: 'smoke', detail: '' };
  expect(mediaPreview(media, base)?.path).toBe(expected);
});

it.each(['http://localhost:5173/src/assets/valley.jpg', 'https://example.test/photo.jpg', 'data:image/png;base64,AA', 'blob:http://localhost/test'])('displays browser image %s without reading it as a disk path', async path => {
  const read = vi.fn();
  expect(await mediaImageSource(path, read)).toBe(path);
  expect(read).not.toHaveBeenCalled();
});

it.each(['file:///Applications/Trilorah/dist/assets/valley.jpg', 'local-media://file/Users/test/photo.jpg', '/Users/test/slide.jpg'])('still loads native image %s through the desktop reader', async path => {
  const read = vi.fn().mockResolvedValue('data:image/jpeg;base64,AA');
  expect(await mediaImageSource(path, read)).toBe('data:image/jpeg;base64,AA');
  expect(read).toHaveBeenCalledWith(path);
});
