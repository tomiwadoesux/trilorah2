import type { NoticeTarget } from '../../shared/serviceNotice';
import type { NotificationEntry } from '../stores/notificationStore';

export type OrbDestination = NoticeTarget | 'preview' | 'live-controls' | 'listen';
export interface OrbAction {
  label: string;
  target: OrbDestination;
  detail: string;
  attention?: boolean;
}

const labels: Record<NoticeTarget, string> = {
  audio: 'Check mic', phone: 'Connect phone', speech: 'Check speech', displays: 'Check display',
  cloud: 'Check publishing', language: 'Check Bible version', recognition: 'Review recognition',
  media: 'Check media', songs: 'Check songs', slides: 'Check slides', run: 'Review service',
  notes: 'Review notes', connections: 'Check connections', remote: 'Connect remote',
  storage: 'Check storage', timers: 'Check timer',
};

/** Recommendations only navigate; sending content or starting audio stays at its control. */
export function orbActions(state: string, entries: NotificationEntry[], hasPreview: boolean): OrbAction[] {
  const rank = { error: 0, warning: 1, info: 2 };
  const actions: OrbAction[] = entries.filter(e => e.status === 'active' && !e.dismissed)
    .sort((a, b) => rank[a.severity] - rank[b.severity] || b.updatedAt - a.updatedAt)
    .map(e => ({ label: labels[e.target], target: e.target, detail: e.detail, attention: e.severity !== 'info' }));
  const add = (label: string, target: OrbDestination, detail: string, attention = false) => actions.push({ label, target, detail, attention });
  if (state === 'no mic signal') add('Check mic', 'audio', 'Open audio inputs to check your microphone.', true);
  else if (state === 'engine error') add('Check speech', 'speech', 'Open speech settings to restore listening.', true);
  else if (state === 'no display') add('Check display', 'displays', 'Choose the audience display.', true);
  else if (state === 'idle') {
    add('Start listening', 'listen', 'Go to the Start listening control.');
    add('Check mic', 'audio', 'Open your microphone inputs.');
  } else if (state === 'output frozen' || state === 'prayer mode') add('Review output', 'displays', 'Open display settings to review the held output.');
  else if (state === 'media / QR') add('Clear output', 'live-controls', 'Go to the live output controls.');
  else if (state === 'practice mode') add('Review input', 'audio', 'Open audio inputs to leave practice mode.');
  if (hasPreview) {
    // A staged item is useful even when another issue needs attention first.
    const at = actions.findIndex(a => !a.attention);
    actions.splice(at < 0 ? actions.length : at, 0, { label: 'Go live', target: 'preview', detail: 'Open the preview and its Go live control.' });
  }
  const seen = new Set<OrbDestination>();
  return actions.filter(action => {
    if (seen.has(action.target)) return false;
    seen.add(action.target);
    return true;
  }).slice(0, 2);
}
