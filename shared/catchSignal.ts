/**
 * The three signals a catch can raise (owner, 2026-10-17).
 *
 *   sweep  a reference said    one flash right to left, the edge turns once
 *   buzz   a verse read out    two flashes, the edge pulses twice
 *   slant  a song heard        a flash from the bottom-right corner, the edge
 *                              lit from that corner round to the top left
 *
 * Named here so the app window, the preload and main agree on the words;
 * the drawing itself is src/lib/signalPlayer.ts.
 */

export const CATCH_SIGNALS = ['sweep', 'buzz', 'slant'] as const
export type CatchSignal = (typeof CATCH_SIGNALS)[number]

export const isCatchSignal = (value: unknown): value is CatchSignal =>
  typeof value === 'string' && (CATCH_SIGNALS as readonly string[]).includes(value)

/** How long each one runs, first frame to last. */
export const SIGNAL_MS: Record<CatchSignal, number> = { sweep: 1400, buzz: 1300, slant: 1600 }

/**
 * Where the app window asks for a signal — its own edges, or the whole
 * screen — and where main lets it go: main has the last word, because only
 * main knows which screens the outputs are on. 'none' when the only place
 * left is a screen the congregation can see.
 */
export type SignalRequest = 'window' | 'screen'
export type SignalAnswer = SignalRequest | 'none'
