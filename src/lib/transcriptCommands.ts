import type { VoiceCommandEvent, VoiceCommandKind } from '../../shared/types';
import { commandWords, findCommandPhrase } from '../../shared/voiceCommandText';
import { formatReference } from '../../shared/verseDisplay';
import { transcriptReferences } from './transcriptReferences';
import type { Spoken } from '../design/screens/transcript/types';

export const TRANSCRIPT_COMMAND_ICONS = {
  'version-switch': 'book',
  'navigate-next': 'next',
  'navigate-previous': 'previous',
  'correction-verse': 'pen',
  'correction-chapter': 'pen',
  'display-dismiss': 'close',
  'display-hold': 'pause',
  'prayer-start': 'prayer',
  'prayer-end': 'play',
} as const satisfies Record<VoiceCommandKind, string>;

export interface TranscriptCommand {
  start: number;
  end: number;
  event: VoiceCommandEvent;
  label: string;
  icon: typeof TRANSCRIPT_COMMAND_ICONS[VoiceCommandKind];
}

function labelFor(event: VoiceCommandEvent): string | null {
  switch (event.kind) {
    case 'version-switch': return typeof event.value === 'string' && !event.value.includes('(not installed)') ? event.value : null;
    case 'navigate-next': return 'Next verse';
    case 'navigate-previous': return 'Previous verse';
    case 'correction-verse': return typeof event.value === 'number' ? `Verse ${event.value}` : null;
    case 'correction-chapter': return typeof event.value === 'number' ? `Chapter ${event.value}` : null;
    case 'display-dismiss': return 'Clear screen';
    case 'display-hold': return 'Hold verse';
    case 'prayer-start': return 'Prayer';
    case 'prayer-end': return 'Resume';
    default: return null;
  }
}

/** Only actual engine events can turn words into command pills. */
export function transcriptCommands(text: string, events: VoiceCommandEvent[] = []): TranscriptCommand[] {
  const ranges: TranscriptCommand[] = [];
  for (const event of events) {
    const label = labelFor(event);
    const range = findCommandPhrase(text, event.phrase ?? event.utterance, true);
    if (!label || !range || ranges.some((other) => range.start < other.end && range.end > other.start)) continue;
    ranges.push({ ...range, event, label, icon: TRANSCRIPT_COMMAND_ICONS[event.kind] });
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** Find either the preacher's original words or the compact label being shown. */
export function transcriptSearchText(text: string, events?: VoiceCommandEvent[]): string {
  const references = transcriptReferences(text).filter((reference) => reference.complete).map((reference) =>
    formatReference({ book: reference.book, chapter: reference.chapter!, version: '' }, reference.verse!,
      reference.endVerse ?? reference.verse!, { showTranslation: false }));
  return [text, ...references, ...transcriptCommands(text, events).map((command) => command.label)].join('\n').toLowerCase();
}

export function recordTranscriptLine(spoken: Spoken, line: { text: string; isFinal: boolean }): Spoken {
  const text = line.text.trim();
  if (!text) return spoken;
  if (!line.isFinal) return { ...spoken, partial: text };
  const commands = spoken.partialCommands?.filter((event) => findCommandPhrase(text, event.phrase ?? event.utterance, true));
  const id = (spoken.lines.at(-1)?.id ?? -1) + 1;
  return { lines: [...spoken.lines, { id, text, ...(commands?.length ? { commands } : {}) }], partial: '' };
}

type IncomingCommand = Omit<VoiceCommandEvent, 'kind'> & { kind: string };
const normalized = (text: string) => commandWords(text).map((token) => token.word).join(' ');
const alreadyHas = (events: VoiceCommandEvent[] | undefined, event: VoiceCommandEvent) =>
  events?.some((old) => old.ts === event.ts && old.kind === event.kind && old.value === event.value);

/** IPC delivers transcript text first, then its recognized command. A fast
 * navigation event can arrive while that same utterance is still partial. */
export function confirmTranscriptCommand(spoken: Spoken, incoming: IncomingCommand): Spoken {
  if (!Object.hasOwn(TRANSCRIPT_COMMAND_ICONS, incoming.kind)) return spoken;
  const event = incoming as VoiceCommandEvent;
  if (!labelFor(event) || !event.utterance.trim()) return spoken;
  const utterance = normalized(event.utterance);
  const matches = (text: string) => {
    const full = ` ${normalized(text)} `;
    return full.includes(` ${utterance} `) && !!findCommandPhrase(text, event.phrase ?? event.utterance, true);
  };
  if (spoken.partial && matches(spoken.partial)) {
    if (alreadyHas(spoken.partialCommands, event)) return spoken;
    return { ...spoken, partialCommands: [...spoken.partialCommands ?? [], event] };
  }
  // Events are ordered on the bridge. Never decorate an older repetition of
  // the phrase elsewhere in the sermon when this utterance doesn't match.
  const last = spoken.lines.at(-1);
  if (!last || !matches(last.text) || alreadyHas(last.commands, event)) return spoken;
  return { ...spoken, lines: [...spoken.lines.slice(0, -1), { ...last, commands: [...last.commands ?? [], event] }] };
}
