import { useMemo, useState } from 'react';
import { AddRow, ProfileBody, Avatar, TrustBar, StagePill } from './PreachersTile';
import { usePreachers, removePreacher, saveTeaching, setActivePreacher, type Preacher } from './preachers';
import { Panel, Pill } from '../parts';
import { TeachingPanels } from './Teaching';
import { LearningActions } from './LearningActions';
import { PreacherPortraitArt } from '../PreacherPortraitArt';
import type { PreacherTeaching } from '../../../../shared/preacherLearning';
import { Button, SearchField, ProfileIcon, PlusIcon, BookIcon, MicIcon, DashboardIcon, cx } from '../../../ui';
import './profileView.css';

const SECTIONS = [
  { id: 'overview', label: 'overview', icon: DashboardIcon },
  { id: 'learning', label: 'sound check & review', icon: MicIcon },
  { id: 'teaching', label: 'teaching', icon: BookIcon },
] as const;
type Section = typeof SECTIONS[number]['id'];

function CompactRow({ p, active, selected, onOpen }: {
  p: Preacher; active: boolean; selected: boolean; onOpen: () => void;
}) {
  return <li>
    <button type="button" onClick={onOpen} aria-current={selected ? 'true' : undefined}
      className={cx('profile-person', selected && 'profile-person--selected')}>
      <Avatar p={p} size={36} ring={selected} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{p.name}</span>
        <span className="profile-person-meta"><span>{p.role}</span>{active && <Pill tone="live">today</Pill>}</span>
        <span className="mt-2 flex items-center gap-2">
          <TrustBar value={p.trustLowerBound} gate={p.gates?.trust} className="min-w-0 flex-1" />
          <span className="profile-trust">{p.services ? `${Math.round(p.trustLowerBound * 100)}%` : '—'}</span>
        </span>
      </span>
    </button>
  </li>;
}

export function ProfileView() {
  const { preachers, activeId } = usePreachers();
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const shown = preachers.find((p) => p.id === (picked ?? activeId)) ?? preachers[0] ?? null;
  const q = query.trim().toLowerCase();
  const shownList = useMemo(() => q ? preachers.filter((p) => p.name.toLowerCase().includes(q) || p.role.includes(q)) : preachers, [preachers, q]);
  const patch = async (id: string, next: Partial<PreacherTeaching>) => {
    setSaving(true); setSaveMessage('Saving…');
    try { await saveTeaching(id, next); setSaveMessage('Saved on this computer.'); }
    catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Could not save. Please retry.'); }
    finally { setSaving(false); }
  };

  return <div className="profile-page">
    <Panel title="preachers" icon={<ProfileIcon size={14} />} right={<span className="profile-count">{preachers.length}</span>}
      className="profile-rail" bodyStyle={{ padding: '4px 12px 14px' }}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="find a preacher" className="shrink-0" />
        <ul className="profile-people">
          {shownList.map((p) => <CompactRow key={p.id} p={p} active={p.id === activeId} selected={!adding && p.id === shown?.id}
            onOpen={() => { setPicked(p.id); setAdding(false); setSaveMessage(''); }} />)}
          {!shownList.length && <li className="profile-no-results">{q ? 'No preachers match your search.' : 'Your preachers will appear here.'}</li>}
        </ul>
        <div className="profile-rail-footer">
          <Button label={adding ? 'cancel' : 'add preacher'} onClick={() => setAdding(!adding)} />
          <p>A little more familiar.<br />Every service.</p>
        </div>
      </div>
    </Panel>

    <div className="profile-main">
      {adding ? <Panel title="add preacher" icon={<PlusIcon size={14} />} className="flex-1" bodyStyle={{ padding: 24 }}>
        <div className="profile-form-intro"><h2>A new voice to get to know.</h2><p>Create a profile to keep their recognition, teaching and service history together.</p></div>
        <AddRow initialName={shownList.length ? '' : query} onCancel={() => setAdding(false)} onAdded={(p) => {
          setPicked(p.id); setQuery(''); setAdding(false); setSection('overview'); setSaveMessage('');
        }} />
      </Panel> : shown ? <>
        <Panel className="profile-hero" bodyStyle={{ padding: 0 }}>
          <div className="profile-hero-content">
            <div className="profile-identity">
              <p className="profile-eyebrow">preacher profile</p>
              <div className="profile-name-row"><Avatar p={shown} size={56} /><div className="min-w-0">
                <h1 title={shown.name}>{shown.name}</h1>
                <p className="profile-subtitle">{shown.role} <span>·</span> {shown.services ? `last preached ${shown.lastPreached ?? '—'}` : 'ready for their first service'}</p>
              </div></div>
              <div className="profile-badges"><StagePill p={shown} />{shown.id === activeId ? <Pill tone="live">preaching today</Pill> : <Button label="set for today" onClick={() => setActivePreacher(shown.id)} />}</div>
            </div>
            <div className="profile-portrait"><PreacherPortraitArt /></div>
          </div>
          <nav className="profile-nav" aria-label="Profile sections">
            {SECTIONS.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={section === id ? 'page' : undefined}
              onClick={() => setSection(id)}><Icon size={15} />{label}</button>)}
          </nav>
        </Panel>
        <div className="profile-content" key={shown.id}>
          {section === 'overview' && <ProfileBody p={shown} onRemove={() => { removePreacher(shown.id); setPicked(null); }} />}
          <div hidden={section !== 'learning'} className="profile-learning"><LearningActions p={shown} /></div>
          {section === 'teaching' && <Panel title="a familiar voice" icon={<BookIcon size={14} />} bodyStyle={{ padding: 24 }}>
            <div className="profile-form-intro"><h2>Teach it how they speak.</h2><p>Book names, familiar phrases and voice commands, all in one place.</p></div>
            <fieldset disabled={saving || !shown.learning} className="disabled:opacity-50">
              <TeachingPanels p={shown} onChange={(next) => void patch(shown.id, next)} />
            </fieldset>
            {!shown.learning && <p className="profile-help">Teaching becomes available when this profile connects to the engine.</p>}
            {saveMessage && <p role="status" className="profile-help">{saveMessage}</p>}
          </Panel>}
        </div>
      </> : <Panel className="flex-1"><div className="profile-empty">
        <div className="profile-empty-art"><PreacherPortraitArt /></div>
        <p className="profile-eyebrow">every voice is different</p>
        <h1>Get to know your preacher.</h1><p>Add their profile to start building a picture of how they preach.</p>
        <Button label="add your first preacher" onClick={() => setAdding(true)} />
      </div></Panel>}
    </div>
  </div>;
}
