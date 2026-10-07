import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { useLiveStore } from './stores/liveStore';
import { fetchVerseText, formatRef } from './lib/verse';
import { startMicCapture, stopMicCapture } from './lib/micCapture';
import { installPhoneMic } from './lib/phoneMic';
import { hasEngine } from './components/ui';
/* The Trilorah LIVE screen. The previous surface is still in
   ./screens/Live — swapping this import back is the whole rollback. */
import { LiveHost } from './screens/LiveHost';
import { noteActivePreacher } from './design/screens/dashboard/preachers';

/**
 * Mounts every engine listener exactly once for the app's lifetime and
 * loads initial state. Screens only read from the stores, so nothing is
 * missed while the operator is on another tab.
 */
function useEngineWiring() {
  useEffect(() => {
    const api = window.api;
    if (!api) return;

    const app = () => useAppStore.getState();
    const live = () => useLiveStore.getState();

    const showVerse = (detection: VerseDetection, target: 'preview' | 'live') => {
      const setter = target === 'preview' ? live().setPreview : live().setLive;
      setter({ detection, text: null });
      void fetchVerseText(detection).then((text) => {
        if (text == null) return;
        const current = target === 'preview' ? live().preview : live().live;
        if (current?.detection === detection) {
          setter({ detection, text });
        }
      });
    };

    const subs: ((() => void) | undefined)[] = [
      api.onTranscriptUpdate((text) => live().appendTranscript(text)),
      api.onVersePreview((d) => showVerse(d, 'preview')),
      api.onVerseDetected((d) => {
        showVerse(d, 'live');
      }),
      api.onVerseAutoDismiss(() => live().setLive(null)),
      api.onShowCleanBackground(() => live().setLive(null)),
      api.onSegmentChanged((segment) => app().setSegment(segment)),
      api.onAudioLevel((level) => {
        const rounded = Math.round(level);
        if (app().audioLevel !== rounded) app().setAudioLevel(rounded);
      }),
      api.onNotesUpdated((snapshot) => live().setNotesSnapshot(snapshot)),
      // Stream Deck / Companion commands arriving over ws://localhost:8081.
      api.onExternalCommand((cmd) => {
        switch (cmd.command) {
          case 'clear-screen':
            live().setLive(null);
            break;
          case 'start-listening': {
            const device = app().settings?.micDeviceLabel;
            api.startListening(typeof device === 'string' && device ? device : undefined);
            app().setAsrStatus('listening');
            app().setListeningSince(Date.now());
            break;
          }
          case 'stop-listening':
            api.stopListening();
            app().setAsrStatus('stopped');
            app().setListeningSince(null);
            break;
          case 'push-preview': {
            const p = live().preview;
            if (p) {
              api.pushToLive(formatRef(p.detection), p.detection.version);
            }
            break;
          }
        }
      }),
      api.onMediaSuggestion(() => {
        /* Media suggestions have no surface in this minimal UI yet. */
      }),
      // Window-mic capture: the engine asks us for audio when SoX is absent.
      api.onMicRequest?.((req) => {
        void startMicCapture(req.sampleRate, req.deviceLabel).catch((e) => {
          console.error('mic capture failed:', e);
          api.reportMicCaptureError?.(e instanceof Error ? e.message : 'Microphone capture failed');
          app().setAsrStatus('error', e instanceof Error ? e.message : 'microphone capture failed');
        });
      }),
      api.onMicStop?.(() => stopMicCapture()),
      // The phone microphone's call, answered here (lib/phoneMic).
      installPhoneMic(),
      // The engine emits human status lines ("Listening...", "Downloading
      // speech model — 40%", "Error: …") — normalize for the state machine
      // and keep the raw line as the visible detail.
      api.onAsrStatus?.((status) => {
        const raw = String(status);
        const s = raw.toLowerCase();
        const norm: ASRStatus = s.startsWith('listening')
          ? 'listening'
          : s.startsWith('error')
            ? 'error'
            : s.startsWith('stopped')
              ? 'stopped'
              : 'connecting';
        const quiet = norm === 'listening' || norm === 'stopped';
        app().setAsrStatus(norm, quiet ? null : raw);
      }),
      api.onVoiceCommand?.((event) => live().pushVoiceCommand(event)),
      api.onVersionChanged?.((version) => live().setDisplayVersion(version)),
      api.onQueueUpdated?.((queue) => live().setQueue(queue)),
      api.onPrayerMode?.((active) => app().setPrayerMode(active)),
      api.onIntentState?.((state) => app().setIntentState(state)),
    ];

    // Initial state.
    void api.getSettings().then((settings) => {
      app().setSettings(settings);
      const preacherId = typeof settings.activePreacherId === 'string' ? settings.activePreacherId : '';
      if (settings.defaultVersion && live().displayVersion == null) {
        live().setDisplayVersion(settings.defaultVersion);
      }
      if (preacherId) {
        /* The dashboard keeps its own preacher list (design/screens/
           dashboard/preachers.ts) and loads it lazily. Telling it who is
           active here means the bento and the profile open on the right
           person rather than on "nobody is set for today" until something
           is pressed. */
        noteActivePreacher(preacherId);
        void api.listPreacherProfiles().then((profiles) => {
          const profile = profiles.find((p) => p.id === preacherId);
          app().setActivePreacher(preacherId, profile?.name ?? preacherId);
        }).catch(() => app().setActivePreacher(preacherId, preacherId));
        void api.getPreacherStats?.(preacherId).then((stats) => {
          const s = stats.find((x) => x.id === preacherId) ?? stats[0];
          if (s) app().setTrustLowerBound(s.trustLowerBound);
        }).catch(() => undefined);
      }
    }).catch(() => undefined);
    void api.getVerseQueue?.().then((queue) => live().setQueue(queue)).catch(() => undefined);

    return () => {
      for (const unsub of subs) unsub?.();
    };
  }, []);
}

export default function App() {
  useEngineWiring();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* The top row — wordmark, tabs, status, audio, remote, tour — is gone.
          Audio and the remote sit on the LIVE toolbar; the cloud account is
          in the settings posture; the old tab screens that still had
          something unique were folded into settings pages. The welcome tour
          is gone too (owner, 2026-10-07). Nothing switches tabs any more:
          `tab` in the store is idle. */}
      {!hasEngine() && (
        <p className="shrink-0 border-b border-hairline px-4 py-1.5 text-xs italic text-neutral-400">
          engine not connected — running outside Electron; controls are inert
        </p>
      )}
      <main className="min-h-0 min-w-0 flex-1">
        <LiveHost />
      </main>
    </div>
  );
}
