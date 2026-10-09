import { describe, expect, it } from 'vitest';
import { selectBackgroundContent } from './backgroundSelection';
import { publishLiveItem } from './publishLiveItem';
import { vi } from 'vitest';
import type { LiveItem } from '../design/screens/projector';

const background = { id: 'forest', label: 'Forest' };
describe('selecting a theme after standalone media', () => {
  it.each([
    { source: 'media', path: '/old.jpg', mediaKind: 'photo' },
    { source: 'media', path: '/old.webm', mediaKind: 'video' },
    { source: 'presentation', path: '/slide.png' },
  ] as const)('replaces $source $path with a stageable background', (content) => {
    const old: LiveItem = { id: 'old', label: 'Old content', ...content };
    const next = selectBackgroundContent(old, background);
    expect(next).toEqual({ source: 'background', ...background, origin: 'operator' });
    expect(next).not.toHaveProperty('path');
    expect(old.path).toBe(content.path);
  });
  it.each(['scripture', 'song', 'presentation'] as const)('preserves intentional %s text', source => {
    const words: LiveItem = { source, id: 'words', label: 'Words', lines: ['Keep these words'] };
    expect(selectBackgroundContent(words, background)).toBe(words);
  });
  it('stages background-only content from an empty preview and replaces an older background', () => {
    const next = selectBackgroundContent(null, background);
    expect(next.source).toBe('background');
    expect(selectBackgroundContent(next, { id: 'sea', label: 'Sea' }).id).toBe('sea');
  });
  it('Go Live clears retained media instead of publishing the old image again', async () => {
    const clearMedia = vi.fn().mockResolvedValue({ success: true });
    const showMedia = vi.fn();
    const item = selectBackgroundContent({ source: 'media', id: 'old', label: 'Old', path: '/old.jpg' }, background);
    expect(await publishLiveItem(item, { clearMedia, showMedia } as unknown as Window['api'])).toBe(item);
    expect(clearMedia).toHaveBeenCalledOnce();
    expect(showMedia).not.toHaveBeenCalled();
  });
  it('does not report successful output when removing the media layer fails', async () => {
    const clearMedia = vi.fn().mockResolvedValue({ success: false });
    await expect(publishLiveItem(selectBackgroundContent(null, background), { clearMedia } as unknown as Window['api'])).rejects.toThrow('could not replace');
  });
});
