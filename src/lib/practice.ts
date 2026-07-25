/**
 * Operator practice mode — replays a scripted mini-service through the real
 * engine via `process-text`, exactly as if ASR had heard the preacher. The
 * engine detects segments, verses, and quotes for real; only the audio is
 * simulated. Coach lines tell the trainee what to watch for and do.
 *
 * The driver lives at module scope so practice survives tab switches; the
 * UI observes it through liveStore.practice.
 */

import { useLiveStore } from '../stores/liveStore';
import { useAppStore } from '../stores/appStore';

interface PracticeStep {
  /** Pause before this step fires, in ms. */
  delayMs: number;
  /** Sent to the engine as heard speech. */
  say?: string;
  /** Shown to the trainee in the practice banner. */
  coach?: string;
}

/**
 * Phrases chosen to match electron/agent/transition-phrases.json so segment
 * detection fires for real. Verse references use digits, matching what ASR
 * providers emit.
 */
const SCRIPT: PracticeStep[] = [
  { delayMs: 0, coach: 'Welcome to practice. A simulated service is starting — nothing goes to the cloud or any output you haven’t opened. Watch the transcript begin.' },
  { delayMs: 2500, say: 'Good morning church, it is so good to see everyone here today.' },
  { delayMs: 4000, say: "Let's sing together as we enter into worship this morning.", coach: 'That phrase should flip the segment to WORSHIP — watch the service order panel on the left.' },
  { delayMs: 6000, say: 'What a mighty God we serve, what a mighty God we serve.' },
  { delayMs: 5000, say: 'Amen, you may be seated. A few announcements before we continue.', coach: 'Segment should move to ANNOUNCEMENTS.' },
  { delayMs: 5000, say: 'Mark your calendars, the community dinner is this coming week on Thursday.' },
  { delayMs: 5000, say: "That's all the announcements. Now let's go to the word. Open your bibles, turn with me to John chapter 3 verse 16.", coach: 'A verse is coming. It should appear in PREVIEW — press PUSH TO LIVE when you’re confident it’s right.' },
  { delayMs: 9000, say: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', coach: 'The preacher is reading the verse — this is the quote matcher’s moment. If the verse isn’t live yet, push it now.' },
  { delayMs: 8000, say: 'And church, hold on to Romans chapter 8 verse 28, we will come back to that in a moment.', coach: 'A "we’ll come back to it" mention — this should land in the QUEUE panel (mentioned, not shown), not on screen. Show it later with SHOW NOW.' },
  { delayMs: 8000, say: 'You see, the love of God is not something we earn. It is something we receive.' },
  { delayMs: 6000, say: 'Now go back with me to what Paul said, Romans chapter 8 and verse 28.', coach: 'The queued verse is being called up. If the engine hesitates, use SHOW NOW on the queue item — that’s your job in a real service.' },
  { delayMs: 8000, say: 'And we know that all things work together for good to them that love God.' },
  { delayMs: 6000, say: 'Let us pray. Father we come before you and we thank you for your word.', coach: 'PRAYER should begin — the display is suppressed automatically. Notice the prayer badge in the status bar.' },
  { delayMs: 7000, say: 'We ask it all in your precious name. Amen.', coach: 'Prayer ends on "amen" — display behavior returns to normal.' },
  { delayMs: 5000, say: 'As we close, the Lord bless you and keep you. Have a blessed week, church.', coach: 'Segment should reach CLOSING. When it does, press END SERVICE to try the review ritual — confirm or reject what the engine detected. Your answers are how it learns.' },
  { delayMs: 4000, coach: 'Practice script finished. Try END SERVICE to walk the review, or press STOP PRACTICE to reset.' },
];

let timer: number | null = null;
let running = false;

function totalSteps(): number {
  return SCRIPT.length;
}

export function isPracticeRunning(): boolean {
  return running;
}

export function startPractice(): void {
  if (running) return;
  running = true;

  let index = 0;
  const advance = () => {
    if (!running) return;
    if (index >= SCRIPT.length) {
      // Leave the final coach line on screen; the operator stops explicitly.
      return;
    }
    const step = SCRIPT[index];
    timer = window.setTimeout(() => {
      if (!running) return;
      if (step.say) window.api?.sendText(step.say);
      const live = useLiveStore.getState();
      const coach = step.coach ?? live.practice?.coach ?? '';
      live.setPractice({ step: index + 1, total: totalSteps(), coach });
      index += 1;
      advance();
    }, step.delayMs);
  };

  useLiveStore.getState().setPractice({ step: 0, total: totalSteps(), coach: 'Starting practice…' });
  advance();
}

export function stopPractice(): void {
  running = false;
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
  const live = useLiveStore.getState();
  live.setPractice(null);
  // Clear anything the rehearsal left on the operator surface.
  live.setPreview(null);
  live.setLive(null);
  useAppStore.getState().setPrayerMode(false);
}
