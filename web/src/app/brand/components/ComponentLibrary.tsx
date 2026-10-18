'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import catalog from './catalog.json';
import './components.css';

type Mode = 'studies' | 'source' | 'checklist';
type Density = 'compact' | 'comfortable' | 'touch';
const fontEntry = { id: 'typography', title: 'Typography', group: 'Foundations', description: 'The typefaces currently used in the desktop app.', kind: 'Foundation', file: 'src/ui/fonts.css', preview: null };
const studies = [fontEntry, ...catalog.studies];
const allEntries = [...studies, ...catalog.components];

export default function ComponentLibrary() {
  const [mode, setMode] = useState<Mode>('studies');
  const [selected, setSelected] = useState('sheet:C-01');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('All');
  const [view, setView] = useState<'preview' | 'source'>('preview');
  const [density, setDensity] = useState<Density>('comfortable');
  const [radius, setRadius] = useState(6);
  const [source, setSource] = useState<Record<string, string> | null>(null);
  const [sourceError, setSourceError] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const entry = allEntries.find(item => item.id === selected) ?? studies[1];
  const preview = entry.preview;
  const isCompanion = preview?.startsWith('web:');
  const previewUrl = preview?.startsWith('web:') ? `/brand/companion-preview?preview=${encodeURIComponent(preview.slice(4))}` : `/brand/component-preview/brand-components.html?preview=${encodeURIComponent(preview ?? '')}`;
  const isScreen = preview?.startsWith('screen:');
  const sourceEntry = 'scope' in entry ? entry : catalog.components.find(item => item.preview === entry.preview);

  useEffect(() => {
    const restore = () => {
      const id = new URLSearchParams(location.search).get('component');
      if (id && allEntries.some(item => item.id === id)) { setSelected(id); setMode(id.startsWith('source:') ? 'source' : 'studies'); }
    };
    restore(); window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    try { setNote(localStorage.getItem(`trilorah-brand-note:${selected}`) ?? ''); } catch { setNote(''); }
    setSaved('');
  }, [selected]);
  useEffect(() => {
    if (view !== 'source' || source) return;
    const controller = new AbortController();
    fetch('/brand/component-library/sources.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Source unavailable');
      return response.json();
    }).then(setSource).catch(error => { if (error.name !== 'AbortError') setSourceError(true); });
    return () => controller.abort();
  }, [view, source]);
  const sendTokens = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: 'trilorah-brand-tokens', density, radius }, location.origin);
  }, [density, radius]);
  useEffect(() => {
    sendTokens();
    const ready = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.origin === location.origin && event.data?.type === 'trilorah-brand-ready') sendTokens(); };
    window.addEventListener('message', ready);
    return () => window.removeEventListener('message', ready);
  }, [sendTokens]);

  function choose(id: string) {
    setSelected(id); setView('preview');
    const url = new URL(location.href); url.searchParams.set('section', 'components'); url.searchParams.set('component', id);
    history.replaceState(null, '', url);
  }
  function saveNote() {
    try { localStorage.setItem(`trilorah-brand-note:${selected}`, note); setSaved('Saved in this browser.'); } catch { setSaved('Could not save. Copy your note before leaving.'); }
  }
  function exportTokens() {
    const blob = new Blob([JSON.stringify({ status: 'proposal', density, tokens: { '--tri-radius-control': `${radius}px` }, component: entry.title, note }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'trilorah-component-proposal.json'; a.click(); URL.revokeObjectURL(url);
  }
  const items = mode === 'source' ? catalog.components : studies;
  const filtered = items.filter(item => (group === 'All' || item.group === group) && `${item.title} ${item.file} ${item.group}`.toLowerCase().includes(query.toLowerCase()));
  const checklist = catalog.checklist.filter(item => `${item.title} ${item.description} ${item.section} ${item.id}`.toLowerCase().includes(query.toLowerCase()));

  return <section className="cl-library" aria-label="Trilorah component design system">
    <div className="cl-summary"><p><span className="cl-live-dot" /> Built from the app</p><span><b>{catalog.components.length}</b> source components</span><span><b>{catalog.studies.length}</b> preview studies</span><a href="https://vercel.com/geist/introduction" target="_blank" rel="noreferrer">Reference: Geist ↗</a></div>
    <div className="cl-layout">
      <aside className="cl-sidebar">
        <label className="cl-search"><span>Search the library</span><input type="search" placeholder="Button, scripture, modal…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="cl-modes" role="group" aria-label="Library catalogue">
          {(['studies', 'source', 'checklist'] as const).map(item => <button key={item} aria-pressed={mode === item} onClick={() => { setMode(item); setGroup('All'); }}>{item === 'studies' ? 'Previews' : item === 'source' ? 'All components' : 'Design checklist'}</button>)}
        </div>
        {mode !== 'checklist' && <label className="cl-category">Category<select value={group} onChange={event => setGroup(event.target.value)}><option>All</option>{catalog.groups.filter(name => items.some(item => item.group === name)).map(name => <option key={name}>{name}</option>)}</select></label>}
        <p className="cl-results" role="status">{mode === 'checklist' ? checklist.length : filtered.length} entries{query ? ` matching “${query}”` : ''}</p>
        {mode === 'checklist' ? <p className="cl-sidebar-note">The original design checklist includes planned patterns. It is separate from components that exist in source.</p> : <nav className="cl-tree" aria-label="Component navigation">
          {catalog.groups.map(name => {
            const entries = filtered.filter(item => item.group === name);
            return entries.length ? <div key={name}><h3>{name}<span>{entries.length}</span></h3>{entries.map(item => <button key={item.id} aria-current={selected === item.id ? 'true' : undefined} onClick={() => choose(item.id)}><span>{item.title}</span>{item.preview && <i title="Has a preview" aria-label="Has a preview" />}</button>)}</div> : null;
          })}
          {!filtered.length && <p className="cl-sidebar-note">No matches. Try a shorter name or another category.</p>}
        </nav>}
      </aside>
      <div className="cl-content">
        {mode === 'checklist' ? <><div className="cl-entry-header"><span className="cl-kicker">DESIGN COVERAGE</span><h2>The bigger picture.</h2><p>{catalog.checklist.length} original checklist entries, including future ideas. These are review prompts, not a claim that every pattern is built.</p></div><div className="cl-checklist">{checklist.map((item, i) => <article key={`${item.id}-${i}`}><span>{item.id}</span><div><h3>{item.title}</h3><p>{item.description}</p><small>{item.section}</small></div><span className="cl-badge">To review</span></article>)}{!checklist.length && <p>No checklist entries match this search.</p>}</div></> : <>
          <div className="cl-entry-header"><div className="cl-entry-meta"><span className="cl-kicker">{entry.group}</span><span className="cl-badge">{'kind' in entry ? entry.kind : entry.preview ? 'Preview available' : 'Source indexed'}</span></div><h2>{entry.title}</h2><p>{'description' in entry ? entry.description : `An ${entry.scope.toLowerCase()} in ${entry.group.toLowerCase()}. Keep its behavior in view while refining the design.`}</p><code className="cl-source-path">{entry.file}{'line' in entry ? `:${entry.line}` : ''}</code></div>
          {entry.id === 'typography' ? <Typography /> : <>
            <div className="cl-preview-tabs" role="group" aria-label="Component view"><button aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Preview</button><button aria-pressed={view === 'source'} onClick={() => setView('source')}>Source</button>{preview && <a href={previewUrl} target="_blank" rel="noreferrer">Open full size ↗</a>}</div>
            {view === 'source' ? <div className="cl-source-view"><p>Current source · reference for the next design pass</p>{sourceEntry ? <pre><code>{sourceError ? 'Source could not load. Reopen this page to try again.' : source?.[sourceEntry.id] ?? 'Loading component source…'}</code></pre> : <div className="cl-source-hint">This study assembles several components. Find individual implementations in <button onClick={() => { setMode('source'); setQuery(''); setGroup(entry.group); }}>All components →</button><code>{entry.file}</code></div>}</div> : preview ? <>
              {!isCompanion && <div className="cl-preview-controls"><label>Density<select value={density} onChange={event => setDensity(event.target.value as Density)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="touch">Touch</option></select></label><label>Control radius <output>{radius}px</output><input aria-label="Control radius" type="range" min="0" max="20" value={radius} onChange={event => setRadius(Number(event.target.value))} /></label><button onClick={() => { setDensity('comfortable'); setRadius(6); }}>Reset</button></div>}
              <div className="cl-preview-frame"><iframe ref={frame} key={preview} src={previewUrl} title={`${entry.title} interactive preview`} sandbox="allow-scripts allow-same-origin" onLoad={sendTokens} className={isScreen ? 'cl-screen-frame' : ''} /></div><div className="cl-preview-caption"><span>Actual components · local example data</span><span>{isScreen ? '1280 × 800 canvas · scroll inside to explore' : 'Try hover, focus, selection, and disabled states'}</span></div>
              <p className="cl-footnote">{isCompanion ? 'This phone canvas uses the companion’s own styles and local sample data.' : 'Density and radius affect components using those tokens. Preview changes stay here; device and cloud features require the app.'}</p>
            </> : <div className="cl-unpreviewed"><span className="cl-outline-shape">＋</span><h3>Give this component its own canvas.</h3><p>Its source is in the library. A standalone fixture still needs to be added before it can be edited visually here.</p><button onClick={() => setView('source')}>Inspect current source →</button><button onClick={() => { setMode('studies'); setQuery(''); setGroup('Screens'); }}>Explore complete screen studies →</button></div>}
          </>}
          <details className="cl-review"><summary>Design notes <span>For the next iteration ＋</span></summary><label htmlFor="cl-note">What should we keep, change, or test?</label><textarea id="cl-note" value={note} onChange={event => { setNote(event.target.value); setSaved('Unsaved changes'); }} placeholder="For example: soften the border, keep the duo selected state, check keyboard focus…" /><div><button onClick={saveNote}>Save note</button><button onClick={exportTokens}>Export proposal ↗</button><span role="status">{saved || 'Notes are stored only in this browser.'}</span></div></details>
          <div className="cl-type-reminder"><span>Aa</span><div><strong>Our interface font is Geist.</strong><p>Geist Mono for technical details. Georgia for scripture.</p></div><button onClick={() => { setMode('studies'); choose('typography'); }}>See typography ↗</button></div>
        </>}
      </div>
    </div>
    <p className="cl-library-footer">A working inventory of desktop and companion UI, including internal components. Icon glyphs are grouped in one study. Rebuild from source with <code>npm run brand:components</code>.</p>
  </section>;
}

function Typography() {
  return <div className="cl-type-studies"><article><header><span>01 / INTERFACE</span><span>Geist · variable · 100–900</span></header><div className="cl-geist-sample">For the people<br />doing a lot.</div><p>Navigation, buttons, forms, headings, and body copy.</p></article><article><header><span>02 / TECHNICAL DETAILS</span><span>Geist Mono · variable</span></header><div className="cl-mono-sample">00:24:18<br />MIC 01 · CONNECTED</div><p>Time, measurements, source code, and technical values.</p></article><article><header><span>03 / SCRIPTURE</span><span>Georgia · system serif</span></header><blockquote>“Be still, and know<br />that I am God.”</blockquote><p>Psalm 46:10 · KJV</p></article><p className="cl-type-note">Geist and Geist Mono are bundled locally in the desktop app. The website currently uses an Inter/system stack; the original brand boards remain type explorations.</p></div>;
}
