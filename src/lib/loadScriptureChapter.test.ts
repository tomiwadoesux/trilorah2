import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadScriptureChapter } from './loadScriptureChapter';

const verse = { id: 1, ref: 'Genesis 1:1', text: 'In the beginning', version: 'KJV' };
afterEach(() => vi.useRealTimers());

describe('scripture loading recovery', () => {
  it('keeps a database failure distinct from a genuinely empty chapter', async () => {
    const getChapter = vi.fn().mockResolvedValueOnce({ success: false, error: 'Database not connected' })
      .mockResolvedValueOnce({ success: true, data: [] });
    expect(await loadScriptureChapter({ getChapter }, 1, 1, 'KJV')).toEqual({ status: 'error', error: 'Database not connected', data: [] });
    expect(await loadScriptureChapter({ getChapter }, 1, 1, 'KJV')).toEqual({ status: 'empty', error: null, data: [] });
  });

  it('recovers on retry after a rejected bridge request, retaining the selected chapter and version', async () => {
    const getChapter = vi.fn().mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce({ success: true, data: [verse] });
    expect((await loadScriptureChapter({ getChapter }, 1, 1, 'KJV')).error).toBe('Connection lost');
    expect(await loadScriptureChapter({ getChapter }, 1, 1, 'KJV')).toEqual({ status: 'idle', data: [verse], error: null });
    expect(getChapter.mock.calls).toEqual([[1, 1, 'KJV'], [1, 1, 'KJV']]);
  });

  it('ends a stalled request and ignores its late result after a successful retry', async () => {
    vi.useFakeTimers();
    let finish!: (result: ChapterResult) => void;
    const getChapter = vi.fn().mockImplementationOnce(() => new Promise<ChapterResult>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce({ success: true, data: [verse] });
    const pending = loadScriptureChapter({ getChapter }, 1, 1, 'KJV');
    await vi.advanceTimersByTimeAsync(15000);
    expect(await pending).toMatchObject({ status: 'error', error: 'Scripture loading timed out.' });
    const retry = await loadScriptureChapter({ getChapter }, 1, 1, 'KJV');
    finish({ success: false, error: 'Late failure' });
    expect(retry).toEqual({ status: 'idle', data: [verse], error: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('explains when the desktop bridge is unavailable', async () => {
    expect(await loadScriptureChapter(undefined, 1, 1, 'KJV')).toMatchObject({ status: 'no-api', data: [], error: expect.stringContaining('desktop app') });
  });
});


describe('chapter reuse while browsing and following', () => {
  it('coalesces concurrent requests and reuses loaded text', async () => {
    let finish!: (result: ChapterResult) => void;
    const api = { getChapter: vi.fn(() => new Promise<ChapterResult>(resolve => { finish = resolve; })) };
    const first = loadScriptureChapter(api, 0, 1, 'KJV');
    const second = loadScriptureChapter(api, 0, 1, 'KJV');
    expect(first).toBe(second);
    finish({ success: true, data: [verse] });
    await first;
    expect(await loadScriptureChapter(api, 0, 1, 'KJV')).toMatchObject({ data: [verse] });
    expect(api.getChapter).toHaveBeenCalledTimes(1);
  });
  it('isolates translations and retries errors on the same bridge', async () => {
    const api = { getChapter: vi.fn().mockResolvedValueOnce({ success: false, error: 'offline' })
      .mockResolvedValue({ success: true, data: [verse] }) };
    await loadScriptureChapter(api, 0, 1, 'KJV');
    expect((await loadScriptureChapter(api, 0, 1, 'KJV')).status).toBe('idle');
    await loadScriptureChapter(api, 0, 1, 'BSB');
    expect(api.getChapter.mock.calls).toEqual([[0, 1, 'KJV'], [0, 1, 'KJV'], [0, 1, 'BSB']]);
  });
});
