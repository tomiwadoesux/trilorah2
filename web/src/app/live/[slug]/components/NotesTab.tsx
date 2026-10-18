'use client';
import { useState } from 'react';
import { Pencil, Check } from '@/components/icons';
import CompanionEmpty from './CompanionEmpty';
import SermonNotesSections, { notesAreEmpty, type SermonNotesData } from '@/components/SermonNotesSections';
import { putNote, notebookText } from '@/lib/companionNotebook';
import type { NotebookController } from '../useNotebook';
import ShareActions from './ShareActions';

export default function NotesTab({ notes, isLive, notebook, service }: {
  notes: SermonNotesData | null; isLive: boolean; notebook: NotebookController;
  service: { id: string; sermon_title: string | null; started_at: string };
}) {
  const hasNotes = !!notes && !notesAreEmpty(notes);
  const [chosen, setChosen] = useState<'church' | 'mine' | null>(null);
  const tab = chosen ?? (hasNotes ? 'church' : 'mine');
  const [editing, setEditing] = useState(service.id);
  const saved = notebook.book.notes.find(n => n.serviceId === editing);
  const title = saved?.title || service.sermon_title || 'Service notes';
  const date = saved?.date || new Date(service.started_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const personal = notebook.book.notes.filter(n => n.text.trim() && n.serviceId !== editing);
  const churchText = notes ? [notes.title, notes.theme, ...(notes.main_points ?? []).map(p => [p.point, p.explanation, p.scriptures.join(', ')].join('\n')), ...(notes.applications ?? []), ...(notes.memorable_quotes ?? []), ...(notes.definitions ?? []).map(d => d.term + ': ' + d.definition), (notes.all_scriptures ?? []).join(', ')].filter(Boolean).join('\n\n') : '';
  return <div className="resource-scroll">
    <div className="resource-switch" aria-label="Note collection">
      <button aria-pressed={tab === 'church'} onClick={() => setChosen('church')}>Church notes</button>
      <button aria-pressed={tab === 'mine'} onClick={() => setChosen('mine')}><Pencil size={16}/>My notes</button>
    </div>
    {tab === 'church' ? hasNotes ? <>
      <div className="companion-notes space-y-6"><SermonNotesSections notes={notes!}/></div>
      <ShareActions title={notes!.title || 'Sermon notes'} text={churchText} filename="sermon-notes.txt"/>
    </> : <CompanionEmpty kind="notes" title="No church notes yet">{isLive ? 'Published notes will appear here as the church shares them.' : 'The church hasn’t published notes for this service.'} You can still write your own in My notes.</CompanionEmpty> : <>
      <div className="personal-note-heading"><span className="companion-eyebrow">YOUR NOTEBOOK</span><h2>{title}</h2><p className="companion-small">{date}</p></div>
      <label className="companion-field-label" htmlFor="personal-note">What do you want to take with you?</label>
      <textarea id="personal-note" className="personal-note-editor" placeholder="A thought, a prayer, a next step…" value={saved?.text ?? ''} maxLength={20000} disabled={!notebook.ready}
        onChange={e => notebook.update(book => putNote(book, { serviceId: editing, title, date, text: e.target.value, updatedAt: new Date().toISOString() }))}/>
      <p role="status" className="notebook-status"><Check size={15}/>{notebook.ready ? notebook.status : 'Opening your notebook…'}</p>
      <p className="companion-small">Private to this browser. Clearing browser data removes these notes. Download a copy to keep them elsewhere.</p>
      <ShareActions title={title} text={[title, date, '', saved?.text ?? ''].join('\n')} filename="my-sermon-note.txt" disabled={!saved?.text.trim()}/>
      {personal.length > 0 && <section className="notebook-history"><h3>Also in your notebook</h3>{personal.map(n => <button key={n.serviceId} onClick={() => setEditing(n.serviceId)}><span>{n.title}<small>{n.date}</small></span><span aria-hidden="true">↗</span></button>)}</section>}
      {editing !== service.id && <button className="resource-link" onClick={() => setEditing(service.id)}>Write about this service</button>}
      <details className="notebook-backup"><summary>Take your whole notebook</summary><p className="companion-small">All your notes and saved scriptures from this church.</p><ShareActions title="My notebook" text={notebookText(notebook.book)} filename="trilorah-notebook.txt"/></details>
    </>}
  </div>;
}
