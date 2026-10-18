import { useEffect, useState } from 'react';
import { RUN_COMPONENTS, componentForItem } from '../../../../shared/runCards';
import { isLocalAssetUrl } from '../../../../shared/mediaUrl';
import { BOOKS, CHAPTER_COUNTS } from '../../../lib/books';
import { importAndSavePresentation, presentationImageSrc, type ImportedPresentation } from '../../../lib/presentationImport';
import { readTriLocal, TRI_DECKS_KEY, TRI_DECKS_EVENT } from '../../../lib/triClient';
import { Button, PlusIcon, SearchIcon, ScriptureReferenceInput, type ResolvedReference } from '../../../ui';
import { useDrag } from '../drag';
import { deckPage, type DeckPageSpec } from '../deckPage';
import { addFromLaptop, mediaSrc, useMediaLibrary, type ThemeMedia } from '../mediaLibrary';
import { useRun, type QueueItem, type RunSegment } from '../run';
import type { LibrarySong } from './RunSongEditor';
import { segmentIcon } from './segmentTypes';

type Content = Omit<QueueItem, 'key'>;
const books = BOOKS.map((name, i) => ({ name, chapters: CHAPTER_COUNTS[i] }));
const localAsset = (url?: string) => isLocalAssetUrl(url, window.location.origin);
const mediaItem = (media: ThemeMedia): Content => ({ source: 'media', label: media.label, path: media.url, preview: mediaSrc({ ...media, poster: localAsset(media.poster) ? media.poster : undefined }), mediaKind: media.kind ?? 'photo' });
const slideItems = (deck: ImportedPresentation): Content[] => deck.slides.flatMap((path, i) => localAsset(path) ? [{ source: 'presentation' as const, label: `${deck.title} · ${i + 1}`, path, preview: presentationImageSrc(path) }] : []);
const LIBRARY_LABELS: Record<string, string> = { music: 'Song library', slides: 'Slide library', image: 'Image library', video: 'Video library' };

export function ContentPreview({ item }: { item: Content }) {
  return <span className="run-content-preview">
    {item.preview ? <img src={item.preview} alt="" draggable={false} />
      : item.lines?.length || item.quote ? <span className="run-content-words">{item.lines?.join('\n') || item.quote}</span>
      : segmentIcon(componentForItem(item), 30)}
    {item.mediaKind === 'video' && <span className="run-video-mark">{segmentIcon('video', 20)}</span>}
  </span>;
}

