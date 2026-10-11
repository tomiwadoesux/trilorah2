import { useEffect, useState } from 'react';
import { Button } from '../../ui';

/** Uses provider availability, never a retrieved key, to show connection state. */
export function StockCredential({ settingKey }: { settingKey: 'pixabayApiKey' | 'pexelsApiKey' }) {
  const provider = settingKey === 'pixabayApiKey' ? 'pixabay' : 'pexels';
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    window.api?.getStockProviders?.().then(items => { if (alive) setConfigured(items.includes(provider)); }).catch(() => { if (alive) setError('Could not check this key.'); });
    return () => { alive = false; };
  }, [provider]);
  const save = async () => {
    if (!value.trim() || saving || !window.api?.setSetting) return;
    setSaving(true); setError('');
    try {
      const ok = await window.api.setSetting(settingKey, value.trim());
      if (!ok) throw new Error('save failed');
      const providers = await window.api.getStockProviders?.();
      if (!providers?.includes(provider)) throw new Error('unavailable');
      setValue(''); setConfigured(true); setEditing(false);
      window.dispatchEvent(new Event('trilorah-stock-credentials-changed'));
    } catch { setError('Could not save this key. Try again.'); }
    finally { setSaving(false); }
  };
  return <div className="flex w-[280px] flex-col gap-2" data-guide-state={configured ? 'configured' : configured === false ? 'missing' : 'checking'}>
    {editing || configured === false ? <form onSubmit={event => { event.preventDefault(); void save(); }} className="flex gap-2">
      <input type="password" aria-label={`${provider} API key`} autoComplete="off" spellCheck={false} value={value} onChange={event => setValue(event.target.value)} placeholder="paste your key" disabled={saving} className="min-w-0 flex-1 rounded bg-black/20 px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-white/30" />
      <Button type="submit" label={saving ? 'saving…' : 'save'} disabled={!value.trim() || saving || !window.api?.setSetting} />
    </form> : <div className="flex items-center justify-between gap-3"><span className="text-xs text-[var(--tri-ink-muted)]">{configured ? 'key saved on this computer' : 'checking…'}</span><Button label="replace" onClick={() => setEditing(true)} disabled={configured === null} /></div>}
    {configured && <p className="text-[10px] text-[var(--tri-ink-muted)]">Search will check whether the provider accepts it.</p>}
    {error && <p role="alert" className="text-xs">{error}</p>}
  </div>;
}
