import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppStore } from '../stores/appStore';
import { TextButton, SectionLabel, EngineNote, hasEngine } from '../components/ui';

/** Persist one key, mirroring it into the renderer's settings cache. */
function save(key: string, value: unknown) {
  void window.api?.setSetting(key, value).catch(() => undefined);
  useAppStore.getState().patchSetting(key, value);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
      <span className="w-44 shrink-0 text-xs uppercase tracking-widest text-neutral-400">{label}</span>
      {children}
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
  const initial = settings?.[settingKey];
  return (
    <Row label={label}>
      <input
        type={masked ? 'password' : 'text'}
        defaultValue={typeof initial === 'string' || typeof initial === 'number' ? String(initial) : ''}
        placeholder={placeholder}
        onBlur={(e) => save(settingKey, e.target.value)}
        className={`text-sm ${wide ? 'w-full max-w-md' : 'w-64'}`}
        autoComplete="off"
      />
    </Row>
  );
}

function NumberSetting({ label, settingKey, suffix }: { label: string; settingKey: string; suffix?: string }) {
  const settings = useAppStore((s) => s.settings);
  const initial = settings?.[settingKey];
  return (
    <Row label={label}>
      <input
        defaultValue={typeof initial === 'number' ? String(initial) : ''}
        inputMode="numeric"
        onBlur={(e) => {
          const n = Number.parseFloat(e.target.value);
          if (!Number.isNaN(n)) save(settingKey, n);
        }}
        className="w-24 text-sm"
      />
      {suffix && <span className="text-xs text-neutral-400">{suffix}</span>}
    </Row>
  );
}

function ToggleSetting({ label, settingKey }: { label: string; settingKey: string }) {
  const settings = useAppStore((s) => s.settings);
  const on = settings?.[settingKey] === true;
  return (
    <Row label={label}>
      <button
        type="button"
        onClick={() => save(settingKey, !on)}
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
  const raw = settings?.[settingKey];
  const value = typeof raw === 'string' && raw ? raw : fallback;
  return (
    <Row label={label}>
      <select value={value} onChange={(e) => save(settingKey, e.target.value)} className="text-sm">
        {(options.includes(value) ? options : [value, ...options]).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Row>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-hairline pt-8 first:border-t-0 first:pt-0">
      <SectionLabel>{title}</SectionLabel>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Settings() {
  const settings = useAppStore((s) => s.settings);
  const loaded = settings != null;
  const [versions, setVersions] = useState<string[]>([]);
  const [obsNote, setObsNote] = useState<string | null>(null);
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
      } else {
        setObsNote(res?.error ?? 'could not connect');
      }
    } catch {
      setObsNote('could not connect');
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

      <Section title="transcription">
        <TextSetting label="deepgram key" settingKey="deepgramApiKey" masked wide />
        <TextSetting label="hugging face token" settingKey="hfToken" masked wide />
        <SelectSetting label="asr provider" settingKey="asrProvider" options={['deepgram', 'whisper-local']} fallback="deepgram" />
      </Section>

      <Section title="intelligence">
        <SelectSetting label="notes provider" settingKey="notesProvider" options={['cloud', 'local']} fallback="cloud" />
        <ToggleSetting label="agent enabled" settingKey="agentEnabled" />
        <ToggleSetting label="slow path" settingKey="slowPathEnabled" />
        <NumberSetting label="batch interval" settingKey="batchIntervalMs" suffix="ms" />
        <ToggleSetting label="false-positive filter" settingKey="falsePositiveFilterEnabled" />
      </Section>

      <Section title="display">
        <SelectSetting
          label="default version"
          settingKey="defaultVersion"
          options={versions.length > 0 ? versions : ['KJV']}
          fallback="KJV"
        />
        <NumberSetting label="auto display timeout" settingKey="autoDisplayTimeout" suffix="seconds" />
        <ToggleSetting label="seasonal theming" settingKey="seasonalThemingEnabled" />
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
      </Section>

      <Section title="vmix">
        <ToggleSetting label="vmix enabled" settingKey="vmixEnabled" />
        <TextSetting label="host" settingKey="vmixHost" placeholder="localhost" />
        <NumberSetting label="port" settingKey="vmixPort" />
        <div className="flex items-baseline gap-x-6 pl-50">
          <TextButton label="CHECK STATUS" primary onClick={() => void checkVmix()} />
          {vmixNote && <span className="text-sm text-neutral-500">{vmixNote}</span>}
        </div>
      </Section>

      <Section title="church & web">
        <TextSetting label="church name" settingKey="churchName" wide />
        <TextSetting label="public web url" settingKey="publicWebUrl" wide />
        <TextSetting label="account slug" settingKey="accountSlug" />
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

      <p className="text-xs text-neutral-400">every field saves when you leave it</p>
    </div>
  );
}
