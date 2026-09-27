/*
 * What the outputs card knows about a screen.
 *
 * One shape, three designs (./styles). The engine already owns every field
 * here — electron/output/outputState.ts has the roles and the screen state,
 * electron/output/displays.ts decides which physical display each output
 * lands on, and `get-displays-status` reports what is actually plugged in.
 * Nothing in this file is invented for the picture.
 */

/** The job an output does. Mirrors OutputRole in electron/output/outputState.ts. */
export type Role = 'projector' | 'stream' | 'stage' | 'timer';

/** What the screen is doing right now. Mirrors ScreenState. */
export type ScreenState = 'live' | 'clear' | 'black' | 'logo';

export interface Screen {
  /** Output id — 'main' | 'alternate' | 'third' | 'timer'. */
  id: string;
  role: Role;
  /** The display it landed on: "Epson EB-2247U", "built-in". */
  display: string;
  /** Pixels, as the operator would say them. Null when nothing is plugged in. */
  size: { w: number; h: number } | null;
  /**
   * No display of its own, so it is a window on the operator's laptop —
   * placeOutput's fallback. A real state, not an error, and the one the
   * card exists to make obvious before a service rather than during one.
   */
  windowed: boolean;
  /** Per-output, because clearing the wall must not clear the stage monitor. */
  state: ScreenState;
}

/* ------------------------------------------------------------------ */
/* Words                                                               */
/* ------------------------------------------------------------------ */

/**
 * The role, in the words a volunteer uses for it. ROLE_TITLES in the engine
 * is longer and more formal ("Main Display Output") because it names a
 * window in the OS; a card read from eight feet away needs one word.
 */
export const ROLE_NAME: Record<Role, string> = {
  projector: 'projector',
  stream: 'stream',
  stage: 'stage',
  timer: 'timer',
};

/** Who is looking at it — the thing that actually distinguishes the roles. */
export const ROLE_AUDIENCE: Record<Role, string> = {
  projector: 'the congregation',
  stream: 'people watching online',
  stage: 'the preacher',
  timer: 'the preacher',
};

/** What it shows, for the row that has room to say it. */
export const ROLE_SHOWS: Record<Role, string> = {
  projector: 'verse, full screen, over the theme',
  stream: 'lower third on a clear background',
  stage: 'verse, clock, and what is queued next',
  timer: 'time left, nothing else',
};

export const STATE_WORD: Record<ScreenState, string> = {
  live: 'live',
  clear: 'cleared',
  black: 'black',
  logo: 'logo',
};

/**
 * The palette the rest of the dashboard already speaks (ConnectionsTile,
 * ReadinessTile). Live is mint because live is the good state here — this
 * is not an alarm board, it is a "yes, the wall is on" board.
 */
export const MINT = '#8fd3c0';
export const GOLD = '#e4d87a';
export const ROSE = '#eac7c6';
export const MUTED = 'rgb(229 243 242 / 0.45)';
export const FAINT = 'rgb(229 243 242 / 0.3)';

export const STATE_INK: Record<ScreenState, string> = {
  live: MINT,
  clear: GOLD,
  black: FAINT,
  logo: FAINT,
};

export const STATE_TONE: Record<ScreenState, 'ok' | 'warn' | 'danger' | 'idle'> = {
  live: 'ok',
  clear: 'warn',
  black: 'idle',
  logo: 'idle',
};

/* ------------------------------------------------------------------ */
/* Sample                                                             */
/* ------------------------------------------------------------------ */

/*
 * A four-screen Sunday: the wall, the stream feed, the stage monitor, and a
 * timer that has no display left over so it is still a window on the
 * laptop. The windowed one is in the sample on purpose — it is the case the
 * card has to make impossible to miss, so every design gets judged on it.
 */
export const SAMPLE: Screen[] = [
  { id: 'main', role: 'projector', display: 'Epson EB-2247U', size: { w: 1920, h: 1080 }, windowed: false, state: 'live' },
  { id: 'alternate', role: 'stream', display: 'BlackMagic HDMI', size: { w: 1920, h: 1080 }, windowed: false, state: 'live' },
  { id: 'third', role: 'stage', display: 'Dell P2419H', size: { w: 1920, h: 1080 }, windowed: false, state: 'clear' },
  { id: 'timer', role: 'timer', display: 'no screen — on this laptop', size: null, windowed: true, state: 'live' },
];

export interface OutputsFace {
  screens: Screen[];
  /** Sets a screen's role, or cycles it when none is given. Absent on a
      read-only rendering. */
  onRole?: (id: string, role?: Role) => void;
  /** The whole card, pressed — where the settings box would open. */
  onOpen?: () => void;
  className?: string;
}
