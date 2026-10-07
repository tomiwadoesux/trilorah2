import { useEffect } from 'react';
import { Button, PhoneIcon, CloseIcon } from '../ui';
import { usePhoneMicStore } from '../lib/phoneMic';

/*
 * The phone as the microphone — the box behind the audio picker's "phone".
 *
 * One screen, four moments: the code to scan, the phone asking to be let in,
 * the phone in and heard, and whatever went wrong. The code is drawn by the
 * laptop (main) so this never encodes anything itself.
 */
export function PhoneMicPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = usePhoneMicStore((s) => s.status);
  const level = usePhoneMicStore((s) => s.level);
  const api = window.api;

  /* Opening the box IS asking for a code, unless a phone is already in. */
  useEffect(() => {
    if (!open || !api?.phoneMicStart) return;
    const s = usePhoneMicStore.getState().status.state;
    if (s === 'idle' || s === 'expired' || s === 'ended' || s === 'declined' || s === 'error') void api.phoneMicStart();
  }, [open, api]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const { state } = status;
  const line =
    state === 'waiting' ? 'scan this with the phone, on the church Wi-Fi'
    : state === 'pending' ? `${status.phoneName} wants to be the microphone`
    : state === 'connecting' ? `connecting to ${status.phoneName}…`
    : state === 'connected' ? `${status.phoneName} is the microphone`
    : state === 'expired' ? 'that code has expired'
    : state === 'declined' ? 'the phone was turned away'
    : state === 'ended' ? 'the phone left'
    : state === 'error' ? status.error ?? 'something went wrong'
    : 'making a code…';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--tri-pop-scrim)] p-5" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Phone microphone"
        className="tri-rounded-surface w-full max-w-[380px] bg-[var(--tri-pop)] p-6 text-[var(--tri-ink)]"
        style={{ boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.1), 0 24px 60px rgb(0 0 0 / 0.55)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <PhoneIcon size={14} />
            <h2 className="text-[length:var(--tri-size)] font-semibold lowercase">phone microphone</h2>
          </div>
          <Button label="" tone="ash" icon={<CloseIcon size={12} />} title="close" onClick={onClose} />
        </div>
        <p className="mt-1 text-[length:var(--tri-size-sm)] leading-relaxed text-[var(--tri-ink-muted)]">
          The phone's sound comes straight to this laptop over the Wi‑Fi. Internet is only needed to connect.
        </p>

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
            style={{ color: state === 'connected' ? 'rgb(var(--tri-go-2))' : state === 'error' || state === 'declined' ? 'var(--tri-ink-danger)' : 'var(--tri-ink)' }}
          >
            {line}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {state === 'pending' && (
            <>
              <Button label="not this one" tone="ash" onClick={() => void api?.phoneMicApprove(false)} />
              <Button label="let it in" tone="go" onClick={() => void api?.phoneMicApprove(true)} />
            </>
          )}
          {(state === 'connected' || state === 'connecting') && (
            <Button label="disconnect" tone="danger" onClick={() => void api?.phoneMicStop()} />
          )}
          {(state === 'expired' || state === 'ended' || state === 'declined' || state === 'error') && (
            <Button label="new code" tone="go" onClick={() => void api?.phoneMicStart()} />
          )}
          {state === 'waiting' && <Button label="cancel" tone="ash" onClick={() => { void api?.phoneMicStop(); onClose(); }} />}
        </div>
      </section>
    </div>
  );
}
