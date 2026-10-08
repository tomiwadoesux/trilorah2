import { describe, expect, it } from 'vitest';
import { createLyricPreviewLoader, previewKey, type PreviewAnswer } from './lyricPreview';

// Every title, artist and line in this file is invented.

/** A load whose answers the test hands out one by one. */
function bridge() {
  const calls: { title: string; artist: string; retry: boolean; answer: (a: PreviewAnswer | null) => void }[] = [];
  let open = 0;
  let peak = 0;
  const load = (title: string, artist: string, opts: { retry: boolean }) =>
    new Promise<PreviewAnswer | null>((resolve) => {
      open += 1;
      peak = Math.max(peak, open);
      calls.push({ title, artist, retry: opts.retry, answer: (a) => { open -= 1; resolve(a); } });
    });
  return { calls, load, peak: () => peak };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const LINE: PreviewAnswer = { ok: true, id: 7, firstLine: 'an invented opening line' };

describe('previewKey', () => {
  it('is deaf to case, accents and punctuation', () => {
    expect(previewKey('Ọ̀rọ̀ Tuntun!', 'Invented  Choir')).toBe(previewKey('oro tuntun', 'invented choir'));
    expect(previewKey('Invented Song', 'A')).not.toBe(previewKey('Invented Song', 'B'));
  });
});

describe('createLyricPreviewLoader', () => {
  it('two cards asking for one song cause one load', async () => {
    const b = bridge();
    const loader = createLyricPreviewLoader({ load: b.load });
    const first = loader.request('k', 'Invented Song', 'Invented Band');
    const second = loader.request('k', 'Invented Song', 'Invented Band');
    await tick();
    expect(b.calls).toHaveLength(1);
    b.calls[0].answer(LINE);
    expect(await first).toEqual({ kind: 'line', text: 'an invented opening line', id: 7 });
    expect(await second).toEqual(await first);
  });

  it('remembers a line and a none, and peek never asks', async () => {
    const b = bridge();
    const loader = createLyricPreviewLoader({ load: b.load });
    expect(loader.peek('k')).toBeNull();
    const asked = loader.request('k', 'Invented Song', 'Invented Band');
    await tick();
    b.calls[0].answer(LINE);
    await asked;
    expect(loader.peek('k')).toMatchObject({ kind: 'line', id: 7 });
    expect(await loader.request('k', 'Invented Song', 'Invented Band')).toMatchObject({ kind: 'line' });

    const none = loader.request('n', 'Unknown Invented', 'Nobody');
    await tick();
    b.calls[1].answer({ ok: false, reason: 'not-found' });
    expect(await none).toEqual({ kind: 'none' });
    expect(loader.peek('n')).toEqual({ kind: 'none' });
    expect(b.calls).toHaveLength(2);
  });

  it('does not remember offline or unavailable — the next hover asks again', async () => {
    const b = bridge();
    const loader = createLyricPreviewLoader({ load: b.load });
    const off = loader.request('k', 'Invented Song', 'Invented Band');
    await tick();
    b.calls[0].answer({ ok: false, reason: 'offline' });
    expect(await off).toEqual({ kind: 'offline' });
    expect(loader.peek('k')).toBeNull();

    const gone = loader.request('k', 'Invented Song', 'Invented Band');
    await tick();
    b.calls[1].answer(null);
    expect(await gone).toEqual({ kind: 'unavailable' });
    expect(loader.peek('k')).toBeNull();
  });

  it('runs no more than two lookups at once, and queues the rest', async () => {
    const b = bridge();
    const loader = createLyricPreviewLoader({ load: b.load });
    const asked = ['a', 'b', 'c', 'd'].map((k) => loader.request(k, `Invented ${k}`, 'Invented Band'));
    await tick();
    expect(b.calls).toHaveLength(2);
    b.calls[0].answer(LINE);
    await tick();
    expect(b.calls).toHaveLength(3);
    b.calls[1].answer(LINE);
    b.calls[2].answer(LINE);
    await tick();
    b.calls[3].answer(LINE);
    await Promise.all(asked);
    expect(b.peak()).toBe(2);
  });

  it('a card that stops asking before its turn costs nothing', async () => {
    const b = bridge();
    const loader = createLyricPreviewLoader({ load: b.load, concurrency: 1 });
    loader.request('a', 'Invented A', 'Invented Band');
    const queued = loader.request('b', 'Invented B', 'Invented Band');
    loader.cancel('b', queued);
    expect(await queued).toEqual({ kind: 'unavailable' });
    await tick();
    b.calls[0].answer(LINE);
    await tick();
    expect(b.calls.map((c) => c.title)).toEqual(['Invented A']);
  });

  it('keeps a queued lookup while another card still wants it', async () => {
    const b = bridge();
    const loader = createLyricPreviewLoader({ load: b.load, concurrency: 1 });
    loader.request('a', 'Invented A', 'Invented Band');
    const one = loader.request('b', 'Invented B', 'Invented Band');
    loader.request('b', 'Invented B', 'Invented Band');
    loader.cancel('b', one);
    await tick();
    b.calls[0].answer(LINE);
    await tick();
    expect(b.calls.map((c) => c.title)).toEqual(['Invented A', 'Invented B']);
  });

  it('a click skips the queue, as the queued lookup rather than a second one', async () => {
    const b = bridge();
    const loader = createLyricPreviewLoader({ load: b.load, concurrency: 1 });
    loader.request('a', 'Invented A', 'Invented Band');
    const hover = loader.request('b', 'Invented B', 'Invented Band');
    const click = loader.request('b', 'Invented B', 'Invented Band', { priority: true, retry: true });
    await tick();
    expect(b.calls.map((c) => [c.title, c.retry])).toEqual([['Invented A', false], ['Invented B', true]]);
    // Once it is the click's, the card leaving cannot drop it.
    loader.cancel('b', hover);
    b.calls[1].answer(LINE);
    expect(await click).toMatchObject({ kind: 'line' });
    expect(await hover).toMatchObject({ kind: 'line' });
  });

  it('a click joins a hover lookup on the wire, and asks again with retry if it came back busy', async () => {
    const b = bridge();
    const loader = createLyricPreviewLoader({ load: b.load });
    loader.request('k', 'Invented Song', 'Invented Band');
    await tick();
    const click = loader.request('k', 'Invented Song', 'Invented Band', { priority: true, retry: true });
    b.calls[0].answer({ ok: false, reason: 'busy' });
    await tick();
    await tick();
    expect(b.calls).toHaveLength(2);
    expect(b.calls[1].retry).toBe(true);
    b.calls[1].answer(LINE);
    expect(await click).toMatchObject({ kind: 'line', id: 7 });
  });

  it('after busy, hovers stand down for the cool-down; a click does not', async () => {
    let clock = 1000;
    const b = bridge();
    const loader = createLyricPreviewLoader({ load: b.load, busyCooldownMs: 5000, now: () => clock, concurrency: 1 });
    const first = loader.request('a', 'Invented A', 'Invented Band');
    const queued = loader.request('b', 'Invented B', 'Invented Band');
    await tick();
    b.calls[0].answer({ ok: false, reason: 'busy' });
    expect(await first).toEqual({ kind: 'busy' });
    // What was queued behind it hears the same, without asking.
    expect(await queued).toEqual({ kind: 'busy' });
    expect(await loader.request('c', 'Invented C', 'Invented Band')).toEqual({ kind: 'busy' });
    expect(b.calls).toHaveLength(1);
    expect(loader.peek('a')).toBeNull();

    const click = loader.request('c', 'Invented C', 'Invented Band', { priority: true, retry: true });
    await tick();
    expect(b.calls).toHaveLength(2);
    b.calls[1].answer(LINE);
    await click;

    clock += 5001;
    loader.request('d', 'Invented D', 'Invented Band');
    await tick();
    expect(b.calls).toHaveLength(3);
  });

  it('reports whether there is a bridge at all', () => {
    expect(createLyricPreviewLoader({ load: () => null }).available()).toBe(true);
    expect(createLyricPreviewLoader({ load: () => null, available: () => false }).available()).toBe(false);
    expect(createLyricPreviewLoader({ load: () => null, available: () => { throw new Error('no window'); } }).available()).toBe(false);
  });

  it('a load that throws is unavailable, not a crash', async () => {
    const loader = createLyricPreviewLoader({ load: () => Promise.reject(new Error('no handler')) });
    expect(await loader.request('k', 'Invented Song', 'Invented Band')).toEqual({ kind: 'unavailable' });
    expect(loader.peek('k')).toBeNull();
  });
});
