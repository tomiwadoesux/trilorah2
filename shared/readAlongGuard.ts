/** An automatic step may replace only the reading it was following. */
export interface ReadAlongGuard {
  reference: string;
  version: string;
}

export function matchesFollowedReading(guard: ReadAlongGuard, live: {
  book: string; chapter: number; verse: number | null; endVerse?: number | null; version?: string;
} | null): boolean {
  if (!live) return false;
  const reference = `${live.book} ${live.chapter}:${live.verse}${live.endVerse && live.endVerse !== live.verse ? `-${live.endVerse}` : ''}`;
  return reference === guard.reference && live.version === guard.version;
}
