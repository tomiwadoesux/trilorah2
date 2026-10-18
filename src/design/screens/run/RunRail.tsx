import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { RUN_COMPONENTS, runItemTarget, runSelectionRange, runTarget } from '../../../../shared/runCards';
import { useLibraryNavigation } from '../../../stores/libraryNavigation';
import { surface } from '../../../ui/lib/surface';
import { ArrowLeftIcon, ArrowIcon, Button, CheckIcon, ClipboardIcon, CloseIcon, CopyIcon, GripIcon, ImportIcon, PencilIcon, PlusIcon, ScanIcon, SearchIcon, TrashIcon } from '../../../ui';
import { useDrag } from '../drag';
import { useProjector } from '../projector';
import { EmptyMark } from '../emptyArt';
import { useRun, type QueueItem, type RunSegment } from '../run';
import { ContextMenu, useContextMenu, type ContextMenuItem } from './ContextMenu';
import { askRun, DefaultRunButton, RunHeaderActions, type RunAsk } from './RunHeaderActions';
import { ContentPreview, RunContentPicker } from './RunContentPicker';
import { RunSongEditor, type LibrarySong } from './RunSongEditor';
import { LayeredProgrammeArt } from './LayeredProgrammeArt';
import { segmentIcon, segmentTypeLabel } from './segmentTypes';
import './run.css';

