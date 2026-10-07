import { useEffect, useState } from 'react';
import { Button, MicIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, SearchField } from '../../ui';
import { useEngine } from './engine';
import { useScriptureFindStore } from '../../stores/scriptureFindStore';
import './scriptureFind.css';

const PER_PAGE = 4;

/**
 * "What was that?" — the operator heard an allusion the engine let pass.
 *
 * One press asks every matcher about what was said in the last few seconds.
 * The auto path stays silent unless it is sure; this never does, because a
 * person asked and is about to choose. The answers are drawn over the preview
 * screen by ScriptureFindOverlay, where the operator is already looking.
 *
 * It is a press, not a mode, and the words expire: the main process searches
 * only what it heard recently, so a press minutes after the sentence says so
 * instead of bringing the old answers back.
 */
export function ScriptureCatches() {
  const engine = useEngine();
  const open = useScriptureFindStore((s) => s.open);
  const close = useScriptureFindStore((s) => s.close);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function find() {
    const api = window.api;
    if (busy || !api?.findHeardScripture) return;
    setBusy(true); setNote('');
    try {
      const result = await api.findHeardScripture();
      if (result.matches.length) { open(result.heard, result.matches); return; }
      close();
      if (result.heard) setNote('no passage found for those words');
      else if (engine.asr !== 'listening') { engine.listen(true); setNote('listening now, press again once something is said'); }
      else setNote('nothing has been said in the last few seconds');
    } catch {
      setNote('could not search just now, try again');
    } finally {
      setBusy(false);
    }
  }

  /* A fragment: the button is one tile in the catches card's action row and
     the note runs under the whole row — see .catch-actions in Live. */
  return <>
    <Button className="catch-tile" label={busy ? 'searching' : 'find scripture'} icon={<MicIcon size={18} />} tone="ash" onClick={() => { void find(); }} />
    {note && <p className="catch-extra px-2 text-center text-xs text-white/50">{note}</p>}
  </>;
}

/**
 * "find scripture", typed: the second field of the verses card's search row
 * (owner, 2026-10-07). The operator describes a story or half-remembers a
 * line — "abraham offers his son", "the one about the lost sheep" — and the
 * same matchers the button uses look for it. The answers open over the
 * preview, the same four-to-a-page cards as the button's.
 */
export function StorySearch() {
  const open = useScriptureFindStore((s) => s.open);
  const close = useScriptureFindStore((s) => s.close);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function search(value: string) {
    const words = value.trim();
    const api = window.api;
    if (!words || busy || !api?.findHeardScripture) return;
    setBusy(true); setNote('');
    try {
      const result = await api.findHeardScripture(words);
      if (result.matches.length) open(words, result.matches, 'typed');
      else { close(); setNote('nothing close — try other words'); }
    } catch {
      setNote('could not search just now');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="story-search" aria-busy={busy}>
      <SearchField
        value={text}
        onChange={(next) => { setText(next); if (note) setNote(''); }}
        onSubmit={(value) => { void search(value); }}
        placeholder="find a story — “abraham offers his son”"
      />
      {(busy || note) && <span className="story-search__note" aria-live="polite">{busy ? 'searching…' : note}</span>}
    </div>
  );
}

/**
 * The answers, over whatever the preview screen is showing.
 *
 * Renders nothing until a search has answers, so the preview's own clicks and
 * arrow keys are untouched the rest of the time. While it is up it covers the
 * picture, which keeps a click meant for a card from stepping the verse
 * underneath, and it takes ← → and Escape before the preview can.
 *
 * A card is the press that sends a verse to the room: the operator asked,
 * read four candidates and chose one. Nothing here goes live on its own.
 */
export function ScriptureFindOverlay() {
  const engine = useEngine();
  const found = useScriptureFindStore((s) => s.found);
  const page = useScriptureFindStore((s) => s.page);
  const setPage = useScriptureFindStore((s) => s.setPage);
  const close = useScriptureFindStore((s) => s.close);
  const pages = found ? Math.ceil(found.matches.length / PER_PAGE) : 0;

  useEffect(() => {
    if (!found) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') setPage(Math.min(pages - 1, page + 1));
      else if (e.key === 'ArrowLeft') setPage(Math.max(0, page - 1));
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    /* Capture, so this runs before the preview's own arrow-key listeners. */
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [found, page, pages, close, setPage]);

  if (!found) return null;
  const shown = found.matches.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return <div className="find-veil" role="dialog" aria-label={found.how === 'typed' ? 'passages found for what was typed' : 'passages found for what was just said'}>
    <div className="find-head">
      <p className="find-heard" title={found.heard}>{found.how === 'typed' ? 'searched' : 'heard'} <em>“{found.heard.split(' ').slice(-10).join(' ')}”</em></p>
      <button type="button" className="find-round" aria-label="close" title="close without choosing (Esc)" onClick={close}><CloseIcon size={12} /></button>
    </div>
    {/* Keyed by page so the cards of a new page rise in like the first did. */}
    <div className="find-grid" key={page}>
      {shown.map((match, i) => <button key={match.reference} type="button" className="find-card" style={{ '--find-i': i } as React.CSSProperties}
        title={`put ${match.reference} on the projector${match.evidence.length ? ` — matched on: ${match.evidence.join(', ')}` : ''}`}
        onClick={() => { if (engine.pushReference(match.reference, match.version)) close(); }}>
        <span className="find-ref">{match.reference}</span>
        <span className="find-title">{match.title}</span>
        <span className="find-text">{match.text}</span>
        <span className="find-go">go live ↗</span>
      </button>)}
    </div>
    {pages > 1 && <div className="find-foot">
      <button type="button" className="find-round" aria-label="previous passages" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeftIcon size={12} /></button>
      <span className="find-count">{page + 1} / {pages}</span>
      <button type="button" className="find-round" aria-label="next passages" title="next passages →" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRightIcon size={12} /></button>
    </div>}
  </div>;
}
