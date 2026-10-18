import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  Button, cx, ScriptureReferenceInput, type ResolvedReference,
  ArrowIcon, BookIcon, CheckIcon, ClockIcon, HistoryIcon, InfoIcon, MicIcon, PlusIcon, UndoIcon, WarningIcon,
} from '../../../ui';
import { Panel } from '../parts';
import { refreshPreacher, usePreachers, type Preacher } from './preachers';
import { BOOKS, CHAPTER_COUNTS } from '../../../lib/books';
import { hasOpenTypingInteraction, ownsTextInput } from '../../../lib/operatorTyping';
import { useAppStore } from '../../../stores/appStore';
import { parts } from '../../../../shared/referenceParts';
import './catchReview.css';

/*
 * Check catches — the review queue, one question at a time.
 *
 * "They said this, Trilorah showed that — was it right?" and the answer
 * moves straight on to the next one. Only the pair of words moves between
 * catches; the answer buttons stay exactly where they are, so the next press
 * (or key) lands in the same place.
 *
 * Answers are held for five seconds before they are sent. The engine cannot
 * take one back — it counts at once, and a "not a verse" can even switch auto
 * mode off — and single-key shortcuts make a slip easy, so the last answer
 * can be undone until it goes. Answering the next catch sends the previous
 * one straight away; leaving the tab sends it too.
 *
 * The catch on screen is pinned. A missed verse added below, or the page's
 * ten-second refresh, can re-sort the queue; neither may swap the question
 * out from under someone who is reading it.
 */

const HOLD_MS = 5000;
/* A catch ignores keys for its first moments, so a double press of Y answers
   one catch, not two. */
const ARM_MS = 350;
const BOOK_DATA = BOOKS.map((name, i) => ({ name, chapters: CHAPTER_COUNTS[i] }));
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const UNDO_KEYS = IS_MAC ? '⌘Z' : 'Ctrl Z';

