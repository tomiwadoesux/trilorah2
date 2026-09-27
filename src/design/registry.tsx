import type { ComponentType } from 'react';
import { ColorTokens, Typography, SpacingRadius, Motion } from './entries/foundations';
import { Buttons, Panels, Pills, Meters, FormsAndEmpty, OutputSurface } from './entries/primitives';
import { TriThinkingOrb } from './entries/orbs';
import { TriThinkingOrb2 } from './entries/orbs2';
import { HeardStack } from './entries/heardStack';
import { TriTranscript } from './entries/transcript';
import { EmptyStates } from './entries/emptyStates';
import { MotionLibrary } from './entries/motion/MotionLibrary';
import { TriButton, TriSlider, TriDashboardButton, TriDisplayFontPicker, TriTextPositionPicker, TriSelect, TriSegmentedControl, TriScriptureReferenceInput, TriTypeScale, TriSurfaceTones } from './entries/trilorah';

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
      { id: 'F-02', title: 'Type scale', Component: TriTypeScale },
      { id: 'F-05', title: 'Surface tones', Component: TriSurfaceTones },
      { id: 'C-01', title: 'Button', Component: TriButton },
      { id: 'C-04', title: 'Segmented control', Component: TriSegmentedControl },
      { id: 'C-05', title: 'Display font', Component: TriDisplayFontPicker },
      { id: 'C-06', title: 'Text position', Component: TriTextPositionPicker },
      { id: 'C-07', title: 'Text effect select', Component: TriSelect },
      { id: 'C-08', title: 'Scripture reference input', Component: TriScriptureReferenceInput },
      { id: 'C-20', title: 'Slider', Component: TriSlider },
      { id: 'C-65', title: 'Thinking orb', Component: TriThinkingOrb },
      { id: 'C-65b', title: 'Thinking orb 2', Component: TriThinkingOrb2 },
      { id: 'D-111', title: 'Dashboard row', Component: TriDashboardButton },
      { id: 'D-27', title: 'Live transcript', Component: TriTranscript },
      { id: 'D-30', title: 'Empty states', Component: EmptyStates },
      { id: 'M-01', title: 'Motion library', Component: MotionLibrary },
      { id: 'S-02d+', title: 'Multiple detections', Component: HeardStack },
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
