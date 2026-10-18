import { useAppStore } from '../../stores/appStore';
import { useState, type ReactNode } from 'react';
import { BookmarkIcon, Button, ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlayIcon, cx } from '../../ui';
import { useEngine } from './engine';
import { useRun } from './run';
import { useProjector, type LiveItem } from './projector';
import { rememberScripture, recallScripture, useScriptureMemoryStore, type RememberedScripture } from '../../stores/scriptureMemoryStore';
import { useAutoAdvanceStore } from '../../stores/autoAdvanceStore';
import { verseToText } from '../../lib/scriptureText';
import './scriptureTools.css';

export function SaveScriptureButton({ item, compact = false }: { item: LiveItem; compact?: boolean }) {
  const run = useRun();
  const entry = rememberScripture(item);
  const saved = useScriptureMemoryStore(state => state.saved.some(old => old.key === entry?.key));
  const toggle = useScriptureMemoryStore(state => state.toggleSaved);
  if (!entry) return null;
  return <button type="button" className="scripture-save" aria-pressed={saved}
    aria-label={`${saved ? 'Unsave' : 'Save'} ${entry.reference}, ${entry.version}`}
    title={saved ? `Remove ${entry.reference} from saved scriptures` : `Save ${entry.reference} and add it to this service`}
    onClick={event => { event.stopPropagation();
      if (!saved && !run.segments.some(segment => segment.items.some(queued => queued.source === 'scripture' && queued.label === entry.reference))) {
        run.dropInto(null, [{ source: 'scripture', label: entry.reference, quote: entry.text }]);
      }
      toggle(entry); }}>
    <BookmarkIcon size={13} selected={saved} />{!compact && (saved ? 'saved' : 'save')}
  </button>;
}

export function ScriptureTools({ children }: { children: ReactNode }) {
  const engine = useEngine();
  const projector = useProjector();
  const enabled = useAutoAdvanceStore(state => state.enabled);
  const setEnabled = useAutoAdvanceStore(state => state.setEnabled);
  const note = useAutoAdvanceStore(state => state.note);
  const saved = useScriptureMemoryStore(state => state.saved);
  const storageError = useScriptureMemoryStore(state => state.storageError);
  const [view, setView] = useState<'saved' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const prayer = useAppStore(state => state.prayerMode);
  const status = prayer ? 'Prayer mode · following is paused' : note || (!engine.caps.bridge ? 'Available in the desktop app' : engine.asr !== 'listening' ? 'Waiting for the microphone' :
    projector.screen !== 'live' ? 'Paused while the screen is hidden' :
      projector.live?.source !== 'scripture' ? 'Put a scripture live to begin' : 'Following the live scripture');

  async function recall(entry: RememberedScripture) {
    if (busy) return;
    setBusy(entry.key); setError('');
    try { await projector.send(recallScripture(entry)); }
    catch { setError(`Could not put ${entry.reference} live. Try again.`); }
    finally { setBusy(null); }
  }

  return <section className="scripture-tools" aria-label="Scripture controls">
    <div className="scripture-tools__bar">
      <Button label="auto advance" icon={<PlayIcon size={12} />} pressed={enabled} tone={enabled ? 'gold' : 'ash'}
        guideId="scripture-auto-advance" title="Move on after the live verse is read through. Pauses during prayer. A spoken next verse just after an automatic move counts as the same step."
        onClick={() => { setEnabled(!enabled); if (!enabled && engine.asr !== 'listening' && engine.caps.bridge) engine.listen(true); }} />
      <button type="button" className="scripture-nav" aria-label="Previous scripture page" title="Previous page or verse" disabled={projector.preview?.source !== 'scripture' && projector.live?.source !== 'scripture'} onClick={() => void projector.stepScripture(-1).catch(() => setError('Could not load the previous verse.'))}><ChevronLeftIcon size={14} /><ChevronLeftIcon size={14} /></button>
      <button type="button" className="scripture-nav" aria-label="Next scripture page" title="Next page or verse" disabled={projector.preview?.source !== 'scripture' && projector.live?.source !== 'scripture'} onClick={() => void projector.stepScripture(1).catch(() => setError('Could not load the next verse.'))}><ChevronRightIcon size={14} /><ChevronRightIcon size={14} /></button>
      <div className="scripture-tools__views">
        <button type="button" aria-pressed={view === 'saved'} onClick={() => { setView(view === 'saved' ? null : 'saved'); setError(''); }}>
          <BookmarkIcon size={13} selected={view === 'saved'} />saved<span className="scripture-tools__count">{saved.length}</span>
        </button>
      </div>
    </div>
    {(enabled || note || prayer) && <p className="scripture-tools__status" role="status">{status}</p>}
    {storageError && <p className="scripture-tools__error" role="alert">{storageError}</p>}
    {error && <p className="scripture-tools__error" role="alert">{error}</p>}
    {view ? <>
      <div className="scripture-tools__heading">
        <span>Saved scriptures<small>Click a scripture to put it live</small></span>
        <button type="button" aria-label="Back to scripture catches" title="Back to catches" onClick={() => setView(null)}><CloseIcon size={13} /></button>
      </div>
      <div className="scripture-tools__list" aria-label={'Saved scriptures'}>
        {saved.length === 0 ? <p className="scripture-tools__empty">
          Save a caught or live scripture to bring it back anytime.
        </p> : saved.map(entry => {
          const live = projector.live?.reference === entry.reference && projector.live.version === entry.version;
          return <div className={cx('scripture-memory-row', live && 'is-live')} key={entry.key}>
            <button type="button" className="scripture-memory-row__recall" disabled={busy !== null}
              aria-label={`Put ${entry.reference}, ${entry.version}, live`} onClick={() => void recall(entry)}>
              <span className="scripture-memory-row__title">{entry.reference}<small>{entry.version}</small><small>{busy === entry.key ? 'loading…' : live ? (projector.screen === 'live' ? 'live' : 'held') : 'go live'}</small></span>
              <span className="scripture-memory-row__text">{verseToText(entry.text)}</span>
            </button>
            <SaveScriptureButton item={recallScripture(entry)} />
          </div>;
        })}
      </div>
    </> : <>
      <div className="scripture-tools__catches">{children}</div>
    </>}
  </section>;
}

export function BookClarification() {
  const projector = useProjector();
  const engine = useEngine();
  const question = engine.bookQuestion;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!question) return null;
  return <div className="scripture-clarification" role="group" aria-label="Choose the numbered Bible book">
    <div><strong>Which book?</strong><button type="button" aria-label="Dismiss book question" onClick={engine.dismissBookQuestion}><CloseIcon size={12} /></button></div>
    <p>The book number wasn’t clear.</p>
    <div>{question.books.map(book => {
      const reference = `${book} ${question.chapter}:${question.verse}${question.endVerse && question.endVerse !== question.verse ? `-${question.endVerse}` : ''}`;
      return <button key={book} type="button" disabled={busy} title={`Put ${reference} live`} onClick={() => {
        setBusy(true); setError('');
        void projector.send({ source: 'scripture', id: reference, label: reference, reference, origin: 'operator' })
          .then(() => engine.dismissBookQuestion())
          .catch(() => setError('Could not load this passage. Try again.')).finally(() => setBusy(false));
      }}>{reference}</button>;
    })}</div>{error && <p role="alert">{error}</p>}
  </div>;
}
