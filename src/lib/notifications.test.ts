import { describe, expect, it } from 'vitest';
import { receiveNotice } from '../stores/notificationStore';
import { audioNotice, publishingNotice } from './notificationChecks';
import type { ServiceNotice } from '../../shared/serviceNotice';
import { operationNotice, operationNoticeKey } from '../../shared/notificationOperations';
import { transcriptDeliveryHealth } from '../../shared/transcriptDeliveryHealth';

const fault: ServiceNotice = { id: 'audio', title: 'No input', detail: 'Check the input.', severity: 'warning', target: 'audio' };
describe('notification lifecycle', () => {
  it('does not fill the list or reorder an unchanged repeated check', () => {
    const first = receiveNotice([], fault, 100);
    expect(receiveNotice(first, fault, 900)).toBe(first);
    expect(first).toHaveLength(1);
  });
  it('keeps acknowledgements during repeated updates and reopens a recurring issue', () => {
    const first = receiveNotice([], fault, 100).map(e => ({ ...e, read: true, dismissed: true }));
    const update = receiveNotice(first, { ...fault, detail: 'Still no input.' }, 200);
    expect(update[0]).toMatchObject({ dismissed: true, read: true, updatedAt: 100 });
    const recovery = receiveNotice(update, { ...fault, status: 'resolved' }, 300);
    const again = receiveNotice(recovery, fault, 400);
    expect(again[0]).toMatchObject({ dismissed: false, read: false, episode: 2, createdAt: 400 });
  });
  it('never shows a recovery for a problem that was not reported', () => {
    const empty: [] = [];
    expect(receiveNotice(empty, { ...fault, status: 'resolved' }, 100)).toBe(empty);
  });
  it('resurfaces an acknowledged warning if it becomes an error', () => {
    const first = receiveNotice([], fault, 100).map(e => ({ ...e, dismissed: true, read: true }));
    expect(receiveNotice(first, { ...fault, severity: 'error' }, 200)[0]).toMatchObject({ dismissed: false, read: false });
  });
  it('retains unresolved issues when history exceeds its limit', () => {
    let entries = receiveNotice([], fault, 1);
    for (let i = 0; i < 220; i++) {
      const notice = { ...fault, id: `old:${i}` };
      entries = receiveNotice(entries, notice, i + 2);
      entries = receiveNotice(entries, { ...notice, status: 'resolved' }, i + 3);
    }
    expect(entries).toHaveLength(200);
    expect(entries.find(e => e.id === 'audio')?.status).toBe('active');
  });
});
describe('evidence-based checks', () => {
  const audio = { startedAt: 1000, lastSignalAt: 0, lastLevelAt: 0, lastTranscriptAt: 0, signalSamples: 0 };
  it('waits twenty seconds before reporting no input', () => {
    expect(audioNotice(audio, 20_999, 'Focusrite')).toBeNull();
    expect(audioNotice(audio, 21_000, 'Focusrite')).toMatchObject({ id: 'audio-signal', title: 'No input detected from Focusrite' });
  });
  it('does not infer a speech failure from silence or music', () => {
    expect(audioNotice({ ...audio, lastSignalAt: 65_000, signalSamples: 3 }, 65_100, 'Focusrite')).toBeNull();
    const notice = audioNotice({ ...audio, lastSignalAt: 65_000, signalSamples: 200 }, 65_100, 'Focusrite');
    expect(notice?.detail).toContain('Music and room noise');
  });
  it('keeps intentionally ended or unused sharing quiet', () => {
    expect(publishingNotice({ configured: true, signedIn: false }, false)).toBeNull();
    expect(publishingNotice({ configured: true, signedIn: false, paused: true }, true)).toBeNull();
  });
  it('flags refused writes even with an empty queue', () => {
    const notice = publishingNotice({ configured: true, signedIn: true, activeServiceId: 'service', queue: { pending: 0, lastError: 'permission denied', lastErrorAt: 1 } }, true);
    expect(notice?.detail).toContain('rejected');
  });
  it('does not call a public feed check proof of viewer receipt', () => {
    const notice = publishingNotice({ configured: true, signedIn: true, activeServiceId: 'service', transcriptDelivery: { state: 'unavailable', checkedAt: 1 } }, true);
    expect(notice?.detail).toContain('does not establish whether every viewer');
  });
  it('detects a stale public feed even while new speech keeps arriving', () => {
    expect(transcriptDeliveryHealth(100_000, 10_000, 100_000, 60_000).state).toBe('behind');
    expect(transcriptDeliveryHealth(101_000, 10_000, 101_000, 60_000).state).toBe('behind');
    expect(transcriptDeliveryHealth(101_000, 99_000, 101_000, 60_000).state).toBe('current');
  });
  it('gives a newly detected public feed gap time to recover', () => {
    expect(transcriptDeliveryHealth(100_000, null, 100_000, 100_000).state).toBe('checking');
  });
});
describe('operation notifications', () => {
  it('ignores file picker cancellation and ordinary background reads', () => {
    expect(operationNotice('tri-inspect', { canceled: true })).toBeNull();
    expect(operationNotice('get-settings', new Error('offline'), true)).toBeNull();
    expect(operationNotice('obs-status', { error: 'offline' })).toBeNull();
  });
  it('surfaces partial import failures', () => {
    expect(operationNotice('import-media-files', { items: [{}], skipped: [{ name: 'missing.jpg', reason: 'missing' }] })?.status).toBe('active');
  });
  it('routes setting failures correctly and isolates different keys', () => {
    expect(operationNotice('set-setting', new Error('disk full'), true, [{ key: 'micDeviceLabel' }])?.target).toBe('speech');
    expect(operationNoticeKey('set-setting', [{ key: 'micDeviceLabel' }])).not.toBe(operationNoticeKey('set-setting', [{ key: 'operatorRunV1' }]));
  });
  it('reports success only as recovery, and redacts credentials from failures', () => {
    expect(operationNotice('songs-update', { id: 'song' })?.status).toBe('resolved');
    expect(operationNotice('obs-connect', new Error('password=secret token=abc'), true)?.detail).toBe('password=[hidden] token=[hidden]');
  });
});
