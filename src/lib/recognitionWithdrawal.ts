/** Remove only the provisional identity, including any translation of it. */
export function removeWithdrawnProposals<T extends { recognition?: { suggestionId: string } }>(
  proposals: T[], suggestionId: string,
): T[] {
  return proposals.filter(proposal => proposal.recognition?.suggestionId !== suggestionId);
}

/** Use against the latest state in a functional state update: an operator may
 * have selected a new preview between receiving an event and React rendering. */
export function withdrawRecognizedPreview<T extends {
  source: string;
  origin?: string;
  recognitionSuggestionId?: string;
}>(preview: T | null, suggestionId: string): T | null {
  return preview?.source === 'scripture' && preview.origin === 'engine' &&
    preview.recognitionSuggestionId === suggestionId ? null : preview;
}
