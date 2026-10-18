import { describe, expect, it } from 'vitest';
import { DEMO_CHAPTERS, DEMO_CLICK_MS, DEMO_CUES, DEMO_DURATION_MS, getDemoState } from './service-demo-timeline';

const action = (id: string) => {
  const cue = DEMO_CUES.find(item => item.id === id);
  if (!cue || cue.clickAt === undefined) throw new Error(`Missing click cue: ${id}`);
  return { ...cue, clickAt: cue.clickAt };
};

describe('native operator service rehearsal', () => {
  it('shows each native result on its click, after the actor starts travelling', () => {
    const actions = [
      ['listen', 'song-ready'], ['song-search-on', 'song-found'],
      ['select-song', 'song-staged'], ['send-song', 'song-live'],
      ['song-search-off', 'song-finished'], ['clear-song', 'song-cleared'],
      ['find-reference', 'reference-find'],
      ['send-found-reference', 'verse-live'], ['next-verse', 'next-live'],
      ['select-last-reference', 'last-staged'], ['send-last-verse', 'last-live'],
      ['open-images', 'image-section'], ['choose-image', 'image-staged'],
      ['send-image', 'image-live'], ['open-slides', 'slides-section'],
      ['choose-slide', 'slide-staged'], ['send-slide', 'slide-live'],
    ];
    expect(actions).toHaveLength(DEMO_CUES.filter(cue => cue.clickAt !== undefined).length);
    for (const [id, phase] of actions) {
      const cue = action(id);
      expect(cue.clickAt, id).toBeGreaterThan(cue.at);
      expect(getDemoState(cue.clickAt - 1).phase, id).not.toBe(phase);
      const result = getDemoState(cue.clickAt);
      expect(result.phase, id).toBe(phase);
      expect(result.phaseStartedAt, id).toBe(cue.clickAt);
      expect(result.clicks.map(item => item.id), id).toContain(id);
      expect(getDemoState(cue.clickAt + DEMO_CLICK_MS).clicks.map(item => item.id), id).not.toContain(id);
    }
  });

  it('clears the matching song from both screens before the sermon with one native action', () => {
    const searchOff = action('song-search-off');
    const clear = action('clear-song');
    const sermon = DEMO_CHAPTERS.find(chapter => chapter.id === 'sermon')!;
    expect(clear.actor).toBe('triangle');
    expect(clear.selector).toBe('[data-guide="preview-unstage"]');
    expect(clear.at).toBeGreaterThan(searchOff.clickAt);
    expect(clear.clickAt).toBe(15_450);
    expect(clear.clickAt + DEMO_CLICK_MS).toBeLessThan(sermon.at);
    expect(sermon.at).toBe(16_500);
    expect(getDemoState(clear.clickAt - 1).phase).toBe('song-finished');
    expect(getDemoState(clear.clickAt).phase).toBe('song-cleared');
    expect(getDemoState(sermon.at - 1).phase).toBe('song-cleared');

    // After clearing, only finding the reference runs before the first scripture send.
    const firstScripture = action('send-found-reference');
    const intervening = DEMO_CUES.filter(cue => cue.clickAt !== undefined
      && cue.clickAt > clear.clickAt && cue.clickAt < firstScripture.clickAt);
    expect(intervening.map(cue => cue.id)).toEqual(['find-reference']);
    expect(getDemoState(sermon.at).phase).toBe('sermon');
    expect(getDemoState(25_000).phase).toBe('reference-ready');
    expect(getDemoState(firstScripture.clickAt - 1).phase).toBe('reference-find');
    expect(getDemoState(firstScripture.clickAt).phase).toBe('verse-live');

    getDemoState(action('send-slide').clickAt);
    expect(getDemoState(clear.clickAt).phase).toBe('song-cleared');
    expect(getDemoState(sermon.at).phase).toBe('sermon');
  });

  it('keeps find and run-section overlays open until their actual selection clicks', () => {
    const sequences = [
      ['find-reference', 'reference-find', 'send-found-reference', 'verse-live'],
      ['open-images', 'image-section', 'choose-image', 'image-staged'],
      ['open-slides', 'slides-section', 'choose-slide', 'slide-staged'],
    ];
    for (const [openId, overlay, closeId, result] of sequences) {
      const opened = action(openId).clickAt;
      const selected = action(closeId).clickAt;
      expect(getDemoState(opened - 1).phase).not.toBe(overlay);
      expect(getDemoState(opened).phase).toBe(overlay);
      expect(getDemoState(selected - 1).phase).toBe(overlay);
      expect(getDemoState(selected).phase).toBe(result);
      // A backward chapter seek must reconstruct the pre-dialog state too.
      expect(getDemoState(opened - 1).phase).not.toBe(overlay);
    }
    expect(action('open-images').selector).toBe('[data-guide="run-section-image"]');
    expect(action('open-slides').selector).toBe('[data-guide="run-section-slides"]');
    expect(action('choose-image').selector).toBe('[data-guide="run-item-open"]');
    expect(action('choose-slide').selector).toBe('[data-guide="run-item-open"]');
  });

  it('reconstructs chapters, captions and actor positions after seeking backwards', () => {
    expect(DEMO_CHAPTERS.map(chapter => chapter.id)).toEqual(['songs', 'sermon', 'images', 'slides']);
    const baseline = new Map(DEMO_CHAPTERS.map(chapter => [chapter.id, getDemoState(chapter.at)]));
    for (const chapter of [...DEMO_CHAPTERS].reverse()) {
      getDemoState(DEMO_DURATION_MS);
      const sought = getDemoState(chapter.at);
      expect(sought).toEqual(baseline.get(chapter.id));
      expect(sought.chapter).toBe(chapter.id);
      expect(sought.complete).toBe(false);
    }

    getDemoState(action('send-slide').clickAt);
    const sermon = getDemoState(20_000);
    expect(sermon).toMatchObject({ chapter: 'sermon', phase: 'sermon', phaseStartedAt: 16_500, captionDuration: 7800 });
    expect(sermon.actors.triangle.id).toBe('sermon-operator-rest');
    expect(sermon.actors.box.id).toBe('song-delivered');
    expect(sermon.clicks).toEqual([]);
    getDemoState(action('open-images').clickAt);
    expect(getDemoState(20_000)).toEqual(sermon);
    expect(getDemoState(0)).toMatchObject({ chapter: 'songs', phase: 'idle', phaseStartedAt: 0, captionDuration: 0, clicks: [], complete: false });
    expect(Object.values(getDemoState(0).actors).map(cue => cue.id)).toEqual(['circle-rest', 'triangle-rest', 'box-rest']);
    expect(getDemoState(DEMO_DURATION_MS)).toMatchObject({ chapter: 'slides', phase: 'slide-live', complete: true });
  });

  it('allows the square to approach while the triangle selects, but sends only afterwards', () => {
    for (const [selectId, sendId] of [
      ['select-song', 'send-song'], ['select-last-reference', 'send-last-verse'],
      ['choose-image', 'send-image'], ['choose-slide', 'send-slide'],
    ]) {
      const select = action(selectId);
      const send = action(sendId);
      expect(send.at).toBeLessThan(select.clickAt);
      expect(send.clickAt).toBeGreaterThan(select.clickAt);
      const approaching = getDemoState(send.at);
      expect(approaching.actors.triangle.id).toBe(selectId);
      expect(approaching.actors.box.id).toBe(sendId);
      expect(approaching.clicks.map(cue => cue.id)).not.toContain(sendId);
      // Two simultaneous click rings are intentional during the handoff.
      expect(getDemoState(send.clickAt).clicks.map(cue => cue.id)).toEqual([selectId, sendId]);
    }
  });

  it('stays on native operator controls and advances the next verse with one action', () => {
    expect(action('send-found-reference').selector).toBe('[data-guide="find-card"]');
    expect(action('next-verse').selector).toBe('[data-guide="preview-step-next"]');
    const clicks = DEMO_CUES.filter(cue => cue.clickAt !== undefined);
    expect(clicks.every(cue => cue.selector !== null)).toBe(true);
    expect(clicks.some(cue => /dashboard|transcript-open|transcriptReference|nextVerse|data-demo-target/i.test(cue.selector ?? ''))).toBe(false);
    // The native preview arrow already sends to both screens.
    const next = action('next-verse').clickAt;
    expect(clicks.filter(cue => cue.clickAt! > next && cue.clickAt! < 51_000)).toEqual([]);
    for (let at = 0; at <= DEMO_DURATION_MS; at += 100) {
      const state = getDemoState(at);
      expect(state.phase).not.toMatch(/dashboard|transcript-open/);
      expect(new Set(state.clicks.map(cue => cue.actor)).size).toBe(state.clicks.length);
      expect(state.clicks.length).toBeLessThanOrEqual(2);
    }
  });

  it('keeps cues ordered and never interrupts an actor before its click', () => {
    expect(new Set(DEMO_CUES.map(cue => cue.id)).size).toBe(DEMO_CUES.length);
    expect(DEMO_CUES.every((cue, index) => index === 0 || cue.at >= DEMO_CUES[index - 1].at)).toBe(true);
    for (const actor of ['circle', 'triangle', 'box']) {
      const cues = DEMO_CUES.filter(cue => cue.actor === actor);
      expect(cues[0].at).toBe(0);
      cues.slice(1).forEach((cue, index) => {
        const previous = cues[index];
        expect(cue.at).toBeGreaterThanOrEqual(previous.clickAt ?? previous.at);
      });
    }
    expect(DEMO_DURATION_MS).toBe(82_000);
    expect(getDemoState(-500)).toEqual(getDemoState(0));
    expect(getDemoState(NaN)).toEqual(getDemoState(0));
    expect(getDemoState(DEMO_DURATION_MS + 1000)).toEqual(getDemoState(DEMO_DURATION_MS));
  });
});