const errorText = (e: unknown) => e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Could not save that answer. Try again.';
const refText = (r: VerseRef | null | undefined) => r ? `${r.book} ${r.chapter}${r.verse ? `:${r.verse}` : ''}` : null;
const when = (ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const sortReviews = (list: readonly ReviewItem[]) =>
  [...list].sort((a, b) => Number(b.reason !== 'detected') - Number(a.reason !== 'detected') || b.ts - a.ts);
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Verse counts per chapter, so the reference field can refuse a verse that is not there. */
const VERSE_COUNTS = new Map<string, number>();

interface Held {
  item: ReviewItem;
  resolution: ReviewResolution;
  amended?: VerseRef;
  preacherId: string;
  timer: number;
  /** Sent, or taken back. Either way it is finished with. */
  settled: boolean;
}

const UNDO_TEXT: Record<ReviewResolution, (h: Held) => string> = {
  confirmed: (h) => `Marked right: ${refText(h.item.proposed) ?? 'that catch'}.`,
  amended: (h) => `Saved: it was ${refText(h.amended) ?? 'that verse'}.`,
  rejected: () => 'Marked as not a verse.',
  skipped: () => 'Skipped. It won’t count either way.',
};

const Kbd = ({ k }: { k: string }) => <kbd className="cr-kbd" aria-hidden>{k}</kbd>;

export function CatchReview({ p }: { p: Preacher }) {
  const { activeId } = usePreachers();
  const api = typeof window === 'undefined' ? undefined : window.api;
  const canAnswer = !!api?.resolveReviewItem;
  const reviewList = p.learning?.reviews;
  const reviews = useMemo(() => sortReviews((reviewList ?? []) as ReviewItem[]), [reviewList]);

  /* Everything answered this visit, in the order it was answered: the
     progress track and the tally are drawn from it. */
  const [answered, setAnswered] = useState<ReadonlyMap<string, ReviewResolution>>(() => new Map());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const heldRef = useRef<Held | null>(null);
  const [fixFor, setFixFor] = useState<string | null>(null);
  const [preview, setPreview] = useState<VerseRef | null>(null);
  const [error, setError] = useState('');
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const refInput = useRef<{ focus: () => boolean } | null>(null);
  const setRefHandle = useCallback((h: { focus: () => boolean } | null) => { refInput.current = h; }, []);
  const mounted = useRef(true);
  const armedAt = useRef(0);
  const focusAfter = useRef(false);
  const keysId = useId();

  const queue = reviews.filter((r) => !answered.has(r.id));
  const item = queue.find((r) => r.id === currentId) ?? queue[0];
  useEffect(() => { if (item && item.id !== currentId) setCurrentId(item.id); }, [item, currentId]);

  const isMiss = item?.kind === 'miss';
  const fixing = !!item && (isMiss || fixFor === item.id);
  const done = !item && answered.size > 0;
  const total = answered.size + queue.length;
  const position = answered.size + 1;
  const serviceOpen = p.id === activeId && !!p.learning?.serviceOpen;
  /* A service opens at its first catch, so "open" is true all through the
     sermon. Finishing it stops listening, so the finish banner only shows
     once listening has stopped; while it runs, catches land here live. */
  const asrStatus = useAppStore((s) => s.asrStatus);
  const listening = asrStatus === 'listening' || asrStatus === 'connecting';
  const showFinish = serviceOpen && !listening;

  /* -------- sending -------- */

  const send = useCallback((h: Held) => {
    if (h.settled) return;
    h.settled = true;
    window.clearTimeout(h.timer);
    if (heldRef.current === h) {
      heldRef.current = null;
      if (mounted.current) setHeld(null);
    }
    void (async () => {
      try {
        await window.api!.resolveReviewItem!(h.item.id, h.resolution, h.amended);
      } catch (e) {
        const text = errorText(e);
        /* Already answered somewhere else is still answered. */
        if (!/already reviewed|no longer available/i.test(text) && mounted.current) {
          setAnswered((m) => { const n = new Map(m); n.delete(h.item.id); return n; });
          setError(`Couldn’t save your answer for ${refText(h.item.proposed) ?? 'that catch'}, so it’s back in the queue. ${text}`);
        }
      }
      await refreshPreacher(h.preacherId).catch(() => undefined);
    })();
  }, []);

  /* Leaving the tab, switching preacher or closing the window sends what is held. */
  useEffect(() => {
    mounted.current = true;
    const leave = () => { if (heldRef.current) send(heldRef.current); };
    window.addEventListener('beforeunload', leave);
    return () => { mounted.current = false; window.removeEventListener('beforeunload', leave); leave(); };
  }, [send]);

  const answer = (target: ReviewItem, resolution: ReviewResolution, amended?: VerseRef) => {
    if (!canAnswer) { setError('Open the desktop app to check catches.'); return; }
    if (heldRef.current) send(heldRef.current);
    const active = document.activeElement;
    focusAfter.current = active === document.body || !!cardRef.current?.contains(active);
    const next = queue.find((r) => r.id !== target.id);
    setAnswered((m) => new Map(m).set(target.id, resolution));
    setCurrentId(next?.id ?? null);
    setFixFor(null); setPreview(null); setDir('fwd'); setError('');
    const h: Held = { item: target, resolution, amended, preacherId: p.id, timer: 0, settled: false };
    h.timer = window.setTimeout(() => send(h), HOLD_MS);
    heldRef.current = h;
    setHeld(h);
  };

  const undo = () => {
    const h = heldRef.current;
    if (!h || h.settled) return;
    h.settled = true;
    window.clearTimeout(h.timer);
    heldRef.current = null;
    setHeld(null);
    const active = document.activeElement;
    focusAfter.current = active === document.body || !!cardRef.current?.contains(active);
    setAnswered((m) => { const n = new Map(m); n.delete(h.item.id); return n; });
    setCurrentId(h.item.id);
    setFixFor(null); setPreview(null); setDir('back'); setError('');
  };

  /* -------- the slide between catches -------- */

  /* The catch that just left stays on screen for a moment, sliding out as
     the next slides in, rather than the words blinking from one to the other. */
  const [prevItem, setPrevItem] = useState<ReviewItem | undefined>(item);
  const [leaving, setLeaving] = useState<{ item: ReviewItem; amended?: VerseRef; dir: 'fwd' | 'back' } | null>(null);
  if (prevItem?.id !== item?.id) {
    setPrevItem(item);
    setLeaving(prevItem && item ? { item: prevItem, amended: held?.item.id === prevItem.id ? held.amended : undefined, dir } : null);
  }
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(null), 220);
    return () => window.clearTimeout(t);
  }, [leaving]);

  /* A new catch: arm the keys, and keep focus somewhere sensible. If the
     button that was pressed is gone (a miss has no "yes", and the last
     answer swaps the buttons for the tally), the title takes focus, so a
     screen reader reads the new question or "All checked" and Tab still works. */
  useEffect(() => {
    armedAt.current = performance.now();
    if (!(item || done) || !focusAfter.current) return;
    focusAfter.current = false;
    if (document.activeElement === document.body) titleRef.current?.focus({ preventScroll: true });
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Into the reference field when fixing starts; back to "no, it was…" when
     it ends — but only from inside this card, never out of the miss field. */
  const wasFixing = useRef(fixing);
  useEffect(() => {
    const before = wasFixing.current;
    wasFixing.current = fixing;
    const active = document.activeElement;
    const ours = active === document.body || !!cardRef.current?.contains(active);
    if (!ours) return;
    if (fixing) requestAnimationFrame(() => refInput.current?.focus());
    else if (before && active === document.body) cardRef.current?.querySelector<HTMLElement>('[data-guide="learning-wrong"]')?.focus({ preventScroll: true });
  }, [fixing, item?.id]);

  /* -------- keys -------- */

  const echo = (guide: string) => {
    if (reducedMotion()) return;
    cardRef.current?.querySelector<HTMLElement>(`[data-guide="${guide}"]`)?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1)' }],
      { duration: 160, easing: 'cubic-bezier(.23,1,.32,1)' },
    );
  };

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const key = e.key.toLowerCase();
      if (key !== 'y' && key !== 'n' && key !== 'x' && key !== 's') return;
      const target = e.target instanceof Element ? e.target : null;
      if (ownsTextInput(target) || hasOpenTypingInteraction(document)) return;
      if (!(target === document.body || target === document.documentElement || (target && rootRef.current?.contains(target)))) return;
      if (!cardRef.current?.offsetParent || performance.now() - armedAt.current < ARM_MS) return;
      if (fixing && !(isMiss && key === 's')) return;
      const proposed = !!item.proposed;
      if ((key === 'y' || key === 'x') && !proposed) return;
      e.preventDefault();
      if (key === 'y') { echo('learning-correct'); answer(item, 'confirmed'); }
      else if (key === 'x') { echo('learning-reject'); answer(item, 'rejected'); }
      else if (key === 's') { echo('learning-skip'); answer(item, 'skipped'); }
      else { echo('learning-wrong'); setFixFor(item.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!held) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      if (IS_MAC ? !e.metaKey || e.ctrlKey : !e.ctrlKey || e.metaKey) return;
      if (ownsTextInput(e.target instanceof Element ? e.target : null) || hasOpenTypingInteraction(document)) return;
      if (!cardRef.current?.offsetParent) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* -------- finishing an open service -------- */

  const finish = async () => {
    if (!api?.endService) return;
    setFinishing(true); setFinishError('');
    try {
      const result = await api.endService({ preacherId: p.id, preacherName: p.name });
      if (!result.success) throw new Error(result.error ?? 'Could not finish the service.');
      await refreshPreacher(p.id);
    } catch (e) { setFinishError(errorText(e)); } finally { setFinishing(false); }
  };

  /* -------- what the card says -------- */

  let tone: 'neutral' | 'mint' | 'gold' | 'rose' = 'neutral';
  let icon: ReactNode = <BookIcon size={15} />;
  let title: string;
  let meta: string;
  if (item) {
    const date = when(item.ts);
    if (isMiss) {
      tone = 'rose'; icon = <PlusIcon size={15} />; title = 'Which verse was it?';
      meta = `${date} · You added this because nothing went up.`;
    } else if (item.reason === 'operator-change') {
      tone = 'gold'; icon = <HistoryIcon size={15} />; title = 'Was this right?';
      meta = `${date} · You changed this one during the service, so it may have been a new passage, not a mistake.`;
    } else {
      title = item.proposed ? 'Was this right?' : 'Was there a verse here?';
      meta = `${date} · Caught during the service.`;
    }
  } else if (done) {
    tone = 'mint'; icon = <CheckIcon size={15} />; title = 'All checked';
    meta = `You checked ${answered.size} ${answered.size === 1 ? 'catch' : 'catches'}. The readiness checks on the summary are up to date.`;
  } else {
    tone = 'mint'; icon = <CheckIcon size={15} />;
    title = !canAnswer ? 'Nothing to check' : serviceOpen ? 'Nothing to check yet' : 'Nothing to check right now';
    meta = !canAnswer ? 'Open the desktop app to check real catches.'
      : serviceOpen ? 'Catches from today’s service arrive here as they happen.'
        : `Every verse Trilorah puts up for ${p.name} waits here. Your yes or no is what teaches it.`;
  }

  const tally = { confirmed: 0, amended: 0, rejected: 0, skipped: 0 } as Record<ReviewResolution, number>;
  for (const r of answered.values()) tally[r]++;

  return (
    <div className="cr" data-guide-area="learning" ref={rootRef}>
      {showFinish && (
        <div className="cr-banner">
          <span className="cr-banner-ico" aria-hidden><ClockIcon size={14} /></span>
          <p className="cr-banner-text">
            <b>A service is still open for {p.name}.</b>
            <span className={cx(finishError && 'cr-banner-error')}>{finishError || 'Listening has stopped. Finish it to save the service to their profile.'}</span>
          </p>
          <Button guideId="learning-finish" tone="gold" label={finishing ? 'finishing…' : 'finish service'} disabled={finishing || !api?.endService} onClick={() => void finish()} />
        </div>
      )}

      {/* The same card header as every other tab: the question is content. */}
      <Panel title="check catches" icon={<CheckIcon size={13} />} className="shrink-0" blurb={meta}
        right={item ? <span className="cr-pos" aria-hidden><b>{position}</b> of {total}</span> : undefined}
        bodyStyle={{ padding: 0 }}>
        <section ref={cardRef} className={cx('cr-card', !item && !done && 'cr-card--empty')} aria-labelledby={`${keysId}-title`}>
          <div className="cr-head">
            <span key={`${tone}-${done}`} className={cx('cr-ico', `cr-ico--${tone}`, done && 'cr-ico--pop')} aria-hidden>{icon}</span>
            <h3 ref={titleRef} id={`${keysId}-title`} tabIndex={-1}>{title}</h3>
          </div>

          {item && <Progress answered={answered} total={total} />}

          <p className="sr-only" aria-live="polite">
            {item ? `Catch ${position} of ${total}. ${p.name} said: ${item.heard || 'no words were kept'}. Trilorah showed ${refText(item.proposed) ?? 'nothing'}.`
              : done ? 'All checked.' : ''}
          </p>

          {item ? <>
            <div className="cr-stage">
              {leaving && (
                <div key={`out-${leaving.item.id}`} className="cr-slide cr-slide--out" data-dir={leaving.dir} aria-hidden inert>
                  <Pair item={leaving.item} name={p.name} fixing={!!leaving.amended} preview={leaving.amended ?? null} />
                </div>
              )}
              <div key={item.id} className="cr-slide cr-slide--in" data-dir={dir}>
                <Pair item={item} name={p.name} fixing={fixing} preview={preview} />
              </div>
            </div>

            {fixing ? (
              <FixRow key={`fix-${item.id}`} item={item} inputRef={setRefHandle} onPreview={setPreview}
                onSave={(ref) => answer(item, 'amended', ref)}
                onBack={() => { setFixFor(null); setPreview(null); }}
                onSkip={() => answer(item, 'skipped')} />
            ) : (
              <div className="cr-actions" role="group" aria-label="Your answer" aria-describedby={keysId}>
                {item.proposed && <Button guideId="learning-correct" tone="go" icon={<Kbd k="Y" />} label="yes, that’s right"
                  title="Yes, that’s right (Y)" onClick={() => answer(item, 'confirmed')} />}
                <Button guideId="learning-wrong" icon={<Kbd k="N" />} label={item.proposed ? 'no, it was…' : 'it was…'}
                  title={item.proposed ? 'No, it was… (N)' : 'It was… (N)'} onClick={() => setFixFor(item.id)} />
                {item.proposed && <Button guideId="learning-reject" icon={<Kbd k="X" />} label="not a verse"
                  title="Not a verse (X)" onClick={() => answer(item, 'rejected')} />}
                <button type="button" className="cr-quiet" data-guide="learning-skip" title="Can’t tell (S)" onClick={() => answer(item, 'skipped')}>
                  can’t tell<Kbd k="S" />
                </button>
                <span id={keysId} className="sr-only">Keyboard: Y for yes, N to give the right verse, X for not a verse, S for can’t tell.</span>
              </div>
            )}
          </> : done ? (
            <ul className="cr-tally" aria-label="What you answered">
              {([['confirmed', 'right', 'mint'], ['amended', 'fixed', 'gold'], ['rejected', 'not a verse', 'rose'], ['skipped', 'can’t tell', 'faint']] as const).map(([k, label, t], i) => (
                <li key={k} className={cx(`cr-tally--${t}`, !tally[k] && 'cr-tally--zero')} style={{ animationDelay: `${60 + i * 40}ms` }}>
                  <b>{tally[k]}</b><span>{label}</span>
                </li>
              ))}
            </ul>
          ) : <>
            {/* How catches get here, for the first visit and every empty one. */}
            <ol className="cr-how" aria-label="How catches arrive">
              <li>
                <span className="cr-ico cr-ico--neutral" aria-hidden><MicIcon size={14} /></span>
                <h4>{p.name} preaches</h4>
                <p>Set them for today and start listening. Trilorah follows along as they speak.</p>
              </li>
              <li>
                <span className="cr-seam" aria-hidden><ArrowIcon size={11} /></span>
                <span className="cr-ico cr-ico--neutral" aria-hidden><BookIcon size={14} /></span>
                <h4>Verses come up</h4>
                <p>Each verse it hears waits in the preview. Nothing goes on screen until someone presses it.</p>
              </li>
              <li>
                <span className="cr-seam" aria-hidden><ArrowIcon size={11} /></span>
                <span className="cr-ico cr-ico--mint" aria-hidden><CheckIcon size={14} /></span>
                <h4>You check them here</h4>
                <p>Each catch waits here for a quick yes or no, whenever you have a moment. Every answer teaches it.</p>
              </li>
            </ol>
            <p className="cr-footnote"><InfoIcon size={12} />Nothing waiting doesn’t mean nothing was missed. If a verse never went up, add it below.</p>
          </>}

          {(item || done) && (
            <footer className="cr-foot">
              {error ? (
                <p key="error" role="alert" className="cr-foot-error"><WarningIcon size={12} /><span>{error}</span></p>
              ) : held ? (
                <p key={`held-${held.item.id}`} className="cr-foot-held">
                  <span className="cr-hold" aria-hidden />
                  <CheckIcon size={12} />
                  <span className="min-w-0 truncate">{UNDO_TEXT[held.resolution](held)}</span>
                  <button type="button" className="cr-undo" data-guide="learning-undo" onClick={undo}><UndoIcon size={12} />undo</button>
                  <Kbd k={UNDO_KEYS} />
                </p>
              ) : (
                <p key="idle" className="cr-foot-idle">Each answer teaches Trilorah how {p.name} speaks. A skipped catch counts for nothing either way.</p>
              )}
            </footer>
          )}
        </section>
      </Panel>

      <MissedVerse p={p} hasQuestion={!!item} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** One segment per catch this visit, coloured by the answer — the same
    language as voice training's progress. A long queue becomes one bar. */
function Progress({ answered, total }: { answered: ReadonlyMap<string, ReviewResolution>; total: number }) {
  const done = [...answered.values()];
  if (total > 20) {
    return <div className="cr-progress" aria-hidden><span className="cr-bar"><span style={{ transform: `scaleX(${total ? done.length / total : 0})` }} /></span></div>;
  }
  return (
    <div className="cr-progress" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cx('cr-seg', i < done.length ? `cr-seg--${done[i]}` : i === done.length && 'cr-seg--now')} />
      ))}
    </div>
  );
}

