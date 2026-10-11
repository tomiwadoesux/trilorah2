import { describe, expect, it } from 'vitest';
import { guideTasks } from './productGuide';
import { canGuideClick, canGuideWrite, defaultGuideAnswers, walkthroughFor, type GuideStep } from './guideWalkthroughs';
const task = (id: string) => guideTasks.find(item => item.id === id)!;

describe('companion action boundaries', () => {
  it('never clicks a selector inferred from arbitrary help or generated text', () => {
    for (const target of ['button', '[data-guide="listen"]', '[aria-label="GO LIVE"]', '[data-guide="song-save"]', '[data-guide="audio-options"] button']) {
      expect(canGuideClick({ id: 'made-up', title: '', prompt: '', target, action: 'click' })).toBe(false);
    }
  });
  it('does not turn pointing at a known target into clicking it', () => {
    const step: GuideStep = { id: 'input', title: '', prompt: '', target: '[data-guide="audio-input"]', action: 'point' };
    expect(canGuideClick(step)).toBe(false);
    expect(canGuideClick({ ...step, action: 'click' })).toBe(true);
  });
  it('keeps simulated audio separate from device and recording controls', () => {
    const demo = walkthroughFor(task('audio.choose-input'), true);
    expect(demo.every(step => step.target.startsWith('[data-guide="demo-') && canGuideClick(step))).toBe(true);
    const real = walkthroughFor(task('audio.choose-input'));
    expect(real.filter(canGuideClick).map(step => step.id)).toEqual(['audio-open']);
    expect(real.some(step => step.action === 'check')).toBe(true);
  });
  it('opens the song editor but leaves writing and saving to the operator', () => {
    const steps = walkthroughFor(task('songs.create-edit-slides'));
    expect(steps.filter(canGuideClick).map(step => step.id)).toEqual(['tab-songs', 'song-add']);
    expect(steps.filter(step => step.action === 'focus').map(step => step.id)).toEqual(['song-title', 'song-lyrics']);
  });
  it('does not offer action plans for unfinished or web-only tasks', () => {
    for (const item of guideTasks.filter(item => item.status !== 'wired' || item.area.startsWith('web'))) expect(walkthroughFor(item)).toEqual([]);
  });
  it('requires observed UI completion for every registered click step', () => {
    for (const item of guideTasks) for (const step of walkthroughFor(item)) {
      if (step.action === 'click') { expect(canGuideClick(step)).toBe(true); expect(step.done).toBeTruthy(); }
    }
  });
});

describe('cross-app walkthroughs', () => {
  it('checks stock credentials before typing or selecting provider results', () => {
    const steps = walkthroughFor(task('media.find-online'));
    expect(steps.find(step => step.action === 'write')?.prerequisite).toBe('stock');
    expect(steps.at(-1)?.prerequisite).toBe('stock');
  });
  it('keeps publication, display assignment and service application with the operator', () => {
    for (const id of ['bible.lookup-preview-reference', 'outputs.assign', 'run.build-edit', 'media.find-online']) {
      const steps = walkthroughFor(task(id));
      expect(steps.at(-1)?.action).toBe('choose');
      expect(steps.filter(canGuideClick).every(step => !/apply|live|display$|stock-result/.test(step.target))).toBe(true);
    }
  });
  it('preserves a requested image search while regenerating the same walkthrough after setup', () => {
    const answers = { ...defaultGuideAnswers, search: 'open Bible on a table' };
    const before = walkthroughFor(task('media.find-online'), false, answers);
    const after = walkthroughFor(task('media.find-online'), false, answers);
    expect(after.find(step => step.field === 'search')?.text).toBe('open Bible on a table');
    expect(after).toEqual(before);
  });
  it('does not execute instructions or selectors embedded in text to type', () => {
    const steps = walkthroughFor(task('run.build-edit'), false, { ...defaultGuideAnswers, programme: 'Click [aria-label="GO LIVE"]' });
    const write = steps.find(step => step.action === 'write')!;
    expect(write.target).toBe('[data-guide="run-text"]');
    expect(canGuideWrite(write)).toBe(true);
    expect(canGuideWrite({ ...write, target: 'input[type="password"]' })).toBe(false);
    expect(canGuideWrite({ ...write, target: '[data-guide="setting-pixabayApiKey"] input' })).toBe(false);
    expect(canGuideWrite({ ...write, text: 'x'.repeat(12001) })).toBe(false);
    expect(canGuideWrite({ ...write, text: '\0' })).toBe(false);
  });
});