export function RunContentPicker({ seg, fallbackSongs }: { seg: RunSegment; fallbackSongs?: readonly LibrarySong[] }) {
  const run = useRun();
  const drag = useDrag();
  const media = useMediaLibrary();
  const kind = seg.type === 'worship' ? 'music' : RUN_COMPONENTS.some(c => c.id === seg.type) && seg.type !== 'sermon' ? seg.type : 'notes';
  const [songs, setSongs] = useState<readonly LibrarySong[]>(window.api?.songs ? [] : fallbackSongs ?? []);
  const [decks, setDecks] = useState<ImportedPresentation[]>([]);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState<ResolvedReference | null>(null);
  const [verse, setVerse] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const previewSongs = kind === 'music' && !window.api?.songs;
  useEffect(() => {
    let current = true;
    setLoadError('');
    const load = async () => {
      if (kind === 'music' && window.api?.songs) {
        setLoading(true);
        try {
          const list = await window.api.songs.list();
          if (current) setSongs(list.map(s => ({ id: s.id, title: s.title, author: (s.authors ?? []).join(', '), verses: s.sections.map(v => ({ label: v.label, lines: v.lines })) })));
        } catch { if (current) setLoadError('Your saved songs could not load.'); }
        finally { if (current) setLoading(false); }
      }
      if (kind === 'slides') {
        const hidden = new Set(readTriLocal<string[]>('trilorah_hidden_presentation_decks', []));
        const custom = readTriLocal<{ id: string; title: string; paths?: string[]; rendered: number; seed: number; spec: DeckPageSpec }[]>(TRI_DECKS_KEY, [])
          .filter(d => !hidden.has(d.id))
          .map(d => ({ id: d.id, title: d.title, slides: d.paths ?? Array.from({ length: d.rendered }, (_, i) => deckPage(d.seed, i, d.spec)), importedAt: 0 }));
        setDecks(custom);
        if (window.api?.loadPresentations) {
          setLoading(true);
          try {
            const list = await window.api.loadPresentations();
            if (current) setDecks([...custom, ...list.filter(d => !hidden.has(d.id))]);
          } catch { if (current) setLoadError('Your saved slides could not load.'); }
          finally { if (current) setLoading(false); }
        }
      }
    };
    void load();
    return () => { current = false; };
  }, [kind, reload]);
  useEffect(() => {
    const refresh = () => setReload(value => value + 1);
    const events = ['trilorah-library-changed', 'trilorah-package-imported', 'presentations-updated', TRI_DECKS_EVENT];
    events.forEach(event => window.addEventListener(event, refresh));
    return () => events.forEach(event => window.removeEventListener(event, refresh));
  }, []);

  const add = (items: Content[]) => {
    run.queueMany(seg.key, items);
    setNotice(`${items.length === 1 ? items[0].label || 'Note' : `${items.length} items`} added to ${seg.label}`);
  };
  const importFiles = async () => {
    setBusy(true);
    try {
      if (kind === 'slides') {
        const deck = await importAndSavePresentation();
        if (deck) { setDecks(prev => [...prev.filter(d => d.id !== deck.id), deck]); add(slideItems(deck)); }
      } else {
        const result = await addFromLaptop({ wanted: 'media', onProgress: setNotice });
        const matching = result.cards.filter(m => localAsset(m.url) && (m.kind ?? 'photo') === (kind === 'video' ? 'video' : 'photo'));
        if (matching.length) add(matching.map(mediaItem));
        const otherCount = result.cards.length - matching.length;
        if (otherCount) setNotice(`${matching.length} ${kind === 'video' ? 'videos' : 'images'} added to ${seg.label}. ${otherCount} other ${otherCount === 1 ? 'file is' : 'files are'} saved in your library.`);
        else if (result.notice) setNotice(result.notice);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not import these files. Try again.'); }
    finally { setBusy(false); }
  };
  const addVerse = (ref: ResolvedReference) => {
    const label = `${ref.book} ${ref.chapter}${ref.verse !== null ? `:${ref.verse}${ref.rangeEnd ? `–${ref.rangeEnd}` : ''}` : ''}`;
    add([{ source: 'scripture', label }]);
    setVerse(''); setReference(null);
  };
  const options: Content[] = kind === 'music'
    ? songs.flatMap(song => song.verses.map(section => ({ source: 'song' as const, label: `${song.title} — ${section.label}`, title: song.title, section: section.label, lines: section.lines, songId: song.id })))
    : kind === 'slides' ? decks.flatMap(slideItems)
      : kind === 'image' || kind === 'video' ? media.filter(m => localAsset(m.url) && (m.kind ?? 'photo') === (kind === 'video' ? 'video' : 'photo')).map(mediaItem) : [];
  const shown = options.filter(i => [i.label, ...(i.lines ?? [])].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));

  return <div className="run-picker">
    {kind === 'notes' ? <form className="run-note-form" onSubmit={e => { e.preventDefault(); if (note.trim()) { add([{ source: 'note', label: note.trim() }]); setNote(''); } }}>
      <label htmlFor="run-new-note">{seg.type === 'sermon' ? 'Sermon notes' : `A note for ${seg.label}`}</label>
      <textarea id="run-new-note" data-guide="run-new-note" autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder={seg.type === 'sermon' ? 'Write your sermon notes…' : 'Write a reminder or cue…'} rows={5} />
      <Button guideId="run-add-note" label={seg.type === 'sermon' ? 'Add sermon notes' : 'Add note'} icon={<PlusIcon size={14} />} disabled={!note.trim()} type="submit" />
    </form> : kind === 'verse' ? <div className="run-note-form">
      <label>Scripture reference</label>
      <ScriptureReferenceInput books={books} value={verse} onChange={setVerse} onReferenceChange={setReference} onSubmit={addVerse} />
      <Button guideId="run-add-verse" label="Add verse" icon={<PlusIcon size={14} />} disabled={!reference} onClick={() => reference && addVerse(reference)} />
    </div> : <>
      <div className="run-local-library-heading"><h4>{LIBRARY_LABELS[kind]}</h4><span>{previewSongs ? 'Preview library' : 'On this device'}</span></div>
      <div className="run-picker-toolbar">
        <label className="run-local-search"><SearchIcon size={14} /><input type="search" data-guide="run-library-search" aria-label={`Search saved ${kind}`} placeholder={`Search your ${kind === 'music' ? 'songs' : kind === 'image' ? 'images' : kind === 'video' ? 'videos' : 'slides'}…`} value={query} onChange={e => setQuery(e.target.value)} /></label>
        {(kind === 'image' || kind === 'video' || kind === 'slides') && <Button guideId="run-from-device" label={busy ? 'Adding…' : 'From device'} disabled={busy} icon={<PlusIcon size={14} />} onClick={() => void importFiles()} />}
      </div>
      <p className="run-hint">{previewSongs ? 'Preview songs are shown here. Your saved song library appears in the desktop app.' : 'Choose from your saved library. Click a card to add it to this section.'}</p>
      {loadError && <div className="run-picker-load-error" role="status"><span>{loadError}</span><Button guideId="run-library-retry" label="Try again" onClick={() => setReload(value => value + 1)} /></div>}
      <div className="run-content-grid" aria-busy={loading}>
        {shown.map((item, index) => <button key={`${item.songId ?? item.path ?? item.label}:${index}`} type="button" data-guide="run-library-item" className="run-library-card" {...drag.bind(() => item)} onClick={() => add([item])} title={`Add ${item.label}`}>
          <ContentPreview item={item} /><span className="run-content-label">{item.title ?? item.label}</span>
          {item.section && <span className="run-card-meta">{item.section}</span>}
          <span className="run-library-add"><PlusIcon size={13} /></span>
        </button>)}
      </div>
      {!shown.length && !loadError && <p className="run-picker-empty">{loading ? 'Loading your library…' : query ? 'No matches in your saved library.' : kind === 'music' ? 'No saved songs yet. Add songs to your music library, then choose them here.' : `No saved ${kind === 'image' ? 'images' : kind === 'video' ? 'videos' : 'slides'} yet. Choose files from your device to add them.`}</p>}
    </>}
    <p role="status" className="run-picker-notice">{notice}</p>
  </div>;
}
