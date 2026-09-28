import { useEffect, useRef, useState } from 'react';
import { SOUND_CHECK_PROMPTS, type SoundCheckState } from '../../../../shared/preacherLearning';
import { Button, cx, surface } from '../../../ui';
import { FIELD } from '../settingsRows';
import { refreshPreacher, usePreachers, type Preacher } from './preachers';

const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Could not complete that action. Please retry.';
const reference = (r: VerseRef | null) => r ? `${r.book} ${r.chapter}${r.verse ? `:${r.verse}` : ''}` : 'No reference caught';
const BOX = 'flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4';

function ReviewCard({ item, onResolve }: { item: ReviewItem; onResolve: (item: ReviewItem, answer: ReviewResolution, amended?: VerseRef) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const answer = async (resolution: ReviewResolution) => {
    let amended: VerseRef | undefined;
    if (resolution === 'amended') {
      const m = value.trim().match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
      if (!m) { setError('Use a reference such as 1 John 4:8.'); return; }
      amended = { book: m[1], chapter: Number(m[2]), verse: m[3] ? Number(m[3]) : null };
    }
    setBusy(true); setError('');
    try { await onResolve(item, resolution, amended); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  return <fieldset disabled={busy} className="flex min-w-0 flex-col gap-2 rounded-lg border border-white/10 p-3 disabled:opacity-60">
    <p className="text-xs text-white/55">{new Date(item.ts).toLocaleDateString()} · {item.reason === 'operator-change' ? 'A change needs checking — it may be a new passage' : item.kind === 'miss' ? 'Reported missed reference' : 'Check this detection'}</p>
    <p className="text-sm text-white/85 break-words">“{item.heard || 'Transcript unavailable'}”</p>
    <p className="text-sm">Suggested: <strong>{reference(item.proposed)}</strong></p>
    <div className="flex flex-wrap gap-2">
      {item.proposed && <Button label="Correct" onClick={() => void answer('confirmed')} />}
      <Button label={item.kind === 'miss' ? 'Add the reference' : 'Wrong reference'} onClick={() => setEditing(!editing)} />
      {item.proposed && <Button label="Not a reference" onClick={() => void answer('rejected')} />}
      <Button label="Can’t tell / new passage" onClick={() => void answer('skipped')} />
    </div>
    {editing && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void answer('amended'); }}>
      <input aria-label="Correct Bible reference" className={cx(FIELD, 'min-w-0 flex-1 text-sm')} placeholder="1 John 4:8" value={value} onChange={(e) => setValue(e.target.value)} />
      <Button label="Save correction" onClick={() => void answer('amended')} disabled={!value.trim()} />
    </form>}
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
  </fieldset>;
}

export function LearningActions({ p }: { p: Preacher }) {
  const { activeId } = usePreachers();
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<string>('');
  const [check, setCheck] = useState<SoundCheckState | null>(null);
  const [prompt, setPrompt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState('');
  const [expanded, setExpanded] = useState(false);
  const ownedCheck = useRef<string | null>(null);
  const mounted = useRef(true);
  const available = !!window.api?.getPreacherLearning;
  const running = check?.status === 'starting' || check?.status === 'listening';

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    const reload = () => void refreshPreacher(p.id).catch((e) => { if (!disposed) setError(errorText(e)); });
    reload();
    void window.api?.getSettings().then((s) => { if (!disposed) setProvider(String(s.asrProvider ?? 'whisper-local')); });
    const timer = window.setInterval(reload, 8000);
    return () => {
      disposed = true; mounted.current = false; window.clearInterval(timer);
      if (ownedCheck.current) void window.api?.stopPreacherSoundCheck?.(ownedCheck.current).catch(() => undefined);
      ownedCheck.current = null;
    };
  }, [p.id]);

  useEffect(() => {
    if (!running) return;
    let disposed = false;
    const timer = window.setInterval(() => {
      void window.api?.getPreacherSoundCheck?.().then((s) => { if (!disposed) setCheck(s); }).catch((e) => { if (!disposed) setError(errorText(e)); });
    }, 700);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [running]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const reviews = [...(p.learning?.reviews ?? [])].sort((a, b) => Number(b.reason !== 'detected') - Number(a.reason !== 'detected') || b.ts - a.ts);
  const visible = expanded ? reviews : reviews.slice(0, 5);

  return <div className="flex flex-col gap-3">
    <section className={cx(surface({ tone: 'default', shape: 'panel', wide: true }), BOX)} aria-label="Local preacher learning">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-semibold text-base">Try a few references</h3>
          <p className="mt-1 text-sm text-white/65">Optional · runs on this computer · no AI API charges · no audio recordings saved</p></div>
        <span className="text-xs text-white/70">Service speech: {provider === 'whisper-local' ? 'offline' : provider === 'deepgram' ? 'cloud (usage charges may apply)' : 'checking…'}</span>
      </div>
      {provider && provider !== 'whisper-local' && <Button label="Use free offline speech for services" disabled={busy || !available || running} onClick={() => void act(async () => {
        await window.api!.useOfflineSpeech!(); setProvider('whisper-local');
      })} />}
      <p className="text-sm text-white/65">Use the service microphone. The first check downloads the free speech engine and model if needed. Results arrive in roughly five-second chunks plus processing time.</p>
      <div className="flex flex-wrap gap-2">
        {SOUND_CHECK_PROMPTS.map((r, i) => <Button key={r.say} label={`${i + 1}. ${r.book}`} disabled={running || busy} onClick={() => { setPrompt(i); setCheck(null); }} />)}
      </div>
      <p className="text-lg font-semibold">Say: “{SOUND_CHECK_PROMPTS[prompt].say}.”</p>
      <div className="flex gap-2">
        <Button label={running ? 'Stop sound check' : 'Start sound check'} disabled={busy || !available} onClick={() => void act(async () => {
          if (running && check) { setCheck(await window.api!.stopPreacherSoundCheck!(check.sessionId)); ownedCheck.current = null; return; }
          const device = await window.api!.getSetting?.('micDeviceLabel');
          const next = await window.api!.startPreacherSoundCheck!(p.id, prompt, typeof device === 'string' ? device : undefined);
          if (!mounted.current) { await window.api!.stopPreacherSoundCheck!(next.sessionId); return; }
          ownedCheck.current = next.sessionId;
          setCheck(next);
        })} />
      </div>
      {check && <div aria-live="polite" className="flex flex-col gap-1 text-sm">
        <p className={check.status === 'error' ? 'text-rose-200' : 'text-white/70'}>{check.message}</p>
        {check.heard && <p>Heard: “{check.heard}”</p>}
        {check.detected && <p className={check.matches ? 'text-emerald-200' : 'text-amber-200'}>Detected: {check.detected} · {check.matches ? 'matched' : 'does not match the exercise'}</p>}
        {check.status === 'finished' && !check.matches && check.heard && <p className="text-white/65">For a misheard book name, add the heard word and correct book under Advanced teaching below, then retry.</p>}
      </div>}
    </section>

    <section className={BOX} aria-label="Recognition review">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-base">Review recognition</h3><span className="text-sm text-white/65">{reviews.length} waiting</span></div>
      <p className="text-sm text-white/65">Check up to five examples at a time. Only your verified answers affect readiness. Unreviewed examples stay unverified; “Can’t tell” adds no score. Transcript examples only, with the latest 200 kept per preacher.</p>
      <p className="text-sm text-white/65">Saved corrections help when the same words are heard again. Missed references are kept separately from detected-verse precision.</p>
      {p.id === activeId && p.learning?.serviceOpen && <Button label="Finish service & review" disabled={busy || running} onClick={() => void act(async () => {
        const result = await window.api!.endService({ preacherId: p.id, preacherName: p.name });
        if (!result.success) throw new Error(result.error ?? 'Could not finish the service.');
        await refreshPreacher(p.id);
      })} />}
      {!!p.learning?.legacySamples && <p className="text-sm text-amber-200">Older totals included unreviewed results. They are preserved in history but excluded from verified readiness.</p>}
      {visible.map((item) => <ReviewCard key={item.id} item={item} onResolve={async (r, answer, amended) => {
        await window.api!.resolveReviewItem!(r.id, answer, amended); await refreshPreacher(p.id);
      }} />)}
      {!reviews.length && <p className="text-sm text-white/65">{p.learning ? 'No examples waiting. This does not mean every reference was caught.' : 'Review data has not loaded.'}</p>}
      {reviews.length > 5 && <Button label={expanded ? 'Show five' : `Show all ${reviews.length}`} onClick={() => setExpanded(!expanded)} />}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (miss.trim()) void act(async () => {
        await window.api!.addMissedReference!(p.id, miss); setMiss(''); await refreshPreacher(p.id);
      }); }}>
        <input aria-label="Words in a missed reference" className={cx(FIELD, 'min-w-[200px] flex-1 text-sm')} value={miss} onChange={(e) => setMiss(e.target.value)} maxLength={1200} placeholder="Missed a reference? Enter what the preacher said." />
        <button type="submit" disabled={busy || !available || !miss.trim()} className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40">Add missed example</button>
      </form>
    </section>
    {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
  </div>;
}
