/**
 * The opening line on an online song card — asked for once, shared, and
 * polite to LRCLIB.
 *
 * LRCLIB is a free, volunteer-run catalogue, and a search answer is a few
 * hundred kilobytes. A grid of two hundred cards swept by a pointer must not
 * turn into two hundred searches, so this loader is the one place card
 * lookups go through:
 *
 * - one request per song, shared by everyone who asks while it is out;
 * - at most `concurrency` hover lookups on the wire, the rest queued, and a
 *   queued one dropped when its card stops asking (`cancel`) — a request
 *   already sent cannot be called back over IPC, so it finishes and its
 *   answer is kept for next time;
 * - only settled answers are remembered ('line', 'none'); a busy or offline
 *   answer is asked again on the next hover;
 * - after LRCLIB says busy, hover lookups stand down for a few seconds and
 *   answer 'busy' without asking. A click (`priority`) is the operator
 *   waiting: it skips the queue and the pause, and may retry once.
 *
 * No `window` in here: the bridge is passed in, so this runs under vitest.
 */

export type PreviewState =
  | { kind: 'loading' }
  | { kind: 'line'; text: string; id: number }
  | { kind: 'none' }
  | { kind: 'busy' }
  | { kind: 'offline' }
  /** No bridge to ask (a browser page, or an app not yet restarted onto it). Shows nothing. */
  | { kind: 'unavailable' };

/** What the bridge answers — the shape of `songs.lyricsPreview`. */
export type PreviewAnswer =
  | { ok: true; id: number; firstLine: string }
  | { ok: false; reason: string; message?: string };

export interface PreviewRequest {
  /** A click: skip the queue and the busy pause. */
  priority?: boolean;
  /** Let the main process wait out one short Retry-After. Clicks only. */
  retry?: boolean;
}

export interface LyricPreviewLoaderOptions {
  load: (title: string, artist: string, opts: { retry: boolean }) => Promise<PreviewAnswer | null | undefined> | null | undefined;
  /** False when there is nothing to ask; cards then never arm. */
  available?: () => boolean;
  concurrency?: number;
  cap?: number;
  busyCooldownMs?: number;
  now?: () => number;
}

export interface LyricPreviewLoader {
  available(): boolean;
  /** A remembered answer, or null. Never starts a request. */
  peek(key: string): PreviewState | null;
  request(key: string, title: string, artist: string, opts?: PreviewRequest): Promise<PreviewState>;
  /**
   * This caller no longer wants `key`. Drops the queued lookup once nobody
   * does. Pass the promise `request` gave, so a caller whose lookup already
   * finished cannot cancel a newer one somebody else is waiting on.
   */
  cancel(key: string, asked?: Promise<PreviewState>): void;
}

/** Title + artist → one key, deaf to case, accents and punctuation. */
export function previewKey(title: string, artist: string): string {
  const norm = (s: string) => String(s ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return `${norm(title)}|${norm(artist)}`;
}

const UNAVAILABLE: PreviewState = { kind: 'unavailable' };
const BUSY: PreviewState = { kind: 'busy' };

function toState(answer: PreviewAnswer | null | undefined): PreviewState {
  if (!answer) return UNAVAILABLE;
  if (answer.ok) return { kind: 'line', text: answer.firstLine, id: answer.id };
  if (answer.reason === 'not-found') return { kind: 'none' };
  if (answer.reason === 'offline') return { kind: 'offline' };
  // 'busy', and any other failure: LRCLIB is not answering properly, which
  // to the operator reads the same — try again in a moment.
  return BUSY;
}

interface Entry {
  key: string;
  title: string;
  artist: string;
  retry: boolean;
  priority: boolean;
  started: boolean;
  /** Hover callers still waiting. A priority caller never cancels. */
  waiters: number;
  promise: Promise<PreviewState>;
  settle: (state: PreviewState) => void;
}

export function createLyricPreviewLoader({
  load,
  available = () => true,
  concurrency = 2,
  cap = 300,
  busyCooldownMs = 5000,
  now = Date.now,
}: LyricPreviewLoaderOptions): LyricPreviewLoader {
  const cache = new Map<string, PreviewState>();
  const entries = new Map<string, Entry>();
  const queue: Entry[] = [];
  let running = 0;
  let quietUntil = 0;

  const remember = (key: string, state: PreviewState) => {
    if (state.kind !== 'line' && state.kind !== 'none') return;
    cache.delete(key);
    cache.set(key, state);
    while (cache.size > cap) cache.delete(cache.keys().next().value as string);
  };

  const finish = (entry: Entry, state: PreviewState) => {
    if (entries.get(entry.key) === entry) entries.delete(entry.key);
    entry.settle(state);
  };

  const start = (entry: Entry) => {
    entry.started = true;
    running += 1;
    void Promise.resolve()
      .then(() => load(entry.title, entry.artist, { retry: entry.retry }))
      .then(toState, () => UNAVAILABLE)
      .then((state) => {
        running -= 1;
        remember(entry.key, state);
        if (state.kind === 'busy') {
          quietUntil = now() + busyCooldownMs;
          // Everything still queued would only hear the same thing.
          for (const queued of queue.splice(0)) finish(queued, BUSY);
        }
        finish(entry, state);
        pump();
      });
  };

  const pump = () => {
    while (running < concurrency && queue.length) {
      const entry = queue.shift()!;
      if (now() < quietUntil) finish(entry, BUSY);
      else start(entry);
    }
  };

  const request = (key: string, title: string, artist: string, opts: PreviewRequest = {}): Promise<PreviewState> => {
    const priority = !!opts.priority;
    const retry = !!opts.retry;
    const cached = cache.get(key);
    if (cached) {
      remember(key, cached);
      return Promise.resolve(cached);
    }
    const existing = entries.get(key);
    if (existing) {
      if (!priority) {
        existing.waiters += 1;
        return existing.promise;
      }
      if (!existing.started) {
        // A click on a card whose hover lookup is still queued: send that
        // lookup now, as the click's, rather than a second one beside it.
        existing.priority = true;
        existing.retry = existing.retry || retry;
        queue.splice(queue.indexOf(existing), 1);
        start(existing);
        return existing.promise;
      }
      // Already on the wire. Join it; if it came back busy without the
      // retry a click is owed, ask once more, as a click.
      if (retry && !existing.retry) {
        return existing.promise.then((state) => (state.kind === 'busy' ? request(key, title, artist, opts) : state));
      }
      return existing.promise;
    }
    if (!priority && now() < quietUntil) return Promise.resolve(BUSY);

    let settle!: (state: PreviewState) => void;
    const promise = new Promise<PreviewState>((resolve) => { settle = resolve; });
    const entry: Entry = { key, title, artist, retry, priority, started: false, waiters: priority ? 0 : 1, promise, settle };
    entries.set(key, entry);
    if (priority) start(entry);
    else {
      queue.push(entry);
      pump();
    }
    return promise;
  };

  return {
    available: () => {
      try { return available(); } catch { return false; }
    },
    peek: (key) => {
      const cached = cache.get(key);
      return cached ?? null;
    },
    request,
    cancel: (key, asked) => {
      const entry = entries.get(key);
      if (!entry || entry.started || entry.priority) return;
      if (asked && asked !== entry.promise) return;
      entry.waiters -= 1;
      if (entry.waiters > 0) return;
      queue.splice(queue.indexOf(entry), 1);
      // Nobody is listening; settle so the promise is not left hanging.
      finish(entry, UNAVAILABLE);
    },
  };
}
