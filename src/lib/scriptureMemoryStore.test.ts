import { beforeEach, describe, expect, it } from 'vitest';
import { rememberScripture, recallScripture, useScriptureMemoryStore as memory } from '../stores/scriptureMemoryStore';
import type { LiveItem } from '../design/screens/projector';

const item: LiveItem = { source: 'scripture', id: 'John 3:16', label: 'John 3:16', reference: 'John 3:16', version: 'KJV', text: 'For God so loved the world', verses: [{ verse: 16, text: 'For God so loved the world' }] };
beforeEach(() => memory.setState({ history: [], saved: [], storageError: null }));
describe('scripture memory', () => {
  it('ignores non-scripture and incomplete deliveries', () => {
    memory.getState().record({ source: 'song', id: 'song', label: 'Amazing Grace' });
    memory.getState().record({ ...item, text: '' });
    expect(memory.getState().history).toEqual([]);
  });
  it('deduplicates echoes and revisits, keeping translations distinct', () => {
    memory.getState().record(item);
    memory.getState().record(item);
    memory.getState().record({ ...item, version: 'BSB' });
    memory.getState().record(item);
    expect(memory.getState().history.map(entry => entry.version)).toEqual(['KJV', 'BSB']);
  });
  it('retains saved scripture when history is bounded, and can unsave it', () => {
    const entry = rememberScripture(item)!;
    memory.getState().toggleSaved(entry);
    for (let i = 1; i <= 510; i++) memory.getState().record({ ...item, reference: `Psalms ${i}:1` });
    expect(memory.getState().history).toHaveLength(500);
    expect(memory.getState().saved).toEqual([entry]);
    memory.getState().toggleSaved(entry);
    expect(memory.getState().saved).toEqual([]);
  });
  it('removes a tab without losing its saved bookmark', () => {
    memory.getState().record(item);
    memory.getState().toggleSaved(rememberScripture(item)!);
    memory.getState().dismiss('John 3:16|KJV');
    expect(memory.getState().history).toEqual([]);
    expect(memory.getState().saved).toHaveLength(1);
  });
  it('recalls the saved translation without stale slide layout or automatic guards', () => {
    const entry = rememberScripture({ ...item, origin: 'auto', followFrom: { reference: 'John 3:15', version: 'KJV' } })!;
    expect(recallScripture(entry)).toMatchObject({ reference: item.reference, version: 'KJV', origin: 'operator' });
    expect(recallScripture(entry)).not.toHaveProperty('followFrom');
    expect(recallScripture(entry).slides?.[0]).toMatchObject({ verseStart: 16, verseEnd: 16 });
  });
});