function followCardEdge(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || event.buttons || !window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
  const card = event.currentTarget;
  const light = card.querySelector<HTMLElement>('.run-card-glint');
  if (!light) return;
  const rect = card.getBoundingClientRect();
  // Account for the design preview's zoom without moving the card or its contents.
  const x = (event.clientX - rect.left) * card.offsetWidth / rect.width;
  const y = (event.clientY - rect.top) * card.offsetHeight / rect.height;
  light.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function CardEdge() {
  return <span className="run-card-edge" aria-hidden="true"><span className="run-card-glint" /></span>;
}

function ComponentPicker({ onAdded }: { onAdded: () => void }) {
  const run = useRun();
  const drag = useDrag();
  return <div className="run-component-picker">
    <p className="run-hint">Choose a section or drag it into your run.</p>
    <div className="run-component-grid">
      {RUN_COMPONENTS.map(type => <button key={type.id} type="button" data-guide={`run-add-${type.id}`} className="run-component-card" data-component={type.id} {...drag.bind(() => ({ source: 'note', label: type.label, dragType: type.id }))}
        onPointerEnter={followCardEdge} onPointerMoveCapture={followCardEdge}
        onClick={() => { run.addSegments([type]); onAdded(); }}>
        <CardEdge />
        <span className="run-component-icon">{segmentIcon(type.id, 28)}</span><span>{type.label}</span>
      </button>)}
    </div>
  </div>;
}

function SegmentCard({ seg, index, selectedKeys, onSelect, onToggle, onOpen }: {
  seg: RunSegment; index: number; selectedKeys: string[];
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void; onToggle: () => void; onOpen: (origin: HTMLElement) => void;
}) {
  const run = useRun();
  const drag = useDrag();
  const menu = useContextMenu();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(seg.label);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renaming) { input.current?.focus(); input.current?.select(); } }, [renaming]);
  const commit = () => { if (draft.trim()) run.renameSegment(seg.key, draft.trim()); setRenaming(false); };
  const target = runTarget(drag.over);
  const over = drag.over !== null && target.segmentKey === seg.key;
  const intent = over ? target.sectionPosition ?? 'inside' : undefined;
  const selected = selectedKeys.includes(seg.key);
  const group = selected && selectedKeys.length > 1;
  const items: ContextMenuItem[] = [
    ...(group ? [
      { id: 'selected-up', label: `move ${selectedKeys.length} sections earlier`, icon: <ArrowIcon className="-rotate-90" size={13} /> },
      { id: 'selected-down', label: `move ${selectedKeys.length} sections later`, icon: <ArrowIcon className="rotate-90" size={13} /> },
      { id: 'selected-remove', label: `remove ${selectedKeys.length} sections`, icon: <TrashIcon size={13} />, danger: true },
    ] : []),
    { id: 'open', label: 'open section', icon: segmentIcon(seg.type) },
    { id: 'rename', label: 'rename', icon: <PencilIcon size={13} /> },
    ...(index ? [{ id: 'up', label: 'move earlier', icon: <ArrowIcon className="-rotate-90" size={13} /> }] : []),
    ...(index < run.segments.length - 1 ? [{ id: 'down', label: 'move later', icon: <ArrowIcon className="rotate-90" size={13} /> }] : []),
    { id: 'type', label: 'change type', icon: segmentIcon(seg.type), items: RUN_COMPONENTS.map(c => ({ id: `type:${c.id}`, label: c.label, icon: segmentIcon(c.id), checked: seg.type === c.id })) },
    { id: 'duplicate', label: 'duplicate', icon: <CopyIcon size={13} /> },
    ...(seg.items.length ? [{ id: 'clear', label: 'clear contents', icon: <TrashIcon size={13} />, danger: true }] : []),
    { id: 'remove', label: 'remove section', icon: <TrashIcon size={13} />, danger: true },
  ];
  const button = useRef<HTMLButtonElement>(null);
  return <li className="run-segment-tile" data-component={seg.type} data-run-section={seg.key} data-run-label={seg.label} data-selected={selected || undefined} {...drag.dropProps(seg.key)} data-drop-intent={intent} data-dragging={drag.active?.dragSegmentKey === seg.key || drag.active?.dragSegmentKeys?.includes(seg.key) || undefined} {...menu.pointer}
    onPointerEnter={followCardEdge} onPointerMoveCapture={followCardEdge}>
    <CardEdge />
    {renaming ? <div className="run-segment-rename">{segmentIcon(seg.type, 28)}<input ref={input} data-guide="run-section-name" aria-label="Section name" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { e.stopPropagation(); setRenaming(false); } }} /></div>
      : <button ref={button} type="button" data-guide={`run-section-${seg.type}`} className="run-segment-open" {...menu.keys}
        {...drag.bind(() => ({ source: 'note', label: group ? `${selectedKeys.length} sections` : seg.label, dragSegmentKey: seg.key, dragSegmentKeys: group ? selectedKeys : undefined, componentType: seg.type }))}
        onClick={onSelect} onDoubleClick={e => { if (selected && !e.metaKey && !e.ctrlKey && !e.shiftKey) onOpen(e.currentTarget); }} aria-label={`Open ${seg.label}, ${seg.items.length} ${seg.items.length === 1 ? 'item' : 'items'}${selected ? ', selected' : ''}`} aria-haspopup="dialog" title={`${seg.label} · drag to reorder · Shift-click to select a range`}>
        <span className="run-card-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="run-card-grip"><GripIcon size={13} /></span>
        <span className="run-component-icon">{segmentIcon(seg.type, 28)}</span>
        <span className="run-segment-label">{seg.label}</span>
        <span className="run-card-meta">{seg.items.length} {seg.items.length === 1 ? 'item' : 'items'}</span>
      </button>}
    {!renaming && <>
      <button type="button" data-guide="run-section-select" className="run-section-select-toggle" role="checkbox" aria-checked={selected} aria-label={`Select ${seg.label}`} title={`Select ${seg.label}`} onClick={onToggle}>{selected && <CheckIcon size={11} />}</button>
      <button type="button" data-guide="run-section-remove" className="run-section-remove" aria-label={`Remove ${seg.label}`} title={`Remove ${seg.label}`} onClick={() => run.removeSegment(seg.key)}><TrashIcon size={12} /></button>
    </>}
    {intent && <span className="run-drop-marker" aria-hidden="true">{intent === 'swap' ? 'Swap' : intent === 'inside' ? 'Add here' : ''}</span>}
    <ContextMenu at={menu.at} items={items} label={`${seg.label} section actions`} onClose={menu.close} onSelect={picked => {
      if (picked.id === 'open' && button.current) onOpen(button.current);
      else if (picked.id === 'rename') { setDraft(seg.label); setRenaming(true); }
      else if (picked.id === 'up') run.moveSegment(seg.key, -1);
      else if (picked.id === 'down') run.moveSegment(seg.key, 1);
      else if (picked.id === 'duplicate') run.duplicateSegment(seg.key);
      else if (picked.id === 'clear') run.clearSegment(seg.key);
      else if (picked.id === 'remove') run.removeSegment(seg.key);
      else if (picked.id === 'selected-up') run.moveSegments(selectedKeys, -1);
      else if (picked.id === 'selected-down') run.moveSegments(selectedKeys, 1);
      else if (picked.id === 'selected-remove') run.removeSegments(selectedKeys);
      else if (picked.id.startsWith('type:')) {
        const type = RUN_COMPONENTS.find(c => c.id === picked.id.slice(5))!;
        run.setSegmentType(seg.key, type, RUN_COMPONENTS.find(c => c.id === seg.type)?.label ?? segmentTypeLabel(seg.type));
      }
    }} />
  </li>;
}

