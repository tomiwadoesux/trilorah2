import { describe, expect, it } from 'vitest';
import { orbActions } from './orbActions';
import type { NotificationEntry } from '../stores/notificationStore';

const notice = (extra: Partial<NotificationEntry>): NotificationEntry => ({
  id: 'audio', title: 'No audio', detail: 'Check the cable', severity: 'warning', target: 'audio',
  status: 'active', dismissed: false, read: false, createdAt: 1, updatedAt: 1, episode: 1, ...extra,
});

describe('orb recommendations', () => {
  it('deduplicates microphone problems and prioritizes urgent issues over a preview', () => {
    const actions = orbActions('no mic signal', [notice({}), notice({ id: 'speech', target: 'speech', severity: 'error' })], true);
    expect(actions.map(a => a.target)).toEqual(['speech', 'audio']);
  });
  it('offers Go live for a pending preview, including when another item is live', () => {
    expect(orbActions('in preview', [], false)).toEqual([]);
    expect(orbActions('in preview', [], true).map(a => a.target)).toEqual(['preview']);
    expect(orbActions('live', [], true).map(a => a.target)).toEqual(['preview']);
    expect(orbActions('live', [], false)).toEqual([]);
  });
  it('stops showing recovered or dismissed problems', () => {
    expect(orbActions('listening', [notice({ status: 'resolved' }), notice({ id: 'old', dismissed: true })], false)).toEqual([]);
  });
  it('routes command-only notices to controls without executing commands', () => {
    expect(orbActions('listening', [notice({ actions: [{ kind: 'command', command: 'restart-listening', label: 'Restart' }] })], false)[0])
      .toMatchObject({ label: 'Check mic', target: 'audio' });
  });
});
