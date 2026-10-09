import type { LiveItem } from '../design/screens/projector';

/** Standalone media covers the whole background. Text is intentionally kept. */
export function selectBackgroundContent(current: LiveItem | null, background: { id: string; label: string }): LiveItem {
  if (current && current.source !== 'background' && current.source !== 'media' &&
      !(current.source === 'presentation' && current.path)) return current;
  return { source: 'background', id: background.id, label: background.label, origin: 'operator' };
}
