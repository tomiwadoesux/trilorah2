import { describe, it, expect } from 'vitest';
import { loadTranscriptPages, transcriptText } from './transcriptArchive';
const rows = Array.from({ length: 1726 }, (_, i) => ({ id: String(i), text: `Segment ${i}`, timestamp: '2026-10-11T15:00:00Z', offset_ms: i * 1000 }));
describe('complete transcript archive', () => {
  it('continues through a server cap smaller than the requested page, including equal timestamps', async () => {
    const calls: number[] = [];
    const result = await loadTranscriptPages(async from => { calls.push(from); return { data: rows.slice(from, from + 120), error: null }; });
    expect(result).toHaveLength(1726);
    expect(result[0].text).toBe('Segment 0'); expect(result.at(-1)?.text).toBe('Segment 1725');
    expect(calls.at(-1)).toBe(1726);
    expect(transcriptText('Title', result)).toContain('Segment 1725');
  });
  it('never labels partial results complete when a later page fails', async () => {
    await expect(loadTranscriptPages(async from => from ? { data: null, error: new Error('Offline') } : { data: rows.slice(0, 500), error: null })).rejects.toThrow('Offline');
  });
  it('rejects a non-advancing server and honours cancellation', async () => {
    await expect(loadTranscriptPages(async () => ({ data: rows.slice(0, 2), error: null }))).rejects.toThrow('did not advance');
    const signal = AbortSignal.abort();
    await expect(loadTranscriptPages(async () => ({ data: [], error: null }), undefined, signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
