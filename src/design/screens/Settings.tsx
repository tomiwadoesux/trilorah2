import { GradientLab } from './GradientLab';
import { useEffect, useState, type ReactNode } from 'react';
import { cx, surface, Button, SearchField, SettingsIcon, MicIcon, BookIcon, SparkleIcon, MediaIcon, PencilIcon, CheckIcon, ResetIcon, TrashIcon, ChevronRightIcon, IconCredits, type SelectOption } from '../../ui';
import { AppShell, type ShellModel } from './AppShell';
import { Pill } from './parts';
import { useArtboard } from './artboard';
import { SettingRow, seedValues, rowVisible, SCRIPTURE_FACES, type Row } from './settingsRows';
import { displayMapFrom, useOutputsStatus } from './dashboard/outputs/fromEngine';
import { Cloud } from '../../screens/Cloud';
import { Themes } from '../../screens/Themes';
import { sortVersions, versionLabel, type BibleVersionRow } from '../../../shared/bibleVersions';

/*
 * S-10 — Settings.
 *
 * One screen, a vertical nav, nine pages — and every row on every page is a
 * setting the engine stores TODAY, under the key it stores it by. This is
 * `electron/data/settings.ts` laid out as a screen, not a wish list.
 *
 * Nine, not thirteen. Companion, giving, voice commands and connections
 * left for the dashboard: each is a tile there, and pressing the tile opens
 * it onto the same rows this screen would have shown. What is left here is
 * what a church sets once — who they are, how the app hears, how it
 * thinks, what the screens do, what scripture wears — plus the keys, the
 * account and the drawer. The rows themselves come from ./settingsRows, so
 * a setting looks the same here and on the dashboard.
 *
 * Two things that used to be settings are not any more, on the owner's
 * word: the false-positive filter, and whether to learn a pastor's style.
 * Both are what the app IS. A switch for either is the app asking
 * permission to work.
 *
 * NORMAL rows are things a church decides about. ADVANCED rows are
 * thresholds, under a disclosure at the foot of the page, closed by
 * default. A church that needs one will go looking.
 */

interface Page {
  id: string;
  title: string;
  blurb: string;
  icon: ReactNode;
  rows: Row[];
  /** A whole screen of its own above the rows — the cloud account and the
      projector text live here now that the top tabs are gone. */
  render?: () => ReactNode;
}

const ICON = 13;

