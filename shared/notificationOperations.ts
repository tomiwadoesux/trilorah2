import { noticeDetail, type NoticeTarget, type ServiceNotice } from './serviceNotice';

/** Only user-facing operations belong here; background reads are checked separately. */
const operations: Array<[RegExp, NoticeTarget, string]> = [
  [/^(tri-save|save-service-summary|save-run|save-presentations)$/, 'run', 'Service changes could not be saved'],
  [/^tri-(open|inspect|import)$/, 'run', 'Service package needs attention'],
  [/^(import-presentation|import-generated-presentation|convert-presentation)/, 'slides', 'Presentation could not be imported'],
  [/^(import-media-files|download-stock|pick-media-file|save-clip-poster)/, 'media', 'Media could not be added'],
  [/^songs-(import|add|update|remove)/, 'songs', 'Song changes need attention'],
  [/^(lyrics-|song-discovery|youtube-captions)/, 'songs', 'Lyrics could not be retrieved'],
  [/^(generate-sermon-notes|export-sermon-notes|cloud-upsert-notes)/, 'notes', 'Sermon notes need attention'],
  [/^(ocr-process|ocr-schedule|schedule-import)/, 'run', 'The image could not be read'],
  [/^cloud-(sign-in|sign-up|start-service|end-service|complete-account|redeem|sync-giving|generate-link)/, 'cloud', 'Online sharing needs attention'],
  [/^(obs-(?!status)|vmix-(?!status))/, 'connections', 'Connection action could not finish'],
  [/^(mobile-enable|mobile-approve|mobile-code|remote-)/, 'remote', 'Mobile remote needs attention'],
  [/^phone-mic-(start|approve)/, 'phone', 'Phone audio could not connect'],
  [/^(get-chapter|search-verse|get-verse-range|set-session-version|set-display-version)/, 'language', 'Bible passage could not be loaded'],
  [/^(timers-create|timers-update|timers-start|timers-pause|timers-reset)/, 'timers', 'Timer action could not finish'],
  [/^(open-output|output-open|show-media|push-live-content|push-to-live)/, 'displays', 'Output action could not finish'],
  [/^(set-setting|save-voice-command|preacher-learning-save|folders-|save-preacher)/, 'storage', 'Changes could not be saved'],
];

export function operationNoticeKey(channel: string, args: unknown[] = []): string {
  const input = args[0] && typeof args[0] === 'object' ? args[0] as Record<string, unknown> : null;
  return channel === 'set-setting' && typeof input?.key === 'string' ? `${channel}:${input.key}` : channel;
}

export function operationNotice(channel: string, result: unknown, failed = false, args: unknown[] = []): ServiceNotice | null {
  const spec = operations.find(([pattern]) => pattern.test(channel));
  if (!spec) return null;
  const data = result && typeof result === 'object' ? result as Record<string, unknown> : null;
  // A dismissed file dialog is not a success or a fault.
  if (!failed && (data?.canceled || data?.cancelled || (result == null && /^(tri-inspect|pick-|import-|get-|search-)/.test(channel)))) return null;
  const errors = Array.isArray(data?.errors) ? data.errors : Array.isArray(data?.skipped) ? data.skipped : [];
  const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
  const problem = failed ? result : data?.error || (errors.length ? `${errors.length} item(s) could not be completed. Review the import results.` : null) || (warnings.length ? warnings.filter(x => typeof x === 'string').join(' · ') : null) || (data?.success === false ? 'The operation did not complete. Review the details and try again.' : null);
  let target = spec[1];
  const key = operationNoticeKey(channel, args);
  if (channel === 'set-setting') {
    const setting = key.slice('set-setting:'.length);
    if (/mic|asr|whisper|deepgram/i.test(setting)) target = 'speech';
    else if (/obs|vmix|remote/i.test(setting)) target = 'connections';
    else if (/output|display|screen/i.test(setting)) target = 'displays';
    else if (/operatorRun/i.test(setting)) target = 'run';
    else if (/Version|Language/i.test(setting)) target = 'language';
    else if (/cloud|public|church/i.test(setting)) target = 'cloud';
  }
  return {
    id: `operation:${key}`, title: spec[2], target,
    detail: problem ? noticeDetail(problem) : 'The operation completed successfully.',
    severity: warnings.length && !errors.length && !failed && !data?.error ? 'warning' : 'error',
    status: problem ? 'active' : 'resolved',
  };
}
