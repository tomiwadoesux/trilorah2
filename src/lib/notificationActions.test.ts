import { afterEach, expect, it, vi } from 'vitest';
import { runNoticeAction } from './notificationActions';
import { useNotificationStore } from '../stores/notificationStore';
import { useNoticeNavigation } from './notificationNavigation';

afterEach(() => { vi.unstubAllGlobals(); useNotificationStore.setState({ entries: [] }); });
it('opens the requested destination directly', async () => {
  await runNoticeAction({ kind: 'navigate', target: 'audio', label: 'Check audio' });
  expect(useNoticeNavigation.getState().target).toBe('audio');
});
it('waits for confirmed listening and coalesces repeated retry presses', async () => {
  let callback: (text: string) => void = () => {};
  const off = vi.fn();
  const startListening = vi.fn();
  vi.stubGlobal('window', { setTimeout, api: { onAsrStatus: (fn: typeof callback) => { callback = fn; return off; }, stopListening: vi.fn(), startListening } });
  const action = { kind: 'command', command: 'restart-listening', label: 'Retry' } as const;
  const first = runNoticeAction(action);
  const second = runNoticeAction(action);
  expect(second).toBe(first);
  expect(startListening).toHaveBeenCalledTimes(1);
  let finished = false;
  void first.then(() => { finished = true; });
  callback('Connecting...'); await Promise.resolve();
  expect(finished).toBe(false);
  callback('Listening...'); await first;
  expect(finished).toBe(true);
  expect(off).toHaveBeenCalled();
});
it('does not clear a publishing failure when a retry leaves queued writes', async () => {
  useNotificationStore.getState().receive({ id: 'publishing', title: 'Publishing failed', detail: 'offline', severity: 'error', target: 'cloud' });
  vi.stubGlobal('window', { api: { retryPublishing: async () => ({ pending: 5, lastError: 'offline' }) } });
  await expect(runNoticeAction({ kind: 'command', command: 'retry-publishing', label: 'Retry' })).rejects.toThrow('offline');
  expect(useNotificationStore.getState().entries[0].status).toBe('active');
});
it('keeps a public transcript incident open after uploads recover but access still fails', async () => {
  useNotificationStore.getState().receive({ id: 'publishing', title: 'Public transcript unavailable', detail: 'check sharing', severity: 'error', target: 'cloud' });
  vi.stubGlobal('window', { api: { retryPublishing: async () => ({ pending: 0, lastError: null }), cloudStatus: async () => ({ transcriptDelivery: { state: 'unavailable' } }) } });
  const message = await runNoticeAction({ kind: 'command', command: 'retry-publishing', label: 'Retry' });
  expect(message).toContain('has not recovered');
  expect(useNotificationStore.getState().entries[0].status).toBe('active');
});
