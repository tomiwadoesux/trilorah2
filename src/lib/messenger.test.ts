import { describe, expect, it } from 'vitest';
import { guideTasks, newerThan, tasksNear, tasksSince, troubleFor } from './productGuide';
import { canGuideClick, lineFor, rephraseCount, stepsFromLesson, defaultGuideAnswers, neverClick, walkthroughFor } from './guideWalkthroughs';
import { eyePosition, triangleGeometry } from '../components/useGuideCursor';
const task = (id: string) => guideTasks.find(item => item.id === id)!;

describe('lessons', () => {
  it('every lesson line is short and has written rephrases', () => {
    for (const item of guideTasks) for (const point of item.lesson ?? []) {
      expect(point.say.length).toBeGreaterThanOrEqual(1);
      expect(point.say.length).toBeLessThanOrEqual(4);
      for (const line of point.say) expect(line.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
  it('cycles rephrases and wraps round', () => {
    const step = { prompt: 'a', say: ['a', 'b', 'c'] };
    expect([0, 1, 2, 3, -1].map(n => lineFor(step, n))).toEqual(['a', 'b', 'c', 'a', 'c']);
    expect(rephraseCount(step)).toBe(3);
    expect(lineFor({ prompt: 'only' }, 5)).toBe('only');
  });
  it('builds steps from the map and downgrades empty writes to focus', () => {
    const steps = stepsFromLesson(task('songs.create-edit-slides'), defaultGuideAnswers);
    expect(steps.map(step => step.id)).toEqual(['tab-songs', 'song-add', 'song-title', 'song-lyrics']);
    expect(steps[2].action).toBe('focus');
    const typed = stepsFromLesson(task('songs.create-edit-slides'), { ...defaultGuideAnswers, songTitle: 'Amazing Grace' });
    expect(typed[2].action).toBe('write'); expect(typed[2].text).toBe('Amazing Grace');
  });
  it('never performs the steps that put something on the wall or approve a device', () => {
    for (const item of guideTasks) for (const step of walkthroughFor(item)) {
      for (const name of neverClick) if (step.target.includes(`"${name}"`)) expect(canGuideClick({ ...step, action: 'click' })).toBe(false);
    }
    expect(task('bible.lookup-preview-reference').consequential).toBe(true);
    expect(task('output.clear-restore').consequential).toBe(true);
  });
});

describe('the nerves', () => {
  it('offers the lessons written for the area under the pointer', () => {
    expect(tasksNear('audio').map(item => item.id)).toContain('audio.choose-input');
    expect(tasksNear('outputs').map(item => item.id)).toContain('outputs.assign');
    expect(tasksNear(null)).toEqual([]);
  });
  it('has a line ready for a notice, by id then by destination', () => {
    expect(troubleFor({ id: 'audio-signal', target: 'audio' })?.task.id).toBe('audio.troubleshoot');
    expect(troubleFor({ id: 'something-new', target: 'displays' })?.task.id).toBe('outputs.assign');
    expect(troubleFor({ id: 'nothing', target: 'nowhere' })).toBeNull();
  });
  it('knows what arrived after the version last seen', () => {
    expect(newerThan('0.4.6', '0.4.5')).toBe(true);
    expect(newerThan('0.4.5', '0.4.5')).toBe(false);
    expect(newerThan('0.4.6', null)).toBe(false);
    expect(tasksSince('0.4.5').map(item => item.id)).toContain('songs.create-edit-slides');
    expect(tasksSince('0.4.5').map(item => item.id)).not.toContain('audio.choose-input');
  });
});

describe('the eye on the triangle', () => {
  it('rests on the right edge, halfway, when the mouse is to the right', () => {
    const at = eyePosition(1, 0.5);
    const { apex, right } = triangleGeometry;
    expect(at.x).toBeCloseTo((apex.x + right.x) / 2); expect(at.y).toBeCloseTo((apex.y + right.y) / 2);
  });
  it('goes round the apex when switching sides, never through the triangle', () => {
    expect(eyePosition(0.5, 0.7)).toEqual(triangleGeometry.apex);
    const left = eyePosition(0, 0.5);
    expect(left.x).toBeLessThan(triangleGeometry.apex.x);
  });
  it('slides only along the middle of the edge', () => {
    const high = eyePosition(1, 0.3), low = eyePosition(1, 0.7);
    expect(high.y).toBeLessThan(low.y);
    expect(low.y).toBeLessThan(triangleGeometry.right.y);
  });
});
