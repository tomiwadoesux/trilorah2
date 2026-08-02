import type { ComponentType } from 'react';
import { ColorTokens, Typography, SpacingRadius, Motion } from './entries/foundations';
import { Buttons, Panels, Pills, Meters, FormsAndEmpty, OutputSurface } from './entries/primitives';
import { TriButton, TriSlider, TriDashboardButton } from './entries/trilorah';

/*
 * The gallery's table of contents.
 *
 * Adding a component to the library means adding one entry here — the nav,
 * routing and deep-link all read from this list. Ids match
 * design/UI-INVENTORY.md so the two never drift.
 */

export interface Entry {
  /** Inventory id — used as the URL hash. */
  id: string;
  title: string;
  Component: ComponentType;
}

export interface EntryGroup {
  title: string;
  /** Progress hint shown in the nav — built / total from the inventory. */
  total: number;
  entries: Entry[];
}

export const REGISTRY: EntryGroup[] = [
  {
    // Built from the Figma file. These supersede the greyscale baseline
    // sheets further down, which document what ui.tsx ships today.
    title: 'Trilorah',
    total: 181,
    entries: [
      { id: 'C-01', title: 'Button', Component: TriButton },
      { id: 'C-20', title: 'Slider', Component: TriSlider },
      { id: 'D-111', title: 'Dashboard row', Component: TriDashboardButton },
    ],
  },
  {
    title: 'Foundations',
    total: 15,
    entries: [
      { id: 'F-01', title: 'Colour tokens', Component: ColorTokens },
      { id: 'F-03', title: 'Type scale', Component: Typography },
      { id: 'F-04', title: 'Spacing & radius', Component: SpacingRadius },
      { id: 'F-08', title: 'Motion', Component: Motion },
    ],
  },
  {
    // The greyscale surface ui.tsx ships today — kept as a reference for
    // what each component has to replace. Ids are tilde-prefixed so they
    // do not collide with the real inventory ids above.
    title: 'Baseline · ui.tsx',
    total: 11,
    entries: [
      { id: '~C-01', title: 'Button', Component: Buttons },
      { id: '~C-19', title: 'Toggle, Field, Empty', Component: FormsAndEmpty },
      { id: '~C-27', title: 'Panel', Component: Panels },
      { id: '~C-43', title: 'Pill / Badge', Component: Pills },
      { id: '~D-03', title: 'Meters', Component: Meters },
    ],
  },
  {
    title: 'Output',
    total: 11,
    entries: [{ id: 'O-01', title: 'Scripture slide', Component: OutputSurface }],
  },
];

export const ALL_ENTRIES: Entry[] = REGISTRY.flatMap((g) => g.entries);

export function findEntry(id: string | null): Entry {
  return ALL_ENTRIES.find((e) => e.id === id) ?? ALL_ENTRIES[0];
}
