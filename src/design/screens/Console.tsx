import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControlCommand, ControlResult, ControlSnapshot, ControlTarget, ControlVerse } from '../../../shared/control/schema';
import { RECIPE_FORMAT, type Ability, type Recipe, type RecipeStep } from '../../../controller/recipes/schema';
import { QUESTIONS, stepFromRecord, type WatchRecord } from '../../../controller/recipes/teach';

/*
 * The console: the terminal-looking workspace from the app-control plan.
 *
 * Everything here goes through window.api.controlCommand — the same typed
 * dispatcher the `trilorah` CLI speaks to — so this view is the command
 * layer made visible, not a second path into the engine. Results carry a
 * fresh snapshot, which is the only state this view trusts; emitter events
 * (transcript, catches) stream in between commands.
 *
 * Its look is deliberately its own: the one allowed exception (like the
 * stage backdrop and the phone pages) to the plain-ground rule — a green
 * black canvas, mono type, panels in Trilorah's deep green. Typing here can
 * never put a verse on the wall: Enter stages, only ⌘Enter or the go-live
 * key takes.
 */

const INK = '#E5F3F2';
const DIM = 'rgba(229,243,242,0.55)';
const FAINT = 'rgba(229,243,242,0.28)';
const ACCENT = '#E4D87A';
const PANEL = '#07271C';
const CANVAS = '#010806';
const LINE = 'rgba(229,243,242,0.12)';

type LogRow = { id: number; kind: 'in' | 'ok' | 'err' | 'note'; text: string };

const refOf = (v: ControlVerse | null | undefined) =>
  v ? `${v.book} ${v.chapter}${v.verse ? `:${v.verse}${v.endVerse && v.endVerse !== v.verse ? `–${v.endVerse}` : ''}` : ''}` : null;

/** Words typed at the prompt, turned into a command. Anything else is a reference. */
function parsePrompt(raw: string, listening: boolean): ControlCommand | { help: true } | null {
  const text = raw.trim();
  if (!text) return null;
  const [head, ...rest] = text.toLowerCase().split(/\s+/);
  if (head === 'help' || head === '?') return { help: true };
  if (head === 'status') return { kind: 'status' };
  if (head === 'listen') {
    if (rest[0] === 'start') return { kind: 'listen.start' };
    if (rest[0] === 'stop') return { kind: 'listen.stop' };
    return { kind: listening ? 'listen.stop' : 'listen.start' };
  }
  if (head === 'take' || head === 'go' || head === 'live') {
    const reference = raw.trim().slice(head.length).trim();
    return reference ? { kind: 'live.take', reference } : { kind: 'live.take' };
  }
  if (head === 'clear') return { kind: 'live.clear' };
  if (head === 'black') return { kind: 'screen.set', state: 'black' };
  if (head === 'logo') return { kind: 'screen.set', state: 'logo' };
  if (head === 'wall') return { kind: 'screen.set', state: 'live' };
  if (head === 'next') return { kind: 'live.next' };
  if (head === 'prev' || head === 'previous' || head === 'back') return { kind: 'live.previous' };
  return { kind: 'scripture.stage', reference: raw.trim() };
}

/* ------------------------------------------------------------------------ */
/* Teaching Trilorah another app: the four questions as a guided flow.       */
/* Each question is one instruction; the app waits for the click; a skip is  */
/* a button. Nothing here presses anything — it only watches and remembers.  */
/* ------------------------------------------------------------------------ */

type RunningApp = { name: string; id: string; pid: number };
type TeachStage = 'pick' | 'ask' | 'checking' | 'done';
interface TeachState {
  stage: TeachStage;
  apps: RunningApp[];
  platform: 'macos' | 'windows';
  app?: RunningApp;
  q: number;
  answers: Partial<Record<Ability, WatchRecord[]>>;
  skipped: Ability[];
  waiting: boolean;
  got?: string;
  needed?: boolean;
  note?: string;
  result?: { verified: boolean; broken: Array<{ ability: string; label?: string; problem: string }>; file?: string };
}

const QUESTION_TITLE: Record<Ability, string> = {
  find: 'How do you search?',
  show: 'How do you put it on the screen?',
  clear: 'How do you take it off?',
  next: 'Next',
  previous: 'Previous',
};

