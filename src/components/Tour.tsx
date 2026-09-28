import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { TabId } from '../stores/appStore';
import { Button, TextButton } from './ui';
import { startPractice } from '../lib/practice';
import { CloseIcon } from '../ui';

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
    body: 'Detected verses land here first — the congregation never sees anything until you press PUSH TO LIVE. Not right? DISMISS it. Once a preacher earns enough trust you can let verses go live automatically.',
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
    title: 'Transcription — free out of the box',
    body: 'Trilorah listens with a free speech engine that runs on this computer — no account, no key. The model downloads itself the first time you press Start Listening. Churches that want faster cloud transcription can switch to Deepgram here.',
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

const CARD_W = 340;

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
    // The app stays interactive during the tour — panels can grow or move
    // under the operator's clicks, so keep the spotlight glued to its target.
    const follow = window.setInterval(() => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (el instanceof HTMLElement) setRect(el.getBoundingClientRect());
    }, 400);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      window.clearInterval(follow);
    };
  }, [step, current, tab, target, setTab]);

  const close = () => {
    setStep(null);
    patchSetting('onboardingDone', true);
    void window.api?.setSetting('onboardingDone', true).catch(() => undefined);
  };

  // Keyboard: → / Enter next, ← back, Esc closes.
  useEffect(() => {
    if (step == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (step < STEPS.length - 1) setStep(step + 1);
        else close();
      } else if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (step == null || current == null) return null;

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
        ...(window.innerHeight - rect.bottom > 240
          ? { top: rect.bottom + 16 }
          : { top: Math.max(16, rect.top - 16), transform: 'translateY(-100%)' }),
      }
    : { width: CARD_W, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    // pointer-events-none: the dim and spotlight never swallow clicks — the
    // operator can actually press the button being described. Only the card
    // itself is interactive.
    <div className="pointer-events-none fixed inset-0 z-40">
      {spotlit ? (
        <div
          className="fixed rounded-lg transition-all duration-300 ease-out"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgba(12, 12, 12, 0.6), 0 0 0 2px var(--color-accent, #16a34a)',
          }}
        >
          <span className="absolute -inset-1 animate-pulse-quiet rounded-lg border border-accent/50" />
        </div>
      ) : (
        <div className="fixed inset-0 bg-ink/60" />
      )}

      <div
        className="pointer-events-auto fixed rounded-lg border border-hairline bg-surface p-5 shadow-2xl transition-all duration-300 ease-out"
        style={cardStyle}
      >
        <h3 className="text-base font-semibold tracking-tight">{current.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{current.body}</p>
        {spotlit && (
          <p className="mt-2 text-[10px] uppercase tracking-widest text-accent">
            the app is live — try the highlighted control
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-x-4">
          <div className="flex items-center gap-x-1.5" aria-label={`step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === step ? 'w-5 bg-accent' : 'w-1.5 bg-neutral-300 hover:bg-neutral-400'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-x-3">
            {step > 0 && <TextButton label="BACK" onClick={() => setStep(step - 1)} />}
            {last ? (
              <>
                <TextButton label="FINISH" onClick={close} />
                <Button label="Start practice" variant="solid" onClick={practiceAndClose} />
              </>
            ) : (
              <Button label="Next" variant="solid" onClick={() => setStep(step + 1)} />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="close tour"
          className="absolute right-3 top-3 text-neutral-400 transition-colors hover:text-ink"
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  );
}
