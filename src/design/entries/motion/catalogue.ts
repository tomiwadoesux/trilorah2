/*
 * The yui540 catalogue, as data.
 *
 * Source: github.com/yui540/css-animations (MIT, © 2026 yui540). The files
 * themselves are copied under design/motion/yui540/ with the licence. This
 * is the index the sandbox page reads — what each one does, and, the part
 * that matters for us, WHERE IN THIS APP IT COULD GO.
 *
 * The `fits` field is the whole point of the page. Every one of these is a
 * real waiting or empty moment somewhere in Trilorah, so the question a
 * motion has to answer is not "is it nice" but "is it the right tenor for
 * the thing the operator is waiting on". A confetti burst suits a verse
 * landing on the wall; it does not suit a Whisper model downloading.
 */

export type Tenor =
  /* Something is genuinely in flight and will finish. A progress-shaped
     loop is CORRECT here — this is the one family where a spinner is not
     a lie. */
  | 'loading'
  /* Ready and unused. Must never resolve — see D-30's waiting-not-loading
     rule; these are the empty states the app already has. */
  | 'waiting'
  /* A thing just happened, once. Fires and is done. */
  | 'event'
  /* Moving between two screens or two states. */
  | 'transition';

export interface Motion {
  /** Catalogue number from the source README. */
  n: number;
  name: string;
  /** Path under design/motion/yui540/. */
  file: string;
  tenor: Tenor;
  loops: boolean;
  /** Roughly, for the once-through ones. */
  seconds?: number;
  /** What actually happens on screen. */
  what: string;
  /** The CSS/SVG techniques worth stealing. */
  how: string[];
  /** Where in Trilorah this could live. The reason the page exists. */
  fits: string[];
}

