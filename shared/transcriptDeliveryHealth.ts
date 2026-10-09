export interface TranscriptDeliveryHealth {
  state: 'off' | 'checking' | 'current' | 'behind' | 'unavailable';
  checkedAt: number;
}

/** A public database read proves availability, not receipt on every viewer's phone. */
export function transcriptDeliveryHealth(expectedAt: number, publicAt: number | null, now: number, gapStartedAt = now): TranscriptDeliveryHealth {
  return { state: !expectedAt ? 'checking' : publicAt != null && publicAt >= expectedAt - 30_000 ? 'current' : now - gapStartedAt < 30_000 ? 'checking' : 'behind', checkedAt: now };
}
