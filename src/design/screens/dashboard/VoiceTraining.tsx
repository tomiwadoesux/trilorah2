import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  BIBLE_SHELF,
  nextTrainingBooks,
  promptFor,
  type BookStanding,
  type TrainingEngine,
  type TrainingOutcome,
  type TrainingState,
  type TrainingStepResult,
} from '../../../../shared/preacherLearning';
import {
  Button, cx, MicIcon, CheckIcon, UndoIcon, SparkleIcon, StopIcon, ArrowIcon, InfoIcon, ClockIcon, WarningIcon, ErrorIcon, LoadingIcon,
  useAnimatedNumber,
} from '../../../ui';
import { hasOpenTypingInteraction, ownsTextInput } from '../../../lib/operatorTyping';
import { Panel, Pill } from '../parts';
import { refreshPreacher, saveTeaching, type Preacher, type SoundsLike } from './preachers';
import { BibleShelf } from './BibleShelf';
import './voiceTraining.css';

/*
 * Voice training — the screen.
 *
 * Three moments in one card: what is about to happen (and which books), the
 * round itself, and what it learned. They share one picture, the round's
 * books drawn as small spines in the shelf's own colours: before a round it
 * says where each book stands, during it it is the progress, and after it
 * it is the result. Books that still trip the app up always come first,
 * behind a thin rule.
 *
 * The round is built to be read from across a room: the reference to say is
 * the biggest thing on the screen, the words the app heard sit under it in
 * the machine's own mono, and one coloured line says what happened. The
 * operator drives — with the buttons, or A / S / U on the keyboard — and the
 * preacher only has to read.
 *
 * The engine owns the session (electron/preachers/voiceTraining.ts) and this
 * polls it. A session belongs to the window that started it, and stops if
 * this screen goes away — a microphone left open by a page nobody can see
 * is worse than a round cut short.
 */

type Tone = 'caught' | 'learned' | 'trouble' | 'unheard' | 'skipped';
type Action = 'skip' | 'again' | 'undo' | 'stop';
type Options = { service: TrainingEngine; online: boolean };

const errorText = (e: unknown) => e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Something went wrong. Try again.';

/* How long a result stays up before the engine moves on by itself: RESULT_MS
   in electron/preachers/voiceTraining.ts, plus 600ms after a miss. The bar
   that counts it down has to keep in step with those two numbers. */
const RESULT_MS = 1700;
const MISSED_EXTRA_MS = 600;

const SHELF = new Map(BIBLE_SHELF.map((b) => [b.book, b]));
const BLANK: BookStanding = { state: 'unheard', quoted: 0, fixes: [] };
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const tryWord = (n: number) => (ORDINAL[n] ? `${ORDINAL[n]} try` : `try ${n}`);
/** "Philippians, Habakkuk and Zechariah". */
const listJoin = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
/** A pick named in a sentence: up to three books by name, then a count. */
const pickName = (xs: string[]) => (xs.length <= 3 ? listJoin(xs) : `these ${xs.length} books`);
const sameBooks = (a: string[] | null, b: string[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));
/** Roughly twenty seconds a reference: twelve is "about four minutes". */
const howLong = (n: number) => {
  const m = Math.round(n / 3);
  return n <= 1 ? 'under a minute' : m <= 1 ? 'about a minute' : `about ${NUM[m] ?? m} minutes`;
};

const STANDING_WORD: Record<BookStanding['state'], string> = {
  caught: 'understood', learned: 'understood with a fix', trouble: 'still trips it up', unheard: 'not heard yet',
};
const OUTCOME_WORD: Record<TrainingOutcome, string> = {
  caught: 'understood first time', retry: 'understood on a later try', learned: 'understood with a new fix', missed: 'still trips it up', skipped: 'skipped',
};
const OUTCOME_TONE: Record<TrainingOutcome, Tone> = { caught: 'caught', retry: 'caught', learned: 'learned', missed: 'trouble', skipped: 'skipped' };

/** A spine's height is the book's length, as on the shelf, squeezed to fit. */
const spineHeight = (book: string, size: 'md' | 'sm') => {
  const ch = SHELF.get(book)?.chapters ?? 10;
  return Math.round(size === 'md' ? 52 + Math.sqrt(ch) * 3.4 : 20 + Math.sqrt(ch) * 2.6);
};
const isTrouble = (book: string, standings: Record<string, BookStanding>) => standings[book]?.state === 'trouble';
/** Trouble first, so the rule can sit between the two groups. The engine reads in this order too. */
const troubleFirst = (books: string[], standings: Record<string, BookStanding>) =>
  [...books.filter((b) => isTrouble(b, standings)), ...books.filter((b) => !isTrouble(b, standings))];
const leadingTrouble = (books: string[], standings: Record<string, BookStanding>) => {
  let k = 0;
  while (k < books.length && isTrouble(books[k], standings)) k++;
  return k;
};
const understoodOf = (standings: Record<string, BookStanding>) =>
  BIBLE_SHELF.filter((b) => standings[b.book]?.state === 'caught' || standings[b.book]?.state === 'learned').length;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/*
 * Entrance animations play once, when a moment first appears. The card stays
 * mounted under a `hidden` tab, and display:none → block restarts every CSS
 * animation, so after a beat the moment is marked settled and they are off.
 */
function useSettled(ms = 1200) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
  return settled;
}

