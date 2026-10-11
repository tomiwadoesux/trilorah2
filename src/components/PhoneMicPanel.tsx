import { useEffect, useRef, useState } from 'react';
import { Button, CloseIcon, PhoneIcon, CheckIcon } from '../ui';
import { MobileConnectionLink, MobilePairingSteps } from './MobileConnectionLink';
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
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const acting = useRef(false);
  async function act(work: () => Promise<unknown>) {
    if (acting.current) return;
    acting.current = true; setActionBusy(true); setActionError('');
    try { await work(); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Could not finish. Please try again.'); }
    finally { acting.current = false; setActionBusy(false); }
  }
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
        className="tri-phone-mic-panel tri-rounded-surface w-full max-w-[460px] bg-[var(--tri-pop)] p-6 text-[var(--tri-ink)]"
        style={{ boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.1), 0 24px 60px rgb(0 0 0 / 0.55)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tri-phone-mic-heading" data-empty={showIntro}>
          <h2>Phone microphone</h2>
          <button type="button" aria-label="Close phone microphone" onClick={onClose}><CloseIcon size={14} /></button>
        </div>
        {showIntro ? <PhoneMicIntro onConnect={() => void connect()} disabled={!api?.phoneMicStart} busy={busy}
          message={startError || (busy ? undefined : line)} error={!!startError || state === 'error' || state === 'declined'} retry={state !== 'idle'} /> : <>
          <p className="tri-phone-mic-subtitle">Your phone’s microphone, connected to this computer.</p>
          <MobilePairingSteps step={state === 'waiting' ? 0 : state === 'connected' ? 2 : 1} />
          {state === 'waiting' ? <div className="tri-phone-mic-pairing">
            <div className="mobile-connection-qr">
              {status.qr && <img src={status.qr} width={196} height={196} alt="Scan to connect your phone microphone" />}
              {status.code && <strong>{status.code}</strong>}
              <p>Scan with your phone’s camera.<br />Keep both devices on the same Wi-Fi.</p>
            </div>
            {status.url && <MobileConnectionLink url={status.url} />}
          </div> : <div className="mobile-connection-state" data-state={state}>
            <div className="mobile-connection-device-icon">{state === 'connected' ? <CheckIcon size={26} /> : <PhoneIcon size={28} />}</div>
            <h3>{state === 'pending' ? 'Let this phone connect?' : state === 'connecting' ? 'Making the connection' : 'Your phone is ready'}</h3>
            <p className="mobile-connection-name">{status.phoneName || 'Your phone'}</p>
            {state === 'pending' && <p>Allow this phone to send microphone audio to your service.</p>}
            {state === 'connecting' && <><PhoneConnectionArt variant="microphone" /><p role="status">Keep the phone’s microphone page open while the connection finishes.</p></>}
            {state === 'connected' && <>
              <div className="mobile-connection-meter" aria-label={`Audio input level ${Math.round(level)} percent`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level)}>
                {Array.from({ length: 16 }, (_, n) => <span key={n} style={{ height: 8 + n * 2, opacity: level > (n + 1) * 6 ? .95 : .14 }} />)}
              </div>
              <p role="status">Connected. Select Use phone audio to start listening.</p>
            </>}
          </div>}
          {actionError && <p className="mobile-connection-error" role="alert">{actionError}</p>}
          <div className="mobile-connection-footer" aria-busy={actionBusy}>
            {state === 'waiting' && <Button label="Cancel pairing" tone="ash" disabled={actionBusy} onClick={() => {
              if (!api) { onClose(); return; }
              void act(async () => { await api.phoneMicStop(); onClose(); });
            }} />}
            {state === 'pending' && <>
              <Button label="Decline" tone="ash" disabled={!api || actionBusy} onClick={() => void act(() => api!.phoneMicApprove(false))} />
              <Button label={actionBusy ? 'Please wait…' : 'Allow microphone'} tone="go" disabled={!api || actionBusy} onClick={() => void act(() => api!.phoneMicApprove(true))} />
            </>}
            {(state === 'connected' || state === 'connecting') && <Button label="Disconnect" tone="ash" disabled={!api || actionBusy} onClick={() => void act(() => api!.phoneMicStop())} />}
            {state === 'connected' && <Button label={actionBusy ? 'Starting…' : 'Use phone audio'} tone="go" disabled={!api || actionBusy} onClick={() => void act(async () => {
              await api!.setSetting('micDeviceLabel', PHONE_MIC_LABEL);
              useAppStore.getState().patchSetting('micDeviceLabel', PHONE_MIC_LABEL);
              api!.stopListening(); api!.startListening(PHONE_MIC_LABEL); onClose();
            })} />}
          </div>
        </>}
      </section>
    </div>
  );
}
