import type { QueueItem, RunSegment } from './operatorRun';

export const RUN_COMPONENTS = [
  { id: 'sermon', label: 'Sermon' },
  { id: 'music', label: 'Music' },
  { id: 'slides', label: 'Slides' },
  { id: 'notes', label: 'Notes' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'verse', label: 'Verse' },
] as const;

/** Drag metadata stays out of the saved service. Existing queued items move;
 * library items are copied, with fresh identities for repeated content. */
export interface RunCarry extends Omit<QueueItem, 'key'> {
  dragSegmentKey?: string;
  /** Selected sections travel together, in their existing running order. */
  dragSegmentKeys?: string[];
  dragType?: string;
  dragItem?: { segmentKey: string; itemKey: string };
}

const ITEM_TARGET = 'run-item:';
const SECTION_TARGET = 'run-section:';
export type SectionDropPosition = 'before' | 'after' | 'swap';
export const runSectionTarget = (segmentKey: string, position: SectionDropPosition) => SECTION_TARGET + JSON.stringify([segmentKey, position]);
export function sectionDropPosition(fraction: number, existing: boolean): SectionDropPosition {
  if (fraction < 0.25) return 'before';
  if (fraction > 0.75) return 'after';
  return existing ? 'swap' : fraction < 0.5 ? 'before' : 'after';
}
export const runItemTarget = (segmentKey: string, itemKey: string) => ITEM_TARGET + JSON.stringify([segmentKey, itemKey]);

export function runTarget(target: string | null): { segmentKey: string | null; before?: string; sectionPosition?: SectionDropPosition } {
  if (target?.startsWith(SECTION_TARGET)) {
    try {
      const [segmentKey, sectionPosition] = JSON.parse(target.slice(SECTION_TARGET.length));
      if (typeof segmentKey === 'string' && ['before', 'after', 'swap'].includes(sectionPosition)) return { segmentKey, sectionPosition };
    } catch { /* Invalid targets remain unmatched. */ }
  }
  if (!target?.startsWith(ITEM_TARGET)) return { segmentKey: target };
  try {
    const [segmentKey, before] = JSON.parse(target.slice(ITEM_TARGET.length));
    if (typeof segmentKey === 'string' && typeof before === 'string') return { segmentKey, before };
  } catch { /* A stale or malformed target is not a drop on the backdrop. */ }
  return { segmentKey: target };
}

export function componentForItem(item: Pick<QueueItem, 'source' | 'mediaKind'>): string {
  return item.source === 'song' ? 'music' : item.source === 'scripture' ? 'verse'
    : item.source === 'presentation' ? 'slides' : item.source === 'note' ? 'notes'
      : item.mediaKind === 'video' ? 'video' : 'image';
}

/** Move each selected block one place without changing its internal order. */
export function moveRunSegments(previous: RunSegment[], keys: readonly string[], delta: -1 | 1): RunSegment[] {
  const selected = new Set(keys);
  const next = [...previous];
  const indices = delta === -1 ? next.map((_, index) => index) : next.map((_, index) => index).reverse();
  let changed = false;
  for (const at of indices) {
    const to = at + delta;
    if (!selected.has(next[at].key) || to < 0 || to >= next.length || selected.has(next[to].key)) continue;
    [next[at], next[to]] = [next[to], next[at]];
    changed = true;
  }
  return changed ? next : previous;
}

export function runSelectionRange(keys: readonly string[], anchor: string | null, target: string): string[] {
  const end = keys.indexOf(target);
  if (end < 0) return [];
  const start = anchor ? keys.indexOf(anchor) : -1;
  return start < 0 ? [target] : keys.slice(Math.min(start, end), Math.max(start, end) + 1);
}

export function applyRunDrop(previous: RunSegment[], target: string | null, carried: RunCarry[], key: () => string): RunSegment[] {
  const { segmentKey, before, sectionPosition } = runTarget(target);
  if (segmentKey && !previous.some(s => s.key === segmentKey)) return previous;
  let next = previous;
  for (const carry of carried) {
    if (carry.dragSegmentKeys?.length) {
      const selected = new Set(carry.dragSegmentKeys);
      const moving = next.filter(segment => selected.has(segment.key));
      if (!moving.length || (segmentKey && selected.has(segmentKey))) continue;
      const remaining = next.filter(segment => !selected.has(segment.key));
      const at = segmentKey ? remaining.findIndex(segment => segment.key === segmentKey) + (sectionPosition === 'after' ? 1 : 0) : remaining.length;
      next = [...remaining.slice(0, at), ...moving, ...remaining.slice(at)];
      continue;
    }
    if (carry.dragSegmentKey || carry.dragType) {
      const existing = carry.dragSegmentKey ? next.find(s => s.key === carry.dragSegmentKey) : undefined;
      if (carry.dragSegmentKey && !existing) continue;
      if (existing?.key === segmentKey) continue;
      const type = RUN_COMPONENTS.find(c => c.id === carry.dragType);
      if (!existing && !type) continue;
      const segment = existing ?? { key: key(), type: type!.id, label: type!.label, items: [] };
      if (sectionPosition === 'swap' && existing && segmentKey) {
        const other = next.find(s => s.key === segmentKey)!;
        next = next.map(s => s.key === existing.key ? other : s.key === other.key ? existing : s);
        continue;
      }
      next = next.filter(s => s.key !== segment.key);
      const at = segmentKey ? next.findIndex(s => s.key === segmentKey) + (sectionPosition === 'after' ? 1 : 0) : next.length;
      next = [...next.slice(0, at), segment, ...next.slice(at)];
      continue;
    }
    const origin = carry.dragItem;
    const existing = origin && next.find(s => s.key === origin.segmentKey)?.items.find(i => i.key === origin.itemKey);
    if (origin && !existing) continue;
    if (origin?.segmentKey === segmentKey && origin?.itemKey === before) continue;
    const { dragItem: _item, dragType: _type, dragSegmentKey: _segment, dragSegmentKeys: _segments, ...content } = carry;
    const item = existing ?? { ...content, key: key() };
    let destination = segmentKey;
    if (!destination) {
      const type = componentForItem(item);
      destination = next.find(s => s.type === type)?.key ?? null;
      if (!destination) {
        destination = key();
        next = [...next, { key: destination, type, label: RUN_COMPONENTS.find(c => c.id === type)!.label, items: [] }];
      }
    }
    next = next.map(s => {
      const items = origin?.segmentKey === s.key ? s.items.filter(i => i.key !== origin.itemKey) : s.items;
      if (s.key !== destination) return items === s.items ? s : { ...s, items };
      const at = before ? items.findIndex(i => i.key === before) : -1;
      const index = at < 0 ? items.length : at;
      return { ...s, items: [...items.slice(0, index), item, ...items.slice(index)] };
    });
  }
  return next;
}