function QueuedItemCard({ seg, item, index, onEditSong, onOpenLibrary }: {
  seg: RunSegment; item: QueueItem; index: number;
  onEditSong: (item: QueueItem, origin: HTMLElement | null) => void; onOpenLibrary: () => void;
}) {
  const run = useRun();
  const drag = useDrag();
  const projector = useProjector();
  const menu = useContextMenu();
  const note = useRef<HTMLTextAreaElement>(null);
  const row = useRef<HTMLLIElement>(null);
  const target = runItemTarget(seg.key, item.key);
  const carry = () => ({ ...item, dragItem: { segmentKey: seg.key, itemKey: item.key } });
  const canGoLive = item.source === 'scripture' || (item.source === 'song' && !!item.lines?.length) || (!!item.path && item.source !== 'note');
  const live = canGoLive && projector.isLive(item.source === 'note' ? 'scripture' : item.source, item.label);
  const send = () => {
    if (live) { projector.clear(); return; }
    if (item.source === 'scripture') projector.send({ source: 'scripture', id: item.label, label: item.label, reference: item.label });
    else if (item.source === 'song') {
      if (item.songId) useLibraryNavigation.getState().selectSong(item.songId);
      projector.send({ source: 'song', id: item.label, label: item.label, title: item.title, section: item.section, lines: item.lines });
    } else if (item.path && (item.source === 'media' || item.source === 'presentation')) projector.send({ source: item.source, id: item.label, label: item.label, path: item.path, mediaKind: item.mediaKind });
  };
  const move = (destination: string, before?: string) => run.dropInto(before ? runItemTarget(destination, before) : destination, [carry()]);
  const actions: ContextMenuItem[] = [
    ...(item.source === 'song' ? [{ id: 'edit', label: 'edit song', icon: <PencilIcon size={13} /> }] : []),
    ...(index ? [{ id: 'earlier', label: 'move earlier' }] : []),
    ...(index < seg.items.length - 1 ? [{ id: 'later', label: 'move later' }] : []),
    { id: 'move', label: 'move to section', items: run.segments.filter(s => s.key !== seg.key).map(s => ({ id: `move:${s.key}`, label: s.label, icon: segmentIcon(s.type) })) },
    { id: 'remove', label: 'remove item', danger: true, icon: <TrashIcon size={13} /> },
  ].filter(a => a.id !== 'move' || run.segments.length > 1);
  return <li ref={row} className="run-content-card" {...drag.dropProps(target)} data-drop-item data-drop-label={item.title ?? item.label ?? 'item'} {...menu.pointer} data-over={drag.over === target || undefined} data-live={live || undefined}>
    {item.source === 'note' ? <div className="run-note-card">
      <button type="button" className="run-note-handle" {...drag.bind(carry)} {...menu.keys} aria-label="Drag note" title="Drag note to reorder or move">{segmentIcon('notes', 22)}<GripIcon size={14} /></button>
      <textarea ref={note} data-guide="run-note-text" aria-label="Edit note" autoFocus={!item.label} value={item.label} onChange={e => run.updateItem(seg.key, item.key, e.target.value)} placeholder="Type a note…" />
    </div> : <button type="button" data-guide="run-item-open" className="run-content-open" {...drag.bind(carry)} {...menu.keys} onClick={() => { useLibraryNavigation.getState().open(item); onOpenLibrary(); }} title={`Preview ${item.label}`}>
      <ContentPreview item={item} /><span className="run-content-label">{item.title ?? item.label}</span>
      {item.section && <span className="run-card-meta">{item.section}</span>}
    </button>}
    <div className="run-content-actions">
      <span className="run-card-meta">{index + 1}</span>
      {canGoLive && <button type="button" data-guide="run-item-live" className="run-live-button" onClick={send}>{live ? 'Take down' : 'Go live'}</button>}
      {item.source === 'song' && <button type="button" data-guide="run-item-edit" aria-label={`Edit ${item.label}`} onClick={() => onEditSong(item, row.current)}><PencilIcon size={13} /></button>}
      <button type="button" data-guide="run-item-remove" className="run-remove-action" aria-label={`Remove ${item.label || 'note'}`} onClick={() => run.remove(seg.key, item.key)}><CloseIcon size={13} /></button>
    </div>
    <ContextMenu at={menu.at} label={`${item.label || 'Note'} actions`} items={actions} onClose={menu.close} onSelect={picked => {
      if (picked.id === 'remove') run.remove(seg.key, item.key);
      else if (picked.id === 'edit') onEditSong(item, row.current);
      else if (picked.id === 'earlier') move(seg.key, seg.items[index - 1].key);
      else if (picked.id === 'later') move(seg.key, seg.items[index + 2]?.key);
      else if (picked.id.startsWith('move:')) move(picked.id.slice(5));
    }} />
  </li>;
}

