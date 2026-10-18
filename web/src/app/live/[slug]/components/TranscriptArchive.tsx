'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Clock, X } from '@/components/icons';
import { loadTranscriptPages, transcriptText, type ArchiveChunk } from '@/lib/transcriptArchive';
import ShareActions from './ShareActions';
import type { Account, Service } from '../CompanionClient';

export default function TranscriptArchive({ service, account, previewChunks, onClose }: {
  service: Service; account: Account; previewChunks?: ArchiveChunk[]; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const previewSnapshot = useRef(previewChunks).current;
  const supabase = useMemo(() => createClient(), []);
  const [chunks, setChunks] = useState<ArchiveChunk[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [services, setServices] = useState<Array<Pick<Service, 'id' | 'sermon_title' | 'started_at'>>>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [more, setMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const title = service.sermon_title || 'Service transcript';
  useEffect(() => {
    // Keep the original trigger across StrictMode's effect replay.
    opener.current ??= document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { requestAnimationFrame(() => opener.current?.focus()); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setProgress(0);
    const through = new Date().toISOString();
    if (!service.publish_transcript) { setError('This service’s transcript isn’t shared.'); setLoading(false); return; }
    if (previewSnapshot) { setChunks(previewSnapshot); setLoading(false); return; }
    void loadTranscriptPages<ArchiveChunk>(async (from, to) => await supabase.from('transcript_chunks')
      .select('id,text,timestamp,offset_ms').eq('service_id', service.id).lte('timestamp', through)
      .order('timestamp', { ascending: true }).order('id', { ascending: true }).range(from, to).abortSignal(controller.signal), setProgress, controller.signal)
      .then(setChunks).catch(e => { if (e.name !== 'AbortError') setError('Couldn’t load the complete transcript. Check your connection and try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [service.id, service.publish_transcript, supabase, previewSnapshot, retry]);
  useEffect(() => {
    if (previewChunks) return;
    let cancelled = false;
    setHistoryLoading(true); setHistoryError('');
    void (async () => {
      const { data, error: failure } = await supabase.from('services').select('id,sermon_title,started_at').eq('account_id', account.id).eq('is_public', true).order('started_at', { ascending: false }).order('id', { ascending: false }).range(historyPage * 30, historyPage * 30 + 29);
      if (cancelled) return;
      if (failure) setHistoryError('Couldn’t load past services.');
      else { setServices(previous => historyPage === 0 ? data ?? [] : [...previous, ...(data ?? [])]); setMore(data?.length === 30); }
      setHistoryLoading(false);
    })();
    return () => { cancelled = true; };
  }, [account.id, supabase, previewChunks, historyPage, retry]);
  const matches = useMemo(() => chunks.filter(c => c.text.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())), [chunks, query]);
  const visible = matches.slice(page * 60, (page + 1) * 60);
  const fullText = transcriptText(title, chunks);
  const changePage = (next: number) => {
    setPage(next);
    dialog.current?.querySelector('.archive-body')?.scrollTo({ top: 0 });
  };
  return <dialog ref={dialog} className="companion-archive" aria-labelledby="transcript-history-title" onCancel={onClose} onClose={onClose}>
    <header className="archive-heading"><div><p className="companion-eyebrow"><Clock size={15}/>TAKE THE MESSAGE WITH YOU</p><h2 id="transcript-history-title">Transcript & history</h2></div><button aria-label="Close transcript history" onClick={onClose}><X size={22}/></button></header>
    <div className="archive-body">
      {!previewChunks && <details className="archive-services"><summary>Browse past services</summary>{services.map(s => <a key={s.id} href={`/live/${encodeURIComponent(account.slug)}?service=${encodeURIComponent(s.id)}`} aria-current={s.id === service.id ? 'page' : undefined}><span>{s.sermon_title || 'Church service'}</span><time>{new Date(s.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></a>)}{historyError && <p role="alert">{historyError}<button onClick={() => setRetry(v => v + 1)}>Try again</button></p>}{historyLoading && <p role="status">Loading services…</p>}{more && <button disabled={historyLoading} onClick={() => setHistoryPage(p => p + 1)}>Earlier services</button>}</details>}
      <div className="archive-title"><h3>{title}</h3><p className="companion-small">{new Date(service.started_at).toLocaleDateString(undefined, { dateStyle: 'long' })} · {account.name}</p></div>
      {loading ? <p role="status">Loading the full transcript… {progress > 0 && `${progress.toLocaleString()} segments loaded`}</p> : error ? <p role="alert">{error}<button className="resource-link" onClick={() => setRetry(v => v + 1)}>Try again</button></p> : <>
        <p className="companion-small">{chunks.length.toLocaleString()} published segments · Speech recognition may contain errors.{!service.ended_at && ' Snapshot when you opened this view.'}</p>
        <ShareActions title={title} text={fullText} filename="service-transcript.txt" disabled={!chunks.length}/>
        <label className="companion-field-label" htmlFor="transcript-search">Search the full transcript</label><input id="transcript-search" className="archive-search" value={query} placeholder="Find a word or phrase" onChange={e => { setQuery(e.target.value); setPage(0); }}/>
        <p role="status" className="companion-small">{query.trim() ? `${matches.length} matching segments` : 'Complete published history'}</p>
        <div className="archive-transcript">{visible.map(c => <p key={c.id}><time>{Math.floor((c.offset_ms ?? Math.max(0, Date.parse(c.timestamp) - Date.parse(service.started_at))) / 60000)}:{String(Math.floor(((c.offset_ms ?? Math.max(0, Date.parse(c.timestamp) - Date.parse(service.started_at))) / 1000) % 60)).padStart(2, '0')}</time><span>{c.text}</span></p>)}{!matches.length && <p>{query ? 'No matches. Try another phrase.' : 'No transcript was published for this service.'}</p>}</div>
        {matches.length > 60 && <nav className="chapter-navigation" aria-label="Transcript pages"><button disabled={!page} onClick={() => changePage(page - 1)}>Previous</button><span>{page + 1} / {Math.ceil(matches.length / 60)}</span><button disabled={(page + 1) * 60 >= matches.length} onClick={() => changePage(page + 1)}>Next</button></nav>}
      </>}
    </div>
  </dialog>;
}
