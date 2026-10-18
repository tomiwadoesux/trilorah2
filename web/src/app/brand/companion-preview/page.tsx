'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useNotebook } from '../../live/[slug]/useNotebook';
import NotesTab from '../../live/[slug]/components/NotesTab';
import ReadingOptions from '../../live/[slug]/components/ReadingOptions';
import SegmentBadge from '../../live/[slug]/components/SegmentBadge';
import BrandMark from '../../live/[slug]/components/BrandMark';
import { SEGMENT_LABELS } from '@/lib/segment-labels';
import type { SermonNotesData } from '@/components/SermonNotesSections';
import type { ReadingAppearance } from '../../live/[slug]/components/ReadingOptions';
import '../../live/[slug]/companion.css';
import './preview.css';

const notes: SermonNotesData = { title: 'A moment to be still', theme: 'Finding peace in the middle of the noise.', main_points: [{ point: 'Make room to listen.', explanation: 'A quiet moment can help us pay attention to what matters.', scriptures: ['Psalm 46:10'] }], definitions: [], applications: ['Take a quiet moment to reflect this week.'], memorable_quotes: [], all_scriptures: ['Psalm 46:10'], is_live: true };

export default function CompanionPreview() {
  const notebook = useNotebook('brand-preview-only');
  const [preview, setPreview] = useState('notes');
  const [state, setState] = useState('populated');
  const [appearance, setAppearance] = useState<ReadingAppearance>({ image: '', size: 21, aurora: 'fern' });
  useEffect(() => { setPreview(new URLSearchParams(location.search).get('preview') ?? 'notes'); }, []);
  return <main className="cw-stage">
    <div className="cw-controls"><span>Actual companion components · example data</span>{preview === 'notes' && <label>State <select value={state} onChange={event => setState(event.target.value)}><option value="populated">Populated</option><option value="live-empty">Live, empty</option><option value="ended-empty">Ended, empty</option></select></label>}</div>
    <div className="companion-shell cw-phone" data-aurora={appearance.aurora} style={{ '--reading-size': `${appearance.size}px`, ...(appearance.image ? { backgroundImage: `linear-gradient(#090b0ccc,#090b0ccc),url("${appearance.image}")`, backgroundSize: 'cover' } : {}) } as CSSProperties}>
      <header className="companion-header"><div className="companion-brand"><BrandMark className="companion-mark" /><span>trilorah</span><span className="companion-brand-note">Follow along</span></div><div className="companion-church"><h1>Sunday gathering</h1><p>A service example</p></div></header>
      {preview === 'notes' ? <NotesTab notebook={notebook} service={{ id: 'brand-preview-only', sermon_title: 'A moment to be still', started_at: '2026-10-11T15:00:00.000Z' }} notes={state === 'populated' ? notes : null} isLive={state !== 'ended-empty'} /> : preview === 'reading' ? <><div className="cw-reading"><ReadingOptions churchId="brand-preview-only" onChange={setAppearance} /></div><div className="transcript-words"><p>A moment to pause. A moment to listen. Take the words with you, wherever the week leads.</p></div></> : <div className="cw-badges">{Object.keys(SEGMENT_LABELS).map(type => <SegmentBadge key={type} type={type} />)}</div>}
    </div>
  </main>;
}