function ScheduleRow({ seg, index, selected, onSelect }: { seg: RunSegment; index: number; selected: boolean; onSelect: () => void }) {
  const run = useRun();
  const drag = useDrag();
  const menu = useContextMenu();
  const target = runTarget(drag.over);
  const intent = drag.over !== null && target.segmentKey === seg.key ? target.sectionPosition ?? 'inside' : undefined;
  const actions: ContextMenuItem[] = [
    ...(index > 0 ? [{ id: 'up', label: 'move earlier', icon: <ArrowIcon className="-rotate-90" size={13} /> }] : []),
    ...(index < run.segments.length - 1 ? [{ id: 'down', label: 'move later', icon: <ArrowIcon className="rotate-90" size={13} /> }] : []),
    { id: 'duplicate', label: 'duplicate section', icon: <CopyIcon size={13} /> },
    ...(seg.items.length ? [{ id: 'clear', label: 'clear contents', icon: <TrashIcon size={13} />, danger: true }] : []),
    { id: 'remove', label: 'remove section', icon: <TrashIcon size={13} />, danger: true },
  ];
  return <li className="run-schedule-row" data-run-section={seg.key} data-run-label={seg.label} data-selected={selected || undefined}
    data-drop-intent={intent} data-dragging={drag.active?.dragSegmentKey === seg.key || undefined} {...drag.dropProps(seg.key)} {...menu.pointer}>
    <span className="run-schedule-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <button type="button" data-guide={`run-schedule-${seg.type}`} className={`run-schedule-select ${surface({ tone: selected ? 'default' : 'ash', interactive: true })}`} data-active={selected || undefined} aria-current={selected ? 'step' : undefined} aria-label={`Select ${seg.label}, section ${index + 1}`}
      {...drag.bind(() => ({ source: 'note', label: seg.label, dragSegmentKey: seg.key, componentType: seg.type }))}
      onClick={onSelect} title="Drag to arrange. Alt + Up or Down to move."
      onKeyDown={event => {
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); run.moveSegment(seg.key, event.key === 'ArrowUp' ? -1 : 1); }
        else menu.keys.onKeyDown(event);
      }}>
      <span className="run-schedule-type">{segmentIcon(seg.type, 19)}</span>
      <span className="run-schedule-name"><strong>{seg.label}</strong><small>{seg.items.length} {seg.items.length === 1 ? 'item' : 'items'}</small></span>
      <GripIcon size={14} className="run-schedule-grip" />
    </button>
    {intent && <span className="run-schedule-drop" aria-hidden="true">{intent === 'swap' ? 'Swap sections' : intent === 'inside' ? 'Add here' : ''}</span>}
    <ContextMenu at={menu.at} items={actions} label={`${seg.label} schedule actions`} onClose={menu.close} onSelect={item => {
      if (item.id === 'up' || item.id === 'down') run.moveSegment(seg.key, item.id === 'up' ? -1 : 1);
      else if (item.id === 'duplicate') run.duplicateSegment(seg.key);
      else if (item.id === 'clear') run.clearSegment(seg.key);
      else if (item.id === 'remove') run.removeSegment(seg.key);
    }} />
  </li>;
}

const SECTION_EMPTY_COPY: Record<string, string> = {
  music: 'Add songs and the sections you want to present.',
  sermon: 'Keep your message outline and sermon notes together.',
  slides: 'Choose slides from your library or import a presentation.',
  notes: 'Keep reminders and cues for this part of the service.',
  image: 'Choose photos and graphics from your library or files.',
  video: 'Choose video clips from your library or import files.',
  verse: 'Add the scripture references for this part of the service.',
};

