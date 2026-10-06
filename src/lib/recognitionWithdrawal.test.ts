import { describe, expect, it } from 'vitest';
import { removeWithdrawnProposals, withdrawRecognizedPreview } from './recognitionWithdrawal';

describe('revised speech withdraws only its provisional UI state', () => {
  it('removes all versions of that suggestion without removing the same verse from another source', () => {
    const automatic = { reference: 'John 3:16', recognition: { suggestionId: 'recognition-1' } };
    const alternate = { ...automatic, version: 'BSB' };
    const another = { reference: 'John 3:16', recognition: { suggestionId: 'recognition-2' } };
    const explicit = { reference: 'John 3:16', recognition: undefined };
    expect(removeWithdrawnProposals([automatic, alternate, another, explicit], 'recognition-1')).toEqual([another, explicit]);
  });

  it('clears the automatically staged preview tied to the withdrawn identity', () => {
    const preview = { source: 'scripture', origin: 'engine', recognitionSuggestionId: 'recognition-1' };
    expect(withdrawRecognizedPreview(preview, 'recognition-1')).toBeNull();
  });

  it('preserves an operator choice, even when it is the same verse or was picked from the suggestion', () => {
    const chosen = { source: 'scripture', origin: 'operator', reference: 'John 3:16', recognitionSuggestionId: 'recognition-1' };
    expect(withdrawRecognizedPreview(chosen, 'recognition-1')).toBe(chosen);
  });

  it('preserves a newer automatic preview and an unassociated preview', () => {
    const newer = { source: 'scripture', origin: 'engine', recognitionSuggestionId: 'recognition-2' };
    const unassociated = { source: 'scripture', origin: 'engine' };
    expect(withdrawRecognizedPreview(newer, 'recognition-1')).toBe(newer);
    expect(withdrawRecognizedPreview(unassociated, 'recognition-1')).toBe(unassociated);
    expect(withdrawRecognizedPreview(null, 'recognition-1')).toBeNull();
  });

  it('preserves a choice queued just before a withdrawal is applied', () => {
    const provisional = { source: 'scripture', origin: 'engine', recognitionSuggestionId: 'recognition-1' };
    const chosen = { source: 'scripture', origin: 'operator', recognitionSuggestionId: 'recognition-1' };
    const updates = [() => chosen, (state: typeof provisional) => withdrawRecognizedPreview(state, 'recognition-1')];
    const result = updates.reduce<typeof provisional | null>((state, update) => state && update(state), provisional);
    expect(result).toBe(chosen);
  });

  it('allows a new proposal received after withdrawal to be retained in event order', () => {
    const old = { recognition: { suggestionId: 'recognition-1' } };
    const next = { recognition: { suggestionId: 'recognition-2' } };
    const proposals = removeWithdrawnProposals([old], 'recognition-1');
    expect([next, ...proposals]).toEqual([next]);
  });
});
