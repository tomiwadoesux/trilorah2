'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Archive, BookOpen, ChevronLeft, ChevronRight, Search, X } from '@/components/icons';
import { books, parsePassage, passageLabel, passageText, type BibleVerse, type Passage } from '@/lib/companionBible';
import { togglePassage } from '@/lib/companionNotebook';
import type { NotebookController } from '../useNotebook';
import ShareActions from './ShareActions';
import CorrectionOverlay from './CorrectionOverlay';
import './scripture-reader.css';

interface Verse { id: string; ref: string; pushed_at: string }
const bookCache = new Map<number, Record<string, BibleVerse[]>>();
export default function VersesTab({ verses, audienceTrainingEnabled, fingerprint, serviceId, isLive = true, notebook }: {
  verses: Verse[]; audienceTrainingEnabled: boolean; fingerprint: string; serviceId: string; isLive?: boolean; notebook: NotebookController;
}) {
  const [collection, setCollection] = useState<'service' | 'saved'>('service');
  const [selected, setSelected] = useState<Passage | null>(null);
  const entries = collection === 'saved' ? notebook.book.verses.map(v => ({ id: v.key, ref: v.ref })) : verses;
  const passage = selected ?? (entries[0] ? parsePassage(entries[0].ref) : null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const readingHeading = useRef<HTMLHeadingElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chapter, setChapter] = useState<BibleVerse[]>([]);
  const [fullChapter, setFullChapter] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    if (!passage) return;
    const { book, chapter: number } = passage;
    let cancelled = false;
    setLoading(true); setError(''); setChapter([]);
    void (async () => {
      try {
        let data = bookCache.get(book);
        if (!data) {
          const result = await fetch('/bible/web/' + book + '.json');
          if (!result.ok) throw new Error('Chapter unavailable');
          data = await result.json(); bookCache.set(book, data!);
        }
        if (!cancelled) setChapter(data![String(number)] ?? []);
      } catch { if (!cancelled) setError('Couldn’t load this chapter. Check your connection and try again.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [passage?.book, passage?.chapter, retry]);
  const choose = (next: Passage) => {
    setSelected(next); setFullChapter(false); setError('');
    scrollRef.current?.scrollTo({ top: 0 });
  };
  const switchCollection = (next: 'service' | 'saved') => {
    setCollection(next); setSelected(null); setFullChapter(false); setError('');
    scrollRef.current?.scrollTo({ top: 0 });
  };
  const openRef = (ref: string) => {
    const next = parsePassage(ref);
    if (!next) { setError('Try a reference such as Romans 12:1–2. Read cross-chapter passages one chapter at a time.'); return false; }
    choose(next); return true;
  };
  const label = passage ? passageLabel(passage) : '';
  const storedPassage = notebook.book.verses.find(v => v.key === 'WEB:' + label);
  const text = (passage ? passageText(chapter, passage) : '') || storedPassage?.text || '';
  const readable = chapter.length ? chapter : (storedPassage?.text.split('\n').map(line => {
    const match = line.match(/^(\d+)\s+(.+)$/); return { number: Number(match?.[1] ?? 0), text: match?.[2] ?? line };
  }) ?? []);
  const newest = verses[0];
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!audienceTrainingEnabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [audienceTrainingEnabled]);
  const correctionVisible = audienceTrainingEnabled && isLive && newest && now - Date.parse(newest.pushed_at) < 5000 && feedbackFor !== newest.id;
  const correct = async (type: 'wrong-verse' | 'no-verse') => {
    if (!correctionVisible) return;
    const { error: failure } = await supabase.from('correction_taps').insert({ service_id: serviceId, detected_verse_id: newest.id, type, audience_fingerprint: fingerprint });
    if (failure) setError('Your correction wasn’t sent. Please try again.'); else setFeedbackFor(newest.id);
  };
  const visibleVerses = readable.filter(v => fullChapter || (passage && v.number >= passage.from && v.number <= passage.to));
  // Saving/sharing should match what the reader is actually looking at.
  const readingPassage = passage && fullChapter ? { ...passage, from: 1, to: 999 } : passage;
  const readingLabel = readingPassage ? passageLabel(readingPassage) : '';
  const readingText = fullChapter ? visibleVerses.map(v => `${v.number} ${v.text}`).join('\n') : text;
  const readingSaved = notebook.book.verses.some(v => v.key === 'WEB:' + readingLabel);
  const toggleSaved = () => {
    if (!readingPassage) return;
    notebook.update(book => togglePassage(book, { key: 'WEB:' + readingLabel, ref: readingLabel, text: readingText, passage: readingPassage, serviceId, savedAt: new Date().toISOString() }));
    if (collection === 'saved' && readingSaved) { setSelected(null); setFullChapter(false); }
  };
  const toggleChapter = () => {
    setFullChapter(v => !v);
    scrollRef.current?.scrollTo({ top: 0 });
    readingHeading.current?.focus({ preventScroll: true });
  };
  return <div className="resource-scroll scripture-reader" ref={scrollRef}>
    <header className="scripture-library-heading"><h1>Scriptures</h1><button ref={searchTrigger} className="scripture-search-trigger" aria-label={searchOpen ? 'Close passage search' : 'Find a passage'} aria-expanded={searchOpen} aria-controls="scripture-search-form" onClick={() => setSearchOpen(v => !v)}>{searchOpen ? <X size={20}/> : <Search size={20}/>}</button></header>
    {searchOpen && <form id="scripture-search-form" className="scripture-search" onSubmit={e => { e.preventDefault(); if (openRef(query)) { setSearchOpen(false); searchTrigger.current?.focus(); } }}><label className="sr-only" htmlFor="scripture-reference">Find a scripture reference</label><input autoFocus id="scripture-reference" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try John 15:5" enterKeyHint="search" autoComplete="off"/><button aria-label="Open passage"><ChevronRight size={20}/></button></form>}
    <div className="scripture-collections" aria-label="Scripture collection"><button aria-pressed={collection === 'service'} onClick={() => switchCollection('service')}>This service <span>{verses.length}</span></button><button aria-pressed={collection === 'saved'} onClick={() => switchCollection('saved')}><Archive size={16}/>Saved <span>{notebook.book.verses.length}</span></button></div>
    {entries.length > 0 ? <div className="scripture-passage-rail" aria-label={collection === 'saved' ? 'Saved scriptures' : 'Shared scriptures'}>{entries.map((v) => {
      const parsed = parsePassage(v.ref);
      return <button key={v.id} aria-label={v.ref} aria-pressed={!!parsed && passageLabel(parsed) === label} onClick={() => openRef(v.ref)}><span><strong>{parsed ? books[parsed.book].name : v.ref}</strong>{parsed && <small>{parsed.chapter}{parsed.to < 999 ? `:${parsed.from}${parsed.from === parsed.to ? '' : '–' + parsed.to}` : ' · Full chapter'}</small>}</span></button>;
    })}</div> : <div className="scripture-library-empty"><BookOpen size={28}/><p>{collection === 'saved' ? 'Keep a passage close.' : 'Ready when the message begins.'}</p><span>{collection === 'saved' ? 'Saved scriptures will be here on this device.' : 'Scriptures shared during the service will appear here.'}</span><button onClick={() => setSearchOpen(true)}>Find a passage<ChevronRight size={16}/></button></div>}
    {error && <div role="alert" className="resource-error">{storedPassage && !chapter.length ? 'Showing your saved passage. Connect to read the full chapter.' : error}{!chapter.length && passage && <button onClick={() => setRetry(v => v + 1)}>Try again</button>}</div>}
    {passage && <article className="scripture-page" aria-busy={loading}>
      <div className="scripture-page-tools"><span><BookOpen size={16}/>World English Bible</span><button disabled={!readingText || !notebook.ready || (fullChapter && !chapter.length)} aria-label={readingSaved ? 'Unsave ' + readingLabel : 'Save ' + readingLabel} aria-pressed={readingSaved} onClick={toggleSaved}><Archive size={19} selected={readingSaved}/><span>{readingSaved ? 'Saved' : 'Save'}</span></button></div>
      <header><p className="scripture-page-kicker">{fullChapter || passage.to === 999 ? 'FULL CHAPTER' : passage.from === passage.to ? 'VERSE ' + passage.from : 'VERSES ' + passage.from + '–' + passage.to}</p><h2 ref={readingHeading} tabIndex={-1}>{books[passage.book].name} <span>{passage.chapter}</span></h2>{fullChapter && passage.to !== 999 && <button className="scripture-return" onClick={toggleChapter}><ChevronLeft size={16}/>Back to verses {passage.from}{passage.to !== passage.from ? '–' + passage.to : ''}</button>}</header>
      {loading && !storedPassage ? <p role="status" className="scripture-loading">Opening the chapter…</p> : <>
        <div className="scripture-text">{visibleVerses.map(v => <p key={v.number} data-highlight={fullChapter && passage.to !== 999 && v.number >= passage.from && v.number <= passage.to ? 'true' : undefined}><sup>{v.number}</sup><span>{v.text}</span></p>)}</div>
        {!text && chapter.length > 0 && <p role="status">That verse isn’t in this chapter. Open the full chapter below.</p>}
        <footer className="scripture-page-footer">{passage.to !== 999 && <button className="scripture-chapter-toggle" disabled={!chapter.length} onClick={toggleChapter}><span><BookOpen size={18}/>{fullChapter ? 'Back to the passage' : 'Read the full chapter'}</span><ChevronRight size={18}/></button>}<span>WEB · Public domain</span></footer>
      </>}
    </article>}
    {passage && <div className="scripture-reading-footer"><p role="status" className="companion-small">{readingSaved ? notebook.status : 'Save passages to this device.'}</p><ShareActions key={readingLabel} title={readingLabel + ' · WEB'} text={readingLabel + ' · World English Bible\n\n' + readingText} filename={readingLabel.replace(/[^a-z0-9]/gi, '-') + '-WEB.txt'} disabled={!readingText || (fullChapter && !chapter.length)}/><nav className="chapter-navigation" aria-label="Bible chapters"><button disabled={passage.chapter <= 1} onClick={() => { choose({ ...passage, chapter: passage.chapter - 1, from: 1, to: 999 }); setFullChapter(true); }}><ChevronLeft size={18}/>Previous</button><span>Chapter {passage.chapter} of {books[passage.book].chapters}</span><button disabled={passage.chapter >= books[passage.book].chapters} onClick={() => { choose({ ...passage, chapter: passage.chapter + 1, from: 1, to: 999 }); setFullChapter(true); }}>Next<ChevronRight size={18}/></button></nav></div>}
    {correctionVisible && <CorrectionOverlay onWrongVerse={() => void correct('wrong-verse')} onNoVerse={() => void correct('no-verse')}/>}
  </div>;
}