function SectionDialog({ seg, onSelect, onClose, onEditSong, fallbackSongs }: {
  seg: RunSegment; onSelect: (key: string) => void; onClose: () => void;
  onEditSong: (item: QueueItem, origin: HTMLElement | null) => void; fallbackSongs?: readonly LibrarySong[];
}) {
  const run = useRun();
  const drag = useDrag();
  const [adding, setAdding] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [query, setQuery] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const sectionPicker = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById('root');
    const wasInert = root?.inert;
    if (root) root.inert = true;
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      if (root) root.inert = wasInert ?? false;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { setAdding(false); setQuery(''); }, [seg.key]);
  useEffect(() => {
    if (!addingSection) return;
    sectionPicker.current?.scrollIntoView({ block: 'nearest' });
    sectionPicker.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [addingSection]);
  const over = drag.over !== null && runTarget(drag.over).segmentKey === seg.key;
  const position = run.segments.findIndex(s => s.key === seg.key) + 1;
  const search = query.trim().toLocaleLowerCase();
  const shownItems = seg.items.map((item, index) => ({ item, index })).filter(({ item }) =>
    !search || [item.label, item.title, item.section, item.quote, ...(item.lines ?? [])].filter(Boolean).join(' ').toLocaleLowerCase().includes(search));
  const clearSearch = () => { setQuery(''); searchInput.current?.focus(); };
  const showPicker = () => { setQuery(''); setAdding(true); };
  return createPortal(<div className="run-dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={dialog} className="run-section-dialog" role="dialog" aria-modal="true" aria-labelledby="run-schedule-title" data-typing-scope="local"
      onKeyDown={e => {
        if (e.key === 'Escape' && !drag.active) { e.preventDefault(); e.stopPropagation(); if (addingSection) setAddingSection(false); else if (adding) setAdding(false); else closeRef.current(); }
        if (e.key === 'Tab') {
          const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, [tabindex="0"]') ?? [])].filter(n => n.getClientRects().length);
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="run-dialog-header">
        <button type="button" data-guide="run-dialog-back" className="run-dialog-icon" aria-label="Back to run of show" onClick={onClose}><ArrowLeftIcon size={18} /></button>
        <div className="run-dialog-heading"><h2 id="run-schedule-title">Service schedule</h2><p>{run.segments.length} sections · Arrange your running order</p></div>
        <button type="button" data-guide="run-dialog-close" className="run-dialog-icon" aria-label="Close schedule" onClick={onClose}><CloseIcon size={18} /></button>
      </header>
      <div className="run-dialog-body">
        <section className="run-schedule-pane" aria-label="Full schedule">
          <header className="run-pane-heading"><div><h3>Running order <span className="run-pane-count">{run.segments.length}</span></h3><p>Drag sections to arrange</p></div><DefaultRunButton label="Default" /></header>
          <div className="run-schedule-scroll" data-run-scroll data-drop-segment="">
            <ol className="run-schedule-list" data-run-sections data-run-layout="timeline" aria-label="Schedule sections">
              {run.segments.map((s, i) => <ScheduleRow key={s.key} seg={s} index={i} selected={s.key === seg.key} onSelect={() => onSelect(s.key)} />)}
            </ol>
            <div className="run-schedule-end"><span />End of schedule</div>
            {addingSection && <div ref={sectionPicker} className="run-schedule-picker"><div className="run-picker-heading"><span>Add a section</span><button type="button" data-guide="run-dialog-picker-close" aria-label="Close section picker" onClick={() => setAddingSection(false)}><CloseIcon size={14} /></button></div><ComponentPicker onAdded={() => setAddingSection(false)} /></div>}
          </div>
          <button type="button" data-guide="run-dialog-add-section" className="run-schedule-add" onClick={() => setAddingSection(v => !v)} aria-expanded={addingSection}><PlusIcon size={15} />Add section</button>
        </section>
        <div className="run-section-main" {...drag.dropProps(seg.key)} data-drop-label={seg.label} data-over={over || undefined}>
          <div className="run-section-toolbar"><div className="run-section-identity"><span className="run-section-symbol">{segmentIcon(seg.type, 24)}</span><div><p>Section {String(position).padStart(2, '0')} / {run.segments.length}</p><h3>{seg.label}</h3></div></div>
            {!adding && <div className="run-section-search"><SearchIcon size={15} />
              <input ref={searchInput} data-guide="run-content-search" type="search" aria-label={`Search ${seg.label} content`} placeholder="Search content…" value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); setQuery(''); } }} />
              {query && <button type="button" data-guide="run-content-search-clear" aria-label="Clear content search" onClick={clearSearch}><CloseIcon size={13} /></button>}
            </div>}
          </div>
          <div className="run-content-heading"><div><h4>{adding ? 'Add to this section' : 'Section content'}</h4><span aria-live="polite">{search ? `${shownItems.length} of ` : ''}{seg.items.length} {seg.items.length === 1 ? 'item' : 'items'}</span></div>
            <Button guideId="run-add-items" label={adding ? 'Back to content' : 'Add items'} icon={adding ? <ArrowLeftIcon size={13} /> : <PlusIcon size={13} />} onClick={() => adding ? setAdding(false) : showPicker()} />
          </div>
          <div className="run-section-scroll" data-run-scroll>
            {adding ? <RunContentPicker key={`${seg.key}:${seg.type}`} seg={seg} fallbackSongs={fallbackSongs} /> : search && !shownItems.length ? <div className="run-section-empty">
              <span className="run-empty-symbol"><SearchIcon size={32} /></span><h4>No matching content</h4><p>Try a different title or a few words from your content.</p>
              <Button guideId="run-clear-search" label="Clear search" onClick={clearSearch} />
            </div> : !seg.items.length ? <div className="run-section-empty">
              <span className="run-empty-symbol">{segmentIcon(seg.type, 38)}</span>
              <h4>Your {seg.label.toLowerCase()} content goes here</h4><p>{SECTION_EMPTY_COPY[seg.type] ?? 'Add the content for this part of the service.'}</p>
              <Button guideId="run-add-items-empty" label="Add items" icon={<PlusIcon size={14} />} onClick={showPicker} />
              <span className="run-empty-drop">You can also drag content into this section</span>
            </div> : <>
              <ul className="run-content-grid" aria-label={`${seg.label} items`}>
                {shownItems.map(({ item, index }) => <QueuedItemCard key={item.key} seg={seg} item={item} index={index} onEditSong={onEditSong} onOpenLibrary={onClose} />)}
                {!search && <li><button type="button" data-guide="run-add-more" className="run-add-content" onClick={showPicker}><PlusIcon size={24} /><span>Add more</span></button></li>}
              </ul>
            </>}
          </div>
          <p className="run-section-footnote">Drag items to arrange them or move them into another section.</p>
        </div>
      </div>
      <footer className="run-schedule-footer"><div><strong>Service tools</strong><span>Open, save, or add a programme.</span></div><div className="run-schedule-imports">
        <button type="button" data-guide="run-import" className={surface({ tone: 'ash', interactive: true })} onClick={() => askRun('tri')}><ImportIcon size={17} /><span><strong>Service files</strong><small>.tri, EasyWorship & more</small></span></button>
        <button type="button" data-guide="run-scan" className={surface({ tone: 'ash', interactive: true })} onClick={() => askRun('scan')}><ScanIcon size={17} /><span><strong>Scan image</strong><small>A printed programme</small></span></button>
        <button type="button" data-guide="run-paste" className={surface({ tone: 'ash', interactive: true })} onClick={() => askRun('paste')}><ClipboardIcon size={17} /><span><strong>Paste text</strong><small>Your order of service</small></span></button>
      </div></footer>
    </div>
  </div>, document.body);
}

