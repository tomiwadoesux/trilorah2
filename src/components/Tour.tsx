import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { TabId } from '../stores/appStore';
import { Button, TextButton } from './ui';
import { startPractice } from '../lib/practice';

/**
 * Guided onboarding — dims the app and spotlights one control at a time,
 * switching tabs as it goes. Auto-opens on first launch (onboardingDone
 * setting) and replays any time from the HOW TO USE button in the header.
 * Targets are anchored by data-tour attributes so steps survive restyles.
 */

interface TourStep {
  /** Tab to show before spotlighting; null keeps the current tab. */
  tab: TabId | null;
  /** data-tour anchor; null renders a centered card over a full dim. */
  target: string | null;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    tab: 'live',
    target: null,
    title: 'Welcome to Trilorah',
    body: 'Trilorah listens to the service, detects the scriptures being preached, and puts them on screen — you stay in control. This one-minute tour shows where everything lives. You can replay it anytime from HOW TO USE in the top bar.',
  },
  {
    tab: 'live',
    target: 'tabs',
    title: 'The tabs',
    body: 'Everything is one click away: LIVE runs the service; SONGS, MEDIA, and THEMES hold your library; PREACHERS tracks how well the engine knows each preacher; SETTINGS and CLOUD connect the rest.',
  },
  {
    tab: 'live',
    target: 'service-order',
    title: 'Service order',
    body: 'The plan for the service. The engine hears transitions — "let\'s sing", "open your bibles" — and highlights the segment you\'re in automatically. Edit the order in the SCHEDULE tab.',
  },
  {
    tab: 'live',
    target: 'start-listening',
    title: 'Start listening',
    body: 'Press this when the service begins. Pick the right microphone next to it — use the soundboard feed, not the laptop mic. The meter shows the engine can hear.',
  },
  {
    tab: 'live',
    target: 'transcript',
    title: 'Live transcript',
    body: 'Every word, as it\'s heard. The freshest words are dark; older ones fade. If the transcript stops moving, check the mic and the meter in the bottom bar.',
  },
  {
    tab: 'live',
    target: 'preview',
    title: 'Preview — your checkpoint',
    body: 'Detected verses land here first, not on the screen. If it\'s right, hit PUSH TO LIVE. If not, DISMISS it. As trust in a preacher grows, verses can start going live automatically.',
  },
  {
    tab: 'live',
    target: 'output',
    title: 'What the church sees',
    body: 'A miniature of the projector. Open the real screens with MAIN, STREAM, or STAGE. SHOW QR puts the companion code on screen so the congregation can follow along on their phones. CLEAR takes everything down.',
  },
  {
    tab: 'live',
    target: 'queue',
    title: 'Mentioned, not shown',
    body: 'When the preacher says "hold on to Romans 8:28, we\'ll come back to it", the verse waits here instead of interrupting. When they come back to it, press SHOW NOW.',
  },
  {
    tab: 'live',
    target: 'end-service',
    title: 'End service',
    body: 'After the benediction, end the service and walk the review: confirm, reject, or amend anything the engine was unsure about. Two minutes of answers is how it gets smarter every week.',
  },
  {
    tab: 'live',
    target: 'practice',
    title: 'Practice room',
    body: 'A simulated sermon runs through the real engine — verses appear, segments change, prayer suppresses the display — and a coach tells you what to do. Perfect for training a new volunteer before Sunday. Nothing is recorded.',
  },
  {
    tab: 'preachers',
    target: 'preacher-profiles',
    title: 'One profile per preacher',
    body: 'The engine learns each preacher separately — their favorite verses, how they call references. Each profile shows a trust meter and what\'s left before verses can go live without you.',
  },
  {
    tab: 'settings',
    target: 'settings-keys',
    title: 'Keys and connections',
    body: 'Transcription needs a Deepgram key (or local Whisper). Further down: your default microphone, OBS Studio and vMix connections, and the Stream Deck control address.',
  },
  {
    tab: 'cloud',
    target: 'cloud-status',
    title: 'Cloud & the companion page',
    body: 'Sign in to your church account and every service syncs — transcript, verses, and notes appear on your church dashboard and on the public page congregants open from the QR code.',
  },
  {
    tab: 'live',
    target: null,
    title: 'You\'re ready',
    body: 'That\'s the whole surface. The best next step is a practice run — the coach walks you through a full mini-service with nothing at stake.',
  },
];

const CARD_W = 380;

export function Tour() {
  const step = useAppStore((s) => s.tourStep);
  const setStep = useAppStore((s) => s.setTourStep);
  const setTab = useAppStore((s) => s.setTab);
  const patchSetting = useAppStore((s) => s.patchSetting);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const current = step != null ? STEPS[step] : undefined;
  const target = current?.target ?? null;
  const tab = current?.tab ?? null;

  useEffect(() => {
    if (current == null) return;
    if (tab) setTab(tab);
    setRect(null);
    if (!target) return;

    let cancelled = false;
    let tries = 0;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: 'nearest' });
        setRect(el.getBoundingClientRect());
      } else if (tries++ < 30) {
        // The tab may still be mounting — try again next frame.
        requestAnimationFrame(find);
      }
    };
    requestAnimationFrame(find);
    const onResize = () => {
      tries = 0;
      find();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
    };
  }, [step, current, tab, target, setTab]);

  if (step == null || current == null) return null;

  const close = () => {
    setStep(null);
    patchSetting('onboardingDone', true);
    void window.api?.setSetting('onboardingDone', true).catch(() => undefined);
  };

  const practiceAndClose = () => {
    close();
    setTab('live');
    startPractice();
  };

  const last = step === STEPS.length - 1;
  const spotlit = target != null && rect != null;

  // Card below the target when there's room, above otherwise; always on-screen.
  const cardStyle: React.CSSProperties = spotlit
    ? {
        width: CARD_W,
        left: Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - CARD_W - 16)),
        ...(window.innerHeight - rect.bottom > 260
          ? { top: rect.bottom + 14 }
          : { top: Math.max(16, rect.top - 14), transform: 'translateY(-100%)' }),
      }
    : { width: CARD_W, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="fixed inset-0 z-40">
      {spotlit ? (
        <div
          className="pointer-events-none fixed rounded-lg transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(20, 20, 20, 0.55)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink/55" />
      )}

      <div className="fixed rounded-md border border-ink bg-surface p-5 shadow-xl" style={cardStyle}>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          step {step + 1} of {STEPS.length}
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight">{current.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{current.body}</p>
        <div className="mt-4 flex items-center justify-between gap-x-4">
          <TextButton label="SKIP TOUR" onClick={close} />
          <div className="flex items-center gap-x-3">
            {step > 0 && <Button label="Back" onClick={() => setStep(step - 1)} />}
            {last ? (
              <>
                <Button label="Finish" onClick={close} />
                <Button label="Start practice" variant="solid" onClick={practiceAndClose} />
              </>
            ) : (
              <Button label="Next" variant="solid" onClick={() => setStep(step + 1)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
