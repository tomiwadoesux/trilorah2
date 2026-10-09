import { useState } from 'react';
import { PhoneMicIntro } from '../../components/PhoneMicPanel';
import { MobileRemoteIntro } from '../../components/MobileRemotePanel';
import { NotificationEmptyState } from '../../components/NotificationCenter';
import { MobileMenu } from '../../components/MobileMenu';
import './connectionEmptyPreview.css';

/** Uses the real first-use components without starting either connection. */
export function ConnectionEmptyPreview() {
  const [history, setHistory] = useState(false);
  const [message, setMessage] = useState('');
  return <main className="connection-empty-preview">
    <header className="connection-empty-preview__heading">
      <span>TRILORAH · EMPTY STATES</span>
      <h1>Ready when you are.</h1>
      <p>Open mobile to choose microphone, remote, or QR access. Connections stay off in this preview.</p>
    </header>
    <div className="connection-empty-preview__toolbar">
      <span>Mobile tools</span>
      <MobileMenu preview />
    </div>
    <div className="connection-empty-preview__grid">
      <section className="connection-empty-preview__card" aria-label="Phone microphone preview">
        <h2>Phone microphone</h2>
        <PhoneMicIntro onConnect={() => setMessage('In the app, Connect phone creates your microphone pairing code.')} />
      </section>
      <section className="connection-empty-preview__card" aria-label="Mobile remote preview">
        <h2>Mobile remote</h2>
        <MobileRemoteIntro onEnable={() => setMessage('In the app, Enable mobile access opens the QR and pairing controls.')} />
      </section>
      <section className="connection-empty-preview__card connection-empty-preview__notifications" aria-label="Notifications preview">
        <h2>Notifications</h2>
        <div className="tri-notification-tabs" role="group" aria-label="Notification filter">
          <button type="button" aria-pressed={!history} onClick={() => setHistory(false)}>active</button>
          <button type="button" aria-pressed={history} onClick={() => setHistory(true)}>history</button>
        </div>
        <NotificationEmptyState history={history} />
        <p className="connection-empty-preview__note">Hover to see the quiet ripple.</p>
      </section>
    </div>
    <p className="connection-empty-preview__feedback" role="status">{message}</p>
  </main>;
}
