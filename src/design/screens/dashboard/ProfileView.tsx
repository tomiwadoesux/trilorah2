import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AddRow, Avatar, TrustChart } from './PreachersTile';
import {
  GATES, refreshPreacher, removePreacher, saveTeaching, setActivePreacher, stageOf, standingsOf, trainingOf, usePreachers,
  type Preacher, type TrainingStage,
} from './preachers';
import { Panel, Pill } from '../parts';
import { TeachingNotices, TeachingPanels, TeachingSaveStatus } from './Teaching';
import { VoiceTraining } from './VoiceTraining';
import { CatchReview } from './CatchReview';
import { BibleShelf, understoodCount } from './BibleShelf';
import { PreacherPortraitArt } from '../PreacherPortraitArt';
import { nextTrainingBooks, type BookStanding, type PreacherTeaching } from '../../../../shared/preacherLearning';
import {
  Button, SearchField, ProfileIcon, PlusIcon, BookIcon, MicIcon, DashboardIcon, CheckIcon, ClockIcon, HistoryIcon, ArrowIcon, cx,
} from '../../../ui';
import './profileView.css';

/*
 * The preacher page.
 *
 * It used to open on six numbers — services, verified detections, reviewed
 * precision, trust floor — that only meant something to whoever built the
 * trust meter, and that read "—" for every preacher a church had just
 * added, which is every preacher on the first Sunday. Training was a mic
 * test that saved nothing, and the review queue was a stack of grey boxes.
 *
 * Now the page answers three questions in order, top to bottom:
 *
 *   how well does it know them    one sentence, and a four-stop track
 *   what should I do now          one card, one button
 *   what does it know             the shelf — every book of the Bible, lit
 *                                 by how well it hears this preacher say it
 *
 * The tabs below hold the work itself: voice training, checking catches,
 * and the words and names it has been taught.
 */

type Tab = 'summary' | 'training' | 'catches' | 'words';
const pct = (v: number) => `${Math.round(v * 100)}%`;
/* Training rounds are stored as 2026-10-17; read them as 17 Oct. */
const day = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : iso;

const JOURNEY: { id: TrainingStage; label: string; note: string }[] = [
  { id: 'new', label: 'new', note: 'not heard yet' },
  { id: 'training', label: 'learning', note: 'getting to know them' },
  { id: 'mature', label: 'confident', note: 'rarely corrected' },
  /* Eligible, never on by itself: auto mode is a switch someone presses. */
  { id: 'auto', label: 'ready for auto', note: 'you switch it on' },
];
const STAGE_WORD: Record<TrainingStage, string> = { new: 'new', training: 'learning', mature: 'confident', auto: 'ready for auto' };

function statusLine(p: Preacher, understood: number): string {
  const stage = stageOf(p);
  if (stage === 'auto') return `Trilorah knows ${p.name} well enough for auto mode. It stays off until you switch it on.`;
  if (stage === 'mature') return `Trilorah knows ${p.name} well. Corrections are rare now.`;
  if (p.services > 0) {
    return p.samples
      ? `Trilorah is getting to know ${p.name}. In the catches you checked, it was right ${pct(p.precision)} of the time.`
      : `Trilorah has heard ${p.name} preach. Check a few catches to see how often it was right.`;
  }
  if (trainingOf(p).sessions > 0) return `Trilorah has practised with ${p.name} and understands ${understood} of 66 books so far. Services will teach it the rest.`;
  return `Trilorah hasn’t heard ${p.name} yet. Four minutes of voice training gets it ready before their first service.`;
}

/* ------------------------------------------------------------------ */

function RailRow({ p, today, selected, onOpen }: { p: Preacher; today: boolean; selected: boolean; onOpen: () => void }) {
  const stage = stageOf(p);
  const reviews = p.learning?.reviews.length ?? 0;
  return <li>
    <button type="button" data-guide={`profile-person-${p.id}`} onClick={onOpen} aria-current={selected ? 'true' : undefined}
      className={cx('pf-person', selected && 'pf-person--selected')}>
      <Avatar p={p} size={34} />
      <span className="min-w-0 flex-1">
        <span className="pf-person-name">{p.name}{today && <Pill tone="live">today</Pill>}</span>
        <span className="pf-person-meta">
          <span className={`pf-stage-dot pf-stage-dot--${stage}`} aria-hidden />
          {STAGE_WORD[stage]}
          {reviews > 0 && <span className="pf-person-badge">{reviews} to check</span>}
        </span>
      </span>
    </button>
  </li>;
}

