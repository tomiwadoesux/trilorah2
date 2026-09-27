import type { ComponentType } from 'react';
import type { OutputsFace } from './types';
import { FloorPlanOutputs } from './FloorPlan';
import { PatchBayOutputs } from './PatchBay';
import { CallSheetOutputs } from './CallSheet';

/*
 * The outputs card designs under review. Same shape as the D-27 transcript
 * review (../../transcript/styles.ts): the dashboard draws the one named
 * by SHIPPED_OUTPUTS, and on the design page a small bar over the card
 * switches between all three on the same screens.
 */
export interface OutputsStyle {
  id: string;
  name: string;
  blurb: string;
  Component: ComponentType<OutputsFace>;
}

export const OUTPUTS_STYLES: OutputsStyle[] = [
  {
    id: 'floorplan',
    name: 'floor plan',
    blurb: 'The screens drawn as screens — the wall large, the others beside it, an output with no display drawn dashed. Press the job on a screen to change it.',
    Component: FloorPlanOutputs,
  },
  {
    id: 'patchbay',
    name: 'patch bay',
    blurb: 'Displays down the left, jobs down the right, a lit cable between each. Press the job end to re-patch.',
    Component: PatchBayOutputs,
  },
  {
    id: 'callsheet',
    name: 'call sheet',
    blurb: 'One line per screen, read as a sentence. The four jobs appear as a switch on the hovered line.',
    Component: CallSheetOutputs,
  },
];

/** What the app draws. The owner picked floor plan on 2026-09-27. */
export const SHIPPED_OUTPUTS = 'floorplan';

export function outputsStyle(id: string | null | undefined): OutputsStyle {
  return OUTPUTS_STYLES.find((s) => s.id === id) ?? OUTPUTS_STYLES.find((s) => s.id === SHIPPED_OUTPUTS)!;
}
