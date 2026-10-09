import type { ServiceNotice } from '../../shared/serviceNotice';

/** Public sharing is optional. A paused or unused feature is not an incident. */
export function publishingNotice(s: CloudStatus, listening: boolean): ServiceNotice | null {
  if (s.paused || (!listening && !s.activeServiceId && !s.queue?.pending)) return null;
  const base = { id: 'publishing', severity: 'warning', target: 'cloud' } as const;
  if (!s.configured) return { ...base, title: 'Online sharing is unavailable', detail: 'This installation is not configured for online sharing. Open Account & cloud for details.' };
  if (!s.signedIn) return { ...base, title: 'Sign in to share this service', detail: 'Online verses and transcripts cannot update until you sign in.', actions: [{ kind: 'navigate', target: 'cloud', label: 'Sign in' }] };
  if (s.hasAccount === false) return { ...base, title: 'Finish church setup', detail: 'Your church account must be set up before this service can appear online.', actions: [{ kind: 'navigate', target: 'cloud', label: 'Finish setup' }] };
  if (s.serviceError || (s.queue?.lastError && s.queue.lastErrorKind !== 'rejected')) return {
    ...base, severity: 'error', title: s.activeServiceId ? 'Online updates need attention' : 'This service could not go online',
    detail: s.queue?.pending ? `${s.queue.pending} updates are waiting to publish. ${s.queue.lastError ?? ''}` : s.serviceError || `Some updates were rejected. ${s.queue?.lastError ?? ''}`,
    actions: [{ kind: 'command', command: 'retry-publishing', label: 'Retry publishing' }, { kind: 'navigate', target: 'cloud', label: 'Open sharing' }],
  };
  if (s.transcriptDelivery?.state === 'behind' || s.transcriptDelivery?.state === 'unavailable') return {
    ...base,
    title: s.transcriptDelivery.state === 'behind' ? 'The public transcript is behind' : 'Online transcript access could not be verified',
    detail: s.transcriptDelivery.state === 'behind' ? 'The public feed is missing recent transcript words from this computer. Open sharing to check publishing.' : 'The app could not read the public transcript feed. Check the connection and sharing settings. This does not establish whether every viewer is affected.',
    actions: [{ kind: 'command', command: 'retry-publishing', label: 'Retry publishing' }, { kind: 'navigate', target: 'cloud', label: 'Open sharing' }],
  };
  return null;
}

export interface AudioHealth {
  startedAt: number;
  lastSignalAt: number;
  lastLevelAt: number;
  lastTranscriptAt: number;
  signalSamples: number;
}
export function audioNotice(s: AudioHealth, now: number, name: string): ServiceNotice | null {
  if (!s.startedAt || now - s.startedAt < 20_000) return null;
  if (now - Math.max(s.lastSignalAt, s.startedAt) >= 20_000) return {
    id: 'audio-signal', title: `No input detected from ${name}`, severity: 'warning', target: 'audio',
    detail: 'Listening is on, but no audio signal has been detected for at least 20 seconds. If someone is speaking, check the input channel, gain, and cable.',
    actions: [{ kind: 'navigate', target: 'audio', label: 'Check audio' }, { kind: 'navigate', target: 'phone', label: 'Try phone audio' }],
  };
  // Sound alone does not prove speech. Describe the evidence, never diagnose an accent.
  if (now - Math.max(s.lastTranscriptAt, s.startedAt) >= 60_000 && now - s.lastSignalAt < 2000 && s.signalSamples >= 100) return {
    id: 'transcript-stalled', title: 'Audio is arriving without new words', severity: 'warning', target: 'speech',
    detail: 'No new transcript has arrived for at least a minute. If this is speech, check the input and speech language. Music and room noise can also cause this.',
    actions: [{ kind: 'command', command: 'restart-listening', label: 'Restart listening' }, { kind: 'navigate', target: 'speech', label: 'Check speech settings' }],
  };
  return null;
}