function Journey({ p }: { p: Preacher }) {
  const at = JOURNEY.findIndex((s) => s.id === stageOf(p));
  const practised = trainingOf(p).sessions > 0;
  /* The bar colour and weight say where they are; aria-current and the
     hidden words say it to a screen reader. */
  return <ol className="pf-journey" aria-label="How well Trilorah knows them">
    {JOURNEY.map((s, i) => (
      <li key={s.id} aria-current={i === at ? 'step' : undefined} className={cx(i < at && 'pf-journey--done', i === at && 'pf-journey--here')}>
        <span className="pf-journey-bar" aria-hidden />
        <span className="pf-journey-label">{s.label}<span className="sr-only">{i < at ? ', done' : i === at ? ', where they are now' : ''}</span></span>
        <span className="pf-journey-note">{s.id === 'new' && practised ? 'practised, no services yet' : s.note}</span>
      </li>
    ))}
  </ol>;
}

/** The three things auto mode waits for, in words a volunteer would use. */
function Checks({ p }: { p: Preacher }) {
  const gates = p.gates ?? GATES;
  const rows = [
    { label: `right ${pct(gates.trust)} of the time`, now: p.trustLowerBound, need: gates.trust, show: p.samples ? pct(p.trustLowerBound) : '—' },
    { label: `${gates.samples} catches checked`, now: p.samples, need: gates.samples, show: String(p.samples) },
    { label: `${gates.services} services`, now: p.services, need: gates.services, show: String(p.services) },
  ];
  return <ul className="pf-checks" aria-label="What auto mode waits for">
    {rows.map((r) => {
      const met = r.now >= r.need;
      return <li key={r.label} className={cx(met && 'pf-checks--met')}>
        <span className="pf-checks-row"><span className="truncate">{met && <CheckIcon size={11} />} {r.label}</span><b>{r.show}</b></span>
        <span className="pf-checks-bar"><span style={{ width: pct(r.need ? Math.min(1, r.now / r.need) : 0) }} /></span>
      </li>;
    })}
  </ul>;
}

interface Step { title: string; line: string; label: string; icon: ReactNode; go: () => void; guide: string }

function nextStep(p: Preacher, today: boolean, standings: Record<string, BookStanding>, open: (tab: Tab, books?: string[]) => void): Step | null {
  const reviews = p.learning?.reviews.length ?? 0;
  const trained = trainingOf(p).sessions > 0;
  const trouble = Object.entries(standings).filter(([, s]) => s.state === 'trouble').map(([b]) => b);
  const unheard = Object.values(standings).filter((s) => s.state === 'unheard').length;
  if (reviews > 0) return {
    title: `Check ${reviews} ${reviews === 1 ? 'catch' : 'catches'} from the last service`, icon: <CheckIcon size={18} />, guide: 'profile-next-catches',
    line: 'Say whether each verse it put up was right. Your answers are what teach it.', label: 'check catches', go: () => open('catches'),
  };
  if (!trained) return {
    title: 'Voice training · about four minutes', icon: <MicIcon size={18} />, guide: 'profile-next-training',
    line: `${p.name} reads 12 references into the microphone, and Trilorah learns how they say the hard book names.`, label: 'start training', go: () => open('training'),
  };
  if (trouble.length) return {
    title: `Practise ${trouble.length === 1 ? trouble[0] : `${trouble.length} books`} again`, icon: <MicIcon size={18} />, guide: 'profile-next-retry',
    line: `${trouble.slice(0, 4).join(', ')}${trouble.length > 4 ? '…' : ''} still ${trouble.length === 1 ? 'trips' : 'trip'} it up. Another try often fixes it.`, label: 'practise', go: () => open('training', trouble),
  };
  if (unheard > 0) return {
    title: 'Train the next 12 books', icon: <MicIcon size={18} />, guide: 'profile-next-round',
    line: `${66 - unheard} of 66 books understood so far. Next up: ${nextTrainingBooks(standings, 3).join(', ')}…`, label: 'next round', go: () => open('training'),
  };
  if (!today) return {
    title: 'Ready for their next service', icon: <ClockIcon size={18} />, guide: 'profile-next-today',
    line: 'Set them as today’s preacher so Trilorah listens for their voice and uses what it has learned.', label: 'set for today', go: () => setActivePreacher(p.id),
  };
  return null;
}

