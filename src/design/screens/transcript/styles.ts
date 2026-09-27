import type { ComponentType } from 'react';
import type { TranscriptStripProps } from './types';
import { LadderTranscript } from './Ladder';
import { RollUpTranscript } from './RollUp';
import { PagesTranscript } from './Pages';
import { FocusLineTranscript } from './FocusLine';

/*
 * The transcript strip designs under review (D-27). The Live screen draws
 * the one named by SHIPPED_TRANSCRIPT; the design page can switch between
 * all of them on a demo sermon (see LiveTranscript).
 */
export interface TranscriptStyle {
  id: string;
  name: string;
  /** One line: how it behaves. */
  blurb: string;
  Component: ComponentType<TranscriptStripProps>;
}

export const TRANSCRIPT_STYLES: TranscriptStyle[] = [
  {
    id: 'rollup',
    name: 'roll-up',
    blurb: 'Broadcast captions: one running paragraph, words land at the end of the bottom line, and the lines roll up as it fills.',
    Component: RollUpTranscript,
  },
  {
    id: 'pages',
    name: 'pages',
    blurb: 'Film subtitles: a caption holds still while it fills, then the next one takes its place — never moving while you read it.',
    Component: PagesTranscript,
  },
  {
    id: 'focus',
    name: 'focus line',
    blurb: 'The line being said, large, pinned to its newest word; the one before it small above; scripture references lit.',
    Component: FocusLineTranscript,
  },
  {
    id: 'ladder',
    name: 'current',
    blurb: 'As it shipped: two centred utterances, the older dimmed a rung.',
    Component: LadderTranscript,
  },
];

/** What the app draws. The owner picked roll-up on 2026-09-26. */
export const SHIPPED_TRANSCRIPT = 'rollup';

export function transcriptStyle(id: string | null | undefined): TranscriptStyle {
  return TRANSCRIPT_STYLES.find((s) => s.id === id) ?? TRANSCRIPT_STYLES.find((s) => s.id === SHIPPED_TRANSCRIPT)!;
}
