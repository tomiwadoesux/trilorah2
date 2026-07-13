import { useEffect } from 'react';
import { useAppStore, TABS } from './stores/appStore';
import { useLiveStore } from './stores/liveStore';
import { fetchVerseText, sameRef, pct } from './lib/verse';
import { hasEngine } from './components/ui';
import { Live } from './screens/Live';
import { Bible } from './screens/Bible';
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
      api.onExternalCommand((cmd) => {
        if (cmd.command === 'clear-screen') live().setLive(null);
      }),
      api.onMediaSuggestion(() => {
        /* Media suggestions have no surface in this minimal UI yet. */
      }),
      // Upcoming surface — may be absent from today's preload.
      api.onAsrStatus?.((status) => app().setAsrStatus(status)),
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

function StatusLine() {
  const asrStatus = useAppStore((s) => s.asrStatus);
  const segment = useAppStore((s) => s.segment);
  const preacherName = useAppStore((s) => s.activePreacherName);
  const trust = useAppStore((s) => s.trustLowerBound);

  const listening = asrStatus === 'listening';

  return (
    <div className="text-xs uppercase tracking-widest text-neutral-400">
      <span className={listening ? 'text-accent' : ''}>
        <span aria-hidden="true">● </span>
        {asrStatus}
      </span>
      {segment && <span> · {segment.type}</span>}
      {preacherName && <span> · {preacherName}</span>}
      {trust != null && <span> · trust {pct(trust)}</span>}
    </div>
  );
}

export default function App() {
  useEngineWiring();
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-4xl px-6 pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
          <nav className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
            {TABS.map((t, i) => (
              <span key={t.id} className="flex items-baseline gap-x-2">
                {i > 0 && <span className="text-neutral-300">·</span>}
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`text-xs uppercase tracking-widest underline-offset-4 hover:underline ${
                    tab === t.id ? 'font-semibold text-accent' : 'text-ink'
                  }`}
                >
                  {t.label}
                </button>
              </span>
            ))}
          </nav>
          <StatusLine />
        </div>
        <div className="mt-6 border-b border-hairline" />
        {!hasEngine() && (
          <p className="mt-4 text-sm italic text-neutral-400">
            engine not connected — running outside Electron; controls are inert
          </p>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-12">
        {tab === 'live' && <Live />}
        {tab === 'bible' && <Bible />}
        {tab === 'schedule' && <Schedule />}
        {tab === 'preachers' && <Preachers />}
        {tab === 'notes' && <Notes />}
        {tab === 'settings' && <Settings />}
        {tab === 'cloud' && <Cloud />}
      </main>
    </div>
  );
}
