import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, MicIcon, PencilIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, ExternalLinkIcon, SearchField } from '../../ui';
import { useEngine } from './engine';
import { useScriptureFindStore } from '../../stores/scriptureFindStore';
import { findTier, perPageFor, type FindTier } from '../../lib/findTier';
import './scriptureFind.css';

/**
 * "What was that?" — the operator heard an allusion the engine let pass.
 *
 * One press asks every matcher about what was said in the last few seconds.
 * The requested search still rejects weak or unrelated matches. Answers are drawn over the preview
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
      if (result.heard) { open(result.heard, result.matches); return; }
      close();
      if (engine.asr !== 'listening') { engine.listen(true); setNote('starting listening — press again once speech appears'); }
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
    <Button className="catch-tile" label={busy ? 'searching' : 'find scripture'} disabled={busy} icon={<MicIcon size={18} />} tone="ash" onClick={() => { void find(); }} />
    {note && <p className="catch-extra px-2 text-center text-xs text-white/50">{note}</p>}
  </>;
}

/**
 * "find scripture", typed: the second field of the verses card's search row
 * (owner, 2026-10-07). The operator describes a story or half-remembers a
 * line — "abraham offers his son", "the one about the lost sheep" — and the
 * same matchers the button uses look for it. The answers open over the
 * preview, the same cards as the button's.
 */
const SCRIPTURE_EXAMPLES = [
  'Jesus calms the storm', 'love is patient and kind', 'the lost sheep',
  'peace when I am anxious', 'David faces Goliath', 'forgiving one another',
  'faith without works', 'Moses and the burning bush', 'the armor of God',
  'Abraham offers his son', 'the Lord is my shepherd', 'strength in weakness',
];

