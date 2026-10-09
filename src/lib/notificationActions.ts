import type { NoticeAction } from '../../shared/serviceNotice';
import { useAppStore } from '../stores/appStore';
import { useNotificationStore } from '../stores/notificationStore';
import { openNoticeTarget } from './notificationNavigation';

const pendingActions = new Map<string, Promise<string>>();
export function runNoticeAction(action: NoticeAction): Promise<string> {
  if (action.kind === 'navigate') { openNoticeTarget(action.target); return Promise.resolve(''); }
  const key = `${action.command}:${action.outputId ?? ''}`;
  const pending = pendingActions.get(key);
  if (pending) return pending;
  const work = performNoticeAction(action).finally(() => { pendingActions.delete(key); });
  pendingActions.set(key, work);
  return work;
}

async function performNoticeAction(action: NoticeAction): Promise<string> {
  if (action.kind === 'navigate') { openNoticeTarget(action.target); return ''; }
  const api = window.api;
  if (!api) throw new Error('The app engine is not connected.');
  switch (action.command) {
    case 'open-mic-permissions': {
      const result = await api.openMicPermissions?.();
      return result?.supported ? 'Microphone permissions opened. Enable access for Trilorah, then retry listening.' : 'Open your system privacy settings and allow microphone access for Trilorah.';
    }
    case 'restart-listening': {
      if (!api.onAsrStatus) throw new Error('Restart the app to reconnect the speech controls.');
      const device = useAppStore.getState().settings?.micDeviceLabel;
      await new Promise<void>((resolve, reject) => {
        let off: (() => void) | undefined;
        const timer = window.setTimeout(() => { off?.(); reject(new Error('Listening has not restarted yet. Open Audio & speech to check the connection.')); }, 45_000);
        off = api.onAsrStatus!(text => {
          if (!/^(listening|error|could not)/i.test(text)) return;
          clearTimeout(timer); off?.();
          if (/^listening/i.test(text)) resolve(); else reject(new Error(text));
        });
        try { api.stopListening(); api.startListening(typeof device === 'string' ? device : undefined); }
        catch (error) { clearTimeout(timer); off?.(); reject(error); }
      });
      return 'Listening restarted. Audio checks are running.';
    }
    case 'retry-publishing': {
      if (!api.retryPublishing) throw new Error('Restart the app to load the publishing retry control.');
      const status = await api.retryPublishing();
      if (status.lastError || status.pending) throw new Error(status.lastError || `${status.pending} updates are still waiting to publish.`);
      const checked = await api.cloudStatus();
      if (checked.transcriptDelivery?.state === 'behind' || checked.transcriptDelivery?.state === 'unavailable') return 'Queued updates have reached the server. The public transcript check has not recovered yet.';
      useNotificationStore.getState().resolve('publishing', 'Queued updates have reached the server.');
      return 'Queued updates have reached the server.';
    }
    case 'reopen-output': {
      api.openOutput(action.outputId ?? 'main');
      openNoticeTarget('displays');
      return 'Output requested. Check its display assignment.';
    }
    case 'offline-speech': {
      if (!api.useOfflineSpeech) throw new Error('Offline speech is not available in this installation.');
      const result = await api.useOfflineSpeech();
      if (!result.success) throw new Error('Offline speech could not be selected.');
      openNoticeTarget('speech');
      return 'Offline speech selected. Check its setup before listening.';
    }
  }
}