/** What they said, and what went up — or, while fixing, what it should have been. */
function Pair({ item, name, fixing, preview }: { item: ReviewItem; name: string; fixing: boolean; preview: VerseRef | null }) {
  const shown = refText(item.proposed);
  const saidRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  /* The right-hand side only animates when the mode changes, not on arrival
     (the whole pair is already sliding in then). */
  const lastMode = useRef(fixing);
  const changed = useRef(false);
  if (lastMode.current !== fixing) { lastMode.current = fixing; changed.current = true; }
  const morph = changed.current;

  useLayoutEffect(() => {
    const el = saidRef.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [item.heard, open]);

  return (
    <div className="cr-pair">
      <div className="cr-said-cell">
        <p className="cr-label">{name} said</p>
        {item.heard
          ? <p ref={saidRef} className={cx('cr-said', open && 'cr-said--open')}>“{item.heard}”</p>
          : <p className="cr-said cr-said--none">No words were kept for this one.</p>}
        {(overflows || open) && (
          <button type="button" className="cr-more" data-guide="learning-show-all" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Show less' : 'Show all'}
          </button>
        )}
      </div>
      <div className="cr-shown-cell">
        <span className="cr-seam" aria-hidden><ArrowIcon size={11} /></span>
        {fixing ? (
          <div key="fix" className={cx(morph && 'cr-morph')}>
            <p className="cr-label">It was</p>
            {shown ? <p className="cr-struck">Not {shown}</p> : item.kind === 'miss' && <p className="cr-struck cr-struck--plain">Nothing went up</p>}
            {preview
              ? <p key={refText(preview)} className="cr-shown cr-shown--fix">{refText(preview)}</p>
              : <p className="cr-shown cr-shown--none cr-shown--wait">Type it below</p>}
          </div>
        ) : (
          <div key="shown" className={cx(morph && 'cr-morph')}>
            <p className="cr-label">Trilorah showed</p>
            <p className={cx('cr-shown', !shown && 'cr-shown--none')}>{shown ?? 'Nothing went up'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "No, it was…" — the app's own reference field, which will not take a
 * keystroke that cannot lead to a real verse, so there is no "write it like
 * 1 John 4:8" error to show. Save needs at least a chapter.
 */
function FixRow({ item, inputRef, onPreview, onSave, onBack, onSkip }: {
  item: ReviewItem;
  inputRef: (h: { focus: () => boolean } | null) => void;
  onPreview: (ref: VerseRef | null) => void;
  onSave: (ref: VerseRef) => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [text, setText] = useState('');
  const [ref, setRef] = useState<ResolvedReference | null>(null);
  const [, setCounted] = useState(0);
  const miss = item.kind === 'miss';
  const complete = ref && (parts(text).chapter ?? '') !== '' ? ref : null;
  const answerRef = complete ? { book: complete.book, chapter: complete.chapter, verse: complete.verse } : null;

  useEffect(() => { onPreview(answerRef); }, [answerRef?.book, answerRef?.chapter, answerRef?.verse]); // eslint-disable-line react-hooks/exhaustive-deps

  const onReference = (r: ResolvedReference | null) => {
    setRef(r);
    const key = r && `${r.bookIndex}:${r.chapter}`;
    if (!r || !key || VERSE_COUNTS.has(key) || !window.api?.getChapter) return;
    window.api.getChapter(r.bookIndex, r.chapter).then((res) => {
      if (res.success && res.data?.length) { VERSE_COUNTS.set(key, res.data.length); setCounted((n) => n + 1); }
    }).catch(() => undefined);
  };

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape' && !e.defaultPrevented && !miss) { e.preventDefault(); onBack(); }
  };

  return (
    <div className="cr-fix" onKeyDown={onKey}>
      <label className="cr-ref">
        <span className="sr-only">{miss ? 'The verse they meant' : 'The right Bible reference'}</span>
        <ScriptureReferenceInput
          ref={inputRef}
          books={BOOK_DATA}
          versesInChapter={(bi, ch) => VERSE_COUNTS.get(`${bi}:${ch}`)}
          guideId="learning-reference"
          placeholder={miss ? 'the verse they meant, like romans 8:28' : 'the right verse, like 1 john 4:8'}
          onChange={setText}
          onReferenceChange={onReference}
          onSubmit={(r) => { if ((parts(text).chapter ?? '') !== '') onSave({ book: r.book, chapter: r.chapter, verse: r.verse }); }}
          className="cr-refinput"
        />
      </label>
      <Button guideId="learning-save" tone="go" icon={<Kbd k="↵" />} label="save" title="Save (Enter)"
        disabled={!answerRef} onClick={() => answerRef && onSave(answerRef)} />
      {miss
        ? <button type="button" className="cr-quiet" data-guide="learning-skip" title="Can’t tell" onClick={onSkip}>can’t tell</button>
        : <Button guideId="learning-fix-cancel" icon={<Kbd k="esc" />} label="back" title="Back (Esc)" onClick={onBack} />}
    </div>
  );
}

/** Its own card: a verse that never went up, typed as it was said. */
function MissedVerse({ p, hasQuestion }: { p: Preacher; hasQuestion: boolean }) {
  const api = typeof window === 'undefined' ? undefined : window.api;
  const [miss, setMiss] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!note?.ok) return;
    const t = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(t);
  }, [note]);

  const add = async () => {
    const text = miss.trim();
    if (!text || busy || !api?.addMissedReference) return;
    setBusy(true); setNote(null);
    try {
      await api.addMissedReference(p.id, text);
      setMiss('');
      setNote({ ok: true, text: hasQuestion ? 'Added. It’s next in the queue.' : 'Added. Say which verse it was above.' });
      await refreshPreacher(p.id).catch(() => undefined);
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally { setBusy(false); }
  };

  return (
    <Panel title="missed a verse?" icon={<PlusIcon size={13} />}
      blurb={`If ${p.name} gave a reference and nothing went up, type what they said. It joins the queue so you can tell Trilorah which verse it was.`}
      bodyStyle={{ padding: '4px 16px 16px' }}>
      <form className="cr-miss" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <div className="cr-miss-row">
          <input id="cr-miss-input" data-guide="learning-miss" className="cr-field" value={miss} maxLength={1200}
            aria-label="What they said" aria-describedby="cr-miss-note" autoComplete="off"
            placeholder="turn with me to first john four eight"
            onChange={(e) => { setMiss(e.target.value); if (note && !note.ok) setNote(null); }} />
          <Button guideId="learning-miss-add" type="submit" icon={<PlusIcon size={11} />} label={busy ? 'adding…' : 'add to queue'}
            disabled={busy || !api?.addMissedReference || !miss.trim()} />
        </div>
        <p id="cr-miss-note" role="status"
          className={cx('cr-miss-note', note?.ok && 'cr-miss-note--ok', note && !note.ok && 'cr-miss-note--error')}>
          {note ? <>{note.ok ? <CheckIcon size={12} /> : <WarningIcon size={12} />}<span key={note.text}>{note.text}</span></>
            : 'Write it the way they said it, words and all.'}
        </p>
      </form>
    </Panel>
  );
}
