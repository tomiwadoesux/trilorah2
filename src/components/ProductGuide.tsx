import { guideReadiness } from '../lib/guidePrerequisites';
import guideIndex from 'virtual:trilorah-guide-index';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon, SearchIcon, ChevronRightIcon, CheckIcon } from '../ui';
import { useAppStore } from '../stores/appStore';
import { useLiveStore } from '../stores/liveStore';
import { usePracticeStore } from '../stores/practiceStore';
import { destinationFor, guideTasks, microphoneCheckComplete, searchGuideTasks, type GuideDestination, type GuideTask } from '../lib/productGuide';
import { defaultGuideAnswers, microphoneTask, shortTitle, walkthroughFor, type GuideAnswers } from '../lib/guideWalkthroughs';
import { guideElement, useGuideCursor } from './useGuideCursor';
import './productGuide.css';

const starters = ['audio.choose-input', 'songs.create-edit-slides', 'bible.lookup-preview-reference', 'media.find-online', 'media.import-preview-local', 'outputs.assign', 'run.build-edit'];
function Triangle({ small = false }: { small?: boolean }) { return <svg width={small ? 15 : 25} height={small ? 17 : 29} viewBox="0 0 25 29" fill="none" aria-hidden="true"><path d="M2 2 22 12 7 25Z" fill="currentColor" stroke="#0b1815" strokeWidth="1.5" strokeLinejoin="round" /></svg>; }

