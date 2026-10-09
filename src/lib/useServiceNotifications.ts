import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { useNotificationStore } from '../stores/notificationStore';
import { usePracticeStore } from '../stores/practiceStore';
import { audioNotice, publishingNotice, type AudioHealth } from './notificationChecks';
import { noticeDetail, type ServiceNotice } from '../../shared/serviceNotice';
import { PHONE_MIC_LABEL } from '../../shared/audioInput';

/** Mounted once above all views; these checks never run on audience outputs. */
export function useServiceNotifications() {
  useEffect(() => {
    const api = window.api;
    if (!api) return;
    let disposed = false;
    const store = () => useNotificationStore.getState();
    const raise = (n: ServiceNotice) => { if (!disposed) store().receive(n); };
    const resolve = (id: string, text?: string) => { if (!disposed) store().resolve(id, text); };
    let audio: AudioHealth = { startedAt: 0, lastSignalAt: 0, lastLevelAt: 0, lastTranscriptAt: 0, signalSamples: 0 };
    let listening = false;
    let wasListening = false;
    let connectingAt = 0;
    let previousDisplays: OutputsStatus | undefined;
    let clippingAt = 0;
    const off: Array<undefined | (() => void)> = [];
    const listeningState = () => {
      const s = useAppStore.getState();
      const next = s.asrStatus === 'listening' && !usePracticeStore.getState().on;
      if (next && !listening) audio = { startedAt: Date.now(), lastSignalAt: 0, lastLevelAt: 0, lastTranscriptAt: 0, signalSamples: 0 };
      listening = next;
      if (!next) {
        clippingAt = 0;
        audio.startedAt = 0;
        resolve('audio-signal', 'Listening is no longer active.');
        resolve('transcript-stalled', 'Listening is no longer active.');
        resolve('audio-clipping', 'Listening is no longer active.');
      }
    };
    off.push(useAppStore.subscribe(listeningState));
    off.push(usePracticeStore.subscribe(listeningState));
    listeningState();

    const noticesSeen = new Set<string>();
    off.push(api.onServiceNotice?.(notice => { noticesSeen.add(notice.id); raise(notice); }));
    void api.getServiceNotices?.().then(notices => notices.forEach(notice => { if (!noticesSeen.has(notice.id)) raise(notice); })).catch(() => undefined);
    off.push(api.onAsrStatus?.(raw => {
      const text = String(raw);
      if (/^listening/i.test(text)) {
        wasListening = true; connectingAt = 0;
        resolve('speech-engine', 'Listening has resumed.');
        resolve('speech-connecting', 'The speech engine connected.');
      } else if (/^(error|could not)/i.test(text)) {
        connectingAt = 0;
        const mic = /microphone|mic |audio input|phone is not connected|permission/i.test(text);
        raise({ id: mic ? 'audio-input' : 'speech-engine', title: mic ? 'Audio input needs attention' : 'Listening could not continue', detail: noticeDetail(text), severity: 'error', target: mic ? 'audio' : 'speech', actions: [
          ...(/permission|access.*blocked|access.*denied/i.test(text) ? [{ kind: 'command' as const, command: 'open-mic-permissions' as const, label: 'Open microphone permissions' }] : []),
          { kind: 'command', command: 'restart-listening', label: 'Retry listening' },
          { kind: 'navigate', target: mic ? 'audio' : 'speech', label: mic ? 'Choose audio input' : 'Open speech settings' },
        ] });
      } else if (/^connecting/i.test(text)) {
        connectingAt ||= Date.now();
        if (wasListening) raise({ id: 'speech-connecting', title: 'Speech connection interrupted', detail: 'The app is reconnecting. New transcription may pause until the connection returns.', severity: 'warning', target: 'speech' });
      } else if (/^stopped/i.test(text)) {
        wasListening = false; connectingAt = 0;
        resolve('speech-connecting', 'Listening was stopped.');
      }
    }));
    off.push(api.onAudioLevel(level => {
      if (!listening || !Number.isFinite(level)) return;
      const now = Date.now(); audio.lastLevelAt = now;
      if (level > -55) { audio.lastSignalAt = now; audio.signalSamples++; resolve('audio-signal', 'Audio input is receiving a signal again.'); }
      if (level >= -2) {
        clippingAt ||= now;
        if (now - clippingAt > 5000) raise({ id: 'audio-clipping', title: 'Audio input is very loud', detail: 'The input has remained near its maximum level for five seconds. Check the interface gain to avoid distortion.', severity: 'warning', target: 'audio' });
      } else { clippingAt = 0; resolve('audio-clipping', 'Audio has returned below the high-level threshold.'); }
    }));
    off.push(api.onTranscriptUpdate(text => {
      if (!text.trim()) return;
      audio.lastTranscriptAt = Date.now(); audio.signalSamples = 0;
      resolve('transcript-stalled', 'New transcript words are arriving again.');
    }));
    off.push(api.onPhoneMicStatus?.(status => {
      const selected = useAppStore.getState().settings?.micDeviceLabel === PHONE_MIC_LABEL;
      if (status.state === 'connected') { resolve('phone-audio', 'The phone microphone is connected.'); resolve('phone-pairing', 'The phone connected.'); }
      else if (status.state === 'pending') raise({ id: 'phone-pairing', title: `${status.phoneName || 'A phone'} wants to provide audio`, detail: 'Review the phone before allowing its microphone into this service.', severity: 'info', target: 'phone' });
      else if (status.state === 'expired') raise({ id: 'phone-pairing', title: 'Phone audio code expired', detail: 'Open phone audio to generate a new pairing code.', severity: 'info', target: 'phone' });
      else if (status.state === 'error' || (selected && status.state === 'ended')) raise({ id: 'phone-audio', title: 'Phone audio is disconnected', detail: noticeDetail(status.error || 'Reconnect the phone or choose another audio input.'), severity: 'error', target: 'phone', actions: [{ kind: 'navigate', target: 'phone', label: 'Reconnect phone' }, { kind: 'navigate', target: 'audio', label: 'Choose another input' }] });
      else if (status.state === 'idle' || status.state === 'declined' || status.state === 'ended') resolve('phone-pairing', 'Phone pairing ended.');
    }));
    off.push(api.onEngineEvent?.('on-bible-notice', data => {
      const notice = data as { text?: string } | null;
      if (typeof notice?.text === 'string') raise({ id: 'bible-version', title: 'Bible version changed', detail: notice.text, severity: 'warning', target: 'language' });
    }));
    off.push(api.onEngineEvent?.('on-auto-mode-event', data => {
      if ((data as { type?: string } | null)?.type === 'auto-disabled') raise({ id: 'auto-mode', title: 'Automatic display was turned off', detail: 'Review the preacher settings before using automatic display again. Manual controls remain available.', severity: 'warning', target: 'recognition' });
    }));
    const timerStates = new Map<string, boolean>();
    off.push(api.onTimers?.(timers => {
      for (const timer of timers) {
        const finished = timer.state === 'running' && timer.kind !== 'elapsed' && timer.remainingMs <= 0;
        if (finished && timerStates.get(timer.id) === false) raise({ id: `timer:${timer.id}`, title: `${timer.name || 'Countdown'} has finished`, detail: 'Open the timer to adjust, reset, or stop it.', severity: 'info', target: 'timers' });
        if (!finished) resolve(`timer:${timer.id}`, 'The timer is no longer over its countdown.');
        timerStates.set(timer.id, finished);
      }
    }));

    let knownInputs = new Set<string>();
    const checkDevices = async () => {
      try {
        const devices = await navigator.mediaDevices?.enumerateDevices();
        if (!devices || disposed) return;
        const labels = new Set(devices.filter(d => d.kind === 'audioinput' && d.label).map(d => d.label));
        const chosen = useAppStore.getState().settings?.micDeviceLabel;
        if (listening && typeof chosen === 'string' && knownInputs.has(chosen) && !labels.has(chosen)) raise({ id: 'audio-input', title: `${chosen} disconnected`, detail: 'The selected device is no longer available. Choose another input or reconnect it.', severity: 'error', target: 'audio', actions: [{ kind: 'navigate', target: 'audio', label: 'Choose audio input' }, { kind: 'navigate', target: 'phone', label: 'Try phone audio' }] });
        knownInputs = labels;
      } catch { /* Labels may be unavailable before microphone permission. */ }
    };
    const deviceChange = () => { void checkDevices(); };
    navigator.mediaDevices?.addEventListener('devicechange', deviceChange);
    off.push(() => navigator.mediaDevices?.removeEventListener('devicechange', deviceChange));
    void checkDevices();

    let outputsBusy = false;
    const checkOutputs = async () => {
      if (outputsBusy || !api.getOutputsStatus) return;
      outputsBusy = true;
      try {
        const current = await api.getOutputsStatus();
        if (disposed) return;
        for (const output of current.outputs) {
          const id = `display:${output.id}`;
          const prior = previousDisplays?.outputs.find(o => o.id === output.id);
          if (output.disabled || !output.open) { resolve(id, 'This output is no longer in use.'); continue; }
          const removed = prior?.displayId != null && !current.displays.some(d => d.id === prior.displayId);
          if (!output.fullscreen || removed) raise({ id, title: removed ? 'An output display disconnected' : 'Audience output is on this computer', detail: `${output.role} output: choose a connected display in display settings.`, severity: 'warning', target: 'displays' });
          else resolve(id, 'The output is assigned to a connected display.');
        }
        previousDisplays = current;
      } catch { /* Do not turn an unsuccessful health read into a device diagnosis. */ }
      finally { outputsBusy = false; }
    };
    off.push(api.onOutputsChanged?.(() => { void checkOutputs(); }));
    void checkOutputs();

    let cloudBusy = false;
    const checkCloud = async () => {
      if (cloudBusy || !api.cloudStatus) return;
      cloudBusy = true;
      try {
        const status = await api.cloudStatus();
        if (disposed) return;
        const notice = publishingNotice(status, listening);
        if (notice) raise(notice);
        else resolve('publishing', status.paused ? 'Online sharing was ended.' : 'The publishing check has cleared.');
      } catch { /* The existing status stays until a successful check. */ }
      finally { cloudBusy = false; }
    };
    off.push(api.onEngineEvent?.('on-cloud-health-changed', () => { void checkCloud(); }));
    const online = () => { void checkCloud(); };
    window.addEventListener('online', online);
    void checkCloud();

    let otherBusy = false;
    let connectedRemotes: PairedDeviceInfo[] = [];
    const checkConnections = async () => {
      if (otherBusy) return;
      otherBusy = true;
      await Promise.allSettled([
        api.remoteConnected?.().then(devices => {
          for (const previous of connectedRemotes) {
            if (!devices.some(d => d.deviceId === previous.deviceId)) raise({ id: `remote:${previous.deviceId}`, title: `${previous.deviceName || 'A remote'} disconnected`, detail: 'This device is no longer connected to the service controls. Open connections to check or pair it again.', severity: 'warning', target: 'connections' });
          }
          for (const device of devices) resolve(`remote:${device.deviceId}`, 'The remote is connected again.');
          connectedRemotes = devices;
        }),
        api.obsStatus?.().then(s => {
          if (!s.enabled || s.connected) resolve('connection:obs', s.enabled ? 'OBS is connected again.' : 'OBS is disabled.');
          else raise({ id: 'connection:obs', title: 'OBS is not connected', detail: 'OBS is enabled, but the connection is unavailable. Check the host, port, and password.', severity: 'warning', target: 'connections' });
        }),
        api.vmixStatus?.().then(s => {
          if (!s.enabled || s.reachable) resolve('connection:vmix', s.enabled ? 'vMix is reachable again.' : 'vMix is disabled.');
          else raise({ id: 'connection:vmix', title: 'vMix is not reachable', detail: 'vMix is enabled. Check its address and that vMix is running.', severity: 'warning', target: 'connections' });
        }),
        api.mobileStatus?.().then(s => {
          if (s.error && s.running) raise({ id: 'mobile-remote', title: 'Mobile access needs attention', detail: s.error, severity: 'warning', target: 'remote' });
          else resolve('mobile-remote', 'The mobile access check has cleared.');
          if (s.pending.length) raise({ id: 'mobile-pairing', title: `${s.pending.length} phone${s.pending.length === 1 ? '' : 's'} waiting for approval`, detail: 'Review the devices requesting control of this service.', severity: 'info', target: 'remote' });
          else resolve('mobile-pairing', 'There are no pending remote requests.');
        }),
      ]);
      otherBusy = false;
    };
    void checkConnections();
    void api.getDbStatus?.().then(status => {
      if (!status.connected) raise({ id: 'bible-database', title: 'The Bible library could not be opened', detail: 'Scripture lookup is unavailable. Open Privacy & data to check the Bible database.', severity: 'error', target: 'storage' });
      else resolve('bible-database', 'The Bible library is available.');
    }).catch(() => undefined);
    void api.songs?.problem?.().then(problem => {
      if (problem) raise({ id: 'song-library', title: 'The song library needs attention', detail: problem, severity: 'error', target: 'songs' });
      else resolve('song-library', 'The song library is available.');
    }).catch(() => undefined);
    const healthTick = window.setInterval(() => {
      if (listening && !useAppStore.getState().prayerMode) {
        const device = useAppStore.getState().settings?.micDeviceLabel;
        const notice = audioNotice(audio, Date.now(), typeof device === 'string' && device ? device : 'the selected input');
        if (notice) raise(notice);
      }
      if (connectingAt && Date.now() - connectingAt > 45_000) raise({ id: 'speech-connecting', title: 'Speech connection is taking longer than expected', detail: 'Check the connection and speech settings. You can retry listening.', severity: 'warning', target: 'speech', actions: [{ kind: 'command', command: 'restart-listening', label: 'Retry listening' }] });
    }, 1000);
    const cloudTick = window.setInterval(() => { void checkCloud(); }, 5000);
    const otherTick = window.setInterval(() => { void checkConnections(); }, 10_000);
    return () => { disposed = true; off.forEach(fn => fn?.()); clearInterval(healthTick); clearInterval(cloudTick); clearInterval(otherTick); window.removeEventListener('online', online); };
  }, []);
}
