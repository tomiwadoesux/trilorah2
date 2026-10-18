import { useScriptureMemoryStore, recallScripture } from '../../stores/scriptureMemoryStore';
import { SaveScriptureButton } from './ScriptureTools';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { CloseIcon, TrashIcon, UndoIcon, cx, surface } from '../../ui';
import { useEngine, type Proposal } from './engine';
import { useProjector, type LiveItem } from './projector';
import { useCatchStore } from '../../stores/catchStore';
import { useSongListeningStore, type HeardSong } from '../../stores/songListeningStore';
import { catchEntries, nextInSet, spotlightIndex, type CatchEntry, type CatchKind } from '../../lib/catchSets';
import { clockShare, type CatchClock } from '../../lib/catchClock';
import { recentSongWords, type SongMatch } from '../../lib/songMatch';
import { useSongMatches } from './songs/useSongMatches';
import { songCards } from '../../../shared/songCards';
import { EmptyMark } from './emptyArt';
import { ScriptureQuoteArt } from './ScriptureQuoteArt';
import './catchesPane.css';

/*
 * The right half of the verses card: where everything the engine catches
 * lands (owner, 2026-10-06, layout "C, spotlight").
 *
 * One catch is up, big, with the whole verse to read before sending; the
 * others wait as rows under it. References named in one breath are one
 * numbered set, sent in the order they were said. Each catch stays six
 * seconds and drains a bar while it does (lib/catchClock); the operator's
 * pointer on it holds it. While "search song" is on, the songs it finds
 * take the top of the half and verses keep arriving under them.
 *
 * "Find scripture" is not here — its answers are drawn over the preview,
 * where the operator asked for them.
 */

const KIND_WORD: Record<CatchKind, string> = { said: 'said', read: 'read', named: 'named', story: 'story' };
const KIND_TITLE: Record<CatchKind, string> = {
  said: 'the preacher said this reference',
  read: 'the preacher read these words out',
  named: 'the preacher named this passage',
  story: 'the engine recognised the story — check before sending',
};

function KindPill({ kind }: { kind: CatchKind }) {
  return (
    <span className={cx('catch-pill', kind === 'said' || kind === 'read' ? 'is-sure' : 'is-maybe')} title={KIND_TITLE[kind]}>
      {KIND_WORD[kind]}
    </span>
  );
}

/** Why it was caught, in the words that caught it. */
function whyOf(p: Proposal): string {
  if (p.recognition?.evidence?.length) return p.recognition.evidence.join(' · ');
  return p.heard ? `“${p.heard}”` : '';
}

/** An online Bible's copyright line under its words (shared/verseDisplay puts it on the slides). */
function CatchCredit({ p }: { p: Proposal }) {
  const credit = p.missing ? undefined : p.slides[0]?.credit;
  return credit ? <p className="catch-spot__credit" title={credit}>{credit}</p> : null;
}

function itemOf(p: Proposal, origin: LiveItem['origin'] = 'operator'): LiveItem {
  return {
    source: 'scripture',
    id: p.reference,
    label: p.reference,
    reference: p.reference,
    version: p.version,
    text: p.text,
    slides: p.slides.length
      ? p.slides
      : [{ reference: p.reference, lines: [{ version: p.version, text: p.text }], verseStart: 1, verseEnd: 1, index: 1, total: 1 }],
    verses: p.verses.length ? p.verses : [{ verse: 1, text: p.text }],
    origin,
  };
}

/*
 * How long a catch has left: a hairline along the foot of its card that
 * drains right to left over its six seconds. It stops, and turns from gold
 * to ink, while the operator's pointer is on the card; it runs on from the
 * same place when the pointer goes. Driven by the Web Animations API from
 * the clock's own numbers — the engine's timer is what removes the card,
 * and the bar only has to agree with it.
 */
export function CatchCountdown({ clock }: { clock: CatchClock }) {
  const bar = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const from = clockShare(clock, Date.now());
    el.style.transform = `scaleX(${from})`;
    if (clock.held || from <= 0) return;
    const run = el.animate(
      [{ transform: `scaleX(${from})` }, { transform: 'scaleX(0)' }],
      { duration: from * clock.life, easing: 'linear', fill: 'forwards' },
    );
    return () => run.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.since, clock.held, clock.remaining, clock.life]);
  return (
    <span aria-hidden className="catch-countdown">
      <span ref={bar} className={cx('catch-countdown__bar', clock.held && 'is-held')} />
    </span>
  );
}

