/**
 * One line for the companion card: is the congregation's page actually
 * receiving this service?
 *
 * Every way the page can stay empty used to be silent on the desktop — not
 * signed in, no church set up, sharing ended, the service row refused, writes
 * stuck in the queue — while the app transcribed and drove the projector
 * perfectly. The card says which one it is.
 */
export interface PublishLine {
  tone: 'live' | 'idle' | 'warn';
  text: string;
}

export function companionPublishLine(s: CloudStatus | null | undefined): PublishLine | null {
  if (!s) return null;
  if (!s.configured) return { tone: 'warn', text: 'cloud is off in this build — the page cannot update' };
  if (!s.signedIn) return { tone: 'warn', text: 'not signed in — sign in under settings › account & cloud' };
  if (s.hasAccount === false) return { tone: 'warn', text: 'finish church setup under settings › account & cloud' };
  if (s.paused) return { tone: 'idle', text: 'sharing ended — reopen it under settings › account & cloud' };
  if (!s.activeServiceId && s.serviceError) return { tone: 'warn', text: `could not go live — ${s.serviceError}` };
  if (!s.activeServiceId) return { tone: 'idle', text: 'goes live when you start listening' };
  const q = s.queue;
  if (q && q.pending > 0 && q.lastError) {
    return { tone: 'warn', text: `${q.pending} update${q.pending === 1 ? '' : 's'} waiting — ${q.lastError}` };
  }
  return { tone: 'live', text: 'live on the page' };
}
