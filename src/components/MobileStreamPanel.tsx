import { useEffect, useRef, useState } from 'react';
import { Button, CloseIcon } from '../ui';
import { PhoneConnectionArt } from './PhoneConnectionArt';
import { MobileConnectionLink } from './MobileConnectionLink';
import { openNoticeTarget } from '../lib/notificationNavigation';
import './mobileRemotePanel.css';
import './mobileStreamPanel.css';

/** Stream is the congregation's QR access, using the same code as Companion. */
export function MobileStreamPanel({ onClose, preview = false }: { onClose: () => void; preview?: boolean }) {
  const [code, setCode] = useState<{ url: string; svg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(true);
  const api = preview ? undefined : window.api;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function showCode() {
    if (!api?.getQrSvg || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api.getQrSvg(320);
      if (!mounted.current) return;
      if (!result.success) throw new Error(result.error || 'Could not load the access code. Try again.');
      if (result.url && result.svg) setCode({ url: result.url, svg: result.svg });
      else setMissing(true);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not load the access code. Try again.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <div className="mobile-remote-scrim" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Stream" className="mobile-remote-panel mobile-stream-panel tri-rounded-surface" onClick={event => event.stopPropagation()}>
      <header className="mobile-remote-heading">
        <h2>Stream</h2>
        <button type="button" className="mobile-remote-close" onClick={onClose} aria-label="Close stream"><CloseIcon size={14} /></button>
      </header>
      <div className="mobile-remote-intro" aria-busy={busy}>
        <p className="mobile-remote-intro__line">Scan to follow the service on your phone.</p>
        {code ? <>
          <div className="mobile-connection-qr mobile-stream-qr-surface">
            <div className="mobile-stream-code" role="img" aria-label="Scan to open the service on your phone" dangerouslySetInnerHTML={{ __html: code.svg }} />
            <p>Scan to follow verses, notes, and the service.</p>
          </div>
          <MobileConnectionLink url={code.url} label="Share this link with your congregation" />
        </> : <>
          <PhoneConnectionArt variant="stream" />
          {missing && <p className="mobile-remote-hint mobile-stream-message" role="status">Set up your church’s companion page to create its access code.</p>}
          <Button label={busy ? 'Loading code…' : missing ? 'Set up access' : error ? 'Try again' : 'Show access code'} tone="go" disabled={busy || !api?.getQrSvg}
            onClick={() => {
              if (missing) { onClose(); openNoticeTarget('cloud'); }
              else void showCode();
            }} />
          <p className="mobile-remote-hint mobile-stream-hint">{!api?.getQrSvg ? 'Your access code is available in the desktop app.' : 'Verses, notes, and the service in one place.'}</p>
        </>}
        {error && <p className="mobile-remote-error" role="alert">{error}</p>}
      </div>
    </section>
  </div>;
}
