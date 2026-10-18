import { useAppStore } from '../../stores/appStore';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { ReadAlong, type FollowStep } from '../../lib/readAlong';
import { useAutoAdvanceStore } from '../../stores/autoAdvanceStore';
import { useEngine, fitRules } from './engine';
import { useProjector } from './projector';
import { buildVerseSlides } from '../../../shared/verseDisplay';

/** Mounted above the library tabs: browsing songs must not stop a reading. */
export function AutoAdvance() {
  const engine = useEngine();
  const projector = useProjector();
  const requested = useAutoAdvanceStore(state => state.enabled);
  const prayer = useAppStore(state => state.prayerMode);
  const enabled = requested && !prayer;
  const follower = useRef(new ReadAlong());
  const latest = useRef({ engine, projector, enabled, prayer });
  latest.current = { engine, projector, enabled, prayer };
  const generation = useRef(0);
  const busy = useRef(false);
  const ready = useRef(false);
  const queue = useRef<({ direction: 'next' | 'previous' } | { text: string; isFinal: boolean })[]>([]);
  const apply = useRef<(step: FollowStep | null, commanded?: boolean) => void>(() => {});
  const flush = useRef(() => {});
  const key = projector.live?.source === 'scripture'
    ? `${projector.live.reference}|${projector.live.version}` : '';
  const active = !prayer && projector.screen === 'live' && !!key;

  useLayoutEffect(() => {
    const token = ++generation.current;
    ready.current = false;
    const item = projector.live;
    const match = item?.reference?.match(/^(.+?) (\d+):(\d+)(?:-(\d+))?$/);
    if (!active || !item?.verses?.length || !match) {
      follower.current.load(null); queue.current = []; return;
    }
    if (item.origin !== 'auto') { follower.current.load(null); queue.current = []; }
    follower.current.load({ book: match[1], chapter: Number(match[2]), verses: item.verses,
      pages: item.slides?.map(slide => ({ first: slide.verseStart, last: slide.verseEnd })) ?? [], page: projector.slide });
    const last = item.verses.at(-1)!.verse;
    useAutoAdvanceStore.getState().setNote('');
    // Read through the chapter, then take its first existing row: some
    // translations skip a verse number (for example Mark 9:44 in BSB).
    void engine.lookup(match[1], Number(match[2]), last + 1, 999, item.version).then(next => {
      if (generation.current !== token) return;
      follower.current.setAfter(next?.verses[0] ?? null, last + 1);
      ready.current = true;
      // Speech and commands may have arrived while the chapter was loading.
      flush.current();
    });
    return () => { generation.current++; };
    // Pages have their own effect. Engine/projection contexts change on every transcript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, projector.delivery]);

  useLayoutEffect(() => { follower.current.setPage(projector.slide); }, [projector.slide]);

  apply.current = (step, commanded = false) => {
    if (!step || step.kind === 'absorbed') return;
    const { engine: nowEngine, projector: now, enabled: on } = latest.current;
    if ((!on && !commanded) || latest.current.prayer || now.screen !== 'live' || now.live?.source !== 'scripture') return;
    if (step.kind === 'page') { now.setSlide(step.page); return; }
    if (busy.current || !ready.current) return;
    const item = now.live;
    const match = item.reference?.match(/^(.+?) (\d+):/);
    if (!match) return;
    busy.current = true;
    const token = generation.current;
    void (async () => {
      const reading = await nowEngine.lookup(match[1], Number(match[2]), step.verse, undefined, item.version);
      if (token !== generation.current || latest.current.prayer || (!latest.current.enabled && !commanded)) return;
      if (!reading) throw new Error('The next verse is unavailable. Choose a scripture to continue.');
      await now.send({ source: 'scripture', id: reading.reference, label: reading.reference, ...reading,
        slides: buildVerseSlides({ book: match[1], chapter: Number(match[2]), version: reading.version }, reading.verses, fitRules(reading.verses)),
        origin: 'auto', followFrom: { reference: item.reference!, version: item.version! } });
    })().catch(error => {
      if (token !== generation.current) return;
      queue.current = [];
      useAutoAdvanceStore.getState().setEnabled(false);
      useAutoAdvanceStore.getState().setNote(error instanceof Error ? error.message : 'Auto advance stopped. Please try again.');
    }).finally(() => {
      busy.current = false;
      // Let the delivered reading reach the follower before queued voice commands.
      requestAnimationFrame(() => flush.current());
    });
  };

  flush.current = () => {
    if (busy.current || !ready.current) return;
    while (queue.current.length && !busy.current) {
      const event = queue.current.shift()!;
      apply.current('direction' in event ? follower.current.nav(event.direction) : follower.current.hear(event.text, event.isFinal), 'direction' in event);
    }
    if (!busy.current && latest.current.enabled) apply.current(follower.current.resume());
  };

  useEffect(() => {
    const api = window.api;
    const offSpeech = api?.onTranscriptLine?.(line => {
      if (!latest.current.enabled || latest.current.projector.screen !== 'live' || latest.current.projector.live?.source !== 'scripture') {
        // Track cumulative partial length even while paused, so old words
        // cannot advance a scripture when following is turned back on.
        follower.current.skip(line.text, line.isFinal); return;
      }
      queue.current.push(line); flush.current();
    });
    const offNav = api?.onReadAlongNav?.(direction => {
      if (latest.current.prayer || latest.current.projector.screen !== 'live') return;
      queue.current.push({ direction }); flush.current();
    });
    return () => { offSpeech?.(); offNav?.(); generation.current++; queue.current = []; ready.current = false; };
  }, []);

  useEffect(() => {
    window.api?.setReadAlong?.(active);
    return () => window.api?.setReadAlong?.(false);
  }, [active]);
  return null;
}
