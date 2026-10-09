/** Operator-only notices. Destinations are explicit, never arbitrary URLs or code. */
export type NoticeTarget = 'audio' | 'phone' | 'speech' | 'displays' | 'cloud' | 'language' | 'recognition' | 'media' | 'songs' | 'slides' | 'run' | 'notes' | 'connections' | 'remote' | 'storage' | 'timers';
export type NoticeCommand = 'restart-listening' | 'retry-publishing' | 'reopen-output' | 'offline-speech' | 'open-mic-permissions';
export type NoticeAction = { label: string } & (
  | { kind: 'navigate'; target: NoticeTarget }
  | { kind: 'command'; command: NoticeCommand; outputId?: string }
);
export interface ServiceNotice {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'error';
  target: NoticeTarget;
  actions?: NoticeAction[];
  status?: 'active' | 'resolved';
}

export function noticeDetail(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : 'The operation could not finish. Open the relevant controls and try again.';
  return raw.replace(/Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '')
    .replace(/(bearer\s+|(?:api[_ -]?key|token|password)\s*[:=]\s*)[^\s,;]+/gi, '$1[hidden]')
    .slice(0, 400);
}
