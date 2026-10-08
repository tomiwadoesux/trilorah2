import type { LiveItem, ScreenState } from '../design/screens/projector';
import { spanKey } from './liveKey';

/*
 * What the preview's ✕ takes away.
 *
 * Always the staged item. The words on the wall as well, but only when the
 * preview is showing what the room is reading — the state after "go live" and
 * after ‹ ›, which put the same item in both boxes. Anything else in the box
 * is the operator's or the engine's next thing: a catch's guess, the next
 * verse of a set the room is not on yet. Throwing that away must not blank the
 * verse the congregation is reading; the LIVE pane's own "clear" is one panel
 * away for that.
 *
 * The wall's clear is the gentle one the LIVE pane already uses: words off,
 * background stays, "restore" brings them back and the next push lifts it.
 * It is taken only while words are actually up: black and logo are holds that
 * only a person lifts, an already-cleared wall stays cleared, and with the
 * themes tab open the preview is a styling canvas, not the service.
 */

export interface PreviewClearInput {
  preview: LiveItem | null;
  live: LiveItem | null;
  screen: ScreenState;
  editingTheme?: boolean;
}

export interface PreviewClearPlan {
  /** Empty the preview box. */
  unstage: boolean;
  /** Also take the words off the wall (screen state 'clear'). */
  clearWall: boolean;
}

/**
 * Do the two boxes hold the same thing? Named the way the projector tells
 * its own push from news (liveKey): by the reading, not its spelling — the
 * phone's ids are "John 3:16–18@KJV", the engine says "Psalms" where the run
 * of service says "Psalm". A translation only counts when both sides name
 * one, because a run line is staged before the engine has picked one.
 */
export function previewIsLive(preview: LiveItem | null, live: LiveItem | null): boolean {
  if (!preview || !live) return false;
  if (spanKey(preview) !== spanKey(live)) return false;
  if (preview.source !== 'scripture') return true;
  const staged = (preview.version ?? '').toUpperCase();
  const onWall = (live.version ?? '').toUpperCase();
  return !staged || !onWall || staged === onWall;
}

export function previewClearPlan({ preview, live, screen, editingTheme }: PreviewClearInput): PreviewClearPlan {
  const unstage = !!preview;
  const clearWall = unstage && !editingTheme && screen === 'live' && previewIsLive(preview, live);
  return { unstage, clearWall };
}
