import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppStore } from '../stores/appStore';
import { TextButton, SectionLabel, EngineNote, hasEngine } from '../components/ui';
import { listAudioInputs, onDeviceChange } from '../lib/audioDevices';

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

function ToggleSetting({ label, settingKey }: { label: string; settingKey: string }) {
  const settings = useAppStore((s) => s.settings);
  const save = useSave();
  const on = settings?.[settingKey] === true;
  return (
    <Row label={label} settingKey={settingKey}>
      <button
        type="button"
        onClick={() => save(settingKey, !on, label)}
        className={`text-xs uppercase tracking-widest underline-offset-4 hover:underline ${
          on ? 'text-accent' : 'text-neutral-400'
        }`}
      >
        [{on ? 'ON' : 'OFF'}]
      </button>
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
function PercentSetting({ label, settingKey }: { label: string; settingKey: string }) {
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
      <span className="text-xs text-neutral-400">% precision (lower bound)</span>
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

/** Editable phrase categories from voice-commands.json (user layer). */
const PHRASE_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'prayerStart', label: 'prayer start' },
  { key: 'prayerEnd', label: 'prayer end' },
  { key: 'dismiss', label: 'take it down' },
  { key: 'hold', label: 'leave it up' },
  { key: 'iSaidTriggers', label: 'correction lead-ins' },
  { key: 'navNext', label: 'next verse' },
  { key: 'navPrevious', label: 'previous verse' },
  { key: 'intentPhrases', label: 'opening-bible intent' },
  { key: 'narrativeMarkers', label: 'story markers' },
  { key: 'deferPhrases', label: 'come-back-later' },
  { key: 'chapterWords', label: '"chapter" words' },
  { key: 'verseWords', label: '"verse" words' },
];

function VoiceCommandEditor() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [merged, setMerged] = useState<Record<string, unknown> | null>(null);
  const [filePath, setFilePath] = useState('');
  const [category, setCategory] = useState('prayerStart');
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const load = () => {
    void window.api?.getVoiceCommandConfig?.()
      .then((res) => {
        setUser(res.user ?? {});
        setMerged(res.merged ?? {});
        setFilePath(res.filePath ?? '');
      })
      .catch(() => undefined);
  };
  useEffect(load, []);

  if (!user || !merged) {
    return <p className="pl-50 text-xs text-neutral-400">loading phrases…</p>;
  }

  const userList = Array.isArray(user[category]) ? (user[category] as string[]) : [];
  const mergedList = Array.isArray(merged[category]) ? (merged[category] as string[]) : [];

  const persist = (next: Record<string, unknown>) => {
    setUser(next);
    setNote('saving…');
    void window.api?.saveVoiceCommandConfig?.(next)
      .then(() => {
        setNote('saved — live immediately');
        load();
      })
      .catch(() => setNote('could not save'));
  };

  const addPhrase = () => {
    const phrase = draft.trim().toLowerCase();
    if (!phrase) return;
    persist({ ...user, [category]: [...userList, phrase] });
    setDraft('');
  };

  return (
    <div className="space-y-3 pl-50">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-sm">
          {PHRASE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">{mergedList.length} active phrases (built-in + language pack + yours)</span>
      </div>
      <ul className="space-y-1">
        {userList.map((p, i) => (
          <li key={`${p}-${i}`} className="flex items-baseline gap-x-4 text-sm">
            <span>“{p}”</span>
            <TextButton
              label="REMOVE"
              onClick={() => persist({ ...user, [category]: userList.filter((_, k) => k !== i) })}
            />
          </li>
        ))}
        {userList.length === 0 && (
          <li className="text-xs italic text-neutral-400">no custom phrases yet — the built-ins are active</li>
        )}
      </ul>
      <div className="flex flex-wrap items-baseline gap-x-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPhrase()}
          placeholder="add a phrase your preacher actually says…"
          className="w-full max-w-md text-sm"
        />
        <TextButton label="ADD" primary onClick={addPhrase} />
        {note && <span className="text-xs text-neutral-400">{note}</span>}
      </div>
      {filePath && (
        <p className="text-xs text-neutral-400">
          full config (incl. translation names) lives at {filePath}
        </p>
      )}
    </div>
  );
}

/** Default microphone for services — same device list the Live bar uses. */
function MicDevicePicker() {
  const settings = useAppStore((s) => s.settings);
  const save = useSave();
  const saved = typeof settings?.micDeviceLabel === 'string' ? settings.micDeviceLabel : '';
  const [labels, setLabels] = useState<string[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listAudioInputs().then((inputs) => {
        if (cancelled) return;
        setLabels(inputs.map((d) => d.label));
        setLoadedOnce(true);
      });
    };
    load();
    const unsub = onDeviceChange(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return (
    <Row label="microphone" settingKey="micDeviceLabel">
      <select
        value={saved}
        onChange={(e) => save('micDeviceLabel', e.target.value, 'microphone')}
        className="max-w-md text-sm"
      >
        <option value="">default microphone</option>
        {labels.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
      <span className="text-xs text-neutral-400">
        {labels.length === 0
          ? loadedOnce
            ? 'no inputs found — plug in the soundboard/USB interface and check it shows in the computer\'s sound settings'
            : 'looking for microphones…'
          : 'used for every service until changed — pick the soundboard feed, not the laptop mic'}
      </span>
    </Row>
  );
}

function DisplayAssignmentSection() {
  const settings = useAppStore((s) => s.settings);
  const save = useSave();
  const [displays, setDisplays] = useState<{
    totalDisplays: number;
    hasExternal: boolean;
    primary: { id: number; bounds: { width: number; height: number } };
    externals: Array<{ id: number; bounds: { width: number; height: number } }>;
  } | null>(null);

  useEffect(() => {
    void window.api?.getDisplaysStatus?.().then((d) => setDisplays(d ?? null));
  }, []);

  const outputDisplays = (settings?.outputDisplays as Record<string, number> | undefined) || {};

  const setOutputDisplay = (outputId: string, displayId: number | undefined, label: string) => {
    const next = { ...outputDisplays };
    if (displayId === undefined) {
      delete next[outputId];
    } else {
      next[outputId] = displayId;
    }
    /* Named after the output, not after the key: three pickers share
       `outputDisplays`, and "outputDisplays saved" would not tell the
       operator which of the three they just changed. */
    save('outputDisplays', next, label);
  };

  const options: Array<{ label: string; id: number | undefined }> = [
    { label: 'Auto (order connected)', id: undefined },
  ];
  if (displays) {
    options.push({
      label: `Display 1: Primary (${displays.primary.bounds.width}×${displays.primary.bounds.height})`,
      id: displays.primary.id,
    });
    displays.externals.forEach((ext, idx) => {
      options.push({
        label: `Display ${idx + 2}: External HDMI (${ext.bounds.width}×${ext.bounds.height})`,
        id: ext.id,
      });
    });
  }

  const renderSelect = (outputId: string, label: string) => {
    const current = outputDisplays[outputId];
    return (
      <Row label={label} settingKey="outputDisplays">
        <select
          value={current !== undefined ? String(current) : ''}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : undefined;
            setOutputDisplay(outputId, val, label);
          }}
          className="text-sm"
        >
          {options.map((opt, idx) => (
            <option key={opt.id !== undefined ? String(opt.id) : `auto-${idx}`} value={opt.id !== undefined ? String(opt.id) : ''}>
              {opt.label}
            </option>
          ))}
        </select>
      </Row>
    );
  };

  return (
    <div className="space-y-3 pt-2">
      {renderSelect('main', 'main verses screen')}
      {renderSelect('timer', 'dedicated timer screen')}
      {renderSelect('third', 'stage monitor screen')}
      {displays && displays.externals.length === 0 && (
        <p className="max-w-xl text-xs leading-relaxed text-amber-500/80">
          No external HDMI displays currently detected. Plug in your HDMI screens and outputs will automatically map.
        </p>
      )}
    </div>
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
  const [obsNote, setObsNote] = useState<string | null>(null);
  const [obsScenes, setObsScenes] = useState<string[]>([]);
  const [vmixNote, setVmixNote] = useState<string | null>(null);

  useEffect(() => {
    void window.api?.getAvailableVersions().then(setVersions).catch(() => undefined);
  }, []);

  const connectObs = async () => {
    setObsNote('connecting…');
    try {
      const res = await window.api?.obsConnect();
      if (res?.success) {
        const status = await window.api?.obsStatus();
        setObsNote(status?.connected ? 'connected' : status?.error ?? 'connected (status unknown)');
        const scenes = Array.isArray(status?.scenes)
          ? (status.scenes as unknown[])
              .map((s) =>
                typeof s === 'string'
                  ? s
                  : s != null && typeof s === 'object' && 'sceneName' in s
                    ? String((s as { sceneName: unknown }).sceneName)
                    : '',
              )
              .filter(Boolean)
          : [];
        setObsScenes(scenes);
      } else {
        setObsNote(res?.error ?? 'could not connect');
        setObsScenes([]);
      }
    } catch {
      setObsNote('could not connect');
      setObsScenes([]);
    }
  };

  const setObsScene = async (scene: string) => {
    try {
      const res = await window.api?.obsSetScene(scene);
      setObsNote(res?.success ? `switched to “${scene}”` : res?.error ?? 'could not switch scene');
    } catch {
      setObsNote('could not switch scene');
    }
  };

  const checkVmix = async () => {
    setVmixNote('checking…');
    try {
      const status = await window.api?.vmixStatus();
      if (!status) setVmixNote('no status');
      else if (!status.enabled) setVmixNote('disabled — turn it on and apply');
      else if (status.reachable === false) setVmixNote(status.error ?? 'not reachable');
      else setVmixNote('reachable');
    } catch {
      setVmixNote('not reachable');
    }
  };

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
        {settings?.asrProvider === 'deepgram' && (
          <TextSetting label="deepgram key" settingKey="deepgramApiKey" masked wide />
        )}
      </Section>

      <Section title="audio input">
        <MicDevicePicker />
      </Section>

      <Section title="intelligence">
        <TextSetting label="hugging face token" settingKey="hfToken" masked wide />
        <p className="pl-50 text-xs leading-relaxed text-neutral-400">
          powers the ai reasoning extras (smart disambiguation, notes) — usually pre-configured;
          transcription and verse detection work without it
        </p>
        <SelectSetting label="notes provider" settingKey="notesProvider" options={['cloud', 'local']} fallback="cloud" />
        <ToggleSetting label="agent enabled" settingKey="agentEnabled" />
        <ToggleSetting label="slow path" settingKey="slowPathEnabled" />
        <NumberSetting label="batch interval" settingKey="batchIntervalMs" suffix="ms" />
        <ToggleSetting label="false-positive filter" settingKey="falsePositiveFilterEnabled" />
      </Section>

      <Section title="language">
        <LanguageSettings />
      </Section>

      <Section title="display">
        <SelectSetting
          label="display version"
          settingKey="displayVersion"
          options={versions.length > 0 ? versions : ['KJV']}
          fallback="KJV"
        />
        <NumberSetting label="auto display timeout" settingKey="autoDisplayTimeout" suffix="seconds" />
        <ToggleSetting label="seasonal theming" settingKey="seasonalEnabled" />
        <ToggleSetting label="grace window" settingKey="graceWindowEnabled" />
      </Section>

      <Section title="outputs & alerts">
        <SelectSetting
          label="stream layout"
          settingKey="streamLayout"
          options={['lower-third', 'full']}
          fallback="lower-third"
        />
        <ToggleSetting label="stage clock" settingKey="stageShowClock" />
        <ToggleSetting label="stage up-next" settingKey="stageShowNext" />
        <TextSetting
          label="stage timer"
          settingKey="stageShowTimer"
          placeholder="timer name — shown on the confidence monitor"
          wide
        />
        <NumberSetting label="alert duration" settingKey="alertDefaultSeconds" suffix="seconds" />
        <DisplayAssignmentSection />
        <p className="max-w-xl text-xs leading-relaxed text-neutral-500">
          STREAM is a transparent window for OBS / vMix. STAGE is the confidence monitor for the pulpit.
          TIMER is a dedicated full-screen clock and countdown display for your HDMI stage/wall monitor.
          Outputs can be mapped directly to your connected physical screens above.
        </p>
      </Section>

      <Section title="trust & auto mode">
        <PercentSetting label="auto-mode trust" settingKey="autoModeMinTrust" />
        <NumberSetting label="min detections" settingKey="autoModeMinSamples" suffix="verified verses" />
        <NumberSetting label="min services" settingKey="autoModeMinServices" suffix="services" />
        <NumberSetting label="mature below" settingKey="matureMaxCorrections" suffix="corrections / service" />
        <NumberSetting label="mature streak" settingKey="matureStreak" suffix="quiet services in a row" />
        <NumberSetting label="reopen at" settingKey="reopenCorrections" suffix="corrections in one service" />
        <p className="pl-50 text-xs leading-relaxed text-neutral-400">
          auto mode unlocks when a preacher's verified precision (wilson lower bound)
          clears the trust gate with enough volume — changes apply live
        </p>
      </Section>

      <Section title="voice commands">
        <ToggleSetting label="voice commands" settingKey="voiceCommandsEnabled" />
        <VoiceCommandEditor />
      </Section>

      <Section title="obs studio">
        <ToggleSetting label="obs enabled" settingKey="obsEnabled" />
        <TextSetting label="host" settingKey="obsHost" placeholder="localhost" />
        <NumberSetting label="port" settingKey="obsPort" />
        <TextSetting label="password" settingKey="obsPassword" masked />
        <div className="flex items-baseline gap-x-6 pl-50">
          <TextButton label="CONNECT" primary onClick={() => void connectObs()} />
          {obsNote && <span className="text-sm text-neutral-500">{obsNote}</span>}
        </div>
        {obsScenes.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 pl-50">
            <span className="text-xs uppercase tracking-widest text-neutral-400">scenes</span>
            {obsScenes.map((scene) => (
              <TextButton key={scene} label={scene.toUpperCase()} onClick={() => void setObsScene(scene)} />
            ))}
          </div>
        )}
      </Section>

      <Section title="vmix">
        <ToggleSetting label="vmix enabled" settingKey="vmixEnabled" />
        <TextSetting label="host" settingKey="vmixHost" placeholder="localhost" />
        <NumberSetting label="port" settingKey="vmixPort" />
        <div className="flex items-baseline gap-x-6 pl-50">
          <TextButton label="CHECK STATUS" primary onClick={() => void checkVmix()} />
          {vmixNote && <span className="text-sm text-neutral-500">{vmixNote}</span>}
        </div>
        {/*
          The setup nobody can guess.

          Turning this on only lets the app TALK to vMix — it does not put the
          words into the stream. Those are two jobs, and the second one is
          done in vMix, not here: vMix has to capture the app's STREAM output
          window, which is the transparent one. Without that step an operator
          switches this on, sees "reachable", and still has no lyrics on the
          broadcast, which reads as the feature not working.

          Written out because vMix runs on the same computer here, so both
          things are on one screen and it is genuinely unclear which half is
          which.
        */}
        <div className="max-w-2xl space-y-2 pl-50 text-xs leading-relaxed text-neutral-400">
          <p>
            This switch only lets the app <span className="text-ink">control</span> vMix — cutting inputs and
            driving overlays. It does not put verses into the stream by itself.
          </p>
          <p>
            To get the words on the broadcast, add the app’s <span className="text-ink">STREAM</span> output as a
            vMix input: in vMix press <span className="font-mono text-ink">Add Input → Desktop Capture</span>, pick
            the window called <span className="font-mono text-ink">Livestream Output</span>, and tick{' '}
            <span className="font-mono text-ink">Preserve source alpha</span>. That window is transparent by design,
            so vMix sees only the text and you can lay it straight over the camera.
          </p>
          <p>
            Open the stream window from <span className="text-ink">Live → the projector button</span>, or give it its
            own screen under <span className="text-ink">displays &amp; outputs</span> above. vMix on this same
            computer means host stays <span className="font-mono text-ink">localhost</span> — and in vMix,{' '}
            <span className="font-mono text-ink">Settings → Web Controller</span> must be on, which is what serves
            port <span className="font-mono text-ink">8088</span>.
          </p>
        </div>
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

      <Section title="giving">
        <TextSetting label="zelle" settingKey="givingZelle" />
        <TextSetting label="venmo" settingKey="givingVenmo" />
        <TextSetting label="cash app" settingKey="givingCashApp" />
        <TextSetting label="paypal" settingKey="givingPaypal" />
        <TextSetting label="bank info" settingKey="givingBankInfo" wide />
        <TextSetting label="custom url" settingKey="givingCustomUrl" wide />
        <TextSetting label="note" settingKey="givingNote" wide />
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