export function RunOfService({ fallbackSongs, say }: { fallbackSongs?: readonly LibrarySong[]; say?: (line: { text: string }) => void }) {
  const run = useRun();
  const drag = useDrag();
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const selectionAnchor = useRef<string | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const marquee = useRef<{ pointer: number; x: number; y: number; base: string[]; moved: boolean } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<{ segKey: string; item: QueueItem; origin: HTMLElement | null } | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const pickerPanel = useRef<HTMLDivElement>(null);
  const section = run.segments.find(s => s.key === selected) ?? (selected ? run.segments[0] : undefined);
  const selectedKeys = selection.filter(key => run.segments.some(segment => segment.key === key));
  const openSection = (key: string, from: HTMLElement) => { origin.current = from; setSelected(key); };
  const range = (key: string) => runSelectionRange(run.segments.map(segment => segment.key), selectionAnchor.current, key);
  const toggle = (key: string) => {
    selectionAnchor.current = key;
    setSelection(previous => previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]);
  };
  const selectCard = (key: string, event: MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey) {
      const keys = range(key);
      setSelection(previous => event.metaKey || event.ctrlKey ? [...new Set([...previous, ...keys])] : keys);
      selectionAnchor.current ??= key;
    } else if (event.metaKey || event.ctrlKey) toggle(key);
    else {
      selectionAnchor.current = key;
      if (selectedKeys.length) setSelection([key]);
      else openSection(key, event.currentTarget);
    }
  };
  const removeSelected = () => { run.removeSegments(selectedKeys); setSelection([]); rail.current?.focus({ preventScroll: true }); };
  const beginMarquee = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || event.pointerType === 'touch' || drag.active || (event.target as HTMLElement).closest('button, input, textarea, [data-run-section], [data-run-picker]')) return;
    const node = event.currentTarget;
    const rect = node.getBoundingClientRect();
    const base = event.shiftKey || event.metaKey || event.ctrlKey ? selectedKeys : [];
    marquee.current = { pointer: event.pointerId, x: event.clientX - rect.left + node.scrollLeft, y: event.clientY - rect.top + node.scrollTop, base, moved: false };
    node.setPointerCapture(event.pointerId);
    node.focus({ preventScroll: true });
    if (!base.length) setSelection([]);
    event.preventDefault();
  };
  const updateMarquee = (event: PointerEvent<HTMLDivElement>) => {
    const start = marquee.current;
    if (!start || start.pointer !== event.pointerId) return;
    const node = event.currentTarget;
    const rect = node.getBoundingClientRect();
    if (event.clientY > rect.bottom - 24) node.scrollTop += 10;
    else if (event.clientY < rect.top + 24) node.scrollTop -= 10;
    const x = Math.max(0, Math.min(node.scrollWidth, event.clientX - rect.left + node.scrollLeft));
    const y = Math.max(0, Math.min(node.scrollHeight, event.clientY - rect.top + node.scrollTop));
    if (!start.moved && Math.hypot(x - start.x, y - start.y) < 4) return;
    start.moved = true;
    const box = { left: Math.min(start.x, x), top: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) };
    setSelectionBox(box);
    const keys = [...node.querySelectorAll<HTMLElement>('[data-run-section]')].filter(card => {
      const cardRect = card.getBoundingClientRect();
      const left = cardRect.left - rect.left + node.scrollLeft, top = cardRect.top - rect.top + node.scrollTop;
      return left < box.left + box.width && left + cardRect.width > box.left && top < box.top + box.height && top + cardRect.height > box.top;
    }).map(card => card.dataset.runSection!);
    setSelection([...new Set([...start.base, ...keys])]);
    if (keys.length) selectionAnchor.current = keys[0];
  };
  const endMarquee = (event: PointerEvent<HTMLDivElement>) => {
    if (marquee.current?.pointer !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    marquee.current = null;
    setSelectionBox(null);
  };
  const close = () => { setSelected(null); origin.current?.focus({ preventScroll: true }); };
  const closePicker = () => { setPicker(false); addButton.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (picker) pickerPanel.current?.scrollIntoView({ block: 'nearest' });
  }, [picker]);
  useEffect(() => {
    const asked = (event: Event) => { if ((event as CustomEvent<RunAsk>).detail === 'components') setPicker(v => !v); };
    window.addEventListener('trilorah-run-ask', asked);
    return () => window.removeEventListener('trilorah-run-ask', asked);
  }, []);
  return <>
    <div ref={rail} className="run-cards-scroll" data-run-scroll data-drop-segment="" tabIndex={0} aria-label="Run of show controls" data-selecting={selectionBox ? true : undefined}
      onPointerDown={beginMarquee} onPointerMove={updateMarquee} onPointerUp={endMarquee} onPointerCancel={endMarquee} onLostPointerCapture={endMarquee}
      onKeyDown={event => {
        if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="menu"]') || picker || drag.active) return;
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
          event.preventDefault(); event.stopPropagation(); setSelection(run.segments.map(segment => segment.key)); selectionAnchor.current ??= run.segments[0]?.key ?? null;
        } else if (event.key === 'Escape' && selectedKeys.length) {
          event.preventDefault(); event.stopPropagation(); setSelection([]);
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedKeys.length) {
          event.preventDefault(); event.stopPropagation(); removeSelected();
        } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && selectedKeys.length) {
          event.preventDefault(); event.stopPropagation(); run.moveSegments(selectedKeys, event.key === 'ArrowUp' ? -1 : 1);
        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && !event.altKey && !event.metaKey && !event.ctrlKey) {
          const current = (event.target as HTMLElement).closest<HTMLElement>('[data-run-section]');
          if (!current) return;
          const index = run.segments.findIndex(segment => segment.key === current.dataset.runSection);
          const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -3 : 3;
          const next = run.segments[index + delta];
          if (!next) return;
          event.preventDefault(); event.stopPropagation();
          if (event.shiftKey) { selectionAnchor.current ??= current.dataset.runSection!; setSelection(range(next.key)); }
          const card = [...(rail.current?.querySelectorAll<HTMLElement>('[data-run-section]') ?? [])].find(node => node.dataset.runSection === next.key);
          card?.querySelector<HTMLButtonElement>('.run-segment-open')?.focus();
        }
      }}>
      {!!run.segments.length && <div className="run-selection-toolbar" role={selectedKeys.length ? 'toolbar' : undefined} aria-label={selectedKeys.length ? 'Selected section actions' : undefined}>
        {!selectedKeys.length ? <span className="run-selection-hint">Drag space to select · Shift-click for more</span> : <>
        <span aria-live="polite">{selectedKeys.length} selected</span>
        <button type="button" data-guide="run-selected-earlier" aria-label="Move selected sections earlier" title="Move earlier · Alt + ↑" onClick={() => run.moveSegments(selectedKeys, -1)}><ArrowIcon className="-rotate-90" size={13} /></button>
        <button type="button" data-guide="run-selected-later" aria-label="Move selected sections later" title="Move later · Alt + ↓" onClick={() => run.moveSegments(selectedKeys, 1)}><ArrowIcon className="rotate-90" size={13} /></button>
        <button type="button" data-guide="run-selected-remove" className="run-selection-remove" aria-label="Remove selected sections" title="Remove selected · Delete" onClick={removeSelected}><TrashIcon size={13} /></button>
        <button type="button" data-guide="run-selection-clear" aria-label="Clear selection" title="Clear selection · Esc" onClick={() => setSelection([])}><CloseIcon size={13} /></button>
        </>}
      </div>}
      {!run.segments.length && <div className="run-rail-empty"><EmptyMark art={<LayeredProgrammeArt />} plain w={180} h={180} line="nothing in the run yet" hint="Add a section to start your service." /></div>}
      <ul className="run-component-grid" data-run-sections aria-label="Run of show" data-empty={!run.segments.length || undefined}>
        {run.segments.map((seg, index) => <SegmentCard key={seg.key} seg={seg} index={index} selectedKeys={selectedKeys} onSelect={event => selectCard(seg.key, event)} onToggle={() => toggle(seg.key)} onOpen={from => openSection(seg.key, from)} />)}
        <li className={!run.segments.length ? 'run-add-empty' : undefined}><button ref={addButton} type="button" data-guide="run-add-section" className="run-add-section-card" aria-label="Add a section" title="Add a section" aria-expanded={picker} onClick={() => setPicker(v => !v)}><PlusIcon size={22} />{!run.segments.length && <span>Add a section</span>}</button></li>
      </ul>
      {selectionBox && <div className="run-selection-box" aria-hidden="true" style={selectionBox} />}
      {picker && <div ref={pickerPanel} data-run-picker onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closePicker(); } }}>
        <div className="run-picker-heading"><span>Add a section</span><button type="button" data-guide="run-picker-close" aria-label="Close section picker" onClick={closePicker}><CloseIcon size={14} /></button></div>
        <ComponentPicker onAdded={closePicker} />
      </div>}
    </div>
    <RunHeaderActions say={say} onOverlayChange={setImporting} />
    {section && !editing && !importing && <SectionDialog seg={section} onSelect={setSelected} onClose={close} fallbackSongs={fallbackSongs}
      onEditSong={(item, from) => setEditing({ segKey: section.key, item, origin: from })} />}
    {editing && <RunSongEditor key={editing.item.key} item={editing.item} origin={editing.origin} fallbackSongs={fallbackSongs}
      onSaved={patch => run.patchItem(editing.segKey, editing.item.key, patch)} onClosed={() => setEditing(null)} />}
  </>;
}
