import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { CheckIcon, CloseIcon, cx, surface } from '../../ui';
import { useEngine, type Proposal } from './engine';
import { useProjector, type LiveItem } from './projector';
import { useCatchStore } from '../../stores/catchStore';
import { useSongListeningStore } from '../../stores/songListeningStore';
import { catchEntries, nextInSet, spotlightIndex, type CatchEntry, type CatchKind } from '../../lib/catchSets';
import { clockShare, type CatchClock } from '../../lib/catchClock';
import { lyricScore } from '../../lib/songMatch';
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

interface SongMatch {
  song: { id: string; title: string; sections: { label: string; lines: string[] }[] };
  section: number;
  lines: string[];
  label: string;
  score: number;
}

/**
 * The songs in the library whose words match what the room is singing — the
 * newest words, so the match follows the song as it moves (lib/songMatch).
 * Loads the library only while song search is on.
 */
function useSongMatches(active: boolean): SongMatch[] {
  const engine = useEngine();
  const [songs, setSongs] = useState<SongMatch['song'][]>([]);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const reload = () => {
      void window.api?.songs?.list().then((list) => {
        if (alive) setSongs(list.map((song) => ({ id: song.id, title: song.title, sections: song.sections.map((s) => ({ label: s.label, lines: s.lines })) })));
      }).catch(() => undefined);
    };
    reload();
    window.addEventListener('trilorah-package-imported', reload);
    window.addEventListener('trilorah-library-changed', reload);
    return () => {
      alive = false;
      window.removeEventListener('trilorah-package-imported', reload);
      window.removeEventListener('trilorah-library-changed', reload);
    };
  }, [active]);
  const heard = [...engine.spoken.lines.slice(-3).map((line) => line.text), engine.spoken.partial]
    .join(' ').split(/\s+/).slice(-16).join(' ');
  return useMemo(() => {
    if (!active) return [];
    return songs
      .flatMap((song) => song.sections.map((s, section) => ({ song, section, lines: s.lines, label: s.label, score: lyricScore(heard, s.lines.join(' ')) })))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .filter((m, i, all) => all.findIndex((a) => a.song.id === m.song.id) === i)
      .slice(0, 4);
  }, [active, songs, heard]);
}

function songItem(match: SongMatch): LiveItem {
  const card = songCards({ id: match.song.id, sections: match.song.sections })
    .find((c) => c.sectionIndex === match.section && c.offset === 0);
  const id = card?.id ?? `${match.song.id}/${match.song.id}:${match.section}`;
  const label = card?.label ?? match.label;
  return { source: 'song', id, label: `${match.song.title} — ${label}`, title: match.song.title, section: label, lines: card?.lines ?? match.lines.slice(0, 4), origin: 'operator' };
}

function SongResults({ matches }: { matches: SongMatch[] }) {
  const projector = useProjector();
  const send = (m: SongMatch) => {
    const item = songItem(m);
    projector.stage(item);
    void projector.send(item);
  };
  const [top, ...rest] = matches;
  return (
    <section className="catch-songs" aria-label="songs heard">
      <p className="catch-eyebrow"><span className="catch-songs__dot" aria-hidden />song search · listening</p>
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
              <span className="catch-why">matched on what is being sung</span>
              <button type="button" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live')}
                onClick={(e) => { e.stopPropagation(); send(top); }}>live</button>
            </div>
          </div>
          {rest.map((m) => (
            <div key={m.song.id} className="catch-row" role="button" tabIndex={0} title="show it in the preview"
              onClick={() => projector.stage(songItem(m))}
              onKeyDown={(e) => { if (e.key === 'Enter') projector.stage(songItem(m)); }}>
              <span className="catch-pill is-song">song</span>
              <span className="catch-row__title">{m.song.title}</span>
              <span className="catch-row__text">{m.label}</span>
              <button type="button" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live is-small')}
                onClick={(e) => { e.stopPropagation(); send(m); }}>live</button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Scripture                                                           */
/* ------------------------------------------------------------------ */

interface Acts {
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
  let n = 0;
  return (
    <div
      data-catch={p.id}
      data-leaving={leaving || undefined}
      className={cx('catch-spot', !p.missing && 'is-pressable', p.missing && 'is-missing')}
      onClick={() => acts.select(p)}
      title={p.missing ? undefined : 'show it in the preview'}
      {...holdHandlers}
    >
      {entry.steps.length > 1 && (
        <div className="catch-steps" aria-label={`${entry.steps.length} said together`}>
          {entry.steps.map((step, i) => {
            if (step.state === 'sent') {
              n += 1;
              return (
                <span key={`sent-${i}`} className="catch-step is-sent" title="already on the wall">
                  <CheckIcon size={11} /> {step.reference}
                </span>
              );
            }
            n += 1;
            const on = step.item.id === p.id;
            return (
              <button key={step.item.id} type="button" className={cx('catch-step', on && 'is-current')} aria-pressed={on}
                onClick={(e) => { e.stopPropagation(); acts.pick(entry, step.item.id); }}>
                {n} · {step.item.reference}
              </button>
            );
          })}
        </div>
      )}
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
            <button key={a} type="button" className="catch-alt" title={`it may have been ${a}`}
              onClick={(e) => { e.stopPropagation(); acts.swap(p, a); }}>{a}</button>
          ))}
        </div>
      ) : null}
      <div className="catch-spot__foot">
        <span className="catch-why" title={why}>{why}</span>
        <button type="button" className={cx(surface({ tone: 'ash', interactive: true }), 'catch-x')} title="dismiss — the engine misheard" aria-label="dismiss"
          onClick={(e) => { e.stopPropagation(); acts.dismiss(entry, p); }}>
          <CloseIcon size={12} />
        </button>
        {!p.missing && (
          <button type="button" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live')} title="put it on the projector"
            onClick={(e) => { e.stopPropagation(); acts.live(entry, p); }}>
            live
          </button>
        )}
      </div>
      {clock && <CatchCountdown clock={clock} />}
    </div>
  );
}

