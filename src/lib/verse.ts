/** Helpers for turning engine verse detections into readable text. */

export function formatRef(d: VerseDetection): string {
  const base = `${d.book} ${d.chapter}`;
  if (d.verse == null) return base;
  const range = d.endVerse && d.endVerse !== d.verse ? `–${d.endVerse}` : '';
  return `${base}:${d.verse}${range}`;
}

export function sameRef(a: VerseDetection, b: VerseDetection): boolean {
  return (
    a.book === b.book &&
    a.chapter === b.chapter &&
    a.verse === b.verse &&
    (a.endVerse ?? null) === (b.endVerse ?? null)
  );
}

/**
 * A detection's verses in one read (get-verse-range), the same rows the
 * operator's preview was built from. A version that leaves a number out
 * (BSB Mark 9:44, WEB Acts 8:37) just skips it; the old verse-by-verse loop
 * below stopped at the first gap, so the wall showed half the reading.
 * Bounded at 30 verses so a misheard "1-150" cannot flood the projector.
 * Null when there is no range IPC (an older main), so callers fall back.
 */
async function readRange(
  d: VerseDetection,
  version: string | undefined,
): Promise<{ verse: number; text: string }[] | null> {
  const api = window.api;
  if (!api?.getVerseRange || d.verse == null) return null;
  const start = d.verse;
  const end = d.endVerse && d.endVerse > start ? Math.min(d.endVerse, start + 29) : start;
  try {
    const res = await api.getVerseRange(d.book, d.chapter, start, end, version);
    return res?.success ? res.verses : [];
  } catch {
    return [];
  }
}

/**
 * Fetch the full text for a detection.
 * Ranges are joined verse-by-verse (bounded, so a mis-detected "1–150"
 * cannot flood the display). Returns null when the engine is absent or
 * the reference is chapter-only.
 */
export async function fetchVerseText(d: VerseDetection): Promise<string | null> {
  const api = window.api;
  if (!api || d.verse == null) return null;
  const ranged = await readRange(d, d.version);
  if (ranged) return ranged.length > 0 ? ranged.map((v) => v.text).join(' ') : null;
  const start = d.verse;
  const end = d.endVerse && d.endVerse > start ? Math.min(d.endVerse, start + 29) : start;
  const parts: string[] = [];
  for (let v = start; v <= end; v++) {
    try {
      const res = await api.searchVerse(d.book, d.chapter, v, d.version);
      if (res?.success && res.data?.text) parts.push(res.data.text);
      else break;
    } catch {
      break;
    }
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Fetch a detection's verses individually, so the display layer can slice
 * them into slides (shared/verseDisplay.ts) rather than receiving one
 * pre-joined blob. Bounded the same way fetchVerseText is, so a mis-detected
 * '1-150' cannot flood the projector.
 */
export async function fetchVerseParts(
  d: VerseDetection,
  version?: string,
): Promise<{ verse: number; text: string }[]> {
  const api = window.api;
  if (!api || d.verse == null) return [];
  const ranged = await readRange(d, version ?? d.version);
  if (ranged) return ranged;
  const start = d.verse;
  /* 30, not 12: a long range is paged now (verseDisplay pageVerses), so the
     bound only has to stop a misheard "1-150" fetching a whole psalm, and the
     wall should show the same pages the operator's preview does. */
  const end = d.endVerse && d.endVerse > start ? Math.min(d.endVerse, start + 29) : start;
  const parts: { verse: number; text: string }[] = [];
  for (let v = start; v <= end; v++) {
    try {
      const res = await api.searchVerse(d.book, d.chapter, v, version ?? d.version);
      if (res?.success && res.data?.text) parts.push({ verse: v, text: res.data.text });
      else break;
    } catch {
      break;
    }
  }
  return parts;
}

export function describeVoiceCommand(e: VoiceCommandEvent): string {
  switch (e.kind) {
    case 'version-switch':
      return `switched to ${e.value ?? 'version'}`;
    case 'correction-verse':
      return `corrected verse to ${e.value ?? '?'}`;
    case 'correction-chapter':
      return `corrected chapter to ${e.value ?? '?'}`;
    case 'navigate-next':
      return 'next verse';
    case 'navigate-previous':
      return 'previous verse';
    case 'display-dismiss':
      return 'dismissed display';
    case 'display-hold':
      return 'holding display';
    case 'prayer-start':
      return 'prayer began — display suppressed';
    case 'prayer-end':
      return 'prayer ended — display restored';
    default:
      return e.value != null ? `${e.kind} → ${e.value}` : e.kind;
  }
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Render a 0..1 fraction (or an already-percent number) as "94%". */
export function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  const n = v <= 1 ? v * 100 : v;
  return `${Math.round(n)}%`;
}
