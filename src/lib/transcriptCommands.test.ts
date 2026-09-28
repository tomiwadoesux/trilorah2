import { describe, expect, it } from 'vitest';
import { confirmTranscriptCommand, recordTranscriptLine, transcriptCommands, transcriptSearchText } from './transcriptCommands';
import type { Spoken } from '../design/screens/transcript/types';
import type { VoiceCommandEvent } from '../../shared/types';

const next: VoiceCommandEvent = { kind: 'navigate-next', utterance: 'now next verse', phrase: 'next verse', ts: 10 };

describe('confirmed transcript command pills', () => {
  it('leaves ordinary speech undecorated until the engine confirms it', () => {
    expect(transcriptCommands('Now next verse.')).toEqual([]);
    expect(transcriptCommands('John was a boy.')).toEqual([]);
    const [range] = transcriptCommands('Now next verse, please.', [next]);
    expect(range).toMatchObject({ start: 4, end: 14, label: 'Next verse', icon: 'next' });
  });

  it('maps every supported command to a concise label and its icon', () => {
    const cases: [VoiceCommandEvent['kind'], string | number | undefined, string, string][] = [
      ['version-switch', 'NIV', 'NIV', 'book'],
      ['navigate-next', undefined, 'Next verse', 'next'],
      ['navigate-previous', undefined, 'Previous verse', 'previous'],
      ['correction-verse', 34, 'Verse 34', 'pen'],
      ['correction-chapter', 5, 'Chapter 5', 'pen'],
      ['display-dismiss', undefined, 'Clear screen', 'close'],
      ['display-hold', undefined, 'Hold verse', 'pause'],
      ['prayer-start', undefined, 'Prayer', 'prayer'],
      ['prayer-end', undefined, 'Resume', 'play'],
    ];
    for (const [kind, value, label, icon] of cases) {
      const [mark] = transcriptCommands('accepted phrase', [{ kind, utterance: 'accepted phrase', phrase: 'accepted phrase', value, ts: 10 }]);
      expect(mark).toMatchObject({ label, icon });
    }
  });

  it('supports preacher-specific phrases and preserves surrounding speech', () => {
    const text = 'Keep going, please, then we will discuss it.';
    const [range] = transcriptCommands(text, [{ ...next, utterance: text, phrase: 'Keep going' }]);
    expect(text.slice(range.start, range.end)).toBe('Keep going');
    expect(text.slice(range.end)).toBe(', please, then we will discuss it.');
  });

  it('does not claim an uninstalled translation was switched', () => {
    const event: VoiceCommandEvent = { kind: 'version-switch', utterance: 'new living translation', value: 'NLT (not installed)', ts: 1 };
    expect(transcriptCommands(event.utterance, [event])).toEqual([]);
    const spoken = { lines: [{ id: 0, text: event.utterance }], partial: '' };
    expect(confirmTranscriptCommand(spoken, event)).toBe(spoken);
  });

  it('carries an early navigation pill through ASR revisions and finalization', () => {
    let spoken: Spoken = { lines: [], partial: '' };
    spoken = recordTranscriptLine(spoken, { text: 'Now next verse', isFinal: false });
    spoken = confirmTranscriptCommand(spoken, next);
    expect(spoken.partialCommands).toEqual([next]);
    expect(confirmTranscriptCommand(spoken, next)).toBe(spoken);
    spoken = recordTranscriptLine(spoken, { text: 'Now next verse, please.', isFinal: false });
    expect(transcriptCommands(spoken.partial, spoken.partialCommands)).toHaveLength(1);
    spoken = recordTranscriptLine(spoken, { text: 'Now next verse, please.', isFinal: true });
    expect(spoken.lines[0]).toMatchObject({ id: 0, commands: [next], text: 'Now next verse, please.' });
    expect(spoken.partialCommands).toBeUndefined();
    spoken = recordTranscriptLine(spoken, { text: 'The next thing Paul says.', isFinal: true });
    expect(spoken.lines[1]).toMatchObject({ id: 1 });
    expect(spoken.lines[1].commands).toBeUndefined();
  });

  it('attaches a final command to its own line and ignores stale or unknown events', () => {
    let spoken: Spoken = { lines: [{ id: 0, text: 'Now next verse.' }], partial: '' };
    spoken = confirmTranscriptCommand(spoken, next);
    expect(spoken.lines[0].commands).toEqual([next]);
    expect(confirmTranscriptCommand(spoken, next)).toBe(spoken);
    spoken = recordTranscriptLine(spoken, { text: 'John was a boy.', isFinal: true });
    expect(confirmTranscriptCommand(spoken, next)).toBe(spoken);
    expect(confirmTranscriptCommand(spoken, { ...next, kind: 'unsupported' })).toBe(spoken);
  });

  it('does not display a command phrase that ASR later removed', () => {
    const spoken = recordTranscriptLine({ lines: [], partial: 'Now next verse', partialCommands: [next] },
      { text: 'Now next week we meet.', isFinal: true });
    expect(spoken.lines[0].commands).toBeUndefined();
  });

  it('finds both the original speech and the new reference or translation label', () => {
    const reference = transcriptSearchText('Read John three sixteen with me.');
    expect(reference).toContain('john three sixteen');
    expect(reference).toContain('john 3:16');
    const text = 'Read it in the King James Version.';
    const translation = transcriptSearchText(text, [{ kind: 'version-switch', utterance: text, phrase: 'King James Version', value: 'KJV', ts: 1 }]);
    expect(translation).toContain('king james version');
    expect(translation).toContain('kjv');
  });
});
