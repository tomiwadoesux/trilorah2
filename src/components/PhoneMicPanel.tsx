import { useEffect, useRef, useState } from 'react';
import { Button, CloseIcon } from '../ui';
import { usePhoneMicStore } from '../lib/phoneMic';
import { useAppStore } from '../stores/appStore';
import { PHONE_MIC_LABEL } from '../../shared/audioInput';
import { PhoneConnectionArt } from './PhoneConnectionArt';
import './phoneMicPanel.css';

/** The same first-use view is shown in the app and the design preview. */
export function PhoneMicIntro({ onConnect, disabled = false, busy = false, message, error = false, retry = false }: {
  onConnect: () => void; disabled?: boolean; busy?: boolean; message?: string; error?: boolean; retry?: boolean;
}) {
  return <div className="tri-phone-mic-intro" aria-busy={busy}>
    <p className="tri-phone-mic-purpose">Use your phone as the room’s microphone.</p>
    <PhoneConnectionArt variant="microphone" />
    {message && <p className="tri-phone-mic-message" data-error={error} role={error ? 'alert' : 'status'}>{message}</p>}
    <Button label={busy ? 'creating code…' : retry ? 'new code' : 'connect phone'} tone="go" disabled={disabled || busy} onClick={onConnect} />
    <p className="tri-phone-mic-hint">Same Wi-Fi. Internet is only needed to connect.</p>
  </div>;
}

/*
 * The phone as the microphone — the box behind the audio picker's "phone".
 *
 * Start with the phone illustration; create a code only on an explicit press.
 * Then: the code to scan, the phone asking to be let in,
 * the phone in and heard, and whatever went wrong. The code is drawn by the
 * laptop (main) so this never encodes anything itself.
 */
export function PhoneMicPanel({ open, onClose, preview = false }: { open: boolean; onClose: () => void; preview?: boolean }) {
  const status = usePhoneMicStore((s) => s.status);
  const level = usePhoneMicStore((s) => s.level);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState('');
  const starting = useRef(false);
  const api = preview ? undefined : window.api;

  async function connect() {
    if (!api?.phoneMicStart || starting.current) return;
    starting.current = true;
    setBusy(true);
    setStartError('');
    const before = usePhoneMicStore.getState().status;
    try {
      const next = await api.phoneMicStart();
      // The status event normally arrives first. Never overwrite a newer
      // approval/connection with the older response from creating the code.
      if (usePhoneMicStore.getState().status === before) usePhoneMicStore.setState({ status: next });
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Could not create a code. Try again.');
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const state = preview ? 'idle' : status.state;
  const showIntro = state === 'idle' || state === 'expired' || state === 'ended' || state === 'declined' || state === 'error';
  const line =
    state === 'waiting' ? 'scan this with the phone, on the church Wi-Fi'
    : state === 'pending' ? `${status.phoneName} wants to be the microphone`
    : state === 'connecting' ? `connecting to ${status.phoneName}…`
    : state === 'connected' ? `${status.phoneName} is connected and ready`
    : state === 'expired' ? 'that code has expired'
    : state === 'declined' ? 'the phone was turned away'
    : state === 'ended' ? 'the phone left'
    : state === 'error' ? status.error ?? 'something went wrong'
    : '';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--tri-pop-scrim)] p-5" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Phone microphone"
        className="tri-phone-mic-panel tri-rounded-surface w-full max-w-[390px] bg-[var(--tri-pop)] p-6 text-[var(--tri-ink)]"
        style={{ boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.1), 0 24px 60px rgb(0 0 0 / 0.55)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tri-phone-mic-heading" data-empty={showIntro}>
          <h2>Phone microphone</h2>
          <button type="button" aria-label="Close phone microphone" onClick={onClose}><CloseIcon size={14} /></button>
        </div>
        {showIntro ? <PhoneMicIntro onConnect={() => void connect()} disabled={!api?.phoneMicStart} busy={busy}
          message={startError || (busy ? undefined : line)} error={!!startError || state === 'error' || state === 'declined'} retry={state !== 'idle'} /> : <>
          <p className="mt-1 text-[length:var(--tri-size-sm)] leading-relaxed text-[var(--tri-ink-muted)]">Your phone sends audio straight to this computer over Wi-Fi.</p>

        <div className="mt-5 flex flex-col items-center gap-3">
          {state === 'waiting' && status.qr && (
            <img src={status.qr} width={208} height={208} alt="Scan to make this phone the microphone" className="tri-rounded-control" />
          )}
          {state === 'waiting' && status.code && (
            <p className="font-mono text-[length:var(--tri-size)] tracking-[0.3em] text-[var(--tri-ink-muted)]">{status.code}</p>
          )}
          {(state === 'connected' || state === 'connecting') && (
            <div className="flex h-10 items-end gap-[3px]" aria-hidden="true">
              {Array.from({ length: 12 }, (_, n) => (
                <span
                  key={n}
                  className="w-[5px] rounded-full transition-[height,opacity] duration-100"
                  style={{ height: 6 + n * 3, background: 'rgb(var(--tri-go-2))', opacity: level > (n + 1) * 8 ? 0.95 : 0.16 }}
                />
              ))}
            </div>
          )}
          <p
            role="status"
            className="text-center text-[length:var(--tri-size)] font-medium"
            style={{ color: state === 'connected' ? 'rgb(var(--tri-go-2))' : 'var(--tri-ink)' }}
          >
            {line}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {state === 'connected' && <Button label="use phone audio" tone="go" onClick={() => {
            if (!api) return;
            void api.setSetting('micDeviceLabel', PHONE_MIC_LABEL).then(() => {
              const app = useAppStore.getState();
              app.patchSetting('micDeviceLabel', PHONE_MIC_LABEL);
              api.stopListening();
              api.startListening(PHONE_MIC_LABEL);
              onClose();
            }).catch(() => undefined);
          }} />}
          {state === 'pending' && (
            <>
              <Button label="not this one" tone="ash" onClick={() => void api?.phoneMicApprove(false)} />
              <Button label="let it in" tone="go" onClick={() => void api?.phoneMicApprove(true)} />
            </>
          )}
          {(state === 'connected' || state === 'connecting') && (
            <Button label="disconnect" tone="danger" onClick={() => void api?.phoneMicStop()} />
          )}
          {state === 'waiting' && <Button label="cancel" tone="ash" onClick={() => { void api?.phoneMicStop(); onClose(); }} />}
        </div>
        </>}
      </section>
    </div>
  );
}
