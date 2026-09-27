import { useEffect, useState, type ReactNode } from 'react';
import { cx, surface, Button, SearchField, SettingsIcon, MicIcon, BookIcon, SparkleIcon, MediaIcon, PencilIcon, CheckIcon, ResetIcon, TrashIcon } from '../../ui';
import { AppShell, type ShellModel } from './AppShell';
import { Pill } from './parts';
import { useArtboard } from './artboard';
import { SettingRow, seedValues, rowVisible, SCRIPTURE_FACES, type Row } from './settingsRows';
import { displayMapFrom, useOutputsStatus } from './dashboard/outputs/fromEngine';

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
      { kind: 'select', key: 'displayVersion', label: 'Default Bible on the projector', blurb: 'What a service starts on. The operator changes the Bible for the moment from the dropdown on Live; this is what it goes back to.', value: 'KJV', options: ['KJV'] },
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
    title: 'Account',
    blurb: 'Your Trilorah account, your companion link, and what syncs.',
    icon: <ResetIcon size={ICON} />,
    rows: [
      { kind: 'status', key: 'cloudStatus', label: 'Signed in as', blurb: '', state: 'ok', text: 'vrcministries@gmail.com · id TRL-••••5675' },
      { kind: 'text', key: 'accountSlug', label: 'Companion link', blurb: 'trilorah.app/live/<name>. A name someone else holds will not save — you can ask for it, and the app tells you if they let it go. Change yours and the old one is free again.', value: 'vrc', placeholder: 'yourchurch' },
      { kind: 'status', key: 'slugAvailability', label: 'This name', blurb: '', state: 'ok', text: 'vrc · yours' },
      { kind: 'text', key: 'publicWebUrl', label: 'Web address', blurb: 'Where the companion page and admin dashboard are served from.', value: 'http://localhost:3003', advanced: true },
      { kind: 'status', key: 'syncStatus', label: 'Sync', blurb: 'Finished services, notes and audience counts. Nothing syncs during a service.', state: 'ok', text: 'last synced 23 april · 4 services' },
      { kind: 'action', key: 'cloudRunRetentionCleanup', label: 'Retention', blurb: 'Sermon notes and audience activity older than four weeks are removed.', button: 'run now', note: 'next run sunday' },
      { kind: 'action', key: 'cloudVerifyPassword', label: 'Password', blurb: '', button: 'change password' },
      { kind: 'action', key: 'cloudSignOutAllDevices', label: 'Other devices', blurb: 'Sign this account out everywhere except here.', button: 'sign out all devices', tone: 'danger' },
      { kind: 'action', key: 'cloudSignOut', label: 'This device', blurb: '', button: 'sign out', tone: 'danger' },
    ],
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
      { kind: 'status', key: 'dbStatus', label: 'Bible database', blurb: '', state: 'ok', text: 'bible.db · 186,486 verses · 6 versions', advanced: true },
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
  const [values, setValues] = useState<Record<string, unknown>>(() => seedValues(page.rows));
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
  /* Same rule for the language pack: offering a language the app has no
     pack for means a church picks it and the resolver quietly keeps
     speaking English. The engine knows which packs are installed. */
  const [languages, setLanguages] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    void window.api?.getAvailableVersions?.().then((v) => {
      if (alive && Array.isArray(v) && v.length) setVersions(v);
    });
    void window.api?.getAvailableLanguages?.().then((l) => {
      if (alive && Array.isArray(l) && l.length) setLanguages(l.map((x) => x.code));
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  /* And for the display map: the displays actually connected. It used to
     draw a built-in screen, an "Epson EB-L200" and a virtual stream on
     every machine. In the app it stays empty until the engine answers
     rather than show a projector that is not plugged in. */
  const outputs = useOutputsStatus(page.rows.some((r) => r.kind === 'displays'));
  const withLiveOptions = (r: Row): Row => {
    if (r.key === 'displayVersion' && versions && 'options' in r) return { ...r, options: versions };
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

      <div className="mt-8">
        {normal.map((row) => (
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
            <span className={cx('inline-block transition-transform', showAdvanced ? 'rotate-90' : '')}>›</span>
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

const NAV_W = 220;

export function SettingsSurface({ pageId }: { pageId: string }) {
  const [current, setCurrent] = useState(pageId);
  const [query, setQuery] = useState('');
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