/*
 * What the summary cannot show yet, said once.
 *
 * A preacher the church has just added has no services and no training,
 * and the four record cards below the shelf used to render anyway — rows of
 * "—" and a line of tiny text each, the very thing this page was rebuilt to
 * stop doing. Now a card appears only once it has something in it, and
 * everything still missing is folded into one block that says what will
 * fill it and when. The figure slot above the words is sized for the
 * hairline drawing that goes there; it is empty until that pass lands.
 */
type Figure = 'chart' | 'habits' | 'services' | 'rounds';
interface StillToCome { figure: Figure; title: string; line: string }

function stillToCome(p: Preacher, has: { trust: boolean; habits: boolean; services: boolean; rounds: boolean }): StillToCome | null {
  const rounds = 'Voice training rounds are listed here too. The first takes about four minutes.';
  if (!has.trust && !has.habits && !has.services) return {
    figure: 'chart',
    title: has.rounds ? 'Their services fill in the rest.' : 'This fills in as they preach.',
    line: `After they preach with Trilorah listening, you’ll see how often it was right, how they preach and each service.${has.rounds ? '' : ` ${rounds}`}`,
  };
  const missing: [Figure, string][] = [];
  if (!has.trust) missing.push(['chart', p.history.length === 1
    ? 'The chart of how often it was right starts after their next service.'
    : 'The chart of how often it was right starts after two services.']);
  if (!has.habits) missing.push(['habits', 'Their habits show once Trilorah has heard them preach a few times.']);
  if (!has.services) missing.push(['services', 'Their services will be listed here.']);
  if (!has.rounds) missing.push(['rounds', missing.length ? rounds : 'Each round is listed here. The first takes about four minutes.']);
  if (!missing.length) return null;
  return {
    figure: missing[0][0],
    title: missing[0][0] === 'rounds' ? 'No voice training yet.' : 'More to come as they preach.',
    line: missing.map(([, s]) => s).join(' '),
  };
}

/* ------------------------------------------------------------------ */

