/**
 * How far past zero an overrunning countdown keeps counting before it stops
 * counting and simply says so (owner, 2026-11-22).
 *
 * Ten minutes. Past zero the clock counts up in the red — -0:01, -0:02 — so
 * the preacher can see exactly how far over he is while it still matters.
 * But a number that keeps climbing all afternoon stops being information:
 * at -37:12 nobody is reading the digits, and the screen is just scolding.
 * So the count stops at ten minutes over and the face says the sentence
 * instead (shared/overrunMessage.ts).
 *
 * Lives in shared/ rather than the engine because the renderer needs it too:
 * a face extrapolating between the store's ticks has to stop at the same
 * place the store does, or the number would run past the cap for a second
 * and then snap back. A renderer importing from electron/ would drag
 * main-process code into the browser bundle.
 */

export const OVERRUN_CAP_MS = 10 * 60_000
