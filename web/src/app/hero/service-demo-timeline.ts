/** One clock replays native operator actions. No microphone or desktop engine. */
export const DEMO_DURATION_MS = 82_000;
export const DEMO_CLICK_MS = 650;
export type DemoActor = 'circle' | 'triangle' | 'box';
export type DemoChapter = 'songs' | 'sermon' | 'images' | 'slides';
export type DemoPhase = 'idle' | 'song-ready' | 'song-found' | 'song-staged'
  | 'song-live' | 'song-finished' | 'song-cleared' | 'sermon' | 'reference-ready' | 'reference-find'
  | 'verse-live' | 'next-ready' | 'next-live' | 'last-caught' | 'last-staged'
  | 'last-live' | 'closing' | 'image-ready' | 'image-section' | 'image-staged'
  | 'image-live' | 'slides-section' | 'slide-staged' | 'slide-live';
export interface DemoCue {
  id: string;
  actor: DemoActor;
  selector: string | null;
  at: number;
  clickAt?: number;
  /** Fraction inside the target, or viewport when parked. This is the eye hotspot. */
  anchor?: [number, number];
}
export interface DemoState {
  elapsed: number;
  phase: DemoPhase;
  chapter: DemoChapter;
  title: string;
  phaseStartedAt: number;
  captionDuration: number;
  actors: Record<DemoActor, DemoCue>;
  clicks: DemoCue[];
  complete: boolean;
}
export const DEMO_CHAPTERS = [
  { id: 'songs', label: 'Songs', at: 0 },
  { id: 'sermon', label: 'Sermon', at: 16_500 },
  { id: 'images', label: 'Images', at: 63_500 },
  { id: 'slides', label: 'Slides', at: 72_700 },
] as const;
const listen = '[data-guide="listen"]';
const songSearch = '[data-guide="catches-song-search"]';
const goLive = '[data-guide="go-live"]';
const output = '[data-guide-area="live"]';
export const DEMO_CUES: readonly DemoCue[] = [
  { id: 'circle-rest', actor: 'circle', selector: null, anchor: [.17, .08], at: 0 },
  { id: 'triangle-rest', actor: 'triangle', selector: null, anchor: [.46, .027], at: 0 },
  { id: 'box-rest', actor: 'box', selector: output, anchor: [.95, .07], at: 0 },
  { id: 'listen', actor: 'circle', selector: listen, at: 900, clickAt: 1500 },
  { id: 'listener-working', actor: 'circle', selector: '[data-guide="transcript-open-header"]', anchor: [.94, .5], at: 2100 },
  { id: 'song-search-on', actor: 'triangle', selector: songSearch, at: 5300, clickAt: 5900 },
  { id: 'select-song', actor: 'triangle', selector: '.catch-spot.is-song', anchor: [.5, .34], at: 8500, clickAt: 9100 },
  { id: 'send-song', actor: 'box', selector: goLive, at: 9000, clickAt: 9700 },
  { id: 'song-operator-rest', actor: 'triangle', selector: null, anchor: [.46, .027], at: 9400 },
  { id: 'song-delivered', actor: 'box', selector: output, anchor: [.95, .07], at: 10_300 },
  { id: 'song-search-off', actor: 'triangle', selector: songSearch, at: 14_000, clickAt: 14_600 },
  // The native clear control removes the matching song from preview and live together.
  { id: 'clear-song', actor: 'triangle', selector: '[data-guide="preview-unstage"]', at: 14_850, clickAt: 15_450 },
  { id: 'sermon-operator-rest', actor: 'triangle', selector: null, anchor: [.46, .027], at: 16_050 },
  { id: 'find-reference', actor: 'triangle', selector: '[data-guide="catches-find"]', at: 31_000, clickAt: 31_600 },
  { id: 'send-found-reference', actor: 'box', selector: '[data-guide="find-card"]', anchor: [.55, .45], at: 34_300, clickAt: 34_900 },
  { id: 'reference-operator-rest', actor: 'triangle', selector: null, anchor: [.46, .027], at: 34_450 },
  { id: 'first-verse-delivered', actor: 'box', selector: output, anchor: [.95, .07], at: 35_400 },
  { id: 'next-verse', actor: 'triangle', selector: '[data-guide="preview-step-next"]', anchor: [.94, .5], at: 43_000, clickAt: 43_600 },
  { id: 'next-verse-operator-rest', actor: 'triangle', selector: null, anchor: [.46, .027], at: 44_200 },
  { id: 'select-last-reference', actor: 'triangle', selector: '.catch-spot.is-pressable', anchor: [.5, .34], at: 54_700, clickAt: 55_300 },
  { id: 'send-last-verse', actor: 'box', selector: goLive, at: 55_100, clickAt: 55_900 },
  { id: 'last-verse-operator-rest', actor: 'triangle', selector: null, anchor: [.46, .027], at: 55_600 },
  { id: 'last-verse-delivered', actor: 'box', selector: output, anchor: [.95, .07], at: 56_500 },
  { id: 'open-images', actor: 'triangle', selector: '[data-guide="run-section-image"]', at: 64_600, clickAt: 65_200 },
  { id: 'choose-image', actor: 'triangle', selector: '[data-guide="run-item-open"]', at: 66_600, clickAt: 67_200 },
  { id: 'send-image', actor: 'box', selector: goLive, at: 66_900, clickAt: 67_700 },
  { id: 'image-operator-rest', actor: 'triangle', selector: null, anchor: [.46, .027], at: 67_500 },
  { id: 'image-delivered', actor: 'box', selector: output, anchor: [.95, .07], at: 68_300 },
  { id: 'open-slides', actor: 'triangle', selector: '[data-guide="run-section-slides"]', at: 73_600, clickAt: 74_200 },
  { id: 'choose-slide', actor: 'triangle', selector: '[data-guide="run-item-open"]', at: 75_400, clickAt: 76_000 },
  { id: 'send-slide', actor: 'box', selector: goLive, at: 75_700, clickAt: 76_500 },
  { id: 'slide-operator-rest', actor: 'triangle', selector: null, anchor: [.46, .027], at: 76_300 },
  { id: 'slide-delivered', actor: 'box', selector: output, anchor: [.95, .07], at: 77_100 },
];
const click = (id: string) => DEMO_CUES.find(cue => cue.id === id)!.clickAt!;
interface PhaseStep { phase: DemoPhase; at: number; title: string; captionDuration?: number }
const PHASES: readonly PhaseStep[] = [
  { phase: 'idle', at: 0, title: 'A service, in motion' },
  { phase: 'song-ready', at: click('listen'), title: 'Listening to the service', captionDuration: 3500 },
  { phase: 'song-found', at: click('song-search-on'), title: 'Amazing Grace · song found' },
  { phase: 'song-staged', at: click('select-song'), title: 'Amazing Grace · ready to present' },
  { phase: 'song-live', at: click('send-song'), title: 'Amazing Grace · on screen' },
  { phase: 'song-finished', at: click('song-search-off'), title: 'The service continues' },
  { phase: 'song-cleared', at: click('clear-song'), title: 'Ready for the message' },
  { phase: 'sermon', at: 16_500, title: 'Be still · listening', captionDuration: 7800 },
  { phase: 'reference-ready', at: 25_000, title: 'God is our refuge and strength', captionDuration: 5200 },
  { phase: 'reference-find', at: click('find-reference'), title: 'Psalm 46:1 · reference found' },
  { phase: 'verse-live', at: click('send-found-reference'), title: 'Psalm 46:1 · on screen' },
  { phase: 'next-ready', at: 40_000, title: 'Next verse', captionDuration: 2800 },
  { phase: 'next-live', at: click('next-verse'), title: 'Psalm 46:2 · on both screens' },
  { phase: 'last-caught', at: 51_000, title: 'Psalm 46:10 · reference caught', captionDuration: 3400 },
  { phase: 'last-staged', at: click('select-last-reference'), title: 'Be still · ready to present' },
  { phase: 'last-live', at: click('send-last-verse'), title: 'Psalm 46:10 · on screen' },
  { phase: 'closing', at: 57_500, title: 'We do not have to carry everything alone', captionDuration: 5000 },
  { phase: 'image-ready', at: 63_500, title: 'Images · open the section' },
  { phase: 'image-section', at: click('open-images'), title: 'Choose an image from the run' },
  { phase: 'image-staged', at: click('choose-image'), title: 'Image · ready to present' },
  { phase: 'image-live', at: click('send-image'), title: 'Image · on screen' },
  { phase: 'slides-section', at: click('open-slides'), title: 'Choose a slide from the run' },
  { phase: 'slide-staged', at: click('choose-slide'), title: 'Be still · slide preview' },
  { phase: 'slide-live', at: click('send-slide'), title: 'Be still · slide on screen' },
];
export function getDemoState(ms: number): DemoState {
  const elapsed = Math.max(0, Math.min(DEMO_DURATION_MS, Number.isFinite(ms) ? ms : 0));
  let phase = PHASES[0];
  for (const step of PHASES) { if (step.at > elapsed) break; phase = step; }
  let chapter: DemoChapter = 'songs';
  for (const item of DEMO_CHAPTERS) if (item.at <= elapsed) chapter = item.id;
  const actors = {} as Record<DemoActor, DemoCue>;
  for (const cue of DEMO_CUES) { if (cue.at > elapsed) break; actors[cue.actor] = cue; }
  return {
    elapsed, phase: phase.phase, chapter, title: phase.title, phaseStartedAt: phase.at,
    captionDuration: phase.captionDuration ?? 0, actors,
    clicks: DEMO_CUES.filter(cue => cue.clickAt !== undefined && elapsed >= cue.clickAt && elapsed < cue.clickAt + DEMO_CLICK_MS),
    complete: elapsed >= DEMO_DURATION_MS,
  };
}
