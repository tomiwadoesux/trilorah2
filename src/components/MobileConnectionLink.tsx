import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from '../ui';
import './mobileConnection.css';

/** Show the exact address encoded by the QR, including its current pairing code. */
export function MobileConnectionLink({ url, label = 'Or open this link on your phone' }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { setCopied(false); setError(false); }, [url]);
  return <div className="mobile-connection-link">
    <label><span>{label}</span><div className="mobile-connection-link__field">
      <input readOnly value={url} aria-label="Connection link" spellCheck={false} onFocus={event => event.currentTarget.select()} />
    </div></label>
    <button type="button" aria-label={copied ? 'Link copied' : 'Copy connection link'} onClick={async () => {
      try { await navigator.clipboard.writeText(url); setCopied(true); setError(false); }
      catch { setError(true); }
    }}>{copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}<span>{copied ? 'Copied' : 'Copy'}</span></button>
    <span className="mobile-connection-link__feedback" role="status">{error ? 'Select the link and copy it manually.' : copied ? 'Link copied. Open it on your phone.' : ''}</span>
  </div>;
}

export function MobilePairingSteps({ step }: { step: number }) {
  return <ol className="mobile-pairing-steps" aria-label="Connection progress">
    {['Open on phone', 'Approve', 'Ready'].map((label, index) => <li key={label} data-current={step === index || undefined} data-done={step > index || undefined} aria-current={step === index ? 'step' : undefined}>
      <span>{step > index ? <CheckIcon size={10} /> : index + 1}</span>{label}
    </li>)}
  </ol>;
}