export function ScriptureSearch() {
  const open = useScriptureFindStore((s) => s.open);
  const close = useScriptureFindStore((s) => s.close);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [correction, setCorrection] = useState<{ original: string; detail: string } | null>(null);
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState(() => Math.floor(Math.random() * SCRIPTURE_EXAMPLES.length));
  const request = useRef(0);

  useEffect(() => {
    if (text || focused) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setExample(current => (current + 1 + Math.floor(Math.random() * (SCRIPTURE_EXAMPLES.length - 1))) % SCRIPTURE_EXAMPLES.length);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [text, focused]);
  useEffect(() => () => { request.current++; }, []);

  async function search(value: string, correctTypos = true) {
    const words = value.trim();
    const api = window.api;
    if (!words) return;
    if (!api?.findHeardScripture) { setNote('scripture search is available in the desktop app'); return; }
    const id = ++request.current;
    setBusy(true); setNote(''); setCorrection(null); close();
    try {
      const result = await api.findHeardScripture(words, correctTypos);
      if (id !== request.current) return;
      const corrected = !!result.corrections?.length;
      if (corrected) setCorrection({ original: words, detail: result.corrections!.map(change => `${change.from} → ${change.to}`).join(' · ') });
      if (result.matches.length) open(result.heard || words, result.matches, 'typed', corrected ? words : undefined);
      else setNote('no close match — try a person, phrase, or more detail');
      if (!result.meaning) setNote(current => [current, 'meaning search is not ready; checking names and wording'].filter(Boolean).join('. '));
    } catch {
      if (id === request.current) setNote('could not search just now — press Enter to retry');
    } finally {
      if (id === request.current) setBusy(false);
    }
  }

  return (
    <div className="story-search" aria-busy={busy}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      title="Search by a remembered phrase, person, event, or topic. Press Enter for passages. The microphone ‘find scripture’ button searches recent speech.">
      <SearchField
        value={text}
        ariaLabel="search scripture by phrase, person, event, or topic"
        onChange={(next) => { request.current++; setText(next); setBusy(false); setNote(''); setCorrection(null); }}
        onSubmit={(value) => { void search(value); }}
        placeholder={`search scripture — “${SCRIPTURE_EXAMPLES[example]}”`}
      />
      {(busy || note || correction) && <div className="story-search__note" role="status">
        {busy ? 'searching…' : <>
          {correction && <span>searched with {correction.detail} <button type="button" onClick={() => void search(correction.original, false)}>use original</button></span>}
          {note && <span>{note}</span>}
        </>}
      </div>}
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
  const open = useScriptureFindStore((s) => s.open);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState('');
  const retry = useRef(0);
  useEffect(() => {
    retry.current++;
    setQuery(found?.heard ?? ''); setEditing(false); setSearching(false); setSearchNote('');
    return () => { retry.current++; };
  }, [found]);

  async function retrySearch() {
    if (!found || !query.trim() || !window.api?.findHeardScripture) return;
    const id = ++retry.current;
    setSearching(true); setSearchNote('');
    try {
      const result = await window.api.findHeardScripture(query.trim(), true, found.how === 'heard');
      if (id !== retry.current) return;
      open(result.heard || query.trim(), result.matches, found.how, result.corrections?.length ? query.trim() : undefined);
    } catch {
      if (id === retry.current) setSearchNote('could not search — try again');
    } finally {
      if (id === retry.current) setSearching(false);
    }
  }

  /*
   * How many cards fit, from the band the veil actually covers (lib/findTier).
   * Measured once before the first paint, then followed: the library handle
   * and the window both reshape the band while the answers are up. The veil's
   * size comes from its insets, never its content, so the observer cannot
   * feed itself.
   */
  const veilRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<FindTier>('full');
  const isOpen = !!found;
  useLayoutEffect(() => {
    const el = veilRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    setTier(findTier(
      box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      box.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
    ));
    const ro = new ResizeObserver(([entry]) => setTier(findTier(entry.contentRect.width, entry.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);
  const perPage = perPageFor(tier);
  const pages = found ? Math.ceil(found.matches.length / perPage) : 0;
  /* Lowering the library on page 2 of 2 makes it one page of four: the page
     the store remembers is clamped here rather than rendered empty. */
  const at = Math.min(page, Math.max(0, pages - 1));

  useEffect(() => {
    if (!found) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') setPage(Math.min(pages - 1, at + 1));
      else if (e.key === 'ArrowLeft') setPage(Math.max(0, at - 1));
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    /* Capture, so this runs before the preview's own arrow-key listeners. */
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [found, at, pages, close, setPage]);

  if (!found) return null;
  const shown = found.matches.slice(at * perPage, at * perPage + perPage);

  return <div ref={veilRef} className="find-veil" data-tier={tier} role="dialog" aria-label={found.how === 'typed' ? 'passages found for what was typed' : 'passages found for what was just said'}>
    <div className="find-head">
      <p className="find-heard" title={found.original ? `Original: ${found.original}\nSearched: ${found.heard}` : found.heard}>{found.original ? 'searched as' : found.how === 'typed' ? 'searched' : 'heard'} <em>“{found.heard}”</em></p>
      <button type="button" className="find-round" aria-label="edit searched words" title="edit the words and search again" aria-expanded={editing} onClick={() => setEditing(value => !value)}><PencilIcon size={12} /></button>
      {/* In the head, not a row of its own: a foot row cost the cards a line
          of text on exactly the bands that page. */}
      {pages > 1 && <div className="find-pager">
        <button type="button" className="find-round" aria-label="previous passages" title="previous passages ←" disabled={at === 0} onClick={() => setPage(at - 1)}><ChevronLeftIcon size={12} /></button>
        <span className="find-count">{at + 1} / {pages}</span>
        <button type="button" className="find-round" aria-label="next passages" title="next passages →" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}><ChevronRightIcon size={12} /></button>
      </div>}
      <button type="button" className="find-round" aria-label="close" title="close without choosing (Esc)" onClick={close}><CloseIcon size={12} /></button>
    </div>
    {editing && <form className="find-edit" onSubmit={event => { event.preventDefault(); void retrySearch(); }}>
      <textarea aria-label="words to search" value={query} rows={2} autoFocus onChange={event => { retry.current++; setSearching(false); setQuery(event.target.value); }} />
      <button type="submit" disabled={searching || !query.trim()}>{searching ? 'searching…' : 'search again'}</button>
      {searchNote && <span role="status">{searchNote}</span>}
    </form>}
    {/* Keyed by page so the cards of a new page rise in like the first did.
        The count lets one or two answers take the whole band. */}
    <div className="find-grid" key={at} data-count={shown.length}>
      {!shown.length && <div className="find-empty"><p>no clear passage for these words</p><button type="button" onClick={() => setEditing(true)}>check the words and try again</button></div>}
      {shown.map((match, i) => <button key={match.reference} type="button" className="find-card" style={{ '--find-i': i } as React.CSSProperties}
        /* The whole passage on hover, since a small band clamps it to a line. */
        title={`${match.reference}${match.title ? ` — ${match.title}` : ''}\n${match.text}\n\nput it on the projector${match.evidence.length ? ` — matched on: ${match.evidence.join(', ')}` : ''}`}
        onClick={() => { if (engine.pushReference(match.reference, match.version)) close(); }}>
        <span className="find-ref">{match.reference}</span>
        <span className="find-title">{match.title}</span>
        <span className="find-basis">{match.kind === 'named' ? 'named passage' : match.kind === 'story' ? 'matching details' : 'possible meaning match'}</span>
        <span className="find-text">{match.text}</span>
        <span className="find-go">go live <ExternalLinkIcon size={12} /></span>
      </button>)}
    </div>
  </div>;
}
