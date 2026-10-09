import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, CloseIcon } from '../ui';
import { PhoneConnectionArt } from './PhoneConnectionArt';
import './mobileRemotePanel.css';

export interface MobileRemoteIntroProps {
  onEnable: () => void;
  disabled?: boolean;
  busy?: boolean;
}

/** The initial view is also used by the gallery; it never contacts the backend. */
export function MobileRemoteIntro({ onEnable, disabled = false, busy = false }: MobileRemoteIntroProps) {
  return (
    <div className="mobile-remote-intro" aria-busy={busy || undefined}>
      <p className="mobile-remote-intro__line">Control the service from your phone.</p>
      <PhoneConnectionArt variant="remote" />
      <div className="mobile-remote-intro__action">
        <Button label={busy ? 'Enabling…' : 'Enable mobile access'} tone="go" disabled={disabled || busy} onClick={onEnable} />
        <p className="mobile-remote-hint">Keep your phone and this computer on the same Wi-Fi.</p>
      </div>
    </div>
  );
}

type RemoteAction = 'enable' | 'disable' | 'code' | 'approve' | 'revoke';

export function MobileRemotePanel({ open, onClose, preview = false }: { open: boolean; onClose: () => void; preview?: boolean }) {
  const [status, setStatus] = useState<Awaited<ReturnType<WindowApi['mobileStatus']>> | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [needsRestart, setNeedsRestart] = useState(false);
  const [pending, setPending] = useState<RemoteAction | null>(null);
  const actionPending = useRef(false);
  const api = preview ? undefined : window.api;
  const busy = pending !== null;

  const refresh = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (!api) return;
    const nextStatus = await api.mobileStatus();
    if (isCurrent()) setStatus(nextStatus);
    const nextCode = await api.mobileCode();
    if (isCurrent()) setCode(nextCode);
  }, [api]);

  const reportError = useCallback((e: unknown) => {
    const message = String(e);
    if (/No handler registered for ['"]mobile-|mobile\w+ is not a function/.test(message)) {
      setNeedsRestart(true);
      setStatus(null);
      setError('Trilorah needs a full restart to load the mobile backend. Close all Trilorah windows and reopen the app, then enable mobile access. Refreshing this window is not enough.');
    } else setError(message);
  }, []);

  useEffect(() => {
    if (!open || needsRestart) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await refresh(() => !disposed);
        if (!disposed) timer = setTimeout(() => void poll(), 1000);
      } catch (e) { if (!disposed) reportError(e); }
    };
    void poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [open, needsRestart, refresh, reportError]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const next = status?.urls.includes(url) ? url : status?.urls[0] || '';
    if (next !== url) setUrl(next);
  }, [status, url]);

  useEffect(() => {
    let disposed = false;
    setQr('');
    if (url) void api?.mobileQr(url).then(value => {
      if (!disposed) setQr(value);
    }).catch(e => { if (!disposed) setError(String(e)); });
    return () => { disposed = true; };
  }, [api, url]);

  async function act(action: RemoteAction, fn: () => Promise<unknown>) {
    if (actionPending.current) return;
    actionPending.current = true;
    setPending(action);
    try { setError(''); await fn(); await refresh(); }
    catch (e) { reportError(e); }
    finally { actionPending.current = false; setPending(null); }
  }

  const unavailable = needsRestart || !api || !status;
  const showDevices = !!status?.running || !!status?.devices.length;

  if (!open) return null;
  return <div className="mobile-remote-scrim" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Mobile remote" className="mobile-remote-panel tri-rounded-surface" onClick={event => event.stopPropagation()}>
        <header className="mobile-remote-heading">
          <h2>Mobile remote</h2>
          <button type="button" className="mobile-remote-close" onClick={onClose} aria-label="Close mobile remote"><CloseIcon size={14} /></button>
        </header>

        {!status?.running ? (
          <MobileRemoteIntro onEnable={() => void act('enable', () => api!.mobileEnable(true))} disabled={unavailable || busy} busy={pending === 'enable'} />
        ) : (
          <div className="mobile-remote-active">
            <p className="mobile-remote-hint">Scan with your phone on the same Wi-Fi, enter the code, then approve it here.</p>
            {status.urls.length > 0 ? <>
              <label className="mobile-remote-address">Connection address
                <select value={url} onChange={event => setUrl(event.target.value)}>{status.urls.map(address => <option key={address}>{address}</option>)}</select>
              </label>
              {qr && <img className="mobile-remote-qr tri-rounded-control" width="200" height="200" alt="Scan to open private mobile controls" src={qr} />}
            </> : <p className="mobile-remote-hint">No Wi-Fi or Ethernet address found. Connect this computer to the church network.</p>}
            <div className="mobile-remote-code">
              <Button label="Generate pairing code" tone="ash" disabled={unavailable || busy} onClick={() => void act('code', () => api!.mobileCode(true))} />
              <strong>{code?.code || '———'}</strong>
            </div>
            <p className="mobile-remote-hint">Codes expire after two minutes. If the page cannot open, allow Trilorah through Windows Firewall on Private networks and check that guest Wi-Fi does not isolate devices.</p>
            <p className="mobile-remote-hint">This QR opens private controls. Use Online on the remote for the congregation’s QR.</p>
            {status.pending.map(phone => <div className="mobile-remote-request" key={phone.id}>
              <p>{phone.name} requests control</p>
              <div className="mobile-remote-actions">
                <Button label="Approve" tone="go" disabled={unavailable || busy} onClick={() => void act('approve', () => api!.mobileApprove(phone.id, true))} />
                <Button label="Decline" tone="ash" disabled={unavailable || busy} onClick={() => void act('approve', () => api!.mobileApprove(phone.id, false))} />
              </div>
            </div>)}
            <div className="mobile-remote-actions mobile-remote-actions--end">
              <Button label={pending === 'disable' ? 'Turning off…' : 'Turn off mobile access'} tone="ash" disabled={unavailable || busy} onClick={() => void act('disable', () => api!.mobileEnable(false))} />
            </div>
          </div>
        )}

        {showDevices && <section className="mobile-remote-devices" aria-label="Paired devices">
          <h3>Paired devices</h3>
          {status?.devices.length === 0 && <p className="mobile-remote-hint">No phones paired yet.</p>}
          {status?.devices.map(device => <div key={device.deviceId} className="mobile-remote-device">
            <span>{device.deviceName}</span>
            <Button label="Revoke" tone="danger" disabled={unavailable || busy} onClick={() => void act('revoke', () => api!.mobileRevoke(device.deviceId))} />
          </div>)}
        </section>}
        {(error || status?.error) && <p role="alert" className="mobile-remote-error">{error || status?.error}</p>}
      </section>
    </div>;
}
