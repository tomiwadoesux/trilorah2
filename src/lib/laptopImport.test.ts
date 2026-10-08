import { describe, expect, it } from 'vitest';
import type { ImportedMedia } from '../../shared/importedMedia';
import type { ThemeMedia } from '../design/screens/mediaLibrary';
import { CLIP_NOT_BACKGROUND } from './backgroundDrop';
import {
  dragKinds,
  finderPaneHint,
  finderStageHint,
  finderStagePick,
  fromImported,
  importNotice,
  keepShelf,
  shelfFor,
  uniqueById,
} from './laptopImport';

const file = (over: Partial<ImportedMedia> = {}): ImportedMedia => ({
  id: 'local:0a1b2c3d4e5f60718293',
  url: 'file:///Users/me/Library/Application%20Support/trilorah/media/0a1b2c3d4e5f60718293.jpg',
  src: 'local-media://file/Users/me/Library/Application%20Support/trilorah/media/0a1b2c3d4e5f60718293.jpg',
  kind: 'photo',
  name: 'harvest morning',
  bytes: 1200,
  existed: false,
  ...over,
});

const card = (over: Partial<ThemeMedia> = {}): ThemeMedia => ({
  id: 'x', label: 'x', detail: 'this laptop', seed: 1, style: 'smoke', source: 'local', url: 'local-media://file/x.jpg', kind: 'photo', collection: 'themes', ...over,
});

describe('what a file from the laptop becomes', () => {
  it('is a local card on the shelf it was added to, drawn from its local-media src', () => {
    const c = fromImported(file(), 'themes');
    expect(c).toMatchObject({ id: 'local:0a1b2c3d4e5f60718293', label: 'harvest morning', detail: 'this laptop', source: 'local', kind: 'photo', collection: 'themes' });
    expect(c.url).toBe(file().src);
    expect(c.seed).toBeGreaterThanOrEqual(0);
    expect(c.seed).toBeLessThan(10);
  });

  it('carries a clip’s poster and length, or says it will not play', () => {
    expect(fromImported(file({ kind: 'video' }), 'media', { poster: 'data:image/jpeg;base64,AA', length: '2:07', playable: true })).toMatchObject({
      poster: 'data:image/jpeg;base64,AA', detail: '2:07 · this laptop', kind: 'video',
    });
    expect(fromImported(file({ kind: 'video' }), 'media', { playable: false }).detail).toBe('will not play here');
  });

  it('lands on the shelf being looked at — except a clip, which is never a background', () => {
    expect(shelfFor({ kind: 'photo' }, 'themes')).toBe('themes');
    expect(shelfFor({ kind: 'photo' }, 'media')).toBe('media');
    expect(shelfFor({ kind: 'video' }, 'themes')).toBe('media');
  });
});

describe('adding something already on the shelf', () => {
  it('keeps the card that is there — its shelf, its name — and drops repeats', () => {
    const there = card({ id: 'local:a', label: 'announcement', collection: 'media' });
    const out = keepShelf([card({ id: 'local:a', label: 'renamed copy', collection: 'themes' }), card({ id: 'local:b' }), card({ id: 'local:b' })], [there]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(there);
    expect(out[1].id).toBe('local:b');
    expect(uniqueById([{ id: 'a' }, { id: 'a' }, { id: 'b' }])).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});

describe('the line an import ends on', () => {
  it('names a single picture and counts several', () => {
    expect(importNotice({ added: [card({ label: 'sanctuary' })], already: [], skipped: [], wanted: 'themes' })).toBe('added sanctuary to themes');
    expect(importNotice({ added: [card({ collection: 'media' }), card({ collection: 'media' }), card({ collection: 'media' })], already: [], skipped: [], wanted: 'media' })).toBe('added 3 to media');
  });

  it('says where a clip went when it was added while looking at themes', () => {
    const line = importNotice({ added: [card(), card(), card({ kind: 'video', label: 'baptism', collection: 'media' })], already: [], skipped: [], wanted: 'themes' });
    expect(line).toBe(`added 2 to themes and baptism to media — ${CLIP_NOT_BACKGROUND}`);
  });

  it('says what was already there and what was skipped, grouped by reason', () => {
    const line = importNotice({
      added: [],
      already: [card({ label: 'sunday', collection: 'media' })],
      skipped: [{ name: 'notes.pdf', reason: 'not a picture or clip' }, { name: 'list.txt', reason: 'not a picture or clip' }, { name: 'IMG_1.heic', reason: 'an iPhone photo (heic) — export it as a jpeg first' }],
      wanted: 'media',
    });
    expect(line).toBe('sunday was already in media · skipped notes.pdf and 1 more — not a picture or clip · skipped IMG_1.heic — an iPhone photo (heic) — export it as a jpeg first');
  });

  it('warns about a clip this laptop cannot play', () => {
    const line = importNotice({ added: [card({ kind: 'video', label: 'promo', collection: 'media', detail: 'will not play here' })], already: [], skipped: [], wanted: 'media' });
    expect(line).toBe('added promo to media · promo will not play here — export it as an h.264 mp4');
  });

  it('is never silent', () => {
    expect(importNotice({ added: [], already: [], skipped: [], wanted: 'media' })).toBe('nothing to add there');
  });
});

describe('a Finder drag over the stage', () => {
  it('reads what is carried from the drag’s own types', () => {
    expect(dragKinds([{ kind: 'file', type: 'image/jpeg' }, { kind: 'file', type: 'image/heic' }])).toBe('photo');
    expect(dragKinds([{ kind: 'file', type: 'video/mp4' }])).toBe('video');
    expect(dragKinds([{ kind: 'file', type: 'video/mp4' }, { kind: 'file', type: 'image/png' }])).toBe('mixed');
    /* A folder, or a type the system does not know, has no type. */
    expect(dragKinds([{ kind: 'file', type: '' }])).toBe('unknown');
    expect(dragKinds([{ kind: 'string', type: 'text/plain' }])).toBe('unknown');
  });

  it('lights the LIVE box for pictures only, as an in-app drag does', () => {
    expect(finderStageHint('stage-live', 'photo')).toBe('add to themes · background on the wall now');
    expect(finderStageHint('stage-live', 'video')).toBeNull();
    expect(finderStageHint('stage-preview', 'video')).toBe('add to media · stage this clip');
    expect(finderStageHint('stage-preview', 'photo')).toBe('add to themes · preview this background');
  });

  it('acts on the first still; on the preview a clip when there is no still', () => {
    const clip = card({ id: 'c', kind: 'video', collection: 'media' });
    const still = card({ id: 's' });
    expect(finderStagePick('stage-live', [clip, still])).toBe(still);
    expect(finderStagePick('stage-live', [clip])).toBeUndefined();
    expect(finderStagePick('stage-preview', [clip])).toBe(clip);
    expect(finderStagePick('stage-preview', [card({ id: 'b', kind: 'video', detail: 'will not play here' })])).toBeUndefined();
  });

  it('tells the media pane where a drop goes', () => {
    expect(finderPaneHint('media', 'photo')).toBe('drop to add to media');
    expect(finderPaneHint('themes', 'video')).toBe('drop to add to media — clips are not backgrounds');
  });

  it('lists every target while the files are over something else', () => {
    expect(finderPaneHint('themes', 'photo', false)).toBe('drop here to add to themes · on the preview or the live screen to use it now');
    expect(finderPaneHint('themes', 'video', false)).toBe('drop here to add to media · on the preview to stage it');
    expect(finderPaneHint('media', 'mixed', false)).toBe('drop here to add to media · on the preview or the live screen to use it now');
  });
});