export function ProductGuide({ onNavigate }: { onNavigate: (destination: GuideDestination) => string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<GuideTask | null>(null);
  const [walking, setWalking] = useState(false);
  const [walkSession, setWalkSession] = useState(0);
  const [demo, setDemo] = useState(false);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manual, setManual] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [voice, setVoice] = useState(false);
  const [error, setError] = useState('');
  const [dock, setDock] = useState<'left' | 'right'>('right');
  const [signal, setSignal] = useState(false);
  const [freshText, setFreshText] = useState(false);
  const [demoMenu, setDemoMenu] = useState(false);
  const [demoInput, setDemoInput] = useState(false);
  const [demoListening, setDemoListening] = useState(false);
  const [demoSpoken, setDemoSpoken] = useState(false);
  const [located, setLocated] = useState(false);
  const [answers, setAnswers] = useState<GuideAnswers>(defaultGuideAnswers);
  const [followup, setFollowup] = useState('');
  const [followupOpen, setFollowupOpen] = useState(false);
  const [setup, setSetup] = useState<'stock' | 'bible' | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupReady, setSetupReady] = useState(false);
  const [externalDisplay, setExternalDisplay] = useState<boolean | null>(null);
  const [stockState, setStockState] = useState('');
  const [mapRevision, setMapRevision] = useState(guideIndex.revision);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const evidence = useRef({ checkStartedAt: 0, signalAt: 0, transcriptAt: 0 });
  const transcriptBaseline = useRef(0);
  const pickedInput = useRef(false);
  const dialogId = useId();
  const status = useAppStore(s => s.asrStatus);
  const detail = useAppStore(s => s.asrDetail);
  const input = useAppStore(s => s.settings?.micDeviceLabel);
  const practice = usePracticeStore(s => s.on);
  const lastLine = useLiveStore(s => s.lines.at(-1)?.id ?? 0);
  const bridge = typeof window !== 'undefined' && !!window.api?.startListening;
  const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const steps = useMemo(() => selected ? walkthroughFor(selected, demo, answers) : [], [selected, demo, answers]);
  const current = steps[step];
  const complete = walking && step >= steps.length;
  const cancelVoice = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  const avoid = useCallback((x: number, y: number) => {
    const box = panel.current?.getBoundingClientRect();
    if (box && x > box.left - 24 && x < box.right + 24 && y > box.top - 24 && y < box.bottom + 24) setDock(x > innerWidth / 2 ? 'left' : 'right');
  }, []);
  const cursor = useGuideCursor(panel, avoid);
  const { cancel, run } = cursor;
  useEffect(() => { if (complete) cancel(); }, [complete, cancel]);
  const stop = useCallback(() => { generation.current++; cancel(); cancelVoice(); }, [cancel, cancelVoice]);
  const pauseGuide = useCallback(() => { generation.current++; cancel(false); cancelVoice(); setPaused(true); setManual(false); }, [cancel, cancelVoice]);
  useEffect(() => {
    const updated = (data: { revision: string }) => { setMapRevision(data.revision); if (walking) { pauseGuide(); setError('The app was updated. Continue when the screen is ready; I’ll find the control again.'); } };
    import.meta.hot?.on('trilorah-guide-map-update', updated);
    return () => import.meta.hot?.off('trilorah-guide-map-update', updated);
  }, [walking, pauseGuide]);
  const close = useCallback(() => { stop(); setOpen(false); setWalking(false); setVoice(false); trigger.current?.focus(); }, [stop]);
  const results = useMemo(() => query.trim() ? searchGuideTasks(query).slice(0, 12) : all ? guideTasks : starters.map(id => guideTasks.find(task => task.id === id)!).filter(Boolean), [query, all]);

  useEffect(() => { if (open && !selected) search.current?.focus(); }, [open, selected]);
  useEffect(() => {
    // Keep the caret where the user put it when a field interaction advances us.
    if (open && selected && (document.activeElement === document.body || panel.current?.contains(document.activeElement) || !walking)) panel.current?.querySelector<HTMLElement>('h3')?.focus();
  }, [open, selected, walking, step]);

  const advance = useCallback(() => { setManual(false); setWaiting(false); setError(''); setStep(n => n + 1); }, []);
  const showStep = useCallback(async (perform: boolean) => {
    if (!current) return;
    const token = ++generation.current;
    setError(''); setPaused(false); setManual(!perform); setWaiting(false);
    try {
      if (current.prerequisite) {
        const readiness = await guideReadiness(current.prerequisite, window.api);
        if (generation.current !== token) return;
        if (readiness === 'desktop') throw new Error('This step needs the Trilorah desktop app.');
        if (readiness === 'unknown') throw new Error('I couldn’t check the setup. Try again when the app is ready.');
        if (readiness !== 'ready') { cancel(); cancelVoice(); setSetup(current.prerequisite); setSetupOpen(false); setSetupReady(false); return; }
        if (current.id === 'stock-pick') {
          const state = guideElement('[data-guide="stock-search"]')?.dataset.guideState;
          if (state === 'error') throw new Error('The provider could not complete this search. Check the message in the library, or try different words.');
          if (state === 'empty') throw new Error('No images for those words yet. Try a simpler subject.');
        }
      }
      const actionable = ['click', 'focus', 'write'].includes(current.action);
      const success = await run(current, perform && actionable);
      if (generation.current !== token || !success) return;
      if (perform && actionable) advance();
      else { setManual(true); setWaiting(true); }
    } catch (reason) { if (generation.current === token) { setError(reason instanceof Error ? reason.message : 'Let’s try that step again.'); setManual(false); } }
  }, [current, run, advance, cancel, cancelVoice]);
  // A demo is explicitly opted into. Real workflows stop at each question.
  useEffect(() => {
    if (!open || !walking || !demo || paused || !current || error) return;
    const timer = window.setTimeout(() => void showStep(true), 650);
    return () => clearTimeout(timer);
  }, [open, walking, demo, paused, step, error, showStep, current]);

  useEffect(() => {
    if (!open) return;
    const allowed = (element: Element | null) => !!element && (!!panel.current?.contains(element) || !!element.closest('[data-guide-demo]') || !!trigger.current?.contains(element));
    const relevant = (element: Element | null) => !!element && (!!current && !!element.closest(current.target) || !!element.closest('[data-guide="audio-options"], [data-guide="song-entry"], [data-guide="run-programme"], [data-guide="outputs-settings"], [data-guide="stock-search"], [data-guide="settings-content"], [role="listbox"]'));
    const pointer = (event: PointerEvent) => {
      if (!event.isTrusted || !walking || complete) return;
      const element = event.target instanceof Element ? event.target : null;
      if (allowed(element)) return;
      // A real click takes precedence over a pending demonstration click.
      if (cursor.busy || !relevant(element)) pauseGuide();
      else cancelVoice();
    };
    const click = (event: MouseEvent) => {
      if (!walking || demo || paused || !event.isTrusted) return;
      const element = event.target instanceof Element ? event.target : null;
      if (current?.action === 'input' && element?.closest('[data-guide="audio-options"] [role="menuitemradio"]')) pickedInput.current = true;
      if (manual && waiting && current?.action === 'focus' && element?.closest(current.target)) advance();
    };
    const key = (event: KeyboardEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (event.key === 'Escape') {
        if (panel.current?.contains(element) || trigger.current === element) { event.preventDefault(); event.stopPropagation(); close(); }
        else if (walking) pauseGuide();
      } else if (event.isTrusted && walking && !complete && !allowed(element) && (cursor.busy || !relevant(element))) pauseGuide();
    };
    const hide = () => { if (document.hidden && walking) pauseGuide(); };
    window.addEventListener('pointerdown', pointer, true); window.addEventListener('click', click, true); window.addEventListener('keydown', key, true); document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('pointerdown', pointer, true); window.removeEventListener('click', click, true); window.removeEventListener('keydown', key, true); document.removeEventListener('visibilitychange', hide); };
  }, [open, walking, demo, paused, current, complete, manual, waiting, cursor.busy, pauseGuide, close, cancelVoice, advance]);

  useEffect(() => {
    if (!walking || paused || !current?.observed) return;
    const observed = (event: Event) => {
      if ((event as CustomEvent).detail === current.observed) { stop(); advance(); }
    };
    window.addEventListener('trilorah-guide-observed', observed);
    return () => window.removeEventListener('trilorah-guide-observed', observed);
  }, [walking, paused, current, stop, advance]);

  // Advance only when the actual UI has reached the expected state.
  useEffect(() => {
    if (!walking || demo || paused || !current || cursor.busy) return;
    const observe = () => {
      if (manual && waiting && current.done && guideElement(current.done)) { advance(); return; }
      if (current.action === 'input' && pickedInput.current && !practice && !guideElement('[data-guide="audio-options"]')) { pickedInput.current = false; advance(); }
      if (current.action === 'listen' && status === 'listening' && !practice && bridge) advance();
    };
    observe(); const timer = window.setInterval(observe, 180);
    return () => clearInterval(timer);
  }, [walking, demo, paused, current, manual, waiting, cursor.busy, practice, status, bridge, advance]);
  useEffect(() => {
    if (!walking || current?.action !== 'check' || demo || paused) return;
    transcriptBaseline.current = useLiveStore.getState().lines.at(-1)?.id ?? 0;
    evidence.current = { checkStartedAt: Date.now(), signalAt: 0, transcriptAt: 0 };
    setSignal(false); setFreshText(false);
    const off = window.api?.onAudioLevel?.(level => {
      if (useAppStore.getState().asrStatus === 'listening' && Number.isFinite(level) && level > -55) { evidence.current.signalAt = Date.now(); setSignal(true); }
    });
    return () => off?.();
  }, [walking, current, demo, paused, input, status, practice]);
  useEffect(() => {
    if (walking && current?.action === 'check' && !paused && !demo && lastLine > transcriptBaseline.current && status === 'listening') { evidence.current.transcriptAt = Date.now(); setFreshText(true); }
  }, [lastLine, walking, current, paused, demo, status]);
  useEffect(() => {
    if (walking && current?.action === 'check' && microphoneCheckComplete({ bridge, practice, listening: status === 'listening', paused, ...evidence.current })) advance();
  }, [walking, current, bridge, practice, status, paused, signal, freshText, advance]);
  useEffect(() => {
    cancelVoice();
    if (!open || !walking || !voice || paused || !voiceSupported || !current || (!demo && status === 'listening')) return;
    const utterance = new SpeechSynthesisUtterance(`${current.title} ${current.prompt}`);
    utterance.onerror = event => { if (!['interrupted', 'canceled'].includes(event.error)) setVoice(false); };
    window.speechSynthesis.speak(utterance);
    return cancelVoice;
  }, [open, walking, voice, paused, voiceSupported, current, demo, status, cancelVoice]);

  const choose = (task: GuideTask) => { stop(); setSetup(null); setFollowup(''); setFollowupOpen(false); setSelected(task); setWalking(false); setDemo(false); setPaused(false); setError(''); setLocated(false); };
  const begin = (isDemo: boolean, byHand = false) => {
    stop(); setSetup(null); setFollowupOpen(false); setDemo(isDemo); setStep(0); setPaused(false); setError(''); setManual(byHand); setSignal(false); setFreshText(false); pickedInput.current = false;
    setDemoMenu(false); setDemoInput(false); setDemoListening(false); setDemoSpoken(false); setWaiting(false); setWalking(true); setWalkSession(n => n + 1);
    if (!isDemo) onNavigate(selected && ['outputs', 'run'].includes(destinationFor(selected) ?? '') ? destinationFor(selected)! : 'audio');
  };
  // The mode choice starts the first step; subsequent steps ask again.
  useEffect(() => { if (walking && !demo && current && !paused) void showStep(!manual); }, [walkSession]);
  const back = () => { stop(); setSetup(null); setFollowupOpen(false); setSelected(null); setWalking(false); setPaused(false); setError(''); };
  const resumeGuide = () => {
    // A click may have landed just before pause. Observe its result instead of
    // replaying a toggle or looking for an option that has already disappeared.
    if (current?.done && guideElement(current.done)) advance();
    setPaused(false); setError('');
  };
  const locate = async () => {
    const destination = selected && destinationFor(selected); if (!destination) return;
    const target = onNavigate(destination); setError('');
    try { await run({ id: 'locate', target, title: '', prompt: '', action: 'point' }, false); setLocated(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Try opening this area again.'); }
  };

  useEffect(() => {
    if (!setup) return;
    let alive = true;
    const check = async () => {
      try {
        const ready = await guideReadiness(setup, window.api);
        if (alive) setSetupReady(ready === 'ready');
      } catch { if (alive) setSetupReady(false); }
    };
    void check(); const timer = window.setInterval(check, 1800);
    return () => { alive = false; clearInterval(timer); };
  }, [setup]);
  useEffect(() => {
    let alive = true; setExternalDisplay(null);
    if (selected?.id.startsWith('outputs.')) window.api?.getDisplaysStatus?.().then(result => { if (alive) setExternalDisplay(result.hasExternal); }).catch(() => undefined);
    return () => { alive = false; };
  }, [selected]);
  useEffect(() => {
    if (!walking || destinationFor(selected!) !== 'online') { setStockState(''); return; }
    const read = () => setStockState(guideElement('[data-guide="stock-search"]')?.dataset.guideState ?? '');
    read(); const timer = window.setInterval(read, 300); return () => clearInterval(timer);
  }, [walking, selected]);
  const openSetup = async () => {
    stop(); setSetupOpen(true);
    onNavigate(setup === 'stock' ? 'keys' : 'language');
    try { await run({ id: 'setup', target: setup === 'stock' ? '[data-guide="setting-pixabayApiKey"]' : '[data-guide="settings-content"]', title: '', prompt: setup === 'stock' ? 'Add either a Pixabay or Pexels key here, then save it.' : 'Check the installed Bible database here.', action: 'point' }, false); }
    catch { setError('Open Settings to finish this setup, then return here.'); }
  };
  const returnFromSetup = () => {
    stop(); setSetup(null); setPaused(false); setError('');
    onNavigate(selected ? destinationFor(selected) ?? 'audio' : 'audio');
  };
  const followupResults = followup.trim() ? searchGuideTasks(followup).slice(0, 3) : [];
  const fieldDone = () => {
    if (current?.action === 'write') {
      const element = guideElement(current.target);
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) || !element.value.trim()) { setError('Add your words in the app field first.'); return; }
      if (current.field) setAnswers(value => ({ ...value, [current.field!]: element.value }));
    }
    stop(); advance();
  };

  return <>
    <button ref={trigger} type="button" className="tri-header-control product-guide-trigger" aria-label="Open Trilorah guide" title="Trilorah guide" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined} onClick={() => open ? close() : setOpen(true)}><span aria-hidden="true" className="product-guide-info">i</span><span className="product-guide-trigger-label">guide</span></button>
    {open && createPortal(<>
      {cursor.rect && cursor.visible && <div aria-hidden="true" className="product-guide-highlight" style={{ left: cursor.rect.left - 3, top: cursor.rect.top - 3, width: cursor.rect.width + 6, height: cursor.rect.height + 6 }} />}
      <div ref={cursor.cursor} aria-hidden="true" className="product-guide-cursor" data-visible={cursor.visible}>
        {cursor.pulse > 0 && <span key={cursor.pulse} className="product-guide-click" />}<Triangle /><span className="product-guide-cursor-name">trilorah</span>
      </div>
      {cursor.visible && walking && !setup && <div className="product-guide-subtitle" aria-live="polite" style={{ left: cursor.bubble.x, top: cursor.bubble.y }}><span>trilorah</span><p key={cursor.busy ? cursor.caption : current?.id}>{paused ? 'I’ll wait here.' : cursor.busy ? cursor.caption : current?.prompt ?? 'Ready when you are.'}</p></div>}
      {walking && demo && !complete && <section className="product-guide-demo" data-guide-demo data-typing-scope="local" aria-label="Microphone demo" data-dock={dock}>
        <div className="product-guide-demo-top"><span>microphone demo</span><span>simulated</span></div>
        <div className="product-guide-demo-controls"><button type="button" data-guide="demo-audio" aria-expanded={demoMenu} onClick={() => setDemoMenu(!demoMenu)}>audio <span>⌄</span></button>
          {demoMenu && <button type="button" data-guide="demo-input" className="product-guide-demo-option" onClick={() => { setDemoInput(true); setDemoMenu(false); }}>USB microphone <CheckIcon size={12} /></button>}
          <span {...(demoInput ? { 'data-guide': 'demo-selected' } : {})}>{demoInput ? 'USB microphone' : 'choose an input'}</span>
        </div>
        <div className="product-guide-demo-transcript">{demoSpoken ? <p data-guide="demo-transcript">“Welcome. It’s good to be here together.”</p> : <div className="product-guide-wave" data-listening={demoListening} aria-label={demoListening ? 'Demo listening' : 'Demo stopped'}>{[12, 22, 34, 18, 28, 42, 20, 32, 16, 26, 12].map((h, i) => <span key={i} style={{ height: h }} />)}</div>}</div>
        <div className="product-guide-demo-bottom"><button type="button" data-guide="demo-listen" aria-pressed={demoListening} onClick={() => setDemoListening(!demoListening)}>{demoListening ? 'listening' : 'start listening'}</button><button type="button" data-guide="demo-speech" disabled={!demoListening} onClick={() => setDemoSpoken(true)}>try a sentence</button></div>
      </section>}
      <aside ref={panel} id={dialogId} role="dialog" aria-modal="false" aria-label="Trilorah guide" data-typing-scope="local" className="product-guide-panel" data-dock={dock}>
        <header className="product-guide-header"><span className="product-guide-mark"><Triangle small /></span><h2>trilorah guide</h2><span className="product-guide-presence">{cursor.busy ? 'showing you' : paused ? 'paused' : 'with you'}</span>
          <button type="button" aria-label={`Move guide to the ${dock === 'right' ? 'left' : 'right'}`} title="Move guide" onClick={() => setDock(dock === 'right' ? 'left' : 'right')}>⇄</button><button type="button" aria-label="Close guide" onClick={close}><CloseIcon size={14} /></button>
        </header>
        <div className="product-guide-scroll">
          {!selected ? <>
            <h3>What shall we do?</h3>
            <form onSubmit={event => { event.preventDefault(); panel.current?.querySelector<HTMLButtonElement>('.product-guide-result')?.focus(); }}><label className="product-guide-search"><SearchIcon size={15} /><input ref={search} value={query} onChange={event => setQuery(event.target.value)} placeholder="Ask me anything about Trilorah…" aria-label="Ask the Trilorah guide" autoComplete="off" />{query && <button type="button" aria-label="Clear guide search" onClick={() => { setQuery(''); search.current?.focus(); }}><CloseIcon size={12} /></button>}</label></form>
            <div className="product-guide-results">{results.map(task => <button type="button" key={task.id} className="product-guide-result" onClick={() => choose(task)}><span>{shortTitle(task)}</span><ChevronRightIcon size={13} /></button>)}</div>
            {!results.length && <p className="product-guide-note">Try “microphone”, “song”, or “screen”.</p>}
            {!query && <button type="button" className="product-guide-browse" onClick={() => setAll(!all)}>{all ? 'back to essentials' : 'all topics'} <span>{all ? '↑' : '↗'}</span></button>}
          </> : <>
            <div className="product-guide-breadcrumb"><button type="button" onClick={back}>← {walking ? shortTitle(selected) : 'all guides'}</button>{walking && <span>{Math.min(step + 1, steps.length)} / {steps.length}</span>}</div>
            {!walking ? <>
              <h3 tabIndex={-1}>{shortTitle(selected)}</h3>
              {walkthroughFor(selected).length ? <><p className="product-guide-caption">How would you like to try it?</p><div className="product-guide-choices"><button type="button" className="product-guide-primary" onClick={() => begin(false)}>Show me <Triangle small /></button><button type="button" onClick={() => begin(false, true)}>I’ll do it</button></div>{microphoneTask(selected) && <button type="button" className="product-guide-demo-link" onClick={() => begin(true)}>▷ watch a demo <span>no microphone needed</span></button>}</> : selected.status !== 'wired' ? <p className="product-guide-caption">This walkthrough is still being prepared.</p> : <><p className="product-guide-caption">{selected.entry.replace(/;.*$/, '')}</p>{destinationFor(selected) && <div className="product-guide-choices"><button type="button" className="product-guide-primary" onClick={() => void locate()} disabled={cursor.busy}>{located ? 'Show me again' : 'Take me there'} <Triangle small /></button></div>}<details className="product-guide-details"><summary>quick steps</summary><ul>{selected.controls.map((control, i) => <li key={i}>{control}</li>)}</ul></details></>}
            </> : setup ? <>
              <h3 tabIndex={-1}>{setupReady ? 'Ready to continue?' : setup === 'stock' ? 'Let’s connect image search.' : 'Your Bible library needs attention.'}</h3>
              <p className="product-guide-caption">{setupReady ? 'Your setup is available. Let’s return to where we left off.' : setup === 'stock' ? setupOpen ? 'Paste either provider’s key in Settings and save. I’ll keep your search ready.' : 'There’s no Pixabay or Pexels key on this computer yet.' : 'Trilorah couldn’t find its Bible database. Check Language & Bible in Settings.'}</p>
              <div className="product-guide-choices"><button type="button" className="product-guide-primary" onClick={() => setupReady ? returnFromSetup() : void openSetup()}>{setupReady ? 'Continue my task' : setupOpen ? 'Point me there' : 'Set it up'} <Triangle small /></button><button type="button" onClick={back}>Another task</button></div>
              {setup === 'stock' && <div className="product-guide-suggestions"><button type="button" onClick={() => choose(guideTasks.find(task => task.id === 'media.import-preview-local')!)}>Use a local picture</button></div>}
            </> : complete ? <><span className="product-guide-complete"><CheckIcon size={18} /></span><h3 tabIndex={-1}>{demo ? 'That’s how it works.' : microphoneTask(selected) ? 'I can hear you.' : 'You’re in the right place.'}</h3><p className="product-guide-caption">{demo ? 'Ready to try your real microphone?' : microphoneTask(selected) ? 'Sound and new words arrived. Check that the words are right.' : selected.id === 'songs.create-edit-slides' ? 'Add your words, then arrange your slides.' : selected.id === 'run.build-edit' ? 'Review your run before rehearsing. Programme text is only added when you press Add to run.' : selected.id.startsWith('outputs.') ? 'Check the physical screen before your service.' : 'Take it from here. I’m a click away.'}</p><div className="product-guide-choices"><button type="button" className="product-guide-primary" onClick={() => demo ? begin(false) : back()}>{demo ? 'Try in the app' : 'What’s next?'} <ChevronRightIcon size={14} /></button><button type="button" onClick={() => demo ? begin(true) : close()}>{demo ? 'Replay' : 'Done'}</button></div></> : <>
              <div className="product-guide-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>{steps.map((s, n) => <span key={s.id} data-done={step > n} data-current={step === n} />)}</div>
              <h3 tabIndex={-1}>{paused ? 'Your turn. I’ll wait.' : current.title}</h3>
              <p className="product-guide-caption" aria-live="polite">{paused ? 'Pick up where we left off whenever you’re ready.' : current.prompt}</p>
              {!demo && current.field && !paused && <div className="product-guide-draft"><label htmlFor={`${dialogId}-words`}>{current.field === 'programme' ? 'your programme · example below' : current.field === 'reference' ? 'Bible reference' : current.field === 'search' ? 'search words' : 'your words'}</label><textarea id={`${dialogId}-words`} rows={current.field === 'programme' || current.field === 'lyrics' ? 4 : 2} value={answers[current.field]} onChange={event => setAnswers(value => ({ ...value, [current.field!]: event.target.value.slice(0, 12000) }))} disabled={cursor.busy} placeholder="Write what you’d like me to type…" />{current.field === 'search' && <div className="product-guide-suggestions">{['mountains at sunrise', 'open Bible', 'calm ocean'].map(text => <button type="button" key={text} disabled={cursor.busy} onClick={() => setAnswers(value => ({ ...value, search: text }))}>{text}</button>)}</div>}</div>}
              {!demo && current.id.startsWith('outputs-') && externalDisplay === false && <p className="product-guide-note">I don’t see an external screen yet. Connect it, then reopen the display picker.</p>}
              {!demo && current.id === 'stock-pick' && ['loading', 'empty', 'error'].includes(stockState) && <p className="product-guide-note">{stockState === 'loading' ? 'Images are loading…' : stockState === 'empty' ? 'Nothing found. Try a simpler subject.' : 'Search couldn’t load. Check the provider message.'} {stockState !== 'loading' && <button type="button" onClick={() => { stop(); setStep(1); setError(''); }}>Change search</button>}</p>}
              {!demo && current.action === 'input' && <div className="product-guide-input">{practice ? 'Practice input selected' : typeof input === 'string' && input ? input : 'System default'}</div>}
              {!demo && current.action === 'check' && <div className="product-guide-checks"><span data-ok={signal}>{signal ? <CheckIcon size={12} /> : '○'} sound</span><span data-ok={freshText}>{freshText ? <CheckIcon size={12} /> : '○'} words</span></div>}
              {!demo && microphoneTask(selected) && !bridge && <p className="product-guide-note">Open the desktop app to use a real microphone.</p>}
              {!demo && microphoneTask(selected) && practice && <p className="product-guide-note">Choose a real input to check your microphone.</p>}
              {!demo && microphoneTask(selected) && status === 'error' && <p role="alert" className="product-guide-note">{detail || 'Check your microphone permission and speech service.'}</p>}
              {paused ? <div className="product-guide-choices"><button type="button" className="product-guide-primary" onClick={resumeGuide}>Continue <ChevronRightIcon size={14} /></button></div> : !demo && <div className="product-guide-choices">
                {['click', 'focus', 'write'].includes(current.action) ? <><button type="button" className="product-guide-primary" disabled={cursor.busy} onClick={() => void showStep(true)}>{cursor.busy ? 'Showing you…' : current.action === 'write' ? 'Type this for me' : manual ? 'Do it for me' : 'Show me'} <Triangle small /></button><button type="button" disabled={cursor.busy} onClick={() => void showStep(false)}>{manual ? 'Point again' : 'I’ll do it'}</button>{current.action === 'write' && <button type="button" onClick={fieldDone} disabled={cursor.busy}>I’ve entered it</button>}</> : current.action === 'choose' ? <><button type="button" className="product-guide-primary" onClick={() => void showStep(false)} disabled={cursor.busy}>Show me where <Triangle small /></button><button type="button" onClick={fieldDone}>I’m ready to continue</button></> : current.action === 'input' ? <><button type="button" className="product-guide-primary" disabled={practice || !bridge} onClick={() => { pickedInput.current = false; advance(); }}>Use this input <ChevronRightIcon size={14} /></button><button type="button" onClick={() => { stop(); setStep(0); }}>Choose another</button></> : current.action === 'listen' ? <button type="button" onClick={() => void showStep(false)} disabled={cursor.busy}>Point me there <Triangle small /></button> : <button type="button" onClick={() => { stop(); setStep(0); setPaused(false); }}>Check my input</button>}
              </div>}
              {manual && !cursor.busy && !error && <p className="product-guide-note">Your click. I’ll follow along.</p>}
            </>}
            {!setup && <div className="product-guide-followup"><button type="button" className="product-guide-browse" onClick={() => setFollowupOpen(!followupOpen)}>{followupOpen ? 'Close follow-up' : 'Something else? Ask me'} <span>↗</span></button>{followupOpen && <><input aria-label="Guide follow-up" placeholder="e.g. connect a screen…" value={followup} onChange={event => setFollowup(event.target.value)} /><div className="product-guide-results">{followupResults.map(task => <button type="button" className="product-guide-result" key={task.id} onClick={() => choose(task)}>{shortTitle(task)}<ChevronRightIcon size={12} /></button>)}</div>{followup && !followupResults.length && <p className="product-guide-note">Try naming what you want to do: find an image, add a song, or prepare a service.</p>}</>}</div>}
            {error && <div role="alert" className="product-guide-note">{error}{demo && <button type="button" className="product-guide-retry" onClick={resumeGuide}>Try again</button>}</div>}
          </>}
        </div>
        {walking && <footer className="product-guide-footer"><button type="button" disabled={!voiceSupported} aria-pressed={voice} onClick={() => setVoice(!voice)}>{voice ? 'voice on' : 'voice off'}</button><span>{demo ? 'demo' : 'in your app'}</span>{!complete && <button type="button" onClick={() => paused ? resumeGuide() : pauseGuide()}>{paused ? 'resume' : 'pause'}</button>}<button type="button" onClick={() => { stop(); setWalking(false); }}>end</button></footer>}
        <span className="product-guide-map" title={`Source map ${mapRevision} · refreshed on builds and app code changes`}>app map · {mapRevision.slice(0, 6)}</span>
      </aside>
    </>, document.body)}
  </>;
}