const PAGES: Page[] = [
  {
    id: 'S-10a',
    title: 'Church',
    blurb: 'Who this copy of Trilorah belongs to. What the congregation sees on the projector and the companion page.',
    icon: <SettingsIcon size={ICON} />,
    rows: [
      { kind: 'text', key: 'churchName', label: 'Church name', blurb: 'Shown on the projector idle screen, the companion page and every export.', value: 'Victory Royale Church', placeholder: 'church name' },
      { kind: 'action', key: 'churchLogoUrl', label: 'Logo', blurb: 'Saved on this computer only. Sent to phones for the length of a service, never stored anywhere else.', button: 'choose image', note: 'church-logo.png · 512px · 84 kb' },
    ],
  },
  {
    id: 'S-10b',
    title: 'Audio & speech',
    blurb: 'How the app hears the preacher. If Sunday goes wrong, it is almost always on this page.',
    icon: <MicIcon size={ICON} />,
    rows: [
      { kind: 'status', key: 'micDeviceLabel', label: 'Microphone', blurb: 'Pick the soundboard feed, not the laptop mic. Used for every service until changed.', state: 'ok', text: 'Scarlett Solo USB · signal' },
      { kind: 'segment', key: 'asrProvider', label: 'Speech engine', blurb: 'whisper-local is free, runs on this computer and needs no account. Deepgram is the faster cloud option for churches that bring their own key. Both stay set up — switching does not forget either.', value: 'whisper-local', options: ['whisper-local', 'deepgram'] },
      { kind: 'segment', key: 'whisperModelSize', label: 'Whisper model', blurb: 'small is the right pick for strong accents. Larger models are slower to answer.', value: 'base', options: ['base', 'small', 'medium'], when: ['asrProvider', 'whisper-local'] },
      {
        kind: 'keys',
        key: 'deepgramApiKeys',
        label: 'Deepgram keys',
        blurb: 'Add as many as the church has and pick the one in use. A key is masked the moment it is saved; revealing it asks for the password you set when you added it.',
        keys: [
          { id: 'k1', name: 'main', prefix: 'HHD', active: true },
          { id: 'k2', name: 'backup', prefix: 'Q2f', active: false },
        ],
        when: ['asrProvider', 'deepgram'],
      },
    ],
  },
  {
    id: 'S-10c',
    title: 'Language',
    blurb: 'What the preacher speaks, and which Bible the resolver thinks in.',
    icon: <BookIcon size={ICON} />,
    rows: [
      { kind: 'select', key: 'engineLanguage', label: 'Engine language', blurb: 'Which language pack the reference resolver and voice commands use.', value: 'en', options: ['en', 'es', 'fr', 'pt', 'hi', 'zh'] },
      /* Free text, not a select: the seven codes that used to be the whole
         list left out es-419, fr-CA, de, ko, ru, it and ja, and a closed
         list is a wall for any church that speaks one of them. Deepgram
         and Whisper both take far more codes than anyone should enumerate
         here, so the blurb names the common ones and the field accepts
         whatever the transcriber does. */
      { kind: 'text', key: 'asrLanguage', label: 'Speech language', blurb: 'What the transcriber listens for — a language code such as en-US, en-GB, es-ES, es-419, fr-FR, fr-CA, pt-BR, de, it, hi-IN, zh-CN, ko or ja. Usually the same language as the engine above.', value: 'en-US', placeholder: 'en-US' },
      { kind: 'select', key: 'displayVersion', label: 'Default Bible on the projector', blurb: 'What a service starts on. The operator changes the Bible for the moment from the dropdown on Live, or the preacher by asking for another; the next service goes back to this.', value: 'KJV', options: [{ value: 'KJV', label: versionLabel('KJV') }] },
      { kind: 'note', key: 'uiLanguage', text: 'UI language is not built yet — the app is English-only for now. The setting is here so it is not forgotten.' },
    ],
  },
  {
    id: 'S-10d',
    title: 'Preacher AI',
    blurb: 'How the app listens to the pastor, decides what to display, and learns over time.',
    icon: <SparkleIcon size={ICON} />,
    rows: [
      { kind: 'toggle', key: 'agentEnabled', label: 'Service agent', blurb: 'Detects service transitions (worship → prayer → sermon) and times verse display accordingly.', value: true },
      { kind: 'toggle', key: 'adaptToAudienceCorrections', label: 'Adapt to audience corrections', blurb: "When audience members tap 'wrong verse' on a detection 5+ times in 30 seconds, auto-add the phrase to this pastor's false-positive filter.", value: true },
      { kind: 'toggle', key: 'vocabularyEnabled', label: 'Pastor vocabulary', blurb: 'Names and titles this pastor says often are fed to the transcriber so they come out spelt right.', value: true },
      { kind: 'slider', key: 'autoDisplayTimeout', label: 'Display hold', blurb: "Seconds a verse stays on screen after it's last mentioned before fading out.", value: 15, min: 5, max: 60, step: 5, unit: 's' },
      { kind: 'toggle', key: 'graceWindowEnabled', label: 'Grace window', blurb: 'Hold a detection in preview until the pastor actually starts reading it, instead of pushing on the first mention.', value: true },
      { kind: 'toggle', key: 'seasonalEnabled', label: 'Seasonal priors', blurb: 'Lean towards Advent readings in December and Easter readings in spring when two references are close.', value: true },
      { kind: 'percent', key: 'autoModeMinTrust', label: 'Auto-mode trust gate', blurb: 'A pastor goes hands-free when their verified precision clears this. Trust is one of three gates — the two below must clear too.', value: 0.9, advanced: true },
      { kind: 'number', key: 'autoModeMinSamples', label: 'Auto-mode minimum detections', blurb: 'Verified verses before auto mode is even considered.', value: 100, unit: 'verses', advanced: true },
      { kind: 'number', key: 'autoModeMinServices', label: 'Auto-mode minimum services', blurb: 'Services this pastor must have preached before auto mode is considered.', value: 5, unit: 'services', advanced: true },
      { kind: 'number', key: 'clashMarginPts', label: 'Clash margin', blurb: 'Two candidates within this many points is a clash — the app holds and asks the operator instead of guessing.', value: 15, unit: 'pts', advanced: true },
      { kind: 'number', key: 'matureMaxCorrections', label: 'Mature below', blurb: 'Corrections per service under which a profile counts as trained.', value: 2, unit: 'corrections', advanced: true },
      { kind: 'number', key: 'matureStreak', label: 'Mature streak', blurb: 'Quiet services in a row before training prompts switch off.', value: 3, unit: 'services', advanced: true },
      { kind: 'number', key: 'reopenCorrections', label: 'Reopen training at', blurb: 'Corrections in a single service that reopen a mature profile.', value: 4, unit: 'corrections', advanced: true },
      { kind: 'toggle', key: 'autoPingEnabled', label: 'Auto-push ping', blurb: 'A short sound when auto mode pushes a verse, so the booth knows it was the machine.', value: false, advanced: true },
      { kind: 'slider', key: 'autoPingVolume', label: 'Ping volume', blurb: '', value: 50, min: 0, max: 100, step: 10, unit: '%', advanced: true },
    ],
  },
  {
    id: 'S-10f',
    title: 'Displays & output',
    blurb: 'Which screen does what. The projector, the stream, and the monitor the pastor sees.',
    icon: <MediaIcon size={ICON} />,
    rows: [
      {
        kind: 'displays',
        key: 'outputRoles',
        label: 'Screens',
        blurb: 'Every display this computer can see. Press one to give it a job, or take one away.',
        displays: [
          { id: 'd1', name: 'Built-in display', w: 1512, h: 982, role: null, isOperator: true },
          { id: 'd2', name: 'Epson EB-L200', w: 1920, h: 1080, role: 'projector' },
          { id: 'd3', name: 'Stream (virtual)', w: 1920, h: 1080, role: 'stream' },
        ],
      },
      { kind: 'action', key: 'identifyDisplays', label: 'Identify', blurb: 'Flash a number on every connected display so you can tell which is which.', button: 'identify' },
      { kind: 'segment', key: 'streamLayout', label: 'Stream layout', blurb: 'lower-third is a band at the foot of the frame. full is the whole projector look on a transparent canvas.', value: 'lower-third', options: ['lower-third', 'full'] },
      { kind: 'toggle', key: 'stageShowClock', label: 'Stage clock', blurb: 'A clock on the confidence monitor.', value: true },
      { kind: 'toggle', key: 'stageShowNext', label: 'Stage up-next', blurb: 'The next item in the run of service, on the confidence monitor.', value: true },
      { kind: 'select', key: 'backgroundFit', label: 'Background fit', blurb: 'How a background image fills the projector.', value: 'cover', options: ['cover', 'contain', 'fill'] },
      { kind: 'select', key: 'backgroundPosition', label: 'Background position', blurb: '', value: 'center', options: ['center', 'top', 'bottom'] },
      { kind: 'slider', key: 'overlayOpacity', label: 'Overlay', blurb: 'The dark wash between the background and the text, so scripture stays readable over a bright photo.', value: 30, min: 0, max: 80, step: 5, unit: '%' },
      { kind: 'number', key: 'alertDefaultSeconds', label: 'Alert duration', blurb: 'How long a message alert stays on the projector.', value: 20, unit: 's', advanced: true },
    ],
  },
  {
    id: 'S-10g',
    title: 'Appearance',
    blurb: 'How the app looks to the operator, and the typeface scripture wears on the projector.',
    icon: <PencilIcon size={ICON} />,
    rows: [
      { kind: 'segment', key: 'appAurora', label: 'App colour', blurb: 'The colour behind your workspace. Buttons take on its tint.', value: 'fern', options: ['fern', 'iris', 'tide', 'ember', 'rose'] },
      { kind: 'segment', key: 'colorMode', label: 'Colour mode', blurb: 'The booth is dark. So is the default.', value: 'dark', options: ['dark', 'light'] },
      { kind: 'fonts', key: 'scriptureFontPreset', label: 'Scripture font', blurb: 'The face the congregation reads. Themes choose serif or sans serif; this is which serif and which sans they get.', value: 'cormorant', faces: SCRIPTURE_FACES },
      { kind: 'number', key: 'defaultFontWeight', label: 'Default weight', blurb: '', value: 600, advanced: true },
      { kind: 'text', key: 'defaultTextColor', label: 'Default text colour', blurb: '', value: '#ffffff', advanced: true },
    ],
  },
  {
    id: 'S-10k',
    title: 'API keys',
    blurb: "Tokens the app uses locally. Once a key is saved, it's masked — revealing it requires your account password.",
    icon: <CheckIcon size={ICON} />,
    rows: [
      { kind: 'secret', key: 'hfToken', label: 'Hugging Face', blurb: 'Sermon note generation and verse disambiguation. Usually pre-configured — transcription and detection work without it.', set: true },
      { kind: 'secret', key: 'pixabayApiKey', label: 'Pixabay', blurb: 'Stock backgrounds.', set: false },
      { kind: 'secret', key: 'pexelsApiKey', label: 'Pexels', blurb: 'Stock backgrounds.', set: false },
      { kind: 'note', key: 'deepgramWhere', text: 'Deepgram keys live under Audio & speech, beside the engine that uses them.' },
      { kind: 'segment', key: 'notesProvider', label: 'Notes provider', blurb: 'cloud uses the Hugging Face token above. local runs a small model on this computer and needs nothing.', value: 'cloud', options: ['cloud', 'local'] },
      { kind: 'toggle', key: 'useIncrementalNotes', label: 'Build notes live', blurb: 'Assemble the sermon outline incrementally during the sermon instead of only at the end. Slightly higher latency on transcription.', value: true },
    ],
  },
  {
    id: 'S-10l',
    title: 'Account & cloud',
    blurb: 'Sign in to your Trilorah account, link this computer, and see what has synced.',
    icon: <ResetIcon size={ICON} />,
    render: () => <Cloud />,
    rows: [
      { kind: 'text', key: 'publicWebUrl', label: 'Web address', blurb: 'Where the companion page and admin dashboard are served from.', value: 'http://localhost:3003', advanced: true },
    ],
  },
  {
    id: 'S-10n',
    title: 'Projector text',
    blurb: 'How verses are set on the wall: verse numbers, where the reference goes, a second translation, and how long verses split.',
    icon: <BookIcon size={ICON} />,
    render: () => <Themes />,
    rows: [],
  },
  {
    id: 'S-10m',
    title: 'Privacy & data',
    blurb: 'What this computer keeps, and how to get rid of it. Nothing on this page needs the internet.',
    icon: <TrashIcon size={ICON} />,
    rows: [
      { kind: 'note', key: 'whatIsStored', text: 'Stored on this computer: the Bible, transcripts of services, pastor profiles and their corrections, your settings and your logo. Sent to your account when a service ends: verses shown, notes, viewer counts. Never sent anywhere: audio.' },
      { kind: 'action', key: 'exportData', label: 'Export', blurb: 'Everything above as a folder you can keep.', button: 'export data' },
      { kind: 'action', key: 'evalExport', label: 'Evaluation set', blurb: 'The corrections as test fixtures — for improving the resolver.', button: 'export corrections', note: 'evals/ · last 3 sept' },
      { kind: 'action', key: 'wipeTranscripts', label: 'Transcripts', blurb: 'Delete every transcript on this computer. Profiles and settings stay.', button: 'wipe transcripts', tone: 'danger' },
      { kind: 'action', key: 'wipeProfiles', label: 'Pastor profiles', blurb: 'Delete every profile and everything it learned. Auto mode starts from nothing.', button: 'wipe profiles', tone: 'danger' },
      /* Filled from get-db-status: a count typed in here went stale the day a Bible was added. */
      { kind: 'status', key: 'dbStatus', label: 'Bible database', blurb: '', state: 'idle', text: 'bible.db', advanced: true },
      /* NKJV and NIV through YouVersion. No key field: the key is built in (owner rule). */
      { kind: 'status', key: 'onlineBibles', label: 'Online Bibles', blurb: 'NKJV and NIV from YouVersion, kept on this computer up to 30 days as they are used.', state: 'idle', text: 'checking…', advanced: true },
      { kind: 'action', key: 'rebuildIndex', label: 'Search index', blurb: 'Rebuild if verse search returns nothing for a reference you know exists.', button: 'rebuild', advanced: true },
      { kind: 'action', key: 'openLogs', label: 'Logs', blurb: '', button: 'open logs folder', advanced: true },
      { kind: 'status', key: 'version', label: 'Version', blurb: '', state: 'idle', text: 'trilorah 0.4.1 · up to date', advanced: true },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

/*
 * A page of settings, backed by the engine.
 *
 * Every row here used to live in local state and nothing else: a toggle
 * moved, looked changed, and was gone on reload. That is worse than an
 * inert control, because the operator believes they configured something.
 * The whole screen was a mock of itself.
 *
 * Now `values` is seeded from the real settings store and every change is
 * written back. The row's own `value` stays as the fallback for a key the
 * store has never held, so a page still draws before the read lands and
 * still draws in the sandbox where there is no engine at all.
 *
 * The save says so, too — see `saved`. A church laptop mid-setup that
 * accepts a change in silence is indistinguishable from one that dropped
 * it, and the value gets retyped three times. The old screen learned that
 * the hard way (src/screens/Settings.tsx) and the lesson comes with it.
 */
function PageBody({ page }: { page: Page }) {
  const screen = page.render?.();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const values = seedValues(page.rows);
    try { values.appAurora = localStorage.getItem('trilorah.aurora') ?? 'fern'; } catch { /* default */ }
    return values;
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  /** Which key last settled, and how it went. */
  const [saved, setSaved] = useState<{ key: string; ok: boolean } | null>(null);

  /* Seed from the store. Runs per page rather than once for the whole
     screen: a page is a handful of keys and the read is cheap, where a
     single shared cache would have to be invalidated by every write. */
  useEffect(() => {
    let alive = true;
    void window.api?.getSettings?.()
      .then((stored) => {
        if (!alive || !stored) return;
        setValues((v) => {
          const next = { ...v };
          for (const row of page.rows) {
            const held = (stored as Record<string, unknown>)[row.key];
            if (held !== undefined) next[row.key] = held;
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [page]);
  /* The Bible list is whatever bible.db actually holds, never a guess. The
     old hardcoded list offered NKJV and NIV against a database that has
     neither — pick one and every verse on the projector reads "not found". */
  const [versions, setVersions] = useState<string[] | null>(null);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; verses?: number; versions?: string[] } | null>(null);
  /* The same list with names and the online ones (NKJV/NIV greyed with the reason until a key unlocks them). */
  const [bibleRows, setBibleRows] = useState<{ versions: BibleVersionRow[]; online: { state: string; text: string } | null } | null>(null);
  /* Same rule for the language pack: offering a language the app has no
     pack for means a church picks it and the resolver quietly keeps
     speaking English. The engine knows which packs are installed. */
  const [languages, setLanguages] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    void window.api?.getAvailableVersions?.().then((v) => {
      if (alive && Array.isArray(v) && v.length) setVersions(v);
    });
    void window.api?.getDbStatus?.().then((status) => {
      if (alive && status) setDbStatus(status);
    }).catch(() => undefined);
    void window.api?.getBibleVersions?.().then((rows) => {
      if (alive && rows?.versions?.length) setBibleRows(rows);
    }).catch(() => undefined);
    const offBibles = window.api?.onEngineEvent?.('on-bible-versions-changed', (rows) => {
      const next = rows as typeof bibleRows;
      if (alive && next?.versions?.length) {
        setBibleRows(next);
        setVersions(next.versions.filter((r) => r.available).map((r) => r.code));
      }
    });
    void window.api?.getAvailableLanguages?.().then((l) => {
      if (alive && Array.isArray(l) && l.length) setLanguages(l.map((x) => x.code));
    }).catch(() => undefined);
    return () => {
      alive = false;
      offBibles?.();
    };
  }, []);
  /* And for the display map: the displays actually connected. It used to
     draw a built-in screen, an "Epson EB-L200" and a virtual stream on
     every machine. In the app it stays empty until the engine answers
     rather than show a projector that is not plugged in. */
  const outputs = useOutputsStatus(page.rows.some((r) => r.kind === 'displays'));
  const withLiveOptions = (r: Row): Row => {
    if (r.key === 'displayVersion' && versions && r.kind === 'select') {
      const installed: SelectOption[] = sortVersions(versions).map((v) => ({ value: v, label: versionLabel(v) }));
      /* A saved default this computer does not have (a .tri package can set
         one) used to read as a blank "select option". Catches quietly come
         in the fallback, so this is where the operator learns why: the
         saved one is listed for what it is, and cannot be picked again. */
      const saved = typeof values.displayVersion === 'string' ? values.displayVersion : '';
      /* NKJV/NIV a key has not unlocked: listed for what they are, greyed with the reason. */
      for (const row of bibleRows?.versions ?? []) {
        if (!row.available && row.code !== saved.trim().toUpperCase()) {
          // The same short form as "· not on this computer" below: the code, and why.
          installed.push({ value: row.code, label: `${row.code} · ${row.note ?? 'unavailable'}`, disabled: true });
        }
      }
      return saved && !versions.includes(saved.trim().toUpperCase())
        ? { ...r, options: [{ value: saved, label: `${saved.trim().toUpperCase()} · not on this computer`, disabled: true }, ...installed] }
        : { ...r, options: installed };
    }
    if (r.key === 'dbStatus' && r.kind === 'status' && dbStatus) {
      const count = dbStatus.versions?.length ?? 0;
      return dbStatus.connected
        ? { ...r, state: 'ok', text: `bible.db · ${(dbStatus.verses ?? 0).toLocaleString('en-US')} verses · ${count} ${count === 1 ? 'version' : 'versions'}` }
        : { ...r, state: 'danger', text: 'bible.db is missing — reinstall Trilorah' };
    }
    if (r.key === 'onlineBibles' && r.kind === 'status' && bibleRows) {
      const state = bibleRows.online?.state ?? 'no-key';
      return { ...r, state: state === 'ready' ? 'ok' : state === 'key-rejected' ? 'danger' : state === 'checking' ? 'idle' : 'warn',
        text: bibleRows.online?.text ?? 'no YouVersion key in this build' };
    }
    if (r.key === 'engineLanguage' && languages && 'options' in r) return { ...r, options: languages };
    if (r.kind === 'displays' && window.api) return { ...r, displays: outputs ? displayMapFrom(outputs) : [] };
    return r;
  };
  const visible = page.rows.map(withLiveOptions).filter((r) => rowVisible(r, values));
  const normal = visible.filter((r) => !r.advanced);
  const advanced = visible.filter((r) => r.advanced);
  const set = (key: string) => (next: unknown) => {
    /* Local first: the operator's own input is never yanked back while a
       write is in flight. */
    setValues((v) => ({ ...v, [key]: next }));
    if (key === 'appAurora') {
      document.documentElement.dataset.aurora = String(next);
      try { localStorage.setItem('trilorah.aurora', String(next)); } catch { /* session only */ }
      setSaved({ key, ok: true });
      return;
    }
    const api = window.api;
    if (!api?.setSetting) return;
    void api
      .setSetting(key, next)
      .then((ok) => setSaved({ key, ok: ok !== false }))
      .catch(() => setSaved({ key, ok: false }));
  };
  const n = PAGES.indexOf(page) + 1;

  return (
    <div className="mx-auto w-full max-w-[760px] px-10 pb-16 pt-10">
      <div className="text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.2em] text-[rgb(229_243_242_/_0.35)]">
        {String(n).padStart(2, '0')} · {page.id}
      </div>
      <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-[var(--tri-ink)]">{page.title}</h1>
      <p className="mt-2 max-w-[560px] text-[length:var(--tri-size)] leading-relaxed text-[rgb(229_243_242_/_0.55)]">{page.blurb}</p>
      {screen ? <div className="settings-screen mt-8">{screen}</div> : null}

      {page.id === 'S-10g' && <GradientLab />}
      <div className="mt-8">
        {normal.map((row) => row.key === 'appAurora' ? (
          <fieldset key={row.key} className="mb-6 border-b border-white/10 pb-6">
            <legend className="mb-2 text-sm font-medium">App colour</legend>
            <p className="mb-4 text-xs text-white/50">The colour behind your workspace. Buttons take on its tint.</p>
            <div className="grid grid-cols-5 gap-2">
              {AURORA_SWATCHES.map(({ id, colors }) => (
                <button key={id} type="button" aria-pressed={values.appAurora === id}
                  aria-label={`${id} app colour`} onClick={() => set('appAurora')(id)}
                  className="aurora-choice">
                  <span className="aurora-choice-art" style={{ background: colors[0], borderBottom: `2px solid ${colors[1]}` }}>
                    {values.appAurora === id && <CheckIcon size={16} />}
                  </span>
                  <span className="capitalize">{id}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <SettingRow
            key={row.key}
            row={row}
            value={values[row.key]}
            onChange={set(row.key)}
            saved={saved?.key === row.key ? saved.ok : undefined}
          />
        ))}
      </div>

      {advanced.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex items-center gap-2 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.16em] text-[rgb(229_243_242_/_0.45)] transition-colors hover:text-[rgb(229_243_242_/_0.7)]"
          >
            <ChevronRightIcon size={12} className={cx('transition-transform', showAdvanced && 'rotate-90')} />
            advanced
            <span className="font-normal normal-case tracking-normal text-[rgb(229_243_242_/_0.3)]">
              {advanced.length} {advanced.length === 1 ? 'setting' : 'settings'}
            </span>
          </button>
          {showAdvanced && (
            <div className="mt-2">
              {advanced.map((row) => (
                <SettingRow
                  key={row.key}
                  row={row}
                  value={values[row.key]}
                  onChange={set(row.key)}
                  saved={saved?.key === row.key ? saved.ok : undefined}
                />
              ))}
              <div className="flex justify-end pt-4">
                <Button label="reset these to defaults" icon={<ResetIcon size={12} />} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The screen                                                          */
/* ------------------------------------------------------------------ */

const AURORA_SWATCHES = [
  { id: 'fern', colors: ['#07151a', '#397465', '#3d516d'] },
  { id: 'iris', colors: ['#131026', '#69509d', '#855077'] },
  { id: 'tide', colors: ['#091724', '#286b87', '#445f99'] },
  { id: 'ember', colors: ['#201217', '#a3653f', '#854860'] },
  { id: 'rose', colors: ['#1d111e', '#985177', '#68548b'] },
];

const NAV_W = 220;

export function SettingsSurface({ pageId }: { pageId: string }) {
  const [current, setCurrent] = useState(pageId);
  const [query, setQuery] = useState('');
  useEffect(() => { setCurrent(pageId); setQuery(''); }, [pageId]);
  const page = PAGES.find((p) => p.id === current) ?? PAGES[0];

  /* Matches row names and keys too, not just page titles — a church looking
     for "whisper" does not know it is on Audio & speech. */
  const q = query.trim().toLowerCase();
  const hits = q
    ? PAGES.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.rows.some((r) => 'label' in r && (r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q))),
      ).map((p) => p.id)
    : null;

  return (
    <div className="flex h-full">
      <nav className="flex shrink-0 flex-col gap-[var(--tri-gap)] p-2.5" style={{ width: NAV_W, boxShadow: 'inset -1px 0 0 rgb(255 255 255 / 0.06)' }}>
        <div className="px-2 pt-1 text-[length:var(--tri-size-eyebrow)] font-semibold uppercase tracking-[0.2em] text-[rgb(229_243_242_/_0.35)]">settings</div>
        <SearchField value={query} onChange={setQuery} placeholder="find a setting" />
        <ul className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto">
          {PAGES.map((p, i) => {
            const active = p.id === page.id;
            const dim = hits !== null && !hits.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(p.id)}
                  className={cx(
                    active && surface({ tone: 'default', shape: 'control' }),
                    'flex w-full items-center gap-2.5 px-2.5 py-[7px] text-left transition-opacity',
                    !active && 'tri-rounded-control hover:bg-[rgb(255_255_255_/_0.03)]',
                    dim && 'opacity-30',
                  )}
                >
                  <span className="w-[16px] shrink-0 text-[length:var(--tri-size-eyebrow)] tabular-nums text-[rgb(229_243_242_/_0.28)]">{String(i + 1).padStart(2, '0')}</span>
                  <span className={cx('shrink-0', active ? 'text-[#8fd3c0]' : 'text-[rgb(229_243_242_/_0.45)]')}>{p.icon}</span>
                  <span className={cx('truncate text-[length:var(--tri-size)]', active ? 'text-[var(--tri-ink)]' : 'text-[rgb(229_243_242_/_0.7)]')}>{p.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="px-2 pb-1 text-[length:var(--tri-size-eyebrow)] leading-relaxed text-[rgb(229_243_242_/_0.3)]">
          companion · giving · voice commands · connections are on the dashboard
        </p>
        <div className="flex items-center gap-2 px-2 pb-1 text-[length:var(--tri-size-xs)] text-[rgb(229_243_242_/_0.4)]">
          <Pill tone="ok">saved</Pill>
          <span>changes apply as you make them</span>
        </div>
        <IconCredits className="px-2 pb-1" />
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <PageBody key={page.id} page={page} />
      </div>
    </div>
  );
}

export const SETTINGS_STATES = PAGES.map((p) => ({ id: p.id, label: p.title.toLowerCase(), note: p.blurb }));

const SHELL: ShellModel = { tab: 'SETTINGS', engine: 'connected' };

export function SettingsScreen({ state }: { state: string }) {
  useArtboard();
  return (
    <AppShell model={SHELL}>
      <SettingsSurface key={state} pageId={state} />
    </AppShell>
  );
}
