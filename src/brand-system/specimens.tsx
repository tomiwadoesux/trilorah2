import { useState, type ComponentType } from 'react';
import { ActionMenu, AddCard, ArrangeList, Button, SearchField, SlideThumb, TextTransitionPicker } from '../ui';
import * as Icons from '../ui/icons';
import { Panel, Pill, Dot, Meter, Scripture, Empty, NotAvailable } from '../design/screens/parts';
import { Waveform } from '../components/ui';
import type { TextTransition } from '../../shared/textTransitions';

export default function Specimens({ name }: { name: string }) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('Try the controls. Actions stay in this example.');
  const [selected, setSelected] = useState(0);
  const [transition, setTransition] = useState<TextTransition>('fade');
  const [play, setPlay] = useState(0);
  const [duo, setDuo] = useState(false);
  const [level, setLevel] = useState(-22);
  return <div className="specimen-extra">
    {name === 'search' && <><h2>Search field</h2><p>Default, populated, and disabled states using the app’s SearchField.</p><div className="space-y-5"><SearchField ariaLabel="Search the specimen library" value={query} onChange={setQuery} onSubmit={value => setMessage(`Search submitted: ${value || '(empty)'}`)} placeholder="search songs…" /><SearchField ariaLabel="Populated search" value="Amazing grace" onChange={() => {}} /><SearchField ariaLabel="Disabled search" disabled placeholder="search unavailable" /></div></>}
    {name === 'action-menu' && <><h2>Action menu</h2><p>Try an action or drill into the submenu.</p><ActionMenu trigger={<Button label="Add to service" icon={<Icons.PlusIcon />} />} groups={[{ items: [{ id: 'scripture', label: 'Scripture', icon: <Icons.BookIcon /> }, { id: 'song', label: 'Song', icon: <Icons.MusicIcon /> }, { id: 'more', label: 'More', items: [{ id: 'prayer', label: 'Prayer' }, { id: 'sermon', label: 'Sermon' }] }] }]} onSelect={item => setMessage(`Selected ${item.label}.`)} /></>}
    {name === 'arrange' && <><h2>Arrangement list</h2><p>Select segments, then change their order.</p><ArrangeList options={[{ id: 'welcome', label: 'Welcome' }, { id: 'worship', label: 'Worship' }, { id: 'scripture', label: 'Scripture' }, { id: 'sermon', label: 'Sermon' }]} commitLabel="Use this arrangement" onCommit={items => setMessage(`Arrangement: ${items.map(item => item.label).join(' → ') || 'empty'}`)} /></>}
    {name === 'slide-thumb' && <><h2>Slide thumbnails</h2><p>Selected, live, and resting cards. Click to select; the send action only updates this preview.</p><div className="specimen-grid">{['Verse 1', 'Chorus', 'Bridge'].map((label, index) => <SlideThumb key={label} label={label} index={index} selected={selected === index} live={index === 1} stanzas={[[index === 0 ? 'Be still, and know' : 'Your goodness and mercy', index === 0 ? 'that I am God.' : 'follow me.']]} onSelect={() => setSelected(index)} onSend={() => setMessage(`${label} sent to the demo screen.`)} onEdit={() => setMessage(`Editing ${label} in this example.`)} />)}<AddCard label="Add a slide" hint="Build the next moment" onClick={() => setMessage('Add slide selected.')} /></div></>}
    {name === 'add-card' && <><h2>Add card</h2><div className="specimen-grid"><AddCard label="Add a song" hint="Start with the words" onClick={() => setMessage('Add song selected.')} /><AddCard label="Import slides" hint="Bring a presentation" onClick={() => setMessage('Import selected.')} /></div></>}
    {name === 'transition' && <><h2>Text transitions</h2><p>Select a transition, or click the selected one to replay.</p><TextTransitionPicker value={transition} duration={450} play={play} onChange={value => { setTransition(value); setPlay(play + 1); }} /></>}
    {name === 'panels' && <><h2>Panels and status</h2><div className="specimen-grid"><Panel title="Ready for the room" blurb="A passage in preview"><Scripture>Be still, and know that I am God.</Scripture></Panel><Panel title="Live output" tone="live"><p>Approved content appears here.</p></Panel><Panel title="Waiting for a service" empty><Empty>No service yet.</Empty></Panel><Panel title="No connection"><NotAvailable reason="A display has not been connected." /></Panel></div></>}
    {name === 'status' && <><h2>Status and meters</h2><div className="specimen-group">{(['ok', 'warn', 'danger', 'idle'] as const).map(tone => <span key={tone} className="flex items-center gap-2 text-xs"><Dot tone={tone} />{tone}</span>)}</div><div className="specimen-group"><Pill>preview</Pill><Pill tone="live">live</Pill><Pill tone="warn">needs review</Pill></div><Meter level={.7} /><label className="mt-8 block text-xs">Audio level: {level} dB<input className="block w-full my-4" type="range" min="-60" max="0" value={level} onChange={event => setLevel(Number(event.target.value))} /></label><Waveform db={level} /></>}
    {name === 'icons' && <><h2>Nubo icons</h2><p>The actual app icon exports. Selected controls use the duo treatment.</p><div className="specimen-group"><button type="button" aria-pressed={duo} onClick={() => setDuo(!duo)} className="rounded border border-white/20 px-4 py-2 text-xs">{duo ? 'Duo selected' : 'Line default'}</button></div><div className="specimen-icon-grid">{Object.entries(Icons).filter(([key]) => key.endsWith('Icon') && !['TrilorahIcon', 'CutoutIcon'].includes(key)).map(([key, Value]) => { const Icon = Value as ComponentType<{ size?: number; selected?: boolean }>; return <div key={key}><Icon size={22} selected={duo} /><small>{key.replace(/Icon$/, '')}</small></div>; })}</div></>}
    <span className="specimen-feedback" role="status">{message}</span>
  </div>;
}
