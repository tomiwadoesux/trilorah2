import { useEffect, useRef, useState } from 'react';
import { seedValues, type Row } from '../settingsRows';

/** Shared by the card face and expanded settings, so saved values stay visible. */
export function useCompanionSettings(rows: Row[]) {
  const [values, setValues] = useState<Record<string, unknown>>(() => seedValues(rows));
  const [saved, setSaved] = useState<Record<string, boolean | undefined>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    const api = window.api;
    if (!api?.getSettings) { setError('Open the desktop app to change these settings.'); return; }
    void api.getSettings().then(settings => {
      if (!alive) return;
      setValues(previous => Object.fromEntries(Object.entries(previous).map(([key, fallback]) => [key, (settings as Record<string, unknown>)[key] ?? fallback])));
      setReady(true);
    }).catch(() => { if (alive) setError('Settings couldn’t be loaded. Reopen this page to try again.'); });
    return () => { alive = false; };
  }, []);
  const change = async (key: string, value: unknown) => {
    if (!ready) return;
    const stamp = (revision.current[key] ?? 0) + 1;
    revision.current[key] = stamp;
    setValues(previous => ({ ...previous, [key]: value }));
    setSaved(previous => ({ ...previous, [key]: undefined }));
    try {
      const ok = (await window.api?.setSetting(key, value)) === true;
      if (revision.current[key] !== stamp) return;
      setSaved(previous => ({ ...previous, [key]: ok }));
      setError(ok ? '' : 'This change wasn’t saved. Try changing the field again.');
    } catch { if (revision.current[key] === stamp) { setSaved(previous => ({ ...previous, [key]: false })); setError('This change wasn’t saved. Try changing the field again.'); } }
  };
  return { values, saved, ready, error, change };
}