export const MOTIONS: Motion[] = [
  /* ---------------------------------------------------------------- */
  /* The signature set — four scene wipes in one reel                  */
  /* ---------------------------------------------------------------- */
  {
    n: 1,
    name: 'Signature transitions',
    file: 'source/2025-02-25/index.html',
    tenor: 'transition',
    loops: false,
    seconds: 9.6,
    what:
      'Four full-screen scene wipes played back to back over a title reveal — a slide, a mask, an arrow and a run of staggered blocks.',
    how: [
      'clip-path and mask for the wipes rather than resizing anything',
      'nth-child stagger across the block wipe',
      'cubic-bezier throughout — these are the curves the rest of the repo reuses',
    ],
    fits: [
      'The reference reel for anything full-screen: going to black, a service starting, a theme change on the wall.',
      'Worth watching first — the other 41 are variations on the vocabulary in this one file.',
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Loaders — the five standalone SVGs                                */
  /* ---------------------------------------------------------------- */
  {
    n: 2,
    name: 'Bouncing LOADING text',
    file: 'source/2025-03-11/loading-1.svg',
    tenor: 'loading',
    loops: true,
    what: 'The letters of LOADING hop one after another over three cycling dots.',
    how: ['standalone SVG', 'transform-box: fill-box', 'nth-child delays'],
    fits: [
      'Too literal for this app — it says the word rather than the state.',
      'Kept in the catalogue for the letter-stagger technique, not the glyph.',
    ],
  },
  {
    n: 3,
    name: 'Pulsing dots',
    file: 'source/2025-03-11/loading-2.svg',
    tenor: 'loading',
    loops: true,
    what: 'Two circles scale out from nothing and fade, half a cycle apart.',
    how: ['scale(0) → scale(1) with opacity 1 → 0', 'one 0.5s offset'],
    fits: [
      'The verse-resolution wait: reference heard, database being queried.',
      'A song lyric being fetched from LRCLIB.',
      'Beside "connecting…" on the listen button, at the size of a full stop.',
    ],
  },
  {
    n: 4,
    name: 'Equalizer bars',
    file: 'source/2025-03-11/loading-3.svg',
    tenor: 'loading',
    loops: true,
    what: 'Ten bars rise and fall on two waves — a slow outer one and a fast inner one.',
    how: [
      'per-bar --scale-y and animation-delay via nth-child',
      'TWO animations on nested elements: outer wave on the wrapper, inner on the bar',
    ],
    fits: [
      'The single best fit in the whole set: the catches panel while the engine is listening.',
      'It is literally an audio meter, and that panel is literally waiting on audio.',
      'Would need the app is-listening colour, and the bars slowed right down — see the note on the page.',
    ],
  },
  {
    n: 5,
    name: 'Hourglass',
    file: 'source/2025-03-11/loading-4.svg',
    tenor: 'loading',
    loops: true,
    what: 'An hourglass flips while its sand drains and refills.',
    how: ['SVG mask for the sand level', 'stroke drawing', 'cubic-bezier on the flip'],
    fits: [
      'A long job with no percentage: the Whisper model downloading on first run.',
      'Exporting sermon notes.',
      'Says "this will take a while" better than a spinner does.',
    ],
  },
  {
    n: 6,
    name: 'Sliding pill',
    file: 'source/2025-03-11/loading-5.svg',
    tenor: 'loading',
    loops: true,
    what: 'A pill slides between two ends of a track, squashing as it turns.',
    how: ['transform-box: fill-box', 'scale on the turn — the squash is what sells it'],
    fits: [
      'A toggle mid-flight: the anyone / wifi-only companion switch while the server restarts.',
      'Output role being reassigned between screens.',
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Physics — the once-through basics                                 */
  /* ---------------------------------------------------------------- */
  {
    n: 7,
    name: 'Pop out',
    file: 'source/2026-04-17/tips-1.html',
    tenor: 'event',
    loops: false,
    seconds: 0.6,
    what: 'A ball scales up from nothing, overshoots to 1.2, dips to 0.9, settles at 1.',
    how: [
      'THE squash-and-stretch overshoot: scale(0) → scale(1.2, 1.25) → scale(0.9, 0.95) → scale(1)',
      'x and y scale by DIFFERENT amounts — that inequality is the whole trick',
      'opacity finishes at 20% while transform runs to 100%, in one keyframe block',
    ],
    fits: [
      'A catch landing in the heard stack — the single most-used event in a service.',
      'A verse arriving in preview.',
      'A new log line pushing into notifications.',
    ],
  },
  {
    n: 8,
    name: 'Page peel',
    file: 'source/2026-04-17/tips-2.html',
    tenor: 'transition',
    loops: false,
    seconds: 1.5,
    what: 'A white tile peels away at the corner to reveal what is under it.',
    how: ['border-radius + translate + scale together', 'cubic-bezier'],
    fits: [
      'Revealing the projector output when a verse goes live.',
      'Opening a preacher profile from the tile.',
    ],
  },
  {
    n: 9,
    name: 'Roll',
    file: 'source/2026-04-17/tips-3.html',
    tenor: 'transition',
    loops: false,
    seconds: 0.7,
    what: 'A rounded square rolls across and stops.',
    how: ['translate and rotate in ONE keyframe — the roll is the two locked together'],
    fits: [
      'A run-of-service segment being dragged into place.',
      'Stepping through song verses.',
    ],
  },
  {
    n: 10,
    name: 'Sudden brake',
    file: 'source/2026-04-17/tips-4.html',
    tenor: 'event',
    loops: false,
    seconds: 1.7,
    what: 'A square slides in fast, tips forward as it stops, and rocks back.',
    how: ['rotate on its own keyframe list, separate from translate', 'hard cubic-bezier'],
    fits: [
      'CLEAR — the panic button. The stop should feel like a stop.',
      'Auto-advance being interrupted by the operator.',
    ],
  },
  {
    n: 11,
    name: 'Balancing blocks',
    file: 'source/2026-04-18/tips-1.html',
    tenor: 'event',
    loops: false,
    seconds: 1.9,
    what: 'A ball, a bar and a ball wobble like a seesaw until they balance.',
    how: ['six coordinated keyframes on three elements'],
    fits: [
      'The trust meter settling after a service — it is literally a balance.',
      'Readiness resolving to "ready for service".',
    ],
  },
  {
    n: 12,
    name: 'Dominoes',
    file: 'source/2026-04-18/tips-2.html',
    tenor: 'transition',
    loops: false,
    seconds: 1.1,
    what: 'Four tiles topple one into the next.',
    how: ['per-tile keyframes with nth-child delays'],
    fits: [
      'A run of service being built — each segment knocking into the next.',
      'Slides advancing through a deck.',
    ],
  },
  {
    n: 13,
    name: 'Swinging tag',
    file: 'source/2026-04-18/tips-3.html',
    tenor: 'event',
    loops: false,
    seconds: 0.8,
    what: 'A tag drops on its string and swings to rest.',
    how: ['translate-x and translate-y as SEPARATE animations, plus a shake'],
    fits: [
      'A preacher pill being assigned to today.',
      'The ON AIR sign coming on.',
    ],
  },
  {
    n: 14,
    name: 'Pop-up stack',
    file: 'source/2026-04-18/tips-4.html',
    tenor: 'event',
    loops: false,
    seconds: 1.0,
    what: 'A block springs up off its base and lands stacked on top.',
    how: ['a jump keyframe and a push keyframe, offset'],
    fits: ['A song being added to the run.', 'A slide being pushed to live.'],
  },

  /* ---------------------------------------------------------------- */
  /* Screen transitions                                                */
  /* ---------------------------------------------------------------- */
  {
    n: 15,
    name: 'Shutter',
    file: 'source/2026-04-22/tips-1.html',
    tenor: 'transition',
    loops: false,
    seconds: 2.0,
    what: 'Slats roll down to cover the screen, then roll back up.',
    how: [
      '--delay per slat via nth-child, read by calc() in the animation shorthand',
      'TWO animations chained: block-in, then block-out at calc(var(--delay) + 1.1s)',
    ],
    fits: [
      'Going to black on the projector — the CLEAR everyone can see.',
      'Switching between operator / dashboard / profile.',
    ],
  },
  {
    n: 16,
    name: 'Stage curtain',
    file: 'source/2026-04-22/tips-2.html',
    tenor: 'transition',
    loops: false,
    seconds: 1.9,
    what: 'Curtains swing closed from both sides, then reopen.',
    how: ['custom properties for the pair', 'matched close/open keyframes'],
    fits: [
      'The most on-theme transition here: a service starting on the wall.',
      'Pre-service screen giving way to the first verse.',
    ],
  },
  {
    n: 17,
    name: 'Paint wipe',
    file: 'source/2026-04-22/tips-3.html',
    tenor: 'transition',
    loops: false,
    seconds: 1.9,
    what: 'Rounded brush strokes paint across the screen, then clear.',
    how: ['calc() stagger', 'rounded stroke ends so it reads as a brush not a bar'],
    fits: ['A theme being applied to the output.', 'Media loading behind a verse.'],
  },
  {
    n: 18,
    name: 'Threads',
    file: 'source/2026-04-22/tips-4.html',
    tenor: 'transition',
    loops: false,
    seconds: 3.0,
    what: 'Lines weave into a grid that fills the screen, then unravel.',
    how: ['20 staggered scale animations', 'cubic-bezier'],
    fits: [
      'The companion QR being generated — a mesh assembling is exactly a QR forming.',
      'Cloud service connecting.',
    ],
  },
  {
    n: 19,
    name: 'Scroll unroll',
    file: 'source/2026-04-25/tips-1.html',
    tenor: 'transition',
    loops: false,
    seconds: 2.7,
    what: 'A scroll unrolls to reveal a title, then rolls away.',
    how: ['line draw + rotate + a text slide, three things timed together'],
    fits: [
      'On-theme for scripture: a passage being revealed on the wall.',
      'Sermon notes being generated.',
    ],
  },
  {
    n: 20,
    name: 'Tumbling bricks',
    file: 'source/2026-04-25/tips-2.html',
    tenor: 'transition',
    loops: false,
    seconds: 2.3,
    what: 'Bricks fall and stack into a wall, then tumble out.',
    how: ['a bounce and a fall keyframe', 'calc() stagger'],
    fits: ['A run of service being imported from a programme file.', 'Bulk song import.'],
  },
  {
    n: 21,
    name: 'Swap',
    file: 'source/2026-04-25/tips-3.html',
    tenor: 'event',
    loops: false,
    seconds: 2.0,
    what: 'A + button flips away as a − slides in, then they swap back.',
    how: ['ONE change keyframe reused by both halves'],
    fits: [
      'Add / remove on a run segment.',
      'The listen button turning into a stop button.',
    ],
  },
  {
    n: 22,
    name: 'Ripple',
    file: 'source/2026-04-25/tips-4.html',
    tenor: 'waiting',
    loops: true,
    what: 'Concentric rings expand and fade, endlessly.',
    how: ['::before and ::after with one 0.4s offset — two elements, no markup'],
    fits: [
      'A waiting state that never resolves: the companion page live and idle.',
      'The mic listening with nothing being said.',
      'Careful: at speed this reads as a spinner. Slowed to 4s+ it reads as a pulse.',
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Shapes and lines                                                  */
  /* ---------------------------------------------------------------- */
  {
    n: 23,
    name: 'Scribble',
    file: 'source/2026-04-29/tips-1.html',
    tenor: 'loading',
    loops: false,
    seconds: 2.5,
    what: 'A line scribbles itself in, then erases from the start.',
    how: [
      'THE line-draw pattern: stroke-dasharray 0 L → L L, where L is path.getTotalLength() hardcoded as --stroke-length',
      'erase by sliding stroke-dashoffset to -L',
      'stroke-width also grows, so the pen presses harder as it goes',
      'two chained animations: draw 1.2s, then clear 1.2s at 1.3s delay',
    ],
    fits: [
      'Directly reusable on D-30: every empty-state drawing is already a dashed hairline.',
      'The sermon-notes outline writing itself as the engine finds points.',
      'A verse reference being resolved, drawn as it is worked out.',
    ],
  },
  {
    n: 24,
    name: 'Pull-cord flip',
    file: 'source/2026-04-29/tips-2.html',
    tenor: 'event',
    loops: false,
    seconds: 3.5,
    what: 'A card on a cord is tugged, flips over, and flips back.',
    how: ['pull, sway and turn as three separate keyframes'],
    fits: ['Flipping a preacher card to its profile.', 'Toggling a theme preview.'],
  },
  {
    n: 25,
    name: 'Fold',
    file: 'source/2026-04-29/tips-3.html',
    tenor: 'transition',
    loops: false,
    seconds: 2.6,
    what: 'A square of four segments unfolds into a line, then folds back.',
    how: ['chained rotate with a moving transform-origin'],
    fits: [
      'The run rail collapsing and expanding.',
      'A segment opening to show its slides.',
    ],
  },
  {
    n: 26,
    name: 'Hop',
    file: 'source/2026-04-29/tips-4.html',
    tenor: 'loading',
    loops: false,
    seconds: 1.3,
    what: 'Three dots squash and hop in a wave.',
    how: ['scale + jump', 'per-dot --delay, --x and --y via nth-child'],
    fits: [
      'The classic three-dot wait, with weight: the transcript pill before the first word.',
      'Anywhere "…" is currently a static ellipsis.',
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Icon micro-interactions                                           */
  /* ---------------------------------------------------------------- */
  {
    n: 27,
    name: 'Expand / shrink',
    file: 'source/2026-05-02/tips-1.html',
    tenor: 'event',
    loops: false,
    seconds: 1.0,
    what: 'Arrows push outward, then pull inward.',
    how: ['one arrow-up and one arrow-down keyframe, mirrored'],
    fits: ['Fullscreen on the projector preview.', 'Expanding a dashboard tile.'],
  },
  {
    n: 28,
    name: 'Dive',
    file: 'source/2026-05-02/tips-2.html',
    tenor: 'event',
    loops: false,
    seconds: 3.6,
    what: 'A bar tips over, a ball squashes flat under it, and pops up the other side.',
    how: ['a rotate chain plus a squash on the ball'],
    fits: ['Pushing a verse from preview to live — the handoff has weight.'],
  },
  {
    n: 29,
    name: 'Download and bar chart',
    file: 'source/2026-05-02/tips-3.html',
    tenor: 'loading',
    loops: false,
    seconds: 1.8,
    what: 'An arrow drops into a tray; chart bars dip and grow back.',
    how: ['nth-child stagger across the bars'],
    fits: [
      'Importing slides or songs.',
      'The recent-services chart filling in after a service — its columns already exist in D-30.',
    ],
  },
  {
    n: 30,
    name: 'Orbit',
    file: 'source/2026-05-02/tips-4.html',
    tenor: 'loading',
    loops: true,
    what: 'Circles orbit a centre, each spinning on its own axis.',
    how: ['nested rotation: the group spins, and each circle counter-spins'],
    fits: [
      'Already in the app: the preachers tile card art is an orbit.',
      'Cloud sync in flight.',
      'The status orb — though that is SvgOrbsPill and settled.',
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Looping objects                                                   */
  /* ---------------------------------------------------------------- */
  {
    n: 31,
    name: 'Tissue box',
    file: 'source/2026-05-14/tips-1.html',
    tenor: 'waiting',
    loops: true,
    what: 'A tissue is pulled up out of the box and pushed back, forever.',
    how: ['clip-path does the reveal, not a resize'],
    fits: [
      'A queue with one item waiting to be taken.',
      'The preview panel holding a staged verse.',
    ],
  },
  {
    n: 32,
    name: 'Zip curtain',
    file: 'source/2026-05-14/tips-2.html',
    tenor: 'waiting',
    loops: true,
    what: 'A zip slides down, the curtain parts, the zip returns.',
    how: ['infinite loop with calc() positions'],
    fits: ['Output being revealed and hidden.', 'A panel opening and closing on a loop.'],
  },
  {
    n: 33,
    name: 'Rolling blocks',
    file: 'source/2026-05-14/tips-3.html',
    tenor: 'waiting',
    loops: true,
    what: 'One block rolls over another, endlessly.',
    how: ['a roll with an inner counter-rotation so the face stays upright'],
    fits: ['Slides cycling in a pre-service loop.', 'Auto-advance running.'],
  },
  {
    n: 34,
    name: 'Headphones',
    file: 'source/2026-05-14/tips-4.html',
    tenor: 'waiting',
    loops: true,
    what: 'Headphones drop onto a head and squeeze to fit.',
    how: ['a move keyframe and a width keyframe'],
    fits: [
      'On-theme for audio: the mic waiting to be picked, or a sound check.',
      'The companion audio player, currently dormant.',
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Like and bookmark — the celebration family                        */
  /* ---------------------------------------------------------------- */
  {
    n: 35,
    name: 'Like 1: confetti',
    file: 'source/2026-06-07/tips-1.html',
    tenor: 'event',
    loops: false,
    seconds: 1.1,
    what: 'A heart fills with a confetti burst and an expanding ring.',
    how: [
      '32 particles, each with its own --x / --y custom property',
      'the ring is a separate scale+fade on one element',
    ],
    fits: [
      'Too loud for a service, and worth saying so: a burst over a verse going live would be wrong.',
      'Defensible once: the first time a preacher reaches auto-ready.',
    ],
  },
  {
    n: 36,
    name: 'Like 2: floating hearts',
    file: 'source/2026-06-07/tips-2.html',
    tenor: 'event',
    loops: false,
    seconds: 1.9,
    what: 'A heart fills and small hearts float away.',
    how: ['SVG hearts with transform-box: fill-box'],
    fits: ['Same caution as the confetti. Technique is the per-particle drift.'],
  },
  {
    n: 37,
    name: 'Like 3: sparkle rays',
    file: 'source/2026-06-07/tips-3.html',
    tenor: 'event',
    loops: false,
    seconds: 1.4,
    what: 'A heart pops with sparkle rays.',
    how: ['line segments sliding outward from a centre'],
    fits: [
      'The quietest of the three, and the only one that could pass: a trust gate being met.',
    ],
  },
  {
    n: 38,
    name: 'Bookmark 1: flip',
    file: 'source/2026-06-08/tips-1.html',
    tenor: 'event',
    loops: false,
    seconds: 3.6,
    what: 'An icon flips in 3D to a filled state with sparkles.',
    how: ['3D rotate', 'clip-path', 'an SVG sparkle'],
    fits: ['Saving a verse to the run.', 'Pinning a song.'],
  },
  {
    n: 39,
    name: 'Bookmark 2: panel sweep',
    file: 'source/2026-06-08/tips-2.html',
    tenor: 'event',
    loops: false,
    seconds: 3.2,
    what: 'A panel sweeps in and a ribbon swings.',
    how: ['clip-path sweep', 'border-radius morph'],
    fits: ['A segment being marked done during a service.'],
  },
  {
    n: 40,
    name: 'Bookmark 3: slide',
    file: 'source/2026-06-08/tips-3.html',
    tenor: 'event',
    loops: false,
    seconds: 3.7,
    what: 'A panel slides across and a ribbon jumps.',
    how: ['clip-path', 'slide in and out'],
    fits: ['Same family. Useful as the quieter save confirmation.'],
  },

  /* ---------------------------------------------------------------- */
  /* Character                                                         */
  /* ---------------------------------------------------------------- */
  {
    n: 41,
    name: 'Walking cat',
    file: 'source/2026-06-09/tips-1.html',
    tenor: 'waiting',
    loops: true,
    seconds: 4.2,
    what: 'A cat walks in with a speed trail, then bobs and breathes in place.',
    how: ['SVG with a blur filter for the trail', 'transform-box', 'a long loop'],
    fits: [
      'Not for a church service — but the BREATHING IDLE is the technique worth taking.',
      'A thing that has arrived and is now waiting is exactly the empty-state problem.',
    ],
  },
  {
    n: 42,
    name: 'Cat and flower',
    file: 'source/2026-06-09/tips-2.html',
    tenor: 'waiting',
    loops: true,
    seconds: 4.1,
    what: 'A stem grows, leaves pop, a flower blooms.',
    how: ['24 keyframes across PNG and SVG parts'],
    fits: [
      'The growth sequence — stem, then leaf, then bloom — is how a sermon outline could build itself.',
      'Trust growing over services.',
    ],
  },
];

export const TENOR_NOTE: Record<Tenor, string> = {
  loading:
    'Something is genuinely in flight and WILL finish. This is the one family where a progress-shaped loop is honest — a spinner here is not a lie.',
  waiting:
    'Ready and unused, with nothing in flight. Must never resolve. This is D-30’s rule: a spinner here says "work is happening" when nothing is.',
  event: 'Happened once. Fires, lands, done. Never loops.',
  transition: 'Moving between two states or two screens. Has a start and an end.',
};
