/*
 * What the engine hands the transcript strip, and what every strip design
 * takes. `lines` are utterances Deepgram has finalised, oldest first, each
 * with an id from a plain counter; `partial` is the utterance it is still
 * hearing, which may change its mind word by word until it is committed
 * as the next line (with the next id).
 */
import type { VoiceCommandEvent } from '../../../../shared/types';

export type Spoken = {
  lines: { id: number; text: string; commands?: VoiceCommandEvent[] }[];
  partial: string;
  partialCommands?: VoiceCommandEvent[];
};

export interface TranscriptStripProps {
  spoken: Spoken;
  /** 'listening' while the engine is hearing the room. */
  asr: string;
  /** The whole strip opens the dashboard, where the full log is. */
  onOpenDashboard: () => void;
}
