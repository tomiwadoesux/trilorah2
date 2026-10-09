import type { ComponentType } from 'react';
import { AppShellScreen, APP_SHELL_STATES } from './AppShell';
import { LiveScreen, LIVE_STATES } from './Live';
import { SettingsScreen, SETTINGS_STATES } from './Settings';
import { DashboardProtoScreen, DASHBOARD_PROTO_STATES } from './DashboardProto';
import { PopupsScreen, POPUP_STATES } from './Popups';

/*
 * The Screens surface — the second half of the sandbox.
 *
 * Sheets answer "is this component right". Screens answer "does the app
 * work", which is a different question and needs different chrome: no
 * 240px nav stealing width, one artboard at true app size, and a state bar
 * instead of every-variant-at-once. Fourteen states of S-02 on one page
 * would be 14 × 1400 × 900 and nobody would read it.
 *
 * Ids match design/UI-INVENTORY.md Part 3, so `#S-02` deep-links here for
 * the same reason `#C-07` deep-links to a sheet.
 */

export interface ScreenState {
  /** Inventory id — 'S-02d'. */
  id: string;
  /** Two or three words for the state bar. */
  label: string;
  /** One line under the bar saying what this state is for. */
  note: string;
}

export interface Screen {
  id: string;
  title: string;
  blurb: string;
  states: ScreenState[];
  Component: ComponentType<{ state: string }>;
}

export const SCREENS: Screen[] = [
  {
    id: 'S-01',
    title: 'App Shell',
    blurb: 'The frame every screen lives in — title bar, brand, tab nav, status cluster. It is what decides how much room every other screen actually gets, at whatever window size the church runs.',
    states: APP_SHELL_STATES,
    Component: AppShellScreen,
  },
  {
    id: 'S-02',
    title: 'LIVE',
    blurb: 'The control surface — service order and preacher left, preview and transcript centre, output, queue and log right, transport along the bottom. Fourteen states, one layout.',
    states: LIVE_STATES,
    Component: LiveScreen,
  },
  {
    id: 'S-03',
    title: 'NO NAV (proto)',
    blurb: 'Wireframe. The ten-tab nav is gone; every tab\u2019s work is a card on the dashboard or an action where it belongs, and profile settings sit behind \u2699. Boxes only \u2014 the question is arrangement, not components.',
    states: DASHBOARD_PROTO_STATES,
    Component: DashboardProtoScreen,
  },
  {
    id: 'S-10',
    title: 'SETTINGS',
    blurb: 'Every setting the engine stores today, as thirteen pages behind a vertical nav. One state per page. The question is whether a church can find the one setting they need on a Sunday morning.',
    states: SETTINGS_STATES,
    Component: SettingsScreen,
  },
  {
    id: 'S-18',
    title: 'POPUPS',
    blurb: 'Every popup in the app as an empty frame at its real size, over the ground it opens on. One state per popup; the facts on each frame are what the code does today. Placeholders for the redesign (owner, 2026-10-08) — nothing inside them yet.',
    states: POPUP_STATES,
    Component: PopupsScreen,
  },
];

/** From the inventory: S-01 … S-17. */
export const SCREEN_TOTAL = 18;

/** The id itself carries the surface, so no separate route scheme is needed. */
export function isScreenId(id: string): boolean {
  return /^S-\d/.test(id);
}

/** '#S-02d' → the S-02 screen and its 'd' state. */
export function findScreen(hash: string): { screen: Screen; state: ScreenState } {
  const screen = SCREENS.find((s) => hash.startsWith(s.id)) ?? SCREENS[0];
  const state = screen.states.find((s) => s.id === hash) ?? screen.states[0];
  return { screen, state };
}

export const ALL_SCREEN_STATES: string[] = SCREENS.flatMap((s) => s.states.map((x) => x.id));

export { allSizes, tierForWidth, ArtboardProvider, type ArtboardSize, type ArtboardTier } from './artboard';
