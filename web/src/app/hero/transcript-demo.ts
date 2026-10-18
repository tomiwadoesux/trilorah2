type Phase = 'idle' | 'book' | 'caught' | 'reading' | 'done';
type Part = 'transcript' | 'stage' | 'catches' | 'listen' | 'orb' | 'actions';
const PARTS: Part[] = ['transcript', 'stage', 'catches', 'listen', 'orb', 'actions'];
const REFERENCE = 'John chapter three verse sixteen.'.split(' ');
const CATCH_LIFE = 6000;

/** Replay exported native component states; no Electron or speech engine loads. */
export function mountTranscriptDemo(doc: Document) {
  const root = doc.querySelector<HTMLElement>('[data-shell]');
  const initialTranscript = doc.querySelector<HTMLElement>('[data-hero-part="transcript"]');
  if (!root || !initialTranscript) return () => {};

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const originalRole = doc.body.getAttribute('role');
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let playing = false;
  let started = false;
  let countdown: Animation | undefined;

  function later(fn: () => void, delay: number) {
    const timer = setTimeout(() => { timers.delete(timer); fn(); }, delay);
    timers.add(timer);
  }

  function paint(phase: Phase, parts: Part[]) {
    for (const part of parts) {
      const template = doc.getElementById(`hero-${phase}-${part}`) as HTMLTemplateElement | null;
      const current = doc.querySelector(`[data-hero-part="${part}"]`);
      const replacement = template?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
      if (current && replacement) {
        const focused = current.contains(doc.activeElement);
        current.replaceWith(replacement);
        if (part === 'listen') {
          replacement.tabIndex = 0;
          replacement.setAttribute('title', playing ? 'Stop practice sermon' : 'Replay practice sermon');
          if (focused) replacement.focus({ preventScroll: true });
        }
      }
    }
  }

  function clear() {
    timers.forEach(clearTimeout);
    timers.clear();
    countdown?.cancel();
    countdown = undefined;
  }

  function stop() {
    clear();
    playing = false;
    root!.dataset.heroPlayback = 'stopped';
    paint('done', ['listen', 'orb', 'actions']);
  }

  function catchVerse() {
    paint('caught', ['stage', 'catches', 'transcript', 'actions']);
    doc.querySelector('[data-hero-part="stage"]')?.classList.add('hero-practice-arrive');
    const bar = doc.querySelector<HTMLElement>('.catch-countdown__bar');
    if (bar) {
      bar.classList.remove('is-held');
      countdown = bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
        { duration: CATCH_LIFE, easing: 'linear', fill: 'forwards' });
    }
    later(() => {
      doc.querySelector('[data-hero-part="catches"]')?.classList.add('hero-practice-leave');
      later(() => paint('idle', ['catches']), 240);
    }, CATCH_LIFE);
  }

  function readVerse() {
    paint('reading', ['transcript']);
    const words = Array.from(doc.querySelectorAll<HTMLElement>('[data-caption-id="1"] .transcript-word'));
    words.forEach(word => { word.hidden = true; });
    let at = 0;
    let scrollPending = false;
    const next = () => {
      const word = words[at++];
      if (!word) { later(stop, 1100); return; }
      word.hidden = false;
      // The native caption holds three lines, advancing one line after a pause.
      const caption = doc.querySelector<HTMLElement>('.preaching-card__caption');
      if (caption && !scrollPending && caption.scrollHeight > caption.clientHeight + caption.scrollTop + 1) {
        scrollPending = true;
        later(() => {
          caption.scrollTop = Math.min(caption.scrollTop + 24, caption.scrollHeight - caption.clientHeight);
          scrollPending = false;
        }, 1500);
      }
      later(next, word.textContent?.endsWith(',') ? 720 : 420);
    };
    next();
  }

  function start() {
    clear();
    observer.disconnect();
    started = true;
    playing = true;
    root!.dataset.heroPlayback = 'playing';
    paint('idle', PARTS);
    if (reducedMotion.matches) {
      paint('caught', ['stage']);
      paint('done', ['transcript', 'listen', 'orb']);
      stop();
      return;
    }

    paint('book', ['transcript', 'listen', 'orb', 'actions']);
    // Keep the app's reference wrapper and its book-name highlight in place.
    const referenceWords = doc.querySelector('.transcript-reference__words');
    REFERENCE.slice(1).forEach((text, index) => later(() => {
      const span = doc.createElement('span');
      span.className = 'transcript-word';
      span.dataset.referenceState = 'possible';
      span.textContent = text;
      referenceWords?.append(' ', span);
    }, (index + 1) * 440));
    later(catchVerse, 2500);
    later(readVerse, 3400);
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !started && !document.hidden) start();
  }, { threshold: 0.55 });
  observer.observe(initialTranscript);
  doc.body.removeAttribute('role');
  const initialButton = doc.querySelector<HTMLElement>('[data-guide="listen"]');
  if (initialButton) {
    initialButton.tabIndex = 0;
    initialButton.title = 'Play practice sermon';
  }
  const clicked = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (target?.closest('[data-guide="listen"]')) playing ? stop() : start();
  };
  const visibilityChanged = () => { if (document.hidden && playing) stop(); };
  doc.addEventListener('click', clicked);
  document.addEventListener('visibilitychange', visibilityChanged);

  return () => {
    clear();
    observer.disconnect();
    doc.removeEventListener('click', clicked);
    document.removeEventListener('visibilitychange', visibilityChanged);
    paint('idle', PARTS);
    delete root.dataset.heroPlayback;
    if (originalRole !== null) doc.body.setAttribute('role', originalRole);
  };
}