function CatchRow({ entry, clock, leaving, acts }: { entry: CatchEntry<Proposal>; clock?: CatchClock; leaving: boolean; acts: Acts }) {
  const p = entry.current;
  const holdHandlers = useHoldHandlers(p.id, acts.hold);
  const more = entry.waiting.length - 1;
  return (
    <div
      data-catch={p.id}
      data-leaving={leaving || undefined}
      className={cx('catch-row', p.missing && 'is-missing')}
      onClick={() => acts.select(p)}
      title={p.missing ? undefined : 'show it in the preview'}
      {...holdHandlers}
    >
      <KindPill kind={p.kind} />
      <span className="catch-row__ref">{p.reference}</span>
      {more > 0 && <span className="catch-meta__dim catch-row__more">+{more} with it</span>}
      <span className="catch-row__text" title={p.missing ? undefined : p.slides[0]?.credit}>{p.missing ? 'not in the bible' : p.text}</span>
      <button type="button" className={cx(surface({ tone: 'ash', interactive: true }), 'catch-x is-small')} aria-label="dismiss" title="dismiss — the engine misheard"
        onClick={(e) => { e.stopPropagation(); acts.dismiss(entry, p); }}>
        <CloseIcon size={10} />
      </button>
      {!p.missing && (
        <button type="button" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live is-small')} title="put it on the projector"
          onClick={(e) => { e.stopPropagation(); acts.live(entry, p); }}>
          live
        </button>
      )}
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
    hold,
    select,
    live: (entry, p) => {
      if (p.missing) return;
      const item = itemOf(p);
      const next = nextInSet(entry, p.id);
      projector.stage(item);
      if (entry.steps.length > 1) markSent(entry.group, { reference: p.reference, arrivedAt: p.arrivedAt });
      if (next) pickInStore(entry.group, next.id);
      hold(p.id, false);
      dismissProposal(p.id);
      /* The set reads on: once this one is up, the next one said waits in
         the preview, one press from the wall. */
      void projector.send(item).then(() => {
        if (next && !next.missing) projector.stage(itemOf(next, 'engine'));
      });
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
  const engine = useEngine();
  const projector = useProjector();
  const songsOn = useSongListeningStore((s) => s.active);
  const songs = useSongMatches(songsOn);
  const entries = useCatchEntries();
  const spot = spotlightIndex(entries);
  const acts = useCatchActions((p) => {
    if (!p.missing) projector.stage(itemOf(p));
  });

  const leaving = new Set(engine.leavingProposals);
  const rows = entries.filter((_, i) => songsOn || i !== spot);

  if (!songsOn && entries.length === 0) {
    return (
      <div className="catches-pane is-empty">
        <EmptyMark w={120} h={100} plain art={<ScriptureQuoteArt />} play="hover" line="verses caught land here" />
      </div>
    );
  }

  return (
    <div className="catches-pane">
      {songsOn && <SongResults matches={songs} />}
      {!songsOn && spot >= 0 && (
        <Spotlight key={`${entries[spot].current.id}:${entries[spot].current.arrivedAt}`} entry={entries[spot]} clock={engine.proposalClocks[entries[spot].current.id]}
          leaving={leaving.has(entries[spot].current.id)} acts={acts} />
      )}
      {rows.length > 0 && (
        <div className="catch-rows">
          {(songsOn || spot >= 0) && <p className="catch-eyebrow">{songsOn ? 'verses heard' : 'also caught'}</p>}
          {rows.map((entry) => (
            <CatchRow key={entry.group} entry={entry} clock={engine.proposalClocks[entry.current.id]}
              leaving={leaving.has(entry.current.id)} acts={acts} />
          ))}
        </div>
      )}
    </div>
  );
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
          <button type="button" className={cx(surface({ tone: 'ash', interactive: true }), 'catch-x')} title="dismiss — the engine misheard" aria-label="dismiss"
            onClick={(e) => { e.stopPropagation(); acts.dismiss(entry, p); }}>
            <CloseIcon size={12} />
          </button>
          {!p.missing && (
            <button type="button" className={cx(surface({ tone: 'gold', shape: 'control', interactive: true }), 'catch-live catch-grow')} title="put it on the projector"
              onClick={(e) => { e.stopPropagation(); acts.live(entry, p); }}>
              live
            </button>
          )}
        </div>
        {clock && <CatchCountdown clock={clock} />}
      </div>
    </div>
  );
}