export function VoiceTraining({
  p,
  standings,
  books: chosen,
  onClearChoice,
  onFinished,
  onClose,
}: {
  p: Preacher;
  standings: Record<string, BookStanding>;
  /** Books picked from the shelf; otherwise the next round is chosen for them. */
  books: string[] | null;
  onClearChoice: () => void;
  onFinished: (fresh: string[]) => void;
  /** Back to the profile summary, where the shelf shows what changed. */
  onClose: () => void;
}) {
  const api = typeof window === 'undefined' ? undefined : window.api;
  const available = !!api?.startPreacherTraining;
  const [options, setOptions] = useState<Options | null>(null);
  const [engine, setEngine] = useState<TrainingEngine>('whisper-local');
  const [mic, setMic] = useState('');
  const [state, setState] = useState<TrainingState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /* How many of the round's books led as "still trips it up" when it began —
     where the live track draws its rule. Fixed at the start, so a refresh of
     the preacher mid-round cannot move it. */
  const [split, setSplit] = useState(0);
  /* The shelf pick the running round was set up with. A pick made while a
     round runs ("practise Habakkuk" on the summary tab) is newer than this:
     it waits, is named in the live round, and is kept for the next Intro
     instead of being cleared when the round ends. */
  const [startedWith, setStartedWith] = useState<string[] | null>(null);
  const waitingPick = chosen && !sameBooks(chosen, startedWith) ? chosen : null;
  const owned = useRef<string | null>(null);
  /* The reference the screen last showed. Every action carries it, so a press
     that lands after the engine has moved on by itself is ignored instead of
     being applied to the next book. */
  const seenIndex = useRef(0);
  /* Every way a round ends — the poll seeing it, stop, a mic error on start —
     lands here once per round, so the shelf and the summary tab refresh
     whichever path got there first. */
  const landed = useRef<string | null>(null);
  const settle = useCallback((s: TrainingState) => {
    seenIndex.current = s.index;
    setState(s);
    if ((s.status === 'finished' || s.status === 'error') && landed.current !== s.sessionId) {
      landed.current = s.sessionId;
      owned.current = null;
      void refreshPreacher(p.id).catch(() => undefined);
      onFinished(s.results.filter((r) => r.outcome !== 'skipped').map((r) => r.book));
    }
  }, [p.id, onFinished]);

  const round = useMemo(() => troubleFirst(chosen ?? nextTrainingBooks(standings), standings), [chosen, standings]);
  const running = state?.status === 'starting' || state?.status === 'listening' || state?.status === 'result';

  useEffect(() => {
    void api?.getTrainingOptions?.().then((o) => { setOptions(o); setEngine(o.online ? o.service : 'whisper-local'); }).catch(() => undefined);
    void api?.getSetting?.('micDeviceLabel').then((m) => setMic(typeof m === 'string' ? m : '')).catch(() => undefined);
    return () => {
      if (owned.current) void api?.preacherTrainingAction?.(owned.current, 'stop', seenIndex.current).catch(() => undefined);
      owned.current = null;
    };
  }, [api]);

  useEffect(() => {
    if (!running) return;
    let gone = false;
    const timer = window.setInterval(() => {
      void api?.getPreacherTraining?.().then((s) => {
        if (gone || !s) return;
        settle(s);
      }).catch((e) => { if (!gone) setError(errorText(e)); });
    }, 300);
    return () => { gone = true; window.clearInterval(timer); };
  }, [running, api, settle]);

  /** fromPick: the round is the Intro's, so it uses up the current shelf pick. */
  const start = async (books: string[], fromPick = false) => {
    setBusy(true); setError('');
    try {
      const next = await api!.startPreacherTraining!(p.id, engine, books, mic || undefined);
      owned.current = next.sessionId;
      if (fromPick) setStartedWith(chosen);
      setSplit(leadingTrouble(next.prompts.map((x) => x.book), standings));
      settle(next);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  /* `index` is the reference on screen when the operator pressed: the engine
     ignores a skip or undo meant for a reference it has already left. */
  const act = async (action: Action) => {
    if (!state) return;
    try {
      const next = await api!.preacherTrainingAction!(state.sessionId, action, state.index);
      if (next) settle(next);
    } catch (e) { setError(errorText(e)); }
  };
  /* A pick made during the round is kept for the next Intro. */
  const clearUsedChoice = () => { if (!waitingPick) onClearChoice(); };

  if (running && state) return <Session state={state} name={p.name} split={split} waiting={waitingPick} onAct={(a) => void act(a)} error={error} />;
  if (state && (state.status === 'finished' || state.status === 'error')) {
    return <Summary state={state} p={p} standings={standings} error={error} busy={busy}
      onAgain={(books) => void start(books)}
      onNext={() => { setState(null); clearUsedChoice(); }}
      onDone={() => { setState(null); clearUsedChoice(); onClose(); }} />;
  }

  return <Intro p={p} mic={mic} standings={standings} round={round} chosen={!!chosen} options={options} engine={engine}
    onEngine={(e) => { setEngine(e); setError(''); }} busy={busy} available={available} error={error}
    onStart={() => void start(round, true)} onClearChoice={onClearChoice} />;
}

/* ------------------------------------------------------------------ */
/* The round strip                                                     */
/* ------------------------------------------------------------------ */

type StripItem = { book: string; tone: Tone; sr: string };

/*
 * The round's books as spines. One part, three jobs (standing, progress,
 * result), so the strip seen before a round is the one that fills in.
 *
 * Hover never drops in the gaps: the visible gap is padding INSIDE each
 * spine's hit area, the hit area runs the strip's full height, and only the
 * strip itself handles the pointer leaving — with a short grace, so a sweep
 * that overshoots the end does not blink the information line. The lift is
 * driven from that one state (data-active), never from :hover, so pointer
 * and keyboard look the same and the grace holds the lift too.
 */
function RoundStrip({
  items, size, split = 0, current, listening, interactive, rise, info, label, guide,
}: {
  items: StripItem[];
  size: 'md' | 'sm';
  /** Draw the rule before items[split]; only when 0 < split < items.length. */
  split?: number;
  /** Live: the spine being read. */
  current?: number;
  listening?: boolean;
  /** Pointer and arrow-key browsing, driving the information line. */
  interactive?: boolean;
  /** Spines grow in once, when the moment first appears. */
  rise?: boolean;
  /** The set-aside space under the strip: null is the strip at rest. */
  info?: (i: number | null) => ReactNode;
  label: string;
  guide?: string;
}) {
  const infoId = useId();
  const [active, setActive] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const enter = (i: number) => { window.clearTimeout(timer.current); setActive(i); };
  const leave = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setActive(null), 160); };
  const shown = active !== null && active < items.length ? active : null;
  const rule = split > 0 && split < items.length;

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const last = items.length - 1;
    const at = shown ?? -1;
    let next: number | null | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(last, at + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = at < 0 ? last : Math.max(0, at - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape' && shown !== null) next = null;
    if (next === undefined) return;
    e.preventDefault();
    window.clearTimeout(timer.current);
    setActive(next);
  };

  return (
    <div className="vt-strip-wrap">
      <ol
        className="vt-strip"
        data-size={size}
        data-dense={items.length > 16 || undefined}
        data-rise={rise || undefined}
        data-listening={listening || undefined}
        data-guide={guide}
        aria-label={label}
        aria-describedby={interactive && info ? infoId : undefined}
        tabIndex={interactive ? 0 : undefined}
        onPointerLeave={interactive ? leave : undefined}
        onBlur={interactive ? leave : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
      >
        {items.flatMap((it, i) => {
          const spine = (
            <li
              key={it.book}
              className={`vt-spine vt-spine--${it.tone}`}
              data-active={i === shown || undefined}
              data-now={i === current || undefined}
              style={{ '--h': `${spineHeight(it.book, size)}px`, '--i': i } as CSSProperties}
              onPointerEnter={interactive ? () => enter(i) : undefined}
            >
              <span className="vt-spine-body" aria-hidden>
                {size === 'md' && <span className="vt-spine-label">{SHELF.get(it.book)?.short ?? it.book}</span>}
              </span>
              <span className="sr-only">{it.sr}</span>
            </li>
          );
          /* The rule has no handler of its own: crossing it keeps the book
             the pointer came from, so the line never empties mid-sweep. */
          return rule && i === split ? [<li key="vt-rule" className="vt-strip-rule" aria-hidden />, spine] : [spine];
        })}
      </ol>
      {info && (
        <div id={infoId} className="vt-strip-info" aria-live="polite">
          {/* Keyed rest/book, never by the book: moving book to book swaps
              instantly so a sweep never lags the pointer; only coming to
              rest and leaving it crossfade. */}
          <div key={shown === null ? 'rest' : 'book'}>{info(shown)}</div>
        </div>
      )}
    </div>
  );
}

const Swatch = ({ tone }: { tone: Tone }) => <span className={`vt-swatch vt-swatch--${tone}`} aria-hidden />;
const Kbd = ({ children }: { children: ReactNode }) => <kbd className="vt-kbd">{children}</kbd>;

/* ------------------------------------------------------------------ */
/* Before a round                                                      */
/* ------------------------------------------------------------------ */

function Intro({
  p, mic, standings, round, chosen, options, engine, onEngine, busy, available, error, onStart, onClearChoice,
}: {
  p: Preacher; mic: string; standings: Record<string, BookStanding>; round: string[]; chosen: boolean;
  options: Options | null; engine: TrainingEngine; onEngine: (e: TrainingEngine) => void;
  busy: boolean; available: boolean; error: string; onStart: () => void; onClearChoice: () => void;
}) {
  const settled = useSettled();
  const listenId = useId();
  const n = round.length;
  const split = leadingTrouble(round, standings);
  const counts = (['trouble', 'unheard', 'learned', 'caught'] as const)
    .map((s) => [s, round.filter((b) => (standings[b] ?? BLANK).state === s).length] as const)
    .filter(([, k]) => k > 0);
  const has = (s: BookStanding['state']) => counts.some(([c]) => c === s);

  const order = chosen
    ? n === 1 ? `Just ${round[0]} this time. It gets up to three tries.`
      : `Just these ${n} books this time${split ? ', the ones that still trip it up first' : ''}.`
    : has('trouble') ? 'Books that still trip it up come first, then the ones it has never heard, hardest names first.'
      : has('unheard') ? 'Books it has never heard come first, hardest names first.'
        : 'Every book has been understood once. This round checks the hardest names again.';

  const info = (i: number | null) => {
    if (i === null) {
      return <>
        <p className="vt-info-main vt-info-main--counts">
          {counts.map(([s, k]) => (
            <span key={s}><Swatch tone={s} /><b>{k}</b> {s === 'trouble' ? plural(k, 'still trips it up', 'still trip it up') : STANDING_WORD[s]}</span>
          ))}
        </p>
        <p className="vt-info-sub">{order}</p>
      </>;
    }
    const book = round[i];
    const s = standings[book] ?? BLANK;
    const say = promptFor(book)?.say;
    return <>
      <p className="vt-info-main"><b>{book}</b><span className={`vt-ink--${s.state}`}>{STANDING_WORD[s.state]}</span></p>
      <p className="vt-info-sub">
        {say ? `Reads “${say}”.` : ''}
        {s.fixes.length > 0 && ` Heard before as ${s.fixes.slice(0, 3).map((f) => `“${f}”`).join(', ')}.`}
      </p>
    </>;
  };

  return (
    <Panel className="vt" guideArea="voice-training" title="voice training" icon={<MicIcon size={13} />}
      blurb={`Teach Trilorah how ${p.name} says the books. Only the words are kept, never the audio.`}
      bodyStyle={{ padding: 0 }}>
      <div className="vt-body" data-moment="intro" data-settled={settled || undefined}>
        <div className="vt-intro">
          <div className="vt-how">
            <p className="vt-label">how it works</p>
            <ol className="vt-steps">
              <li>
                <span className="vt-step-n" aria-hidden>1</span>
                <div><b>Set up the microphone as on Sunday.</b>
                  <p>{mic ? `Using ${mic}.` : 'Using this computer’s default microphone.'} To change it, use the audio button on the live screen.</p></div>
              </li>
              <li>
                <span className="vt-step-n" aria-hidden>2</span>
                <div><b>{p.name} reads each reference aloud.</b><p>One at a time, the way they would say it from the pulpit.</p></div>
              </li>
              <li>
                <span className="vt-step-n" aria-hidden>3</span>
                <div><b>Trilorah saves a fix for each book name it mishears.</b><p>Then it asks for that one again, to check the fix works.</p></div>
              </li>
            </ol>
            <p className="vt-aside vt-how-note">Skip or stop whenever you like. Every fix learned so far is kept.</p>
            <p className="vt-keys vt-keys--intro">
              <span className="vt-keys-lead">During the round</span>
              <span><Kbd>A</Kbd>say it again</span>
              <span><Kbd>S</Kbd>skip</span>
              <span><Kbd>U</Kbd>undo a fix</span>
            </p>
          </div>

          <div className="vt-setup">
            <section>
              <p className="vt-label">
                {chosen ? n === 1 ? 'practising one book' : `practising ${n} books` : `this round · ${n} ${plural(n, 'book', 'books')}`}
                {chosen && <button type="button" className="vt-link" data-guide="training-use-next-round" onClick={onClearChoice}>use the next round instead</button>}
              </p>
              {n ? (
                <RoundStrip size="md" interactive rise guide="training-round" label="This round’s books" split={split} info={info}
                  items={round.map((b) => {
                    const s = (standings[b] ?? BLANK).state;
                    return { book: b, tone: s, sr: `${b}, ${STANDING_WORD[s]}. Reads ${promptFor(b)?.say ?? b}.` };
                  })} />
              ) : <p className="vt-aside">No books chosen.</p>}
            </section>
            <section>
              <p className="vt-label" id={listenId}>listen with</p>
              <EngineChoice engine={engine} onChange={onEngine} options={options} disabled={busy} labelledBy={listenId} />
            </section>
          </div>
        </div>

        <div className="vt-startbar">
          {error ? <p role="alert" className="vt-alert"><WarningIcon size={13} /><span>{error}</span></p>
            : <p className="vt-meta">
              {available ? <><ClockIcon size={12} />{n} {plural(n, 'reference', 'references')} · {howLong(n)}</> : 'Open the desktop app to train.'}
            </p>}
          <Button guideId="training-start" tone="go" className="vt-cta"
            icon={busy ? <LoadingIcon size={13} className="vt-spin" /> : <MicIcon size={13} />}
            label={busy ? 'starting…' : 'start training'} disabled={busy || !available || !n} onClick={onStart} />
        </div>
      </div>
    </Panel>
  );
}

const ENGINES: { id: TrainingEngine; title: string; desc: string }[] = [
  { id: 'whisper-local', title: 'Offline speech', desc: 'Free, and works without the internet. A little slower to judge each try, and the first round may download it once.' },
  { id: 'deepgram', title: 'Online speech', desc: 'Quicker to judge each try. Needs the internet, and a round costs a few cents.' },
];

/*
 * How training listens — a real radio group, drawn as one bordered list with
 * a rule between the rows. The engine matters more than a toggle suggests:
 * the two mishear different words, so the row Sunday uses is tagged.
 */
function EngineChoice({ engine, onChange, options, disabled, labelledBy }: {
  engine: TrainingEngine; onChange: (e: TrainingEngine) => void; options: Options | null; disabled: boolean; labelledBy: string;
}) {
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const usable = (e: TrainingEngine) => !disabled && (e === 'whisper-local' || !!options?.online);
  const offline = !!options && !options.online;
  const tagged = options && (options.online || options.service === 'whisper-local') ? options.service : null;

  const pick = (i: number, focus = false) => {
    const o = ENGINES[i];
    if (!o || !usable(o.id)) return;
    onChange(o.id);
    if (focus) refs.current[i]?.focus();
  };
  const onKey = (e: ReactKeyboardEvent, i: number) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    pick((i + 1) % ENGINES.length, true);
  };

  const note = !options ? null
    : offline ? { tone: 'off', icon: <InfoIcon size={12} />, text: 'Online speech is not set up on this computer, so training listens offline.' }
      : engine === options.service ? { tone: 'match', icon: <CheckIcon size={12} />, text: 'The fixes it learns are the ones Sunday needs.' }
        : { tone: 'mismatch', icon: <WarningIcon size={12} />, text: `Your services use ${options.service === 'deepgram' ? 'online' : 'offline'} speech. The two mishear different words, so fixes learned here may not help on Sunday.` };

  return <>
    <div role="radiogroup" aria-labelledby={labelledBy} data-guide="training-engine" className="vt-engines">
      {ENGINES.map((o, i) => {
        const checked = engine === o.id;
        return (
          <button
            key={o.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={!usable(o.id) || undefined}
            aria-labelledby={`${id}-${o.id}-t`}
            aria-describedby={`${id}-${o.id}-d`}
            tabIndex={checked ? 0 : -1}
            data-guide={`training-engine-${o.id}`}
            className="vt-engine-opt"
            onClick={() => pick(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="vt-radio" aria-hidden />
            <span className="min-w-0">
              <span id={`${id}-${o.id}-t`} className="vt-engine-title">{o.title}</span>
              <span id={`${id}-${o.id}-d`} className="vt-engine-desc">{o.id === 'deepgram' && offline ? 'Not set up on this computer.' : o.desc}</span>
            </span>
            {tagged === o.id && <span className="vt-engine-tag"><Pill tone="ok">same as your services</Pill></span>}
          </button>
        );
      })}
    </div>
    {/* Always the same line, so nothing below moves when the choice does. */}
    <p className="vt-engine-note" data-tone={note?.tone}>{note && <>{note.icon}<span>{note.text}</span></>}</p>
  </>;
}

/* ------------------------------------------------------------------ */
/* The round                                                           */
/* ------------------------------------------------------------------ */

type VerdictTone = 'wait' | 'idle' | 'undone' | 'retry' | 'fix' | 'caught' | 'proven' | 'missed';
type HearState = 'wait' | 'listening' | 'hearing' | 'checking' | 'off';
const HEAR_WORD: Record<HearState, string> = { wait: 'getting ready', listening: 'listening', hearing: 'hearing words', checking: 'checking…', off: '' };
const ACTION_GUIDE: Partial<Record<Action, string>> = { again: 'training-again', skip: 'training-skip', undo: 'training-undo' };

function FixToken({ heard, means }: { heard: string; means: string }) {
  return <span className="vt-fix"><span className="vt-fix-heard">“{heard}”</span><ArrowIcon size={11} aria-hidden /><b>{means}</b></span>;
}

/*
 * The operator's keys. Bound once, reading the latest state through a ref,
 * so the 300ms poll never re-binds it. The card stays mounted under a hidden
 * tab, so a key does nothing unless the round is actually on screen, and
 * nothing while someone is typing or a dialog (the guide among them) is open.
 * Stop has no key: it ends the round, so it is always a deliberate press.
 * S works while the round is getting ready too: the engine then only moves
 * to the next reference and keeps saying "getting ready" until it can hear.
 */
function useTrainingKeys(rootRef: { current: HTMLElement | null }, latest: { current: { state: TrainingState; run: (a: Action, byKey?: boolean) => void } }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const root = rootRef.current;
      if (!root || !root.getClientRects().length || root.closest('[hidden], [inert]')) return;
      const target = e.target instanceof Element ? e.target : null;
      if (ownsTextInput(target) || ownsTextInput(document.activeElement) || hasOpenTypingInteraction(document)) return;
      const { state, run } = latest.current;
      const k = e.key.toLowerCase();
      const action: Action | null = k === 'a' && state.status === 'listening' ? 'again'
        : k === 's' && (state.status === 'starting' || state.status === 'listening' || state.status === 'result') ? 'skip'
          : k === 'u' && state.learned ? 'undo' : null;
      if (!action) return;
      e.preventDefault();
      run(action, true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rootRef, latest]);
}

function Session({ state, name, split, waiting, onAct, error }: {
  state: TrainingState; name: string; split: number; error: string;
  /** Books picked on the shelf while this round runs; they wait for it to end. */
  waiting: string[] | null;
  onAct: (a: Action) => void;
}) {
  const settled = useSettled();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [undone, setUndone] = useState<number | null>(null);
  const n = state.prompts.length;
  const prompt = state.prompts[state.index];
  const listening = state.status === 'listening';
  const starting = state.status === 'starting';
  const result: TrainingStepResult | undefined = state.status === 'result' ? state.results[state.index] : undefined;

  /* A press, or a key that stands for one. A key also briefly presses the
     button it stands for, so the operator sees which action the key took. */
  const run = (a: Action, byKey = false) => {
    if (a === 'undo') setUndone(state.index);
    else if (a === 'again') setUndone(null);
    const guide = ACTION_GUIDE[a];
    const el = byKey && guide ? bodyRef.current?.querySelector<HTMLElement>(`[data-guide="${guide}"]`) : null;
    if (el && !reducedMotion()) {
      el.setAttribute('data-flash', '');
      window.setTimeout(() => el.removeAttribute('data-flash'), 120);
    }
    onAct(a);
  };
  const latest = useRef({ state, run });
  latest.current = { state, run };
  useTrainingKeys(bodyRef, latest);

  /* The round takes the focus from the start button that just went away, and
     comes into view if the page was scrolled past the top of the card. */
  useEffect(() => {
    const body = bodyRef.current;
    const card = body?.closest<HTMLElement>('.vt');
    if (!body || !card || !body.getClientRects().length) return;
    if (!document.activeElement || document.activeElement === document.body) body.focus({ preventScroll: true });
    const scroller = card.closest('.pf-scroll');
    if (scroller && card.getBoundingClientRect().top < scroller.getBoundingClientRect().top) {
      card.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }, []);

  /* Words fade in as they land. When a try is cleared the list starts again,
     so it is keyed afresh and the new words fade in too. */
  const gen = useRef({ text: '', n: 0, index: -1 });
  if (state.index !== gen.current.index || !state.heard.startsWith(gen.current.text)) {
    gen.current = { text: state.heard, n: gen.current.n + 1, index: state.index };
  } else gen.current.text = state.heard;

  const tone: VerdictTone = state.status === 'starting' ? 'wait'
    : result ? result.outcome === 'missed' ? 'missed' : result.outcome === 'learned' ? 'proven' : undone === state.index ? 'undone' : 'caught'
      : state.learned && state.verdict === 'learned' ? 'fix'
        : undone === state.index && !state.verdict ? 'undone'
          : state.verdict && state.verdict !== 'caught' && state.verdict !== 'learned' ? 'retry' : 'idle';

  const eyebrow = state.status === 'starting' ? 'getting ready'
    : result ? result.outcome === 'missed' ? 'moving on' : result.outcome === 'learned' ? 'caught with the new fix' : 'caught it'
      : state.attempt > 1 ? `read this aloud · ${tryWord(state.attempt)}` : 'read this aloud';
  const refTone = state.status === 'starting' ? 'wait'
    : result ? result.outcome === 'missed' ? 'missed' : result.outcome === 'learned' ? 'learned' : 'caught' : undefined;
  const hear: HearState = state.status === 'starting' ? 'wait'
    : listening ? state.live ? 'hearing' : state.heard ? 'checking' : 'listening' : 'off';

  const pct = state.status === 'starting' ? /(\d{1,3})\s*%/.exec(state.message) : null;
  const fix = state.learned ?? (result?.learned ? { heard: result.learned, means: result.book } : null);
  const words = state.heard.split(/\s+/).filter(Boolean);

  const icon = {
    wait: <LoadingIcon size={15} className="vt-spin" />, idle: <MicIcon size={15} />, undone: <UndoIcon size={15} />,
    retry: <MicIcon size={15} />, fix: <SparkleIcon size={15} />, caught: <CheckIcon size={15} />, proven: <SparkleIcon size={15} />,
    missed: <WarningIcon size={15} />,
  }[tone];
  const message = tone === 'fix' && fix ? <>
    <span className="vt-verdict-line">New fix saved <FixToken heard={fix.heard} means={fix.means} /></span>
    <span className="vt-verdict-sub">Say it once more to check it works.</span>
  </> : tone === 'proven' && fix ? <span className="vt-verdict-line">Caught it with the new fix <FixToken heard={fix.heard} means={fix.means} /></span>
    : state.message;

  const items: StripItem[] = state.prompts.map((pr, i) => {
    const r = state.results[i];
    return { book: pr.book, tone: r ? OUTCOME_TONE[r.outcome] : 'unheard', sr: `${pr.say}: ${r ? OUTCOME_WORD[r.outcome] : i === state.index ? 'now' : 'still to come'}` };
  });

  return (
    <Panel className="vt" guideArea="voice-training" title="voice training" icon={<MicIcon size={13} />}
      blurb={`${name} reads each reference aloud. Only the words are kept.`}
      right={<span className="vt-live-tools">
        <span className="vt-engine-word">{state.engine === 'deepgram' ? 'online speech' : 'offline speech'}</span>
        <Button guideId="training-stop" icon={<StopIcon size={12} />} label="stop" title="Stop the round. Every fix learned so far is kept." onClick={() => run('stop')} />
      </span>}
      bodyStyle={{ padding: 0 }}>
      <div ref={bodyRef} tabIndex={-1} className="vt-body" data-moment="live" data-settled={settled || undefined}>
        <div className="vt-live">
          <div className="vt-track" data-guide="training-progress">
            <RoundStrip size="sm" items={items} split={split} current={state.index} listening={listening} label={`Reference ${state.index + 1} of ${n}`} />
            <span className="vt-track-count">{state.index + 1} of {n}</span>
          </div>

          <div className="vt-prompt" data-tone={refTone}>
            <p className="vt-label">{eyebrow}</p>
            <p key={state.index} className="vt-ref" data-tone={refTone} aria-hidden>{prompt.say}</p>
            <p className="sr-only" aria-live="polite">Reference {state.index + 1} of {n}: {prompt.say}.</p>
          </div>

          <div className="vt-pair">
            <div className="vt-heard" data-guide="training-heard">
              <div className="vt-heard-head">
                <p className="vt-label">what Trilorah heard</p>
                <span className="vt-status" data-state={hear} aria-hidden>
                  {hear === 'wait' || hear === 'checking' ? <LoadingIcon size={11} className="vt-spin" /> : <span className="vt-dot" />}
                  {HEAR_WORD[hear]}
                </span>
              </div>
              <div className="vt-heard-text">
                {words.length || state.live
                  ? <p key={gen.current.n}>{words.map((w, i) => <span key={i} className="vt-word">{w} </span>)}{state.live && <span className="vt-live-words">{state.live}</span>}</p>
                  : <p className="vt-placeholder">{state.status === 'starting' ? 'The microphone opens in a moment.' : 'Words appear here as Trilorah hears them.'}</p>}
              </div>
            </div>

            <div className={`vt-verdict vt-verdict--${tone}`}>
              <span className="vt-verdict-icon" aria-hidden>{icon}</span>
              <div className="vt-verdict-msg" role="status" aria-live="polite" aria-atomic="true">
                <div key={`${state.index}:${state.attempt}:${tone}:${state.message}`}>{message}</div>
              </div>
              {state.learned && (
                <button type="button" className="vt-undo" data-guide="training-undo" aria-keyshortcuts="U" onClick={() => run('undo')}>
                  <UndoIcon size={12} />undo<Kbd>U</Kbd>
                </button>
              )}
              {pct && <span className="vt-download" aria-hidden><span style={{ '--p': Math.min(100, Number(pct[1])) / 100 } as CSSProperties} /></span>}
              {result && <span key={state.index} className="vt-drain" aria-hidden
                style={{ '--d': `${RESULT_MS + (result.outcome === 'missed' ? MISSED_EXTRA_MS : 0)}ms` } as CSSProperties} />}
            </div>
          </div>

          {/* Always mounted, so the note is announced when it appears. */}
          <div className="vt-pick" aria-live="polite">
            {waiting && <p><InfoIcon size={12} /><span>Finish or stop this round to practise {pickName(waiting)}.</span></p>}
          </div>

          <div className="vt-live-foot">
            {error ? <p role="alert" className="vt-alert"><WarningIcon size={13} /><span>{error}</span></p>
              : <p className="vt-keys" aria-hidden data-guide="training-keys">
                <span data-off={!listening || undefined}><Kbd>A</Kbd>say it again</span>
                <span><Kbd>S</Kbd>{result ? 'next' : 'skip'}</span>
              </p>}
            <div className="vt-live-actions">
              <Button guideId="training-again" className="vt-act" icon={<MicIcon size={12} />} label="say it again" title="Say it again (A)"
                disabled={!listening} onClick={() => run('again')} />
              <Button guideId="training-skip" className="vt-act" icon={<ArrowIcon size={12} />} label={result ? 'next' : 'skip'}
                title={starting ? 'Skip (S). Listening starts once the microphone is ready.' : `${result ? 'Next' : 'Skip'} (S)`}
                onClick={() => run('skip')} />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* What it learned                                                     */
/* ------------------------------------------------------------------ */

function OutcomeRing({ caught, learned, missed, tried }: { caught: number; learned: number; missed: number; tried: number }) {
  const understood = caught + learned;
  const [target, setTarget] = useState(0);
  useEffect(() => setTarget(understood), [understood]);
  /* Starts at 0 on purpose: the hook begins at its target, so the real
     number is handed over after mount and the count is seen to climb. */
  const shown = useAnimatedNumber(target, { duration: 700 });
  const arcs = tried ? ([['caught', caught], ['learned', learned], ['trouble', missed]] as const).filter(([, v]) => v > 0) : [];
  const gap = arcs.length > 1 ? 1 : 0;
  let at = 0;
  return (
    <div className="vt-ring" aria-hidden>
      <svg viewBox="0 0 76 76">
        <circle className="vt-ring-track" cx="38" cy="38" r="32" pathLength={100} />
        {arcs.map(([tone, v], k) => {
          const len = Math.max(0.5, (v / tried) * 100 - gap);
          const arc = <circle key={tone} className={`vt-ring-arc vt-ring-arc--${tone}`} cx="38" cy="38" r="32" pathLength={100}
            strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-(at + gap / 2)} style={{ '--k': k } as CSSProperties} />;
          at += (v / tried) * 100;
          return arc;
        })}
      </svg>
      <span className="vt-ring-num"><b>{Math.round(shown)}</b>{tried > 0 && <span>of {tried}</span>}</span>
    </div>
  );
}

function Summary({ state, p, standings, error, busy, onAgain, onNext, onDone }: {
  state: TrainingState; p: Preacher; standings: Record<string, BookStanding>; error: string; busy: boolean;
  onAgain: (books: string[]) => void; onNext: () => void; onDone: () => void;
}) {
  const settled = useSettled();
  const headRef = useRef<HTMLHeadingElement>(null);
  const tried = state.results.filter((r) => r.outcome !== 'skipped');
  const firstTry = tried.filter((r) => r.outcome === 'caught' || r.outcome === 'retry').length;
  const fixed = tried.filter((r) => r.outcome === 'learned').length;
  const missed = tried.filter((r) => r.outcome === 'missed').map((r) => r.book);
  const skipped = state.results.length - tried.length;
  const understood = firstTry + fixed;
  const learned = state.results.filter((r) => r.outcome === 'learned' && r.learned);
  const isError = state.status === 'error';
  const early = !isError && state.results.length < state.prompts.length;
  const saveFailed = !isError && /could not be saved/i.test(state.message);
  const touched = useMemo(() => new Set(state.results.filter((r) => r.outcome !== 'skipped').map((r) => r.book)), [state.results]);

  /* This round's results, the ones that still trip it up first. */
  const strip = useMemo(() => {
    const idx = state.prompts.map((_, i) => i);
    const bad = idx.filter((i) => state.results[i]?.outcome === 'missed');
    return { order: [...bad, ...idx.filter((i) => state.results[i]?.outcome !== 'missed')], split: bad.length };
  }, [state.prompts, state.results]);

  /* The round's fixes are saved by the engine as it goes; the preacher here
     catches up when the refresh fired at the end of the round lands. Until
     then a fix cannot be removed — saving the old list would wipe the
     round's other fixes. One save at a time, for the same reason. */
  const first = useRef(p);
  const [synced, setSynced] = useState(false);
  useEffect(() => { if (p !== first.current) setSynced(true); }, [p]);
  useEffect(() => { const t = window.setTimeout(() => setSynced(true), 4000); return () => window.clearTimeout(t); }, []);
  const [pending, setPending] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const save = async (heard: string, soundsLike: SoundsLike[]) => {
    setPending(heard); setSaveError('');
    try { await saveTeaching(p.id, { soundsLike }); } catch (e) { setSaveError(errorText(e)); } finally { setPending(null); }
  };

  useEffect(() => {
    const h = headRef.current;
    if (h && h.getClientRects().length && (!document.activeElement || document.activeElement === document.body)) h.focus({ preventScroll: true });
  }, []);

  const headline = isError ? state.message
    : !tried.length ? 'No references were tried.'
      : understood === tried.length ? tried.length === 1 ? `Understood ${tried[0].ref}.` : `Understood all ${tried.length} references.`
        : `Understood ${understood} of ${tried.length} ${plural(tried.length, 'reference', 'references')}.`;
  const remaining = state.prompts.slice(state.results.length).map((x) => x.book);
  /* Each fact is said once: the eyebrow says the round stopped, the blurb
     what was saved (only when something was), the note which books still
     trip it up and how many were not reached. */
  const note = isError ? 'Check the microphone, then try again.'
    : !state.results.length ? 'The round ended before the first reference, so nothing changed.'
      : !tried.length ? 'Every reference was skipped, so the shelf is unchanged.'
        : [
          missed.length ? `${listJoin(missed)} still ${plural(missed.length, 'trips', 'trip')} it up.` : 'Nothing left to fix from this round.',
          early ? `${remaining.length} ${plural(remaining.length, 'reference was', 'references were')} not reached.` : '',
        ].filter(Boolean).join(' ');
  const legend = ([
    ['caught', firstTry, 'without a fix'],
    ['learned', fixed, 'with a new fix'],
    ['trouble', missed.length, 'not understood'],
    ['skipped', skipped, 'skipped'],
  ] as const).filter(([, k]) => k > 0);
  const fixCount = learned.length === 1 ? 'The new fix is' : `The ${NUM[learned.length] ?? learned.length} new fixes are`;
  const blurb = isError
    ? `Something interrupted the microphone.${learned.length ? ` ${learned.length === 1 ? 'The fix' : 'Every fix'} learned before that is kept.` : ''}`
    : learned.length ? `${fixCount} saved for ${p.name} and used from the next service.`
      : missed.length ? 'Nothing new was learned this round. Another try often fixes it.'
        : tried.length ? 'Nothing needed fixing this round.'
          : 'Nothing new was learned this round.';

  return (
    <Panel className="vt" guideArea="voice-training" title="voice training" icon={<MicIcon size={13} />} blurb={blurb} bodyStyle={{ padding: 0 }}>
      <div className="vt-body" data-moment="summary" data-settled={settled || undefined}>
        <div className="vt-summary">
          <div className="vt-hero" data-error={isError || undefined}>
            {isError ? <span className="vt-hero-icon" aria-hidden><ErrorIcon size={18} /></span>
              : <OutcomeRing caught={firstTry} learned={fixed} missed={missed.length} tried={tried.length} />}
            <div className="min-w-0">
              <p className="vt-label">{isError ? 'training stopped' : early ? 'round stopped' : 'round finished'}</p>
              <h3 ref={headRef} tabIndex={-1}>{headline}</h3>
              <p className="vt-hero-note">{note}</p>
              {!isError && legend.length > 0 && (
                <ul className="vt-legend">
                  {legend.map(([tone, k, word]) => <li key={tone}><Swatch tone={tone} /><b>{k}</b>{word}</li>)}
                </ul>
              )}
            </div>
            <div className="vt-hero-actions">
              <Button guideId="training-done" label="done" onClick={onDone} />
              {isError ? (
                <Button guideId="training-try-again" tone="go" className="vt-cta" label={busy ? 'starting…' : 'try again'} disabled={busy}
                  onClick={() => onAgain(remaining.length ? remaining : state.prompts.map((x) => x.book))} />
              ) : <>
                <Button guideId="training-next-round" tone={missed.length ? 'default' : 'go'} className={cx(!missed.length && 'vt-cta')}
                  label="next round" disabled={busy} onClick={onNext} />
                {missed.length > 0 && (
                  <Button guideId="training-retry-missed" tone="go" className="vt-cta" disabled={busy} onClick={() => onAgain(missed)}
                    label={busy ? 'starting…' : `practise ${missed.length === 1 ? missed[0] : `these ${missed.length}`} again`} />
                )}
              </>}
            </div>
          </div>
          {(error || saveFailed) && <p role="alert" className="vt-alert"><WarningIcon size={13} /><span>{error || state.message}</span></p>}

          {state.results.length > 0 && (
            <section>
              <p className="vt-label">this round</p>
              <RoundStrip size="md" interactive rise guide="training-round-results" label="This round’s results" split={strip.split}
                items={strip.order.map((i) => {
                  const pr = state.prompts[i];
                  const r = state.results[i];
                  return { book: pr.book, tone: r ? OUTCOME_TONE[r.outcome] : 'unheard', sr: `${pr.say}, ${r ? OUTCOME_WORD[r.outcome] : 'not reached'}` };
                })}
                info={(at) => {
                  if (at === null) return <p className="vt-info-sub">Point at a book to see what Trilorah heard.</p>;
                  const i = strip.order[at];
                  const pr = state.prompts[i];
                  const r = state.results[i];
                  return <>
                    <p className="vt-info-main"><b>{pr.say}</b>
                      <span className={r ? `vt-ink--${OUTCOME_TONE[r.outcome]}` : 'vt-ink--unheard'}>{r ? OUTCOME_WORD[r.outcome] : 'not reached'}</span></p>
                    <p className={cx('vt-info-sub', r?.heard && 'vt-info-heard')}>
                      {r?.heard ? r.heard : !r ? 'Not reached before the round stopped.' : r.outcome === 'skipped' ? 'Skipped before anything was heard.' : 'Nothing was heard.'}
                    </p>
                  </>;
                }} />
            </section>
          )}

          {learned.length > 0 && (
            <section>
              <p className="vt-label">learned this round</p>
              <ul className="vt-fixes">
                {learned.map((r) => {
                  const heard = r.learned!;
                  const kept = p.soundsLike.some((a) => a.heard === heard);
                  const gone = !kept && synced;
                  return (
                    <li key={heard} data-removed={gone || undefined}>
                      <span className="vt-mini" aria-hidden />
                      <span className="vt-fix-heard">“{heard}”</span>
                      <ArrowIcon size={11} aria-hidden className="vt-fix-arrow" />
                      <span className="vt-fix-book">{r.book}</span>
                      <span className="vt-fix-end">
                        {pending === heard || (!kept && !synced) ? 'saving…'
                          : kept ? <button type="button" className="vt-fix-action" data-guide="training-fix-remove" disabled={!!pending}
                            aria-label={`Remove the fix “${heard}” for ${r.book}`}
                            onClick={() => void save(heard, p.soundsLike.filter((a) => a.heard !== heard))}>remove</button>
                            : <>removed ·<button type="button" className="vt-fix-action" data-kind="restore" data-guide="training-fix-restore" disabled={!!pending}
                              aria-label={`Put back the fix “${heard}” for ${r.book}`}
                              onClick={() => void save(heard, [...p.soundsLike.filter((a) => a.heard !== heard), { heard, means: r.book, source: 'learned', hits: 0 }])}>put back</button></>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {saveError && <p role="alert" className="vt-alert vt-alert--under"><WarningIcon size={13} /><span>{saveError}</span></p>}
            </section>
          )}

          {tried.length > 0 && (
            <section>
              <p className="vt-label">the shelf now<span className="pf-count">{understoodOf(standings)} of 66 understood</span></p>
              <BibleShelf standings={standings} fresh={touched} />
            </section>
          )}
        </div>
      </div>
    </Panel>
  );
}