/** A double-click puts a verse live; it should not also select a word of it. */
function noSelectOnDoubleClick(e: MouseEvent) {
  if (e.detail > 1) e.preventDefault();
}

/** A double-click on a card's own buttons (✕, save) is theirs, never "live". */
const fromButton = (e: MouseEvent) => !!(e.target as Element).closest('button');

/** Hold a card's clock while the pointer or the keyboard is on it — and let
    go when the card goes, since a card that leaves from under a resting
    pointer never hears it leave. */
function useHoldHandlers(id: string, hold: (id: string, on: boolean) => void) {
  useEffect(() => () => hold(id, false), [id, hold]);
  return {
    onPointerEnter: () => hold(id, true),
    onPointerLeave: () => hold(id, false),
    onFocus: () => hold(id, true),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hold(id, false);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Songs                                                               */
/* ------------------------------------------------------------------ */

function songItem(match: SongMatch): LiveItem {
  const card = songCards({ id: match.song.id, sections: match.song.sections })
    .find((c) => c.sectionIndex === match.section && c.offset === 0);
  const id = card?.id ?? `${match.song.id}/${match.song.id}:${match.section}`;
  const label = card?.label ?? match.label;
  return { source: 'song', id, label: `${match.song.title} — ${label}`, title: match.song.title, section: label, lines: card?.lines ?? match.lines.slice(0, 4), origin: 'operator' };
}

function SongResults({ matches }: { matches: SongMatch[] }) {
  const projector = useProjector();
  const engine = useEngine();
  const clear = useSongListeningStore(state => state.clear);
  const send = (m: SongMatch) => {
    const item = songItem(m);
    projector.stage(item);
    void projector.send(item);
  };
  const [top, ...rest] = matches;
  return (
    <section className="catch-songs" aria-label="songs heard">
      <div className="flex items-center justify-between gap-2"><p className="catch-eyebrow"><span className="catch-songs__dot" aria-hidden />song search · listening</p>{matches.length > 0 && <button type="button" data-guide="catches-song-clear" className="text-xs text-white/50 hover:text-white" onClick={() => clear(recentSongWords(engine.spoken))}>clear results</button>}</div>
      {!top ? (
        <p className="catch-songs__waiting">listening for songs in your library</p>
      ) : (
        <>
          <div className="catch-spot is-song" role="button" tabIndex={0} title="show it in the preview"
            onClick={() => projector.stage(songItem(top))}
            onKeyDown={(e) => { if (e.key === 'Enter') projector.stage(songItem(top)); }}>
            <div className="catch-spot__head">
              <span className="catch-pill is-song">song</span>
              <span className="catch-spot__title">{top.song.title}</span>
              <span className="catch-meta catch-push">{top.label}</span>
            </div>
            <p className="catch-spot__lines">{top.lines.slice(0, 4).map((line, i) => <span key={i}>{line}</span>)}</p>
            <div className="catch-spot__foot">
              <span className="catch-why">kept here until you clear or stop search</span>
              <button type="button" data-guide="catches-song-live" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live')}
                onClick={(e) => { e.stopPropagation(); send(top); }}>live</button>
            </div>
          </div>
          {rest.map((m) => (
            <div key={m.song.id} data-guide="catches-song-row" className="catch-row" role="button" tabIndex={0} title="show it in the preview"
              onClick={() => projector.stage(songItem(m))}
              onKeyDown={(e) => { if (e.key === 'Enter') projector.stage(songItem(m)); }}>
              <span className="catch-pill is-song">song</span>
              <span className="catch-row__title">{m.song.title}</span>
              <span className="catch-row__text">{m.label}</span>
              <button type="button" data-guide="catches-song-live" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live is-small')}
                onClick={(e) => { e.stopPropagation(); send(m); }}>live</button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

/* A song heard without "search song" being pressed (owner, 2026-10-17):
   offered over the verses, which stay where they are, until it is put up,
   turned away, or a minute passes (songs/useHeardSongs). */
function HeardSongs({ heard }: { heard: HeardSong[] }) {
  const projector = useProjector();
  const dropHeard = useSongListeningStore((state) => state.dropHeard);
  const send = (m: SongMatch) => {
    const item = songItem(m);
    projector.stage(item);
    void projector.send(item);
    dropHeard(m.song.id, Date.now());
  };
  return (
    <section className="catch-songs" aria-label="songs heard">
      <p className="catch-eyebrow"><span className="catch-songs__dot is-heard" aria-hidden />song heard</p>
      {heard.map(({ match: m }) => (
        <div key={m.song.id} data-guide="catches-song-row" className="catch-row" role="button" tabIndex={0} title="show it in the preview"
          onClick={() => projector.stage(songItem(m))}
          onKeyDown={(e) => { if (e.key === 'Enter') projector.stage(songItem(m)); }}>
          <span className="catch-pill is-heard">song</span>
          <span className="catch-row__title">{m.song.title}</span>
          <span className="catch-row__text">{m.label}</span>
          <button type="button" data-guide="catches-dismiss" className={cx(surface({ tone: 'ash', interactive: true }), 'catch-x is-small')} aria-label="dismiss" title="not this song"
            onClick={(e) => { e.stopPropagation(); dropHeard(m.song.id, Date.now()); }}>
            <CloseIcon size={10} />
          </button>
          <button type="button" data-guide="catches-song-live" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live is-small')}
            onClick={(e) => { e.stopPropagation(); send(m); }}>live</button>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Scripture                                                           */
/* ------------------------------------------------------------------ */

interface Acts {
  error: string;
  hold: (id: string, on: boolean) => void;
  select: (p: Proposal) => void;
  live: (entry: CatchEntry<Proposal>, p: Proposal) => void;
  dismiss: (entry: CatchEntry<Proposal>, p: Proposal) => void;
  pick: (entry: CatchEntry<Proposal>, id: string) => void;
  swap: (p: Proposal, reference: string) => void;
}

function Spotlight({ entry, clock, leaving, acts }: { entry: CatchEntry<Proposal>; clock?: CatchClock; leaving: boolean; acts: Acts }) {
  const p = entry.current;
  const holdHandlers = useHoldHandlers(p.id, acts.hold);
  const why = whyOf(p);
  return (
    <div
      data-catch={p.id}
      data-leaving={leaving || undefined}
      className={cx('catch-spot', !p.missing && 'is-pressable', p.missing && 'is-missing')}
      onClick={() => acts.select(p)}
      onMouseDown={noSelectOnDoubleClick}
      onDoubleClick={(e) => { if (!p.missing && !fromButton(e)) acts.live(entry, p); }}
      title={p.missing ? undefined : 'show it in the preview · double-click to put it live'}
      {...holdHandlers}
    >
      <div className="catch-spot__head">
        <KindPill kind={p.kind} />
        {p.alternates?.length ? <span className="catch-pill is-maybe" title="the engine heard something close to this too">not sure</span> : null}
        {p.trust != null && (
          <span className="catch-meta" title="how sure the engine is about this catch">
            {Math.round(p.trust * 100)}% <span className="catch-meta__dim">confidence</span>
          </span>
        )}
        <span className="catch-meta catch-push">{p.version}</span>
      </div>
      <div className="catch-spot__ref">{p.reference}</div>
      <p className="catch-spot__text">{p.missing ? 'not in the bible — nothing to show' : p.text}</p>
      <CatchCredit p={p} />
      {p.alternates?.length ? (
        <div className="catch-or">
          <span className="catch-meta__dim">or</span>
          {p.alternates.map((a) => (
            <button key={a} type="button" data-guide="catches-alternate" className="catch-alt" title={`it may have been ${a}`}
              onClick={(e) => { e.stopPropagation(); acts.swap(p, a); }}>{a}</button>
          ))}
        </div>
      ) : null}
      <div className="catch-spot__foot">
        <span className="catch-why" title={why}>{why}</span>
        {!p.missing && <SaveScriptureButton item={itemOf(p)} />}
        <button type="button" data-guide="catches-dismiss" className={cx(surface({ tone: 'ash', interactive: true }), 'catch-x')} title="dismiss — the engine misheard" aria-label="dismiss"
          onClick={(e) => { e.stopPropagation(); acts.dismiss(entry, p); }}>
          <CloseIcon size={12} />
        </button>
        {!p.missing && (
          <button type="button" data-guide="catches-live" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live')} title="put it on the projector"
            onClick={(e) => { e.stopPropagation(); acts.live(entry, p); }}>
            live
          </button>
        )}
      </div>
      {acts.error && <p className="scripture-tools__error" role="alert">{acts.error}</p>}
      {clock && <CatchCountdown clock={clock} />}
    </div>
  );
}

/**
 * What a catch's buttons do, wherever the catch is drawn — the right half of
 * the verses card, or the left card while the verses card is away. The
 * pointer holds a clock only while the card it rests on is up to be pointed
 * at: whatever is still held when the user of this hook goes is let go.
 */
function useCatchActions(select: (p: Proposal) => void): Acts {
  const engine = useEngine();
  const projector = useProjector();
  const markSent = useCatchStore((s) => s.markSent);
  const pickInStore = useCatchStore((s) => s.pick);
  const { holdProposal, dismissProposal, swapProposal, lookup } = engine;
  const [error, setError] = useState('');
  const pointed = useRef(new Set<string>());
  const hold = useCallback((id: string, on: boolean) => {
    if (on) pointed.current.add(id);
    else pointed.current.delete(id);
    holdProposal(id, on, 'pointer');
  }, [holdProposal]);
  useEffect(() => {
    const held = pointed.current;
    return () => {
      held.forEach((id) => holdProposal(id, false, 'pointer'));
      held.clear();
    };
  }, [holdProposal]);

  return {
    error,
    hold,
    select,
    live: (entry, p) => {
      if (p.missing) return;
      setError('');
      const item = itemOf(p);
      const next = nextInSet(entry, p.id);
      projector.stage(item);
      hold(p.id, true);
      /* The set reads on: once this one is up, the next one said waits in
         the preview, one press from the wall. */
      void projector.send(item).then(() => {
        dismissProposal(p.id);
        if (entry.steps.length > 1) markSent(entry.group, { reference: p.reference, arrivedAt: p.arrivedAt });
        if (next) pickInStore(entry.group, next.id);
        if (next && !next.missing) projector.stage(itemOf(next, 'engine'));
      }).catch(() => setError(`Could not put ${p.reference} live. Try again.`)).finally(() => hold(p.id, false));
    },
    dismiss: (entry, p) => {
      const next = nextInSet(entry, p.id);
      if (next) pickInStore(entry.group, next.id);
      hold(p.id, false);
      dismissProposal(p.id);
    },
    pick: (entry, id) => {
      pickInStore(entry.group, id);
      const chosen = entry.waiting.find((w) => w.id === id);
      if (chosen && !chosen.missing) projector.stage(itemOf(chosen));
    },
    swap: (p, reference) => {
      const m = reference.match(/^(.+?) (\d+):(\d+)(?:-(\d+))?$/);
      if (!m) return;
      void lookup(m[1], Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : undefined, p.version).then((reading) => {
        if (reading) swapProposal(p.id, reading);
      });
    },
  };
}

function useCatchEntries() {
  const engine = useEngine();
  const sent = useCatchStore((s) => s.sent);
  const picked = useCatchStore((s) => s.picked);
  return useMemo(() => catchEntries(engine.proposals, sent, picked), [engine.proposals, sent, picked]);
}

export function CatchesPane() {
  const projector = useProjector();
  const engine = useEngine();
  const songsOn = useSongListeningStore(s => s.active);
  const songs = useSongMatches();
  const heard = useSongListeningStore(s => s.heard);
  const entries = useCatchEntries();
  const history = useScriptureMemoryStore(s => s.history);
  const dismissMemory = useScriptureMemoryStore(s => s.dismiss);
  const dismissMemories = useScriptureMemoryStore(s => s.dismissMany);
  /* The card under the tabs shows one tab, or none (owner, 2026-10-18): a
     press on its tab again, its ✕, or putting it live puts it away. A verse
     the preacher says opens it; a verse going live does not — the LIVE pane
     already shows that one. */
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  /* "clear all" hides everything caught or shown before this moment. "undo"
     brings it back until the list is folded with "show fewer" (or the card
     goes); only then is it removed for good. */
  const [clearedAt, setClearedAt] = useState<number | null>(null);
  const newestGroup = entries[0]?.group;
  const newestAt = entries[0]?.newestAt;
  /* Only a verse newer than any seen opens it — the newest going (live or
     ✕) must not pop the one under it open. */
  const seenArrival = useRef(0);
  useEffect(() => {
    if (!newestGroup || newestAt == null || newestAt <= seenArrival.current) return;
    seenArrival.current = newestAt;
    setSelected(newestGroup);
  }, [newestGroup, newestAt]);
  const acts = useCatchActions(p => { if (!p.missing) projector.stage(itemOf(p)); });
  /* A set keeps one tab while it reads on: keyed by its group, sending its
     first verse brings the next one up in the same card. */
  const allTabs = [
    ...entries.map(entry => ({ key: entry.group, item: itemOf(entry.current), at: entry.current.arrivedAt, newest: entry.newestAt, entry })),
    ...history.filter(old => !entries.some(entry => entry.current.reference === old.reference && entry.current.version === old.version))
      .map(old => ({ key: old.key, item: recallScripture(old), at: old.at, newest: old.at, entry: null })),
  ].sort((a, b) => b.at - a.at);
  type Tab = typeof allTabs[number];
  const tabs = clearedAt == null ? allTabs : allTabs.filter(tab => tab.newest > clearedAt);
  const chosen = tabs.find(tab => tab.key === selected);
  const visible = expanded ? tabs : tabs.slice(0, 3);

  const forgetCleared = useRef(() => {});
  forgetCleared.current = () => {
    if (clearedAt == null) return;
    for (const entry of entries) if (entry.newestAt <= clearedAt) entry.waiting.forEach(w => engine.dismissProposal(w.id));
    dismissMemories(useScriptureMemoryStore.getState().history.filter(old => old.at <= clearedAt).map(old => old.key));
  };
  useEffect(() => () => forgetCleared.current(), []);
  const fold = () => { forgetCleared.current(); setClearedAt(null); setExpanded(false); };

  /* The second press of a double-click belongs to the double-click: it
     must not put away the card the first press opened. */
  const choose = (tab: Tab, e: MouseEvent) => {
    if (e.detail > 1) return;
    if (chosen?.key === tab.key) { setSelected(null); return; }
    setSelected(tab.key);
    if (!tab.entry?.current.missing) projector.stage(tab.item);
  };
  const goLive = (tab: Tab) => {
    if (tab.entry) { if (!tab.entry.current.missing) acts.live(tab.entry, tab.entry.current); return; }
    void projector.send(tab.item).then(() => setSelected(key => key === tab.key ? null : key));
  };
  return <div data-guide-area="catches" className="catches-pane">
    {(tabs.length > 0 || clearedAt != null) && <div className="scripture-tabs" aria-label="Caught and previously live scriptures">
      {visible.map(tab => <div key={tab.key} className={cx('scripture-tab', chosen?.key === tab.key && 'is-active')}>
        <button type="button" className="scripture-tab__select" aria-pressed={chosen?.key === tab.key}
          title={chosen?.key === tab.key ? `Close ${tab.item.reference} · double-click to put it live` : `Preview ${tab.item.reference} · double-click to put it live`}
          onMouseDown={noSelectOnDoubleClick} onClick={(e) => choose(tab, e)} onDoubleClick={() => goLive(tab)}>
          <span>{tab.item.reference}</span><small>{projector.live?.reference === tab.item.reference && projector.screen === 'live' ? 'live' : tab.entry ? KIND_WORD[tab.entry.current.kind] : 'shown'}</small>
        </button>
        <SaveScriptureButton item={tab.item} compact />
        <button type="button" className="scripture-tab__close" aria-label={`Remove ${tab.item.reference}`} title="Remove from this list"
          onClick={() => { if (tab.entry) acts.dismiss(tab.entry, tab.entry.current); else dismissMemory(tab.key); }}><CloseIcon size={12} /></button>
      </div>)}
      {expanded && clearedAt == null && tabs.length > 0 && <button type="button" className="scripture-tabs__more" title="Remove every scripture from this list. You can undo until you press show fewer."
        onClick={() => setClearedAt(Date.now())}><TrashIcon size={12} />clear all</button>}
      {clearedAt != null && <button type="button" className="scripture-tabs__more is-undo" title="Bring the cleared scriptures back"
        onClick={() => setClearedAt(null)}><UndoIcon size={12} />undo<small>{allTabs.length - tabs.length} cleared</small></button>}
      {(tabs.length > 3 || expanded) && <button type="button" className="scripture-tabs__more" aria-expanded={expanded}
        onClick={() => expanded ? fold() : setExpanded(true)}>{expanded ? 'show fewer' : `+${tabs.length - 3}`}</button>}
    </div>}
    {songsOn && <SongResults matches={songs} />}
    {!songsOn && heard.length > 0 && <HeardSongs heard={heard} />}
    {chosen?.entry ? <Spotlight key={chosen.key} entry={chosen.entry} leaving={false} acts={acts} /> : chosen ?
      <div className="catch-spot" title="double-click to put it live" onMouseDown={noSelectOnDoubleClick}
        onDoubleClick={(e) => { if (!fromButton(e)) goLive(chosen); }}>
        <div className="catch-spot__head"><span className="catch-pill">{projector.live?.reference === chosen.item.reference && projector.screen === 'live' ? 'live now' : 'previously live'}</span><span className="catch-meta catch-push">{chosen.item.version}</span></div>
        <div className="catch-spot__ref">{chosen.item.reference}</div><p className="catch-spot__text">{chosen.item.text}</p>
        <div className="catch-spot__foot"><SaveScriptureButton item={chosen.item} /><button type="button" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live')}
          onClick={() => goLive(chosen)}>live</button></div></div> :
      !songsOn && !heard.length ? <div className="catches-pane is-empty"><EmptyMark w={120} h={100} plain art={<ScriptureQuoteArt />} play="hover" line="verses caught land here" /></div> : null}
  </div>;
}

/*
 * The catch while the verses card is not showing (owner, 2026-10-07).
 *
 * The operator is in songs, or themes, when the preacher names a verse: it
 * comes to the left card — where the transcript lives — as one card, the one
 * the spotlight would show, with "+N" for the others waiting. The
 * transcript, put out of its card, rises along the foot of the window until
 * the catch is gone (see LiveBody). A press on the card opens the verses
 * card, where the catch takes its full place; live and ✕ do what they do
 * there, without leaving the tab the operator is in.
 */
export function CatchPeek({ onOpen }: { onOpen: () => void }) {
  const engine = useEngine();
  const entries = useCatchEntries();
  const spot = spotlightIndex(entries);
  const acts = useCatchActions(() => onOpen());
  if (spot < 0) return null;
  const entry = entries[spot];
  const p = entry.current;
  return (
    <PeekCard
      key={`${p.id}:${p.arrivedAt}`}
      entry={entry}
      more={engine.proposals.length - 1}
      clock={engine.proposalClocks[p.id]}
      leaving={engine.leavingProposals.includes(p.id)}
      acts={acts}
    />
  );
}

function PeekCard({ entry, more, clock, leaving, acts }: { entry: CatchEntry<Proposal>; more: number; clock?: CatchClock; leaving: boolean; acts: Acts }) {
  const p = entry.current;
  const holdHandlers = useHoldHandlers(p.id, acts.hold);
  return (
    <div className="catch-peek">
      <div
        data-catch={p.id}
        data-leaving={leaving || undefined}
        className={cx('catch-spot is-peek is-pressable', p.missing && 'is-missing')}
        onClick={() => acts.select(p)}
        title="open the verses card"
        {...holdHandlers}
      >
        <div className="catch-spot__head">
          <KindPill kind={p.kind} />
          {p.trust != null && (
            <span className="catch-meta" title="how sure the engine is about this catch">{Math.round(p.trust * 100)}%</span>
          )}
          {more > 0 ? (
            <span className="catch-peek__more catch-push" title={`${more} more waiting in the verses card`}>+{more}</span>
          ) : (
            <span className="catch-meta catch-push">{p.version}</span>
          )}
        </div>
        <div className="catch-spot__ref">{p.reference}</div>
        <p className="catch-spot__text">{p.missing ? 'not in the bible — nothing to show' : p.text}</p>
        <CatchCredit p={p} />
        <div className="catch-spot__foot">
          <button type="button" data-guide="catches-dismiss" className={cx(surface({ tone: 'ash', interactive: true }), 'catch-x')} title="dismiss — the engine misheard" aria-label="dismiss"
            onClick={(e) => { e.stopPropagation(); acts.dismiss(entry, p); }}>
            <CloseIcon size={12} />
          </button>
          {!p.missing && (
            <button type="button" data-guide="catches-live" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live catch-grow')} title="put it on the projector"
              onClick={(e) => { e.stopPropagation(); acts.live(entry, p); }}>
              live
            </button>
          )}
        </div>
        {acts.error && <p className="scripture-tools__error" role="alert">{acts.error}</p>}
      {clock && <CatchCountdown clock={clock} />}
      </div>
    </div>
  );
}
