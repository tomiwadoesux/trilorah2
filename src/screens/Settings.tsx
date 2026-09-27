import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppStore } from '../stores/appStore';
import { SectionLabel, EngineNote, hasEngine } from '../components/ui';

/*
 * Telling the operator their change landed.
 *
 * Every field here has always saved the instant you left it — there is no
 * Apply button because there is nothing to apply. But nothing SAID so, and a
 * screen that accepts a change in silence is indistinguishable from one that
 * dropped it. On a church laptop, mid-setup, that silence is read as "this is
 * broken" and the value gets retyped three times.
 *
 * So a save now announces itself twice over: the row flashes "saved" beside
 * the field it belongs to, and a line at the foot of the screen names the
 * setting, which is what the operator sees when the field has already
 * scrolled away. Both come from the same call, so neither can claim a save
 * the other did not make.
 *
 * It also reports FAILURE, which the old silent `.catch(() => undefined)`
 * swallowed entirely: a key the engine rejects now says so in red instead of
 * looking exactly like a success.
 */
interface SaveFeedback {
  /** Which key last settled, and how it went. */
  status: { key: string; state: 'saved' | 'failed' } | null;
  save: (key: string, value: unknown, label?: string) => void;
}

const SaveCtx = createContext<SaveFeedback>({
  status: null,
  save: (key, value) => {
    void window.api?.setSetting(key, value).catch(() => undefined);
    useAppStore.getState().patchSetting(key, value);
  },
});

function SaveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SaveFeedback['status']>(null);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const save = useCallback((key: string, value: unknown, label?: string) => {
    /* The cache is patched first so the field keeps the typed value even if
       the write is slow — the operator's own input is never yanked back. */
    useAppStore.getState().patchSetting(key, value);
    const name = label ?? key;
    const settle = (state: 'saved' | 'failed') => {
      setStatus({ key, state });
      setNote({
        text: state === 'saved' ? `${name} saved` : `${name} could not be saved`,
        bad: state === 'failed',
      });
      /* Clears itself. A "saved" badge that never leaves stops meaning
         "just now", which is the only thing it is for. */
      timers.current.push(
        window.setTimeout(() => {
          setStatus((s) => (s?.key === key ? null : s));
          setNote(null);
        }, state === 'saved' ? 2200 : 6000),
      );
    };
    const write = window.api?.setSetting?.(key, value);
    if (!write) {
      /* No engine behind the window — design mode, or a browser tab. The
         cache took it, so say saved rather than inventing a failure. */
      settle('saved');
      return;
    }
    void write.then(() => settle('saved')).catch(() => settle('failed'));
  }, []);

  return (
    <SaveCtx.Provider value={{ status, save }}>
      {children}
      {/* Fixed to the foot of the screen: the field that was edited is
          often no longer the field being looked at. */}
      {note && (
        <div
          className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-xs lowercase tracking-wide shadow-lg backdrop-blur ${
            note.bad
              ? 'bg-red-500/20 text-red-200 ring-1 ring-red-400/40'
              : 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30'
          }`}
          role="status"
          aria-live="polite"
        >
          {note.text}
        </div>
      )}
    </SaveCtx.Provider>
  );
}

/** Persist one key, mirroring it into the renderer's settings cache. */
function useSave() {
  return useContext(SaveCtx).save;
}

/** The "saved" tick that rides the row whose field just settled. */
function SavedBadge({ settingKey }: { settingKey: string }) {
  const { status } = useContext(SaveCtx);
  if (status?.key !== settingKey) return null;
  return (
    <span
      className={`text-[10px] uppercase tracking-widest ${
        status.state === 'saved' ? 'text-emerald-300' : 'text-red-300'
      }`}
    >
      {status.state === 'saved' ? '✓ saved' : '✕ failed'}
    </span>
  );
}

function Row({ label, children, settingKey }: { label: string; children: ReactNode; settingKey?: string }) {
  return (
    <label className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <span className="w-44 shrink-0 text-xs uppercase tracking-widest text-neutral-400">{label}</span>
      {children}
      {settingKey && <SavedBadge settingKey={settingKey} />}
    </label>
  );
}

/** Text-ish input persisted on blur. Remounted via `key` when settings load. */
function TextSetting({
  label,
  settingKey,
  masked,
  placeholder,
  wide,
}: {
  label: string;
  settingKey: string;
  masked?: boolean;
  placeholder?: string;
  wide?: boolean;
}) {
  const settings = useAppStore((s) => s.settings);
  const save = useSave();
  const initial = settings?.[settingKey];
  return (
    <Row label={label} settingKey={settingKey}>
      <input
        type={masked ? 'password' : 'text'}
        defaultValue={typeof initial === 'string' || typeof initial === 'number' ? String(initial) : ''}
        placeholder={placeholder}
        /* Enter saves too. Blur alone means the last field an operator types
           into is unsaved until they click elsewhere, and pressing Enter and
           seeing nothing is exactly what reads as a dead form. */
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => save(settingKey, e.target.value, label)}
        className={`text-sm ${wide ? 'w-full max-w-md' : 'w-64'}`}
        autoComplete="off"
      />
    </Row>
  );
}

function NumberSetting({ label, settingKey, suffix }: { label: string; settingKey: string; suffix?: string }) {
  const settings = useAppStore((s) => s.settings);
  const save = useSave();
  const initial = settings?.[settingKey];
  return (
    <Row label={label} settingKey={settingKey}>
      <input
        defaultValue={typeof initial === 'number' ? String(initial) : ''}
        inputMode="numeric"
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => {
          const n = Number.parseFloat(e.target.value);
          if (!Number.isNaN(n)) save(settingKey, n, label);
        }}
        className="w-24 text-sm"
      />
      {suffix && <span className="text-xs text-neutral-400">{suffix}</span>}
    </Row>
  );
}

function SelectSetting({
  label,
  settingKey,
  options,
  fallback,
}: {
  label: string;
  settingKey: string;
  options: string[];
  fallback: string;
}) {
  const settings = useAppStore((s) => s.settings);
  const save = useSave();
  const raw = settings?.[settingKey];
  const value = typeof raw === 'string' && raw ? raw : fallback;
  return (
    <Row label={label} settingKey={settingKey}>
      <select value={value} onChange={(e) => save(settingKey, e.target.value, label)} className="text-sm">
        {(options.includes(value) ? options : [value, ...options]).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Row>
  );
}

/** 0-1 setting edited as a percentage. */
function PercentSetting({
  label,
  settingKey,
  suffix,
}: {
  label: string;
  settingKey: string;
  suffix?: string;
}) {
  const settings = useAppStore((s) => s.settings);
  const save = useSave();
  const initial = settings?.[settingKey];
  return (
    <Row label={label} settingKey={settingKey}>
      <input
        defaultValue={typeof initial === 'number' ? String(Math.round(initial * 100)) : ''}
        inputMode="numeric"
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => {
          const n = Number.parseFloat(e.target.value);
          if (!Number.isNaN(n) && n > 0 && n <= 100) save(settingKey, n / 100, label);
        }}
        className="w-24 text-sm"
      />
      <span className="text-xs text-neutral-400">{suffix ?? '%'}</span>
    </Row>
  );
}

const ASR_LANGUAGE_SUGGESTIONS = [
  'en-US', 'en-GB', 'es', 'es-419', 'fr', 'fr-CA', 'pt', 'pt-BR', 'hi', 'zh-CN', 'de', 'ko', 'ru', 'nl', 'it', 'ja',
];

function LanguageSettings() {
  const [languages, setLanguages] = useState<Array<{ code: string; label: string }>>([]);
  useEffect(() => {
    void window.api?.getAvailableLanguages?.().then(setLanguages).catch(() => undefined);
  }, []);
  const settings = useAppStore((s) => s.settings);
  const save = useSave();
  const engineLang = typeof settings?.engineLanguage === 'string' ? settings.engineLanguage : 'en';
  return (
    <>
      <Row label="engine language" settingKey="engineLanguage">
        <select
          value={engineLang}
          onChange={(e) => save('engineLanguage', e.target.value, 'engine language')}
          className="text-sm"
        >
          {(languages.length > 0 ? languages : [{ code: 'en', label: 'English' }]).map((l) => (
            <option key={l.code} value={l.code}>
              {l.label} ({l.code})
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">book names, numbers & commands — english always stays on underneath</span>
      </Row>
      <Row label="asr language" settingKey="asrLanguage">
        <input
          defaultValue={typeof settings?.asrLanguage === 'string' ? settings.asrLanguage : 'en-US'}
          list="asr-languages"
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={(e) => e.target.value && save('asrLanguage', e.target.value, 'asr language')}
          className="w-32 text-sm"
        />
        <datalist id="asr-languages">
          {ASR_LANGUAGE_SUGGESTIONS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <span className="text-xs text-neutral-400">what the transcriber listens in (deepgram code / whisper language)</span>
      </Row>
    </>
  );
}

function Section({ title, children, dataTour }: { title: string; children: ReactNode; dataTour?: string }) {
  return (
    <section data-tour={dataTour} className="space-y-4 border-t border-hairline pt-8 first:border-t-0 first:pt-0">
      <SectionLabel>{title}</SectionLabel>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/*
 * The screen itself, inside the save-feedback provider.
 *
 * Split in two so every setting row below can call useSave() — a provider
 * cannot be consumed by the component that renders it.
 */
export function Settings() {
  return (
    <SaveProvider>
      <SettingsBody />
    </SaveProvider>
  );
}

function SettingsBody() {
  const settings = useAppStore((s) => s.settings);
  const loaded = settings != null;
  const [versions, setVersions] = useState<string[]>([]);
  useEffect(() => {
    void window.api?.getAvailableVersions().then(setVersions).catch(() => undefined);
  }, []);

  if (!hasEngine()) {
    return (
      <div className="space-y-6">
        <SectionLabel>settings</SectionLabel>
        <EngineNote what="engine not connected — settings live in the Electron main process" />
      </div>
    );
  }

  return (
    // Remount all defaultValue inputs once the settings cache arrives.
    <div key={loaded ? 'loaded' : 'loading'} className="space-y-10">
      {!loaded && <p className="text-sm italic text-neutral-400">loading settings…</p>}

      <Section title="transcription" dataTour="settings-keys">
        <SelectSetting
          label="speech engine"
          settingKey="asrProvider"
          options={['whisper-local', 'deepgram']}
          fallback="whisper-local"
        />
        <p className="pl-50 text-xs leading-relaxed text-neutral-400">
          whisper-local is the default: free, runs on this computer, no account or key needed
          (the speech model downloads itself the first time you press start listening).
          deepgram is the faster cloud option for churches that bring their own key.
        </p>
      </Section>

      <Section title="language">
        <LanguageSettings />
      </Section>

      <Section title="display">
        <SelectSetting
          label="default translation"
          settingKey="displayVersion"
          options={versions.length > 0 ? versions : ['KJV']}
          fallback="KJV"
        />
      </Section>

      {/*
          Auto mode in the operator's words.

          Every number here was named after the statistic behind it — "wilson
          lower bound", "min samples", "mature streak". Those are the right
          names for the engine and the wrong ones for a volunteer at a church
          laptop, who is being asked to decide when the app may put scripture
          on the wall without them. Someone who cannot read the label cannot
          judge the risk, so they either leave the defaults untouched and
          never know what they agreed to, or change one and find out during a
          service.

          So the section leads with what auto mode IS, and each row asks the
          question the number answers. The statistics did not change — only
          who the screen is written for.
      */}
      <Section title="trust & auto mode">
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">
          Normally the app finds a verse and waits for you to press it onto the screen. Auto mode
          lets it put the verse up by itself — but only for a preacher it has been right about,
          over and over, for weeks. These numbers are how sure it has to be before it earns that.
          You can leave them alone; the defaults are deliberately strict.
        </p>
        <PercentSetting
          label="how often it must be right"
          settingKey="autoModeMinTrust"
          suffix="out of every 100 verses — and it has to be a safe estimate, not a lucky streak"
        />
        <NumberSetting
          label="before we start counting"
          settingKey="autoModeMinSamples"
          suffix="verses you've confirmed for this preacher"
        />
        <NumberSetting
          label="across at least"
          settingKey="autoModeMinServices"
          suffix="services — one good Sunday isn't proof"
        />
        <NumberSetting
          label="a calm service means"
          settingKey="matureMaxCorrections"
          suffix="corrections or fewer from you"
        />
        <NumberSetting
          label="and it needs"
          settingKey="matureStreak"
          suffix="calm services in a row before it's trusted"
        />
        <NumberSetting
          label="hand it back to you at"
          settingKey="reopenCorrections"
          suffix="corrections in a single service"
        />
        <p className="max-w-2xl pl-50 text-xs leading-relaxed text-neutral-400">
          If a preacher's auto mode is switched off by that last number, nothing breaks — the app
          simply goes back to asking you first, and starts earning its way back. Changes here take
          effect immediately.
        </p>
      </Section>

      <Section title="church & web">
        <TextSetting label="church name" settingKey="churchName" wide />
        <TextSetting label="public web url" settingKey="publicWebUrl" wide />
        <TextSetting label="account slug" settingKey="accountSlug" />
      </Section>

      <Section title="external control">
        <p className="text-sm leading-relaxed text-neutral-500">
          Stream Deck / Bitfocus Companion can reach the app at{' '}
          <span className="font-mono text-ink">ws://localhost:8081</span> — send JSON like{' '}
          <span className="font-mono">{'{"action":"START_LISTENING"}'}</span>. Commands:{' '}
          <span className="font-mono">START_LISTENING</span>, <span className="font-mono">STOP_LISTENING</span>,{' '}
          <span className="font-mono">CLEAR_SCREEN</span>, <span className="font-mono">PUSH_PREVIEW</span>.
        </p>
      </Section>

      {/* There is no Apply button because there is nothing to apply, and
          saying so plainly is the point: an operator looking for one needs to
          be told it does not exist, not left to wonder. */}
      <p className="text-xs text-neutral-400">
        no apply button — every field saves the moment you leave it (or press enter), and says{' '}
        <span className="text-emerald-300">✓ saved</span> when it has
      </p>
    </div>
  );
}
