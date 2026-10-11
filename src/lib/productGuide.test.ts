import { describe, expect, it } from 'vitest';
import { destinationFor, guideTasks, microphoneCheckComplete, searchGuideTasks } from './productGuide';

describe('guide task discovery', () => {
  it.each(['conect micrphone', 'How do I get Trilorah to hear the pastor?', 'connect my mic'])('finds microphone setup from %s', query => {
    expect(searchGuideTasks(query).slice(0, 3).map(task => task.id)).toContain('audio.choose-input');
  });
  it('distinguishes troubleshooting and phone intent from basic setup', () => {
    expect(searchGuideTasks('my microphone stopped working')[0].id).toBe('audio.troubleshoot');
    expect(searchGuideTasks('use my phone as microphone')[0].id).toBe('audio.phone-microphone');
  });
  it('returns choices for ambiguous connection requests without launching anything', () => {
    const ids = searchGuideTasks('connect').map(task => task.id);
    expect(ids).toContain('audio.choose-input');
    expect(ids).toContain('outputs.assign');
    expect(ids).toContain('remote.pair');
  });
  it('does not make up a guide for unrelated input', () => {
    expect(searchGuideTasks('quantum aardvark')).toEqual([]);
  });
  it('never offers desktop navigation for incomplete tasks or web-only guides', () => {
    for (const task of guideTasks.filter(task => task.status !== 'wired' || task.area.startsWith('web'))) expect(destinationFor(task)).toBeNull();
  });
  it('routes current libraries and output setup without obsolete URLs', () => {
    const task = (id: string) => guideTasks.find(task => task.id === id)!;
    expect(destinationFor(task('outputs.assign'))).toBe('outputs');
    expect(destinationFor(task('media.find-online'))).toBe('online');
    expect(destinationFor(task('bible.lookup-preview-reference'))).toBe('scripture');
  });
});

describe('microphone success evidence', () => {
  const ready = { bridge: true, practice: false, listening: true, paused: false, checkStartedAt: 100, signalAt: 120, transcriptAt: 130 };
  it('requires both fresh audio and a new transcript from this check', () => {
    expect(microphoneCheckComplete(ready)).toBe(true);
    expect(microphoneCheckComplete({ ...ready, signalAt: 0 })).toBe(false);
    expect(microphoneCheckComplete({ ...ready, transcriptAt: 90 })).toBe(false);
    expect(microphoneCheckComplete({ ...ready, signalAt: 90 })).toBe(false);
  });
  it('rejects simulation, stopped listening, paused checks, and a disconnected engine', () => {
    expect(microphoneCheckComplete({ ...ready, practice: true })).toBe(false);
    expect(microphoneCheckComplete({ ...ready, listening: false })).toBe(false);
    expect(microphoneCheckComplete({ ...ready, paused: true })).toBe(false);
    expect(microphoneCheckComplete({ ...ready, bridge: false })).toBe(false);
    expect(microphoneCheckComplete({ ...ready, checkStartedAt: 0 })).toBe(false);
  });
});
