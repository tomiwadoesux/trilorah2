'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from '@/components/icons';
import { DEMO_CHAPTERS, DEMO_DURATION_MS, getDemoState } from './service-demo-timeline';
import { ServiceDemoActors } from './ServiceDemoActors';
import './service-demo.css';

type NativeStates = { initial: string; fragments: string[]; states: Record<string, Record<string, number>> };
/** Plays captured results of real app actions, without loading its engine. */
export function ServiceDemo({ theme }: { theme: 'light' | 'dark' }) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const elapsed = useRef(0);
  const native = useRef<{ document: Document; initial: string; phase: string; parts: Record<string, number> }>();
  const lastCaption = useRef('');
  const [time, setTime] = useState(0);
  const [committed, setCommitted] = useState(() => ({ demo: getDemoState(0), revision: 0 }));
  const committedDemo = committed.demo;
  const [nativeDocument, setNativeDocument] = useState<Document | null>(null);
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [assets, setAssets] = useState<NativeStates>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const demo = useMemo(() => getDemoState(time), [time]);
  const ready = !!assets && loaded;
  const running = ready && visible && pageVisible && !paused && !demo.complete;

  useLayoutEffect(() => {
    // Matching the outer page prevents a browser-imposed opaque iframe canvas.
    const root = iframe.current?.contentDocument?.documentElement;
    if (root) {
      root.style.colorScheme = theme;
      root.dataset.heroTheme = theme;
    }
  }, [theme, loaded]);

  useLayoutEffect(() => {
    // The hero already loads both landscapes. Reuse those exact cached assets
    // for selected images as well as the native preview/live backgrounds.
    iframe.current?.contentDocument?.querySelectorAll<HTMLImageElement>('[data-native-content-image="landscape"]')
      .forEach(image => { image.src = `/hero-landscape/${theme}.webp`; });
  }, [theme, committedDemo.phase, loaded]);

  useEffect(() => {
    // A server-rendered frame can finish before React attaches its load listener.
    if (iframe.current?.contentDocument?.querySelector('[data-shell]')) setLoaded(true);
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/hero-service/states.json', { signal: abort.signal }).then(response => {
      if (!response.ok) throw new Error('Native demo unavailable');
      return response.json();
    }).then(setAssets).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => abort.abort();
  }, []);

  useLayoutEffect(() => {
    const wrapper = frame.current;
    const shell = canvas.current;
    if (!wrapper || !shell) return;
    const resize = () => { shell.style.transform = `scale(${wrapper.clientWidth / 1600})`; };
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    resize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    let appVisible = false;
    let sectionVisible = false;
    const section = node.closest('section')!;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === node) appVisible = entry.intersectionRatio >= .55;
        else sectionVisible = entry.isIntersecting;
      }
      setVisible(appVisible && sectionVisible);
    }, { threshold: [0, .55], rootMargin: '-64px 0px 0px' });
    observer.observe(node);
    observer.observe(section);
    const visibility = () => setPageVisible(!document.hidden);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => {
      setReduced(motion.matches);
      if (motion.matches) {
        elapsed.current = DEMO_DURATION_MS;
        setTime(DEMO_DURATION_MS);
        setPaused(true);
      }
    };
    visibility();
    preference();
    document.addEventListener('visibilitychange', visibility);
    motion.addEventListener('change', preference);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', preference);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsed.current = Math.min(DEMO_DURATION_MS, elapsed.current + now - previous);
      previous = now;
      setTime(elapsed.current);
    }, 100);
    return () => clearInterval(timer);
  }, [running]);

  useLayoutEffect(() => {
    const doc = iframe.current?.contentDocument;
    if (!ready || !assets || !doc?.querySelector('[data-shell]')) return;
    if (native.current?.document !== doc) {
      native.current = { document: doc, initial: doc.body.innerHTML, phase: '', parts: { ...assets.states[assets.initial] } };
      setNativeDocument(doc);
    }
    const current = native.current;
    if (current.phase !== demo.phase) {
      const parts = assets.states[demo.phase];
      if (!parts) return;
      for (const [part, index] of Object.entries(parts)) {
        if (current.parts[part] !== index) {
          const target = doc.querySelector(`[data-native-part="${part}"]`);
          if (target) target.outerHTML = assets.fragments[index];
        }
      }
      current.parts = parts;
      current.phase = demo.phase;
      // DOM serialization omits scrollTop. Restore the native follow-live view.
      doc.querySelectorAll<HTMLElement>('.preaching-card__history-scroll, .transcript-reader__scroll').forEach(area => {
        area.scrollTop = area.scrollHeight;
      });
    }
    // Reveal the real transcript's existing words, keeping its native wrapping.
    const caption = doc.querySelector('.preaching-card__caption [data-caption-id]:last-child .transcript-marked');
    const words = caption ? Array.from(caption.children) as HTMLElement[] : [];
    const progress = reduced || !demo.captionDuration ? 1 : Math.min(1, (time - demo.phaseStartedAt) / demo.captionDuration);
    const count = Math.max(1, Math.ceil(progress * words.length));
    const captionKey = `${demo.phase}:${count}`;
    if (lastCaption.current !== captionKey) {
      words.forEach((word, index) => { word.style.visibility = index < count ? '' : 'hidden'; });
      const area = caption?.closest<HTMLElement>('.preaching-card__caption');
      const word = words[Math.min(count, words.length) - 1];
      if (area && word) {
        const overflow = word.getBoundingClientRect().bottom - area.getBoundingClientRect().bottom;
        if (overflow > 0) area.scrollTop += overflow;
      }
      lastCaption.current = captionKey;
    }

    // A chapter seek must commit the new native DOM and actor clock together.
    // Otherwise actors first reset to the old phase, then animate across it.
    setCommitted({ demo, revision: playbackRevision });
  }, [assets, ready, demo, time, reduced, running, playbackRevision]);

  useEffect(() => {
    const animations = iframe.current?.contentDocument?.getAnimations() ?? [];
    for (const animation of animations) {
      if (animation.playState === 'finished') continue;
      if (running) animation.play();
      else animation.pause();
    }
  }, [running, demo.phase, ready]);

  function seek(at = 0) {
    elapsed.current = at;
    lastCaption.current = '';
    setTime(at);
    setPlaybackRevision(value => value + 1);
    setPaused(false);
  }
  const replay = () => seek();
  return <div className="service-demo" ref={frame} data-running={running} data-phase={demo.phase} data-native-loaded={loaded} data-states-loaded={!!assets}>
    <p className="sd-sr-only">A sample service in Trilorah’s actual interface. The circle listens, triangle operates, and square presents to the congregation. Follow four operator sections: Amazing Grace, a sermon on Psalm 46, images, and slides.</p>
    <div className="sd-viewport">
      <div className="sd-native-canvas" ref={canvas}>
        <iframe aria-hidden="true" ref={iframe} src="/hero-service/app.html" title="Trilorah sample service" sandbox="allow-same-origin" tabIndex={-1} onLoad={() => setLoaded(true)} />
        <ServiceDemoActors document={nativeDocument} demo={committedDemo} running={running} reduced={reduced} playbackRevision={committed.revision} />
      </div>
    </div>
    <div className="sd-playback">
      <div className="sd-chapters" aria-label="Sample service sections">{DEMO_CHAPTERS.map(chapter => <button type="button" key={chapter.id} disabled={!ready} onClick={() => seek(chapter.at)} aria-label={`Show ${chapter.label.toLowerCase()} demonstration`} aria-pressed={demo.chapter === chapter.id}>{chapter.label}</button>)}</div>
      <span>{failed ? 'Sample service unavailable' : ready ? demo.title : 'Preparing the sample service'}</span>
      <button type="button" disabled={!ready} onClick={() => demo.complete ? replay() : setPaused(value => !value)} aria-label={demo.complete ? 'Play service demo again' : paused ? 'Play service demo' : 'Pause service demo'}>{demo.complete || paused ? '▷' : 'Ⅱ'}</button>
      <button type="button" disabled={!ready} onClick={replay} aria-label="Replay service demo"><RotateCcw size={15} /></button>
    </div>
  </div>;
}
