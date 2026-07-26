import { useEffect } from 'react';
import { useAppStore, TABS } from './stores/appStore';
import { useLiveStore } from './stores/liveStore';
import { fetchVerseText, sameRef, pct } from './lib/verse';
import { startMicCapture, stopMicCapture } from './lib/micCapture';
import { LevelMeter, hasEngine } from './components/ui';
import { Tour } from './components/Tour';
import { Live } from './screens/Live';
import { Bible } from './screens/Bible';
import { Songs } from './screens/Songs';
import { Presentations } from './screens/Presentations';
import { Themes } from './screens/Themes';
import { Schedule } from './screens/Schedule';
import { Preachers } from './screens/Preachers';
import { Notes } from './screens/Notes';
import { Settings } from './screens/Settings';
import { Cloud } from './screens/Cloud';

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
        if (current && sameRef(current.detection, detection)) {
          setter({ detection, text });
        }
      });
    };

    const subs: ((() => void) | undefined)[] = [
      api.onTranscriptUpdate((text) => live().appendTranscript(text)),
      api.onVersePreview((d) => showVerse(d, 'preview')),
      api.onVerseDetected((d) => {
        showVerse(d, 'live');
        // A verse going live supersedes its own preview.
        const p = live().preview;
        if (p && sameRef(p.detection, d)) live().setPreview(null);
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
            api.pushToLive();
            const p = live().preview;
            if (p) {
              live().setLive(p);
              live().setPreview(null);
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
          app().setAsrStatus('error', e instanceof Error ? e.message : 'microphone capture failed');
        });
      }),
      api.onMicStop?.(() => stopMicCapture()),
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
      // First launch on this machine → open the guided tour.
      if (settings.onboardingDone !== true) app().setTourStep(0);
      const preacherId = typeof settings.activePreacherId === 'string' ? settings.activePreacherId : '';
      if (settings.defaultVersion && live().displayVersion == null) {
        live().setDisplayVersion(settings.defaultVersion);
      }
      if (preacherId) {
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

function StatusCluster() {
  const asrStatus = useAppStore((s) => s.asrStatus);
  const segment = useAppStore((s) => s.segment);
  const preacherName = useAppStore((s) => s.activePreacherName);
  const trust = useAppStore((s) => s.trustLowerBound);
  const audioLevel = useAppStore((s) => s.audioLevel);

  const listening = asrStatus === 'listening';

  return (
    <div className="flex items-center gap-x-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
      <span className={`flex items-center gap-x-1.5 ${listening ? 'text-accent' : ''}`}>
        <span aria-hidden="true" className={listening ? 'animate-pulse-quiet' : ''}>
          ●
        </span>
        {asrStatus}
      </span>
      {listening && <LevelMeter db={audioLevel} />}
      {segment && <span>{segment.type}</span>}
      {preacherName && <span className="text-ink">{preacherName}</span>}
      {trust != null && <span>trust {pct(trust)}</span>}
    </div>
  );
}

export default function App() {
  useEngineWiring();
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const setTourStep = useAppStore((s) => s.setTourStep);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-hairline bg-surface">
        <div className="flex items-center justify-between gap-x-6 px-4 py-2">
          <div className="flex items-center gap-x-6">
            <span className="select-none text-sm font-bold tracking-[0.3em]">TRILORAH</span>
            <nav data-tour="tabs" className="flex items-center gap-x-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                    tab === t.id ? 'bg-accent text-white' : 'text-neutral-500 hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-x-5">
            <StatusCluster />
            <button
              type="button"
              onClick={() => setTourStep(0)}
              title="Replay the guided tour"
              className="rounded border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500 transition-colors hover:border-ink hover:text-ink"
            >
              How to use
            </button>
          </div>
        </div>
        {!hasEngine() && (
          <p className="border-t border-hairline px-4 py-1.5 text-xs italic text-neutral-400">
            engine not connected — running outside Electron; controls are inert
          </p>
        )}
      </header>

      {tab === 'live' ? (
        // The control surface owns the whole viewport below the header.
        <main className="min-h-0 flex-1">
          <Live />
        </main>
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 pb-24 pt-10">
            {tab === 'bible' && <Bible />}
            {tab === 'songs' && <Songs />}
            {tab === 'presentations' && <Presentations />}
            {tab === 'themes' && <Themes />}
            {tab === 'schedule' && <Schedule />}
            {tab === 'preachers' && <Preachers />}
            {tab === 'notes' && <Notes />}
            {tab === 'settings' && <Settings />}
            {tab === 'cloud' && <Cloud />}
          </div>
        </main>
      )}

      <Tour />
    </div>
  );
}