/** What a recorded click gets called in the flow: "the Go Live button". */
function nameOf(record: WatchRecord): string {
  const name = [record.title, record.description, record.help].find((v) => typeof v === 'string' && v) as string | undefined;
  const role = String(record.role ?? '').replace(/^AX/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return name ? `the ${role || 'control'} "${name}"` : `that ${role || 'control'}`;
}

function TeachPanel({ onClose, onTaught, say }: { onClose: () => void; onTaught: (recipe: Recipe) => void; say: (kind: LogRow['kind'], text: string) => void }) {
  const api = window.api;
  const [s, setS] = useState<TeachState>({ stage: 'pick', apps: [], platform: 'macos', q: 0, answers: {}, skipped: [], waiting: false });
  const alive = useRef(true);
  // StrictMode mounts twice in dev: the flag comes back on at every mount, not just the first.
  useEffect(() => { alive.current = true; return () => { alive.current = false; api?.controllerWatchCancel?.(); }; }, [api]);

  /* The system's own windows are never something to drive. */
  const NOT_TARGETS = /^(finder|system settings|system preferences|iphone mirroring|code|terminal|trilorah( console)?)$/i;
  const lookAtApps = useCallback(() => {
    if (!api?.controllerApps) { setS((x) => ({ ...x, note: 'the engine is not attached (sandbox?)' })); return; }
    void api.controllerApps().then((r) => {
      if (!alive.current) return;
      setS((x) => ({ ...x, apps: (r.apps ?? []).filter((a) => !NOT_TARGETS.test(a.name)), platform: r.platform ?? 'macos', note: r.ok ? undefined : (r.error ?? 'could not see the open apps') }));
    });
  }, [api]);
  useEffect(() => { void api?.controllerCheck?.(); lookAtApps(); }, [api, lookAtApps]);

  const ask = useCallback(async (state: TeachState, q: number) => {
    const question = QUESTIONS[q];
    if (!question || !state.app) return;
    setS({ ...state, stage: 'ask', q, waiting: true, got: undefined, needed: false });
    const r = await api!.controllerWatch(state.app.pid, question.clicks, 120);
    if (!alive.current) return;
    if (r.recorded.length >= question.clicks) {
      const got = nameOf(r.recorded[0] as WatchRecord);
      const next = { ...state, stage: 'ask' as const, q, waiting: false, got, answers: { ...state.answers, [question.ability]: r.recorded as WatchRecord[] } };
      setS(next);
      say('ok', `${state.app.name}: ${question.ability} → ${got}`);
      setTimeout(() => { if (alive.current) void advance(next, q + 1); }, 900);
    } else if (question.required) {
      setS({ ...state, stage: 'ask', q, waiting: false, needed: true });
    } else {
      const next = { ...state, stage: 'ask' as const, q, waiting: false, skipped: [...state.skipped, question.ability] };
      void advance(next, q + 1);
    }
  }, [api, say]);

  const advance = useCallback(async (state: TeachState, q: number) => {
    if (q < QUESTIONS.length) return ask(state, q);
    if (!state.app) return;
    setS({ ...state, stage: 'checking', waiting: false });
    const abilities: Recipe['abilities'] = {};
    for (const [ability, records] of Object.entries(state.answers) as [Ability, WatchRecord[]][]) {
      abilities[ability] = records.map((r): RecipeStep => stepFromRecord(ability, r));
    }
    const recipe: Recipe = { format: RECIPE_FORMAT, platform: state.platform, app: { id: state.app.id, name: state.app.name }, abilities, taught: { by: 'operator', at: new Date().toISOString() } };
    const saved = await api!.controllerSaveRecipe(recipe);
    if (!alive.current) return;
    if (!saved.ok) { setS({ ...state, stage: 'done', waiting: false, note: saved.error ?? 'could not save' }); return; }
    setS({ ...state, stage: 'done', waiting: false, result: { verified: !!saved.verified, broken: saved.broken ?? [], file: saved.file } });
    onTaught(recipe);
  }, [api, ask, onTaught]);

  const skip = () => { api?.controllerWatchCancel?.(); };
  const retry = () => { if (s.app) void ask(s, s.q); };
  const question = QUESTIONS[s.q];
  const dots = QUESTIONS.map((qq, i) => {
    const done = s.answers[qq.ability] ? ACCENT : s.skipped.includes(qq.ability) ? FAINT : i === s.q && s.stage === 'ask' ? INK : 'rgba(229,243,242,0.18)';
    return <span key={qq.ability} style={{ width: 8, height: 8, borderRadius: 4, background: done, display: 'inline-block' }} />;
  });
  const btn = (label: string, onClick: () => void, tone: 'go' | 'ash' = 'ash') => (
    <button type="button" onClick={onClick} style={{ font: 'inherit', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: '10px 16px', borderRadius: 8, color: tone === 'go' ? CANVAS : INK, background: tone === 'go' ? ACCENT : 'rgba(229,243,242,0.07)', border: `1px solid ${tone === 'go' ? ACCENT : LINE}` }}>{label}</button>
  );

  return (
    <section style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: ACCENT, textTransform: 'uppercase' }}>teach Trilorah an app</span>
        {s.app && <span style={{ color: DIM, fontSize: 12 }}>{s.app.name}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>{s.stage !== 'pick' && dots}</span>
      </header>

      {s.stage === 'pick' && (
        <>
          <p style={{ margin: 0, fontSize: 15, color: INK, lineHeight: 1.45 }}>Which app should Trilorah learn to drive?</p>
          <p style={{ margin: 0, fontSize: 12, color: DIM, lineHeight: 1.5 }}>Five quick questions. For each one you click the real button in that app — once — and Trilorah remembers which button it was. Do this at sound check, not during a service.</p>
          {s.note && <p style={{ margin: 0, fontSize: 12, color: '#F0A8A0' }}>{s.note}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {s.apps.map((a) => (
              <button key={a.pid} type="button" onClick={() => void ask({ ...s, app: a }, 0)} style={{ font: 'inherit', fontSize: 13, cursor: 'pointer', padding: '12px 16px', borderRadius: 8, color: INK, background: 'rgba(229,243,242,0.07)', border: `1px solid ${LINE}` }}>{a.name}</button>
            ))}
            {s.apps.length === 0 && !s.note && <span style={{ color: FAINT, fontSize: 12 }}>looking at what's open…</span>}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: FAINT, lineHeight: 1.5 }}>Don't see it? Open the app first — EasyWorship, ProPresenter, whatever runs your screens — then refresh. Apps Trilorah already knows appear under "screen" on their own.</p>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>{btn('refresh', lookAtApps)}{btn('cancel', onClose)}</div>
        </>
      )}

      {s.stage === 'ask' && question && s.app && (
        <>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.12em', color: FAINT, textTransform: 'uppercase' }}>{s.q + 1} of {QUESTIONS.length} · {QUESTION_TITLE[question.ability]}</p>
          <p style={{ margin: 0, fontSize: 17, color: INK, lineHeight: 1.45 }}>{question.ask.replace(' here', ` in ${s.app.name}`)}</p>
          {s.waiting && (
            <p style={{ margin: 0, fontSize: 13, color: ACCENT, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: ACCENT, display: 'inline-block', animation: 'tri-console-pulse 1.2s ease-in-out infinite' }} />
              watching {s.app.name} — click it now
            </p>
          )}
          {s.got && <p style={{ margin: 0, fontSize: 13, color: INK }}>✓ got it — {s.got}</p>}
          {s.needed && (
            <p style={{ margin: 0, fontSize: 13, color: '#F0A8A0', lineHeight: 1.5 }}>Trilorah needs this one — without it, it cannot put anything on {s.app.name}'s screen.</p>
          )}
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
            {s.needed ? btn('try again', retry, 'go') : s.waiting ? btn(question.required ? 'cancel' : `skip — no ${question.ability === 'find' ? 'search' : question.ability} here`, skip) : null}
            {btn('stop teaching', onClose)}
          </div>
        </>
      )}

      {s.stage === 'checking' && <p style={{ margin: 0, fontSize: 14, color: DIM }}>Checking every control again, without pressing anything…</p>}

      {s.stage === 'done' && s.app && (
        <>
          {s.result?.verified ? (
            <p style={{ margin: 0, fontSize: 17, color: INK }}>{s.app.name} is ready ✓</p>
          ) : (
            <p style={{ margin: 0, fontSize: 15, color: '#F0A8A0' }}>{s.note ?? `${s.app.name} was saved, but ${s.result?.broken.length ?? 0} control${s.result?.broken.length === 1 ? '' : 's'} could not be found again.`}</p>
          )}
          {s.result?.broken.map((b, i) => <p key={i} style={{ margin: 0, fontSize: 12, color: DIM }}>✗ {b.label ?? b.ability} — {b.problem}</p>)}
          <p style={{ margin: 0, fontSize: 12, color: DIM, lineHeight: 1.5 }}>
            Taught: {(Object.keys(s.answers) as Ability[]).join(', ') || 'nothing'}{s.skipped.length ? ` · skipped: ${s.skipped.join(', ')}` : ''}. Trilorah will check these again before every service.
          </p>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
            {btn('done', onClose, 'go')}
          </div>
        </>
      )}
      <style>{'@keyframes tri-console-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }'}</style>
    </section>
  );
}

/** Whose screen the buttons move: Trilorah's own wall or a taught app, with "ready" when checked. */
function ScreenPicker({ targets, current, onPick, onTeach }: { targets: ControlTarget[]; current: string; onPick: (id: string) => void; onTeach: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, letterSpacing: '0.14em', color: FAINT, textTransform: 'uppercase' }}>screen</span>
      <div style={{ display: 'inline-flex', border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden' }}>
        {targets.map((t) => {
          const on = t.id === current;
          return (
            <button key={t.id} type="button" onClick={() => onPick(t.id)} aria-pressed={on} title={t.verified === false ? 'has changed since it was taught' : undefined}
              style={{ font: 'inherit', fontSize: 12, cursor: 'pointer', padding: '7px 12px', border: 'none', borderRight: `1px solid ${LINE}`, color: on ? CANVAS : INK, background: on ? ACCENT : 'transparent' }}>
              {t.name}{t.verified === true ? ' ✓' : t.verified === false ? ' !' : ''}
            </button>
          );
        })}
        <button type="button" onClick={onTeach} style={{ font: 'inherit', fontSize: 12, cursor: 'pointer', padding: '7px 12px', border: 'none', color: DIM, background: 'transparent' }}>+ teach an app</button>
      </div>
    </div>
  );
}

const HELP_LINES = [
  'type a reference to stage it — John 3:16, Psalm 23, Romans 8:28-30',
  'take [reference]   put the preview (or this verse) on the wall',
  'clear · black · logo · wall    what the wall shows',
  'listen [start|stop] · next · prev · status',
  'Enter stages — only ⌘Enter (or "take") goes live',
];

/**
 * workspace: the full view behind the console pill in the app.
 * popup: its own small window (console.html) — buttons first, because not
 * everyone types commands; the prompt is still there, underneath.
 */
export default function ConsoleView({ variant = 'workspace' }: { variant?: 'workspace' | 'popup' } = {}) {
  const api = window.api;
  const [snap, setSnap] = useState<ControlSnapshot | null>(null);
  const [targets, setTargets] = useState<ControlTarget[]>([{ id: 'trilorah', name: 'Trilorah' }]);
  const [teaching, setTeaching] = useState(false);
  const [heard, setHeard] = useState<string[]>([]);
  const [partial, setPartial] = useState('');
  const [log, setLog] = useState<LogRow[]>([]);
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const historyAt = useRef(-1);
  const rowId = useRef(0);
  const logEnd = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const say = useCallback((kind: LogRow['kind'], text: string) => {
    setLog((rows) => [...rows.slice(-120), { id: ++rowId.current, kind, text }]);
  }, []);

  const run = useCallback(async (command: ControlCommand, opts: { quiet?: boolean } = {}): Promise<ControlResult | null> => {
    if (!api?.controlCommand) { say('err', 'the engine is not attached (sandbox?)'); return null; }
    try {
      const result = await api.controlCommand(command);
      setSnap(result.snapshot);
      // Background refreshes keep the panes true without writing to the log.
      if (opts.quiet && result.ok) return result;
      if (!result.ok) say('err', `no: ${result.error}`);
      else if (result.live) say('ok', `live · ${refOf(result.live)} (${result.live.version})`);
      else if (result.staged) say('ok', `staged · ${refOf(result.staged)} (${result.staged.version})`);
      else if (command.kind === 'status') say('note', `listening ${result.snapshot.listening ? 'yes' : 'no'} · preview ${refOf(result.snapshot.preview) ?? '—'} · live ${refOf(result.snapshot.live) ?? '—'} · wall ${result.snapshot.screen}`);
      else say('ok', 'done');
      return result;
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'the command did not get through');
      return null;
    }
  }, [api, say]);

  // What the engine is hearing and showing, live.
  useEffect(() => {
    if (!api) return;
    void run({ kind: 'status' }, { quiet: true });
    const offs = [
      api.onTranscriptLine?.((line) => {
        if (line.isFinal) { setHeard((h) => [...h.slice(-7), line.text]); setPartial(''); }
        else setPartial(line.text);
      }),
      api.onVersePreview?.(() => void run({ kind: 'status' }, { quiet: true })),
      api.onVerseDetected?.(() => void run({ kind: 'status' }, { quiet: true })),
      api.onAsrStatus?.(() => void run({ kind: 'status' }, { quiet: true })),
    ].filter(Boolean) as Array<() => void>;
    return () => offs.forEach((off) => off());
    // run is stable enough for a mount effect; re-subscribing on every render would double events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { logEnd.current?.scrollIntoView({ block: 'end' }); }, [log]);

  /** Whose screen the buttons move. Choosing an app verifies it; the list shows the answer once it lands. */
  const refreshTargets = useCallback(async () => {
    const r = await run({ kind: 'target.list' }, { quiet: true });
    if (r?.ok && r.targets) setTargets(r.targets);
  }, [run]);
  useEffect(() => { void refreshTargets(); }, [refreshTargets]);
  const pickTarget = useCallback(async (id: string) => {
    const r = await run({ kind: 'target.set', id });
    if (r?.ok) say('note', id === 'trilorah' ? 'the buttons move Trilorah\'s own wall' : `checking ${targets.find((t) => t.id === id)?.name ?? id} — every taught control, nothing pressed`);
    setTimeout(() => void refreshTargets(), 3000);
    void refreshTargets();
  }, [run, say, refreshTargets, targets]);
  const screenPicker = (
    <ScreenPicker targets={targets} current={snap?.target ?? 'trilorah'} onPick={(id) => void pickTarget(id)} onTeach={() => setTeaching(true)} />
  );
  const teachPanel = teaching ? (
    <TeachPanel onClose={() => { setTeaching(false); void refreshTargets(); }} onTaught={() => void refreshTargets()} say={say} />
  ) : null;

  const submit = useCallback((take: boolean) => {
    const text = prompt;
    const parsed = take && !text.trim() ? ({ kind: 'live.take' } as ControlCommand) : parsePrompt(text, snap?.listening ?? false);
    if (!parsed) return;
    if (text.trim()) { say('in', `› ${text.trim()}`); setHistory((h) => [...h.slice(-30), text]); }
    historyAt.current = -1;
    setPrompt('');
    if ('help' in parsed) { HELP_LINES.forEach((l) => say('note', l)); return; }
    // ⌘Enter on a typed reference means take it, not just stage it.
    const command: ControlCommand = take && parsed.kind === 'scripture.stage' ? { kind: 'live.take', reference: parsed.reference, version: parsed.version } : parsed;
    void run(command);
  }, [prompt, snap, run, say]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(e.metaKey || e.ctrlKey); }
    else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      historyAt.current = historyAt.current < 0 ? history.length - 1 : Math.max(0, historyAt.current - 1);
      setPrompt(history[historyAt.current] ?? '');
    } else if (e.key === 'ArrowDown' && historyAt.current >= 0) {
      e.preventDefault();
      historyAt.current = historyAt.current + 1 >= history.length ? -1 : historyAt.current + 1;
      setPrompt(historyAt.current < 0 ? '' : history[historyAt.current] ?? '');
    }
  };

  const button = (label: string, command: ControlCommand, tone: 'go' | 'ash' = 'ash') => (
    <button
      type="button"
      onClick={() => { say('in', `› ${label}`); void run(command); }}
      style={{
        font: 'inherit', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
        color: tone === 'go' ? CANVAS : DIM, background: tone === 'go' ? ACCENT : 'rgba(229,243,242,0.07)',
        border: `1px solid ${tone === 'go' ? ACCENT : LINE}`, borderRadius: 6, padding: '6px 12px',
      }}
    >{label}</button>
  );

  const pane = (title: string, verse: ControlVerse | null, live: boolean) => (
    <section style={{ background: PANEL, border: `1px solid ${LINE}`, borderLeft: live && verse ? `2px solid ${ACCENT}` : `1px solid ${LINE}`, borderRadius: 6, padding: '10px 12px', minHeight: 86, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.14em', color: live && verse ? ACCENT : FAINT, textTransform: 'uppercase' }}>
        {title}{live && verse ? ' ●' : ''}
      </div>
      {verse ? (
        <>
          <div style={{ marginTop: 6, fontSize: 15, color: INK }}>{refOf(verse)} <span style={{ color: FAINT, fontSize: 11 }}>{verse.version}</span></div>
          <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5, color: DIM, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{verse.text}</div>
        </>
      ) : (
        <div style={{ marginTop: 10, fontSize: 11, color: FAINT }}>nothing {live ? 'on the wall' : 'staged'}</div>
      )}
    </section>
  );

  if (variant === 'popup') {
    const bigButton = (label: string, command: ControlCommand, tone: 'go' | 'ash' = 'ash', grow = 1) => (
      <button
        type="button"
        onClick={() => void run(command)}
        style={{
          // The big one stays big but never balloons; the cards take the spare room.
          flex: tone === 'go' ? '0 0 auto' : grow, font: 'inherit', fontSize: tone === 'go' ? 15 : 12, letterSpacing: '0.1em', textTransform: 'uppercase',
          cursor: 'pointer', padding: tone === 'go' ? '18px 12px' : '12px 10px', borderRadius: 8,
          color: tone === 'go' ? CANVAS : INK, background: tone === 'go' ? ACCENT : PANEL,
          border: `1px solid ${tone === 'go' ? ACCENT : LINE}`, fontWeight: tone === 'go' ? 700 : 400,
        }}
      >{label}</button>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100vh', padding: 14, background: CANVAS, color: INK, fontFamily: 'var(--font-mono)', fontSize: 12, boxSizing: 'border-box', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ letterSpacing: '0.18em', fontSize: 11, color: ACCENT }}>TRILORAH</span>
          <span style={{ color: snap?.listening ? ACCENT : FAINT }}>{snap?.listening ? '● listening' : '○ not listening'}</span>
          <span style={{ marginLeft: 'auto', color: DIM }}>wall · {snap?.screen ?? '—'}</span>
        </header>
        {screenPicker}

        {teachPanel ?? (
          <>
        {pane('live', snap?.live ?? null, true)}
        {pane('preview', snap?.preview ?? null, false)}

        {/* The verse box: type it, press the button. No commands to know. */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={input}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (prompt.trim()) void run({ kind: 'scripture.stage', reference: prompt.trim() }).then(() => setPrompt('')); } }}
            placeholder="type a verse — John 3:16"
            spellCheck={false}
            style={{ flex: 1, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, outline: 'none', color: INK, font: 'inherit', fontSize: 13, padding: '10px 12px' }}
          />
          <button
            type="button"
            onClick={() => { if (prompt.trim()) void run({ kind: 'scripture.stage', reference: prompt.trim() }).then(() => setPrompt('')); }}
            style={{ font: 'inherit', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', color: INK, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 8, padding: '0 16px' }}
          >stage</button>
        </div>

        {bigButton('go live', { kind: 'live.take' }, 'go')}
        <div style={{ display: 'flex', gap: 8 }}>
          {bigButton('clear', { kind: 'live.clear' })}
          {bigButton('black', { kind: 'screen.set', state: 'black' })}
          {bigButton('logo', { kind: 'screen.set', state: 'logo' })}
          {bigButton('wall', { kind: 'screen.set', state: 'live' })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {bigButton('‹ prev', { kind: 'live.previous' })}
          {bigButton(snap?.listening ? 'stop listening' : 'start listening', { kind: snap?.listening ? 'listen.stop' : 'listen.start' }, 'ash', 2)}
          {bigButton('next ›', { kind: 'live.next' })}
        </div>

        {/* What just happened, and the last thing heard. */}
        <div style={{ marginTop: 'auto', minHeight: 44, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2 }}>
          {(partial || heard.length > 0) && <div style={{ color: FAINT, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>heard · {partial || heard[heard.length - 1]}</div>}
          {log.slice(-2).map((row) => (
            <div key={row.id} style={{ fontSize: 11, color: row.kind === 'err' ? '#F0A8A0' : row.kind === 'in' ? DIM : FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.text}</div>
          ))}
        </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => input.current?.focus()}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0, padding: 14,
        background: CANVAS, borderRadius: 8, color: INK, fontFamily: 'var(--font-mono)', fontSize: 12,
        boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.055)',
      }}
    >
      {/* Status line: the whole state of the service in one row. */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ letterSpacing: '0.18em', fontSize: 11, color: ACCENT }}>TRILORAH CONSOLE</span>
        <span style={{ color: snap?.listening ? ACCENT : FAINT }}>{snap?.listening ? '● listening' : '○ not listening'}</span>
        <span style={{ color: DIM }}>wall · {snap?.screen ?? '—'}</span>
        {snap?.asrStatus && <span style={{ color: FAINT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{snap.asrStatus}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {button(snap?.listening ? 'stop' : 'listen', { kind: snap?.listening ? 'listen.stop' : 'listen.start' })}
          {button('go live', { kind: 'live.take' }, 'go')}
          {button('clear', { kind: 'live.clear' })}
          {button('black', { kind: 'screen.set', state: 'black' })}
          {button('logo', { kind: 'screen.set', state: 'logo' })}
          {button('pop out', { kind: 'console.open' })}
        </span>
      </header>
      {screenPicker}

      {teachPanel ?? (
      <div style={{ display: 'flex', gap: 10, minHeight: 0, flex: 1 }}>
        {/* HEARD: the transcript roll, as the laptop hears it. */}
        <section style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 6, padding: '10px 12px', flex: 1.1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', color: FAINT, textTransform: 'uppercase' }}>heard</div>
          <div style={{ marginTop: 8, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4 }}>
            {heard.length === 0 && !partial && <div style={{ color: FAINT, fontSize: 11 }}>what is said shows here once listening starts</div>}
            {heard.slice(-8).map((line, i, all) => (
              <div key={`${i}-${line.slice(0, 10)}`} style={{ color: INK, opacity: 0.3 + ((i + 1) / all.length) * 0.7, fontSize: 12, lineHeight: 1.45 }}>{line}</div>
            ))}
            {partial && <div style={{ color: DIM, fontStyle: 'italic', fontSize: 12 }}>{partial}</div>}
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
          {pane('preview', snap?.preview ?? null, false)}
          {pane('live', snap?.live ?? null, true)}
          {/* The command log: what was asked and what actually happened. */}
          <section style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 6, padding: '10px 12px', flex: 1, minHeight: 72, overflowY: 'auto' }}>
            {log.length === 0 && <div style={{ color: FAINT, fontSize: 11 }}>type help for the few words this prompt knows</div>}
            {log.map((row) => (
              <div key={row.id} style={{ fontSize: 11, lineHeight: 1.6, color: row.kind === 'err' ? '#F0A8A0' : row.kind === 'in' ? DIM : row.kind === 'note' ? FAINT : INK }}>{row.text}</div>
            ))}
            <div ref={logEnd} />
          </section>
        </div>
      </div>
      )}

      {/* The prompt. Enter stages; ⌘Enter takes. */}
      <footer style={{ display: 'flex', alignItems: 'center', gap: 8, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 6, padding: '8px 12px' }}>
        <span style={{ color: ACCENT }}>›</span>
        <input
          ref={input}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKey}
          placeholder='a reference stages it — "take" puts it on the wall'
          spellCheck={false}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: INK, font: 'inherit', fontSize: 13 }}
        />
        <span style={{ color: FAINT, fontSize: 10 }}>⌘⏎ go live</span>
      </footer>
    </div>
  );
}