export function ProfileView() {
  const { preachers, activeId } = usePreachers();
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<Tab>('summary');
  const [books, setBooks] = useState<string[] | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const shown = preachers.find((p) => p.id === (picked ?? activeId)) ?? preachers[0] ?? null;
  const q = query.trim().toLowerCase();
  const list = useMemo(() => q ? preachers.filter((p) => p.name.toLowerCase().includes(q) || p.role.includes(q)) : preachers, [preachers, q]);
  const standings = useMemo(() => shown ? standingsOf(shown) : {}, [shown]);
  const understood = understoodCount(standings);

  /* The page is open before a service, often for a while: keep the queue
     and the shelf current without a manual refresh. */
  const shownId = shown?.id;
  useEffect(() => {
    if (!shownId || !window.api?.getPreacherLearning) return;
    void refreshPreacher(shownId).catch(() => undefined);
    const timer = window.setInterval(() => void refreshPreacher(shownId).catch(() => undefined), 10_000);
    return () => window.clearInterval(timer);
  }, [shownId]);

  useEffect(() => {
    if (!fresh.size) return;
    const t = window.setTimeout(() => setFresh(new Set()), 6000);
    return () => window.clearTimeout(t);
  }, [fresh]);

  /*
   * Keyboard focus across a view swap. Most of the buttons that switch the
   * view live in the view they switch away from — "practise X" on the
   * shelf, the next-step button, "done" at the end of a round — so pressing
   * one unmounts it and focus falls to <body>. When that happens, put it on
   * the tab that is now current, so the next Tab goes into the new view.
   * A tab pressed directly keeps its own focus; this only fills the gap.
   */
  const page = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const lastTab = useRef(tab);
  useEffect(() => {
    if (lastTab.current === tab) return;
    lastTab.current = tab;
    const at = document.activeElement;
    if (!at || at === document.body) tabRefs.current[tab]?.focus({ preventScroll: true });
  }, [tab]);

  /* The remove confirm swaps one button for two and back again: "keep"
     takes focus when it appears (autoFocus), "remove preacher" gets it
     back when "keep" closes it, and after a removal it goes to whoever is
     shown next, or to "add your first preacher" when nobody is left. */
  const removeRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef<'remove' | 'removed' | null>(null);
  useEffect(() => {
    if (confirmRemove || refocus.current !== 'remove') return;
    refocus.current = null;
    removeRef.current?.focus({ preventScroll: true });
  }, [confirmRemove]);
  useEffect(() => {
    if (refocus.current !== 'removed') return;
    refocus.current = null;
    const at = document.activeElement;
    if (at && at !== document.body) return;
    (tabRefs.current.summary ?? page.current?.querySelector<HTMLElement>('[data-guide="profile-add-first"]'))?.focus({ preventScroll: true });
  }, [shownId]);

  const choose = (id: string) => { setPicked(id); setAdding(false); setTab('summary'); setBooks(null); setSaveMessage(''); setConfirmRemove(false); };
  const open = (next: Tab, chosen?: string[]) => { setTab(next); if (chosen) setBooks(chosen); };
  const onFinished = useCallback((touched: string[]) => setFresh(new Set(touched)), []);
  const onClose = useCallback(() => setTab('summary'), []);
  const onClearChoice = useCallback(() => setBooks(null), []);

  const patch = async (id: string, next: Partial<PreacherTeaching>) => {
    setSaving(true); setSaveMessage('Saving…');
    try { await saveTeaching(id, next); setSaveMessage('Saved on this computer.'); }
    catch (error) { setSaveMessage(error instanceof Error ? error.message : 'Could not save. Try again.'); }
    finally { setSaving(false); }
  };

  const today = !!shown && shown.id === activeId;
  const step = shown ? nextStep(shown, today, standings, open) : null;
  const reviews = shown?.learning?.reviews.length ?? 0;
  const rounds = shown ? trainingOf(shown).rounds : [];
  /* Only the habits a service has actually shown; a row of "—" says nothing. */
  const habitRows: [string, string | null][] = shown ? [
    ['quotes most', shown.mostQuoted],
    ['favourite books', shown.topBooks.length ? shown.topBooks.join(', ') : null],
    ['preaches for', shown.avgSermonMin ? `about ${shown.avgSermonMin} min` : null],
    ['says after a verse', shown.ignoreTails.length ? shown.ignoreTails.slice(0, 2).map((t) => `“${t}”`).join(', ') : null],
  ] : [];
  const habits = habitRows.filter((r): r is [string, string] => !!r[1]);
  const has = {
    trust: (shown?.history.length ?? 0) >= 2,
    habits: habits.length > 0,
    services: (shown?.recent.length ?? 0) > 0,
    rounds: rounds.length > 0,
  };
  const later = shown ? stillToCome(shown, has) : null;
  const TABS: { id: Tab; label: string; icon: typeof DashboardIcon; count?: number }[] = [
    { id: 'summary', label: 'summary', icon: DashboardIcon },
    { id: 'training', label: 'voice training', icon: MicIcon },
    { id: 'catches', label: 'check catches', icon: CheckIcon, count: reviews },
    { id: 'words', label: 'words and names', icon: BookIcon },
  ];

  return <div className="profile-page" ref={page}>
    <Panel title="preachers" icon={<ProfileIcon size={14} />} right={<span className="pf-count">{preachers.length}</span>}
      className="pf-rail" bodyStyle={{ padding: '4px 10px 12px' }}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <SearchField guideId="profile-search" value={query} onChange={setQuery} placeholder="find a preacher" className="shrink-0" />
        <ul className="pf-people">
          {list.map((p) => <RailRow key={p.id} p={p} today={p.id === activeId} selected={!adding && p.id === shown?.id} onOpen={() => choose(p.id)} />)}
          {!list.length && <li className="pf-muted pf-pad">{q ? 'No preachers match your search.' : 'Your preachers will appear here.'}</li>}
        </ul>
        <Button guideId="profile-add-toggle" icon={adding ? undefined : <PlusIcon size={11} />} label={adding ? 'cancel' : 'add preacher'} onClick={() => setAdding(!adding)} />
      </div>
    </Panel>

    <div className="profile-main">
      {adding ? <Panel title="add preacher" icon={<PlusIcon size={14} />} className="flex-1" bodyStyle={{ padding: 24 }}>
        <div className="pf-intro"><h2>A new voice to get to know.</h2><p>Add them, then run a short voice training so Trilorah is ready before their first service.</p></div>
        <AddRow initialName={list.length ? '' : query} onCancel={() => setAdding(false)} onAdded={(p) => {
          setPicked(p.id); setQuery(''); setAdding(false); setTab('summary'); setBooks(null);
        }} />
      </Panel> : shown ? <div className="pf-scroll" key={shown.id}>
        <section className="pf-head" data-guide-area="profile-status">
          <div className="pf-who">
            <Avatar p={shown} size={52} />
            <div className="min-w-0 flex-1">
              <h1 title={shown.name}>{shown.name}</h1>
              <p className="pf-muted">{shown.role}{shown.lastPreached ? ` · last preached ${shown.lastPreached}` : ''}</p>
            </div>
            {today ? <Pill tone="live">preaching today</Pill>
              : <Button guideId="profile-set-today" label="set for today" onClick={() => setActivePreacher(shown.id)} />}
          </div>
          {/* The whole picture on the summary; on a work tab the header shrinks
              to who this is, so the work itself starts above the fold. */}
          {tab === 'summary' && <>
            <p className="pf-status">{statusLine(shown, understood)}</p>
            <Journey p={shown} />
            {stageOf(shown) !== 'new' && stageOf(shown) !== 'auto' && <Checks p={shown} />}
          </>}
        </section>

        {step && tab === 'summary' && <section className="pf-next">
          <span className="pf-next-icon" aria-hidden>{step.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="pf-next-eyebrow">next step</p>
            <h2>{step.title}</h2>
            <p>{step.line}</p>
          </div>
          <Button guideId={step.guide} tone="go" label={step.label} icon={<ArrowIcon size={12} />} onClick={step.go} />
        </section>}

        <nav className="pf-tabs" aria-label="Profile sections">
          {TABS.map(({ id, label, icon: Icon, count }) => (
            <button type="button" key={id} ref={(el) => { tabRefs.current[id] = el; }} data-guide={`profile-section-${id}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              <Icon selected={tab === id} size={15} />{label}
              {!!count && <span className="pf-tab-count">{count}</span>}
            </button>
          ))}
        </nav>

        {tab === 'summary' && <div className="pf-stack">
          <Panel title="how trilorah hears each book" icon={<BookIcon size={13} />} guideArea="bible-shelf"
            blurb={`Every book of the Bible. A spine lights up once Trilorah has understood ${shown.name} say it, in training or in a service. Click a book to see more and practise it.`}
            right={<span className="pf-count">{understood} of 66</span>}>
            <BibleShelf standings={standings} fresh={fresh} onPick={(b) => open('training', [b])} />
          </Panel>

          {/* Only the cards with something in them; an odd one out spans the
              row. Whatever is still empty is said once, in the block below. */}
          {(has.trust || has.habits || has.rounds || has.services) && <div className="pf-grid">
            {has.trust && <Panel title="how often it was right" icon={<HistoryIcon size={13} />}
              blurb="Each point is a service, counting only the catches you checked. The dashed line is where auto mode becomes possible.">
              <TrustChart history={shown.history} gate={(shown.gates ?? GATES).trust} />
            </Panel>}
            {has.habits && <Panel title="habits" icon={<ProfileIcon size={13} />} blurb="What the services so far say about how they preach.">
              <dl className="pf-facts">
                {habits.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            </Panel>}
            {has.rounds && <Panel title="training rounds" icon={<MicIcon size={13} />}>
              <ul className="pf-rows">
                {[...rounds].reverse().slice(0, 5).map((r, i) => (
                  <li key={`${r.date}-${i}`}>
                    <span>{day(r.date)}</span>
                    <span className="pf-muted">{r.engine === 'deepgram' ? 'online' : 'offline'}</span>
                    <span className="pf-rows-end">{r.total - r.missed} of {r.total} understood{r.learned ? ` · ${r.learned} learned` : ''}</span>
                  </li>
                ))}
              </ul>
            </Panel>}
            {has.services && <Panel title="recent services" icon={<ClockIcon size={13} />}>
              <ul className="pf-rows">
                {shown.recent.map((r) => (
                  <li key={r.date}>
                    <span>{r.date}</span>
                    <span className="pf-muted">{r.verses} verses</span>
                    <span className="pf-rows-end">{r.minutes} min</span>
                  </li>
                ))}
              </ul>
            </Panel>}
          </div>}

          {later && <Panel className="shrink-0" bodyStyle={{ padding: 0 }}>
            <div className="pf-soon">
              <div className="pf-empty-figure" data-figure={later.figure} aria-hidden />
              <h2>{later.title}</h2>
              <p>{later.line}</p>
            </div>
          </Panel>}

          <footer className="pf-foot">
            <p>{shown.learning ? 'Kept on this computer. Training keeps the words it heard, never the audio.' : 'Sample profile — open the desktop app for real preachers.'}</p>
            {confirmRemove ? <span className="pf-confirm">
              remove {shown.name} and everything learned about them?
              <button type="button" data-guide="profile-remove-confirm" className="pf-danger" onClick={() => { refocus.current = 'removed'; removePreacher(shown.id); setPicked(null); setConfirmRemove(false); }}>remove</button>
              {/* The safe answer takes focus, so Enter twice cannot remove anyone. */}
              <button type="button" data-guide="profile-remove-keep" autoFocus onClick={() => { refocus.current = 'remove'; setConfirmRemove(false); }}>keep</button>
            </span> : <button type="button" ref={removeRef} data-guide="profile-remove" onClick={() => setConfirmRemove(true)}>remove preacher</button>}
          </footer>
        </div>}

        {/* Kept mounted while hidden: a round in progress must survive a
            look at the shelf or the catches. Unmounting stops it. */}
        <div hidden={tab !== 'training'} className="pf-stack">
          <VoiceTraining p={shown} standings={standings} books={books} onClearChoice={onClearChoice} onFinished={onFinished} onClose={onClose} />
          {rounds.length > 0 && <p className="pf-muted pf-pad">
            {rounds.length} {rounds.length === 1 ? 'round' : 'rounds'} so far · {understood} of 66 books understood. Every round is saved on the summary.
          </p>}
        </div>

        {tab === 'catches' && <CatchReview p={shown} />}

        {/* One card, laid out like a settings page. The save status sits in
            its header; the fieldset stays disabled while a save is in flight
            because every patch sends a whole list (see Teaching.tsx). */}
        {tab === 'words' && <Panel title="words and names" icon={<BookIcon size={13} />} className="shrink-0"
          blurb={`How ${shown.name} speaks, so Trilorah hears them right. Changes save on this computer as you make them.`}
          right={<TeachingSaveStatus saving={saving} message={saveMessage} />}
          bodyStyle={{ padding: '0 0 4px' }}>
          <TeachingNotices sample={!shown.learning} message={saveMessage} />
          <fieldset disabled={saving || !shown.learning} className="wn">
            <TeachingPanels p={shown} onChange={(next) => void patch(shown.id, next)} />
          </fieldset>
        </Panel>}
      </div> : <Panel className="flex-1"><div className="pf-empty">
        <div className="pf-empty-art"><PreacherPortraitArt /></div>
        <p className="pf-next-eyebrow">every voice is different</p>
        <h1>Get to know your preacher.</h1>
        <p>Add them, then a four-minute voice training teaches Trilorah how they say the book names.</p>
        <Button guideId="profile-add-first" tone="go" label="add your first preacher" onClick={() => setAdding(true)} />
      </div></Panel>}
    </div>
  </div>;
}
