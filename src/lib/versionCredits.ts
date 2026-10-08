import { setVersionCredits, type BibleVersionRow } from '../../shared/bibleVersions';

/**
 * Keep this window's copyright lines (shared/bibleVersions versionCredit)
 * in step with main's online Bibles: read once at start, then on every
 * 'on-bible-versions-changed' (a key that starts working, a listing that
 * changes). Each window that slices scripture calls it once — the app and
 * every output — so the line on the operator's preview is the line on the
 * wall. Returns the unsubscribe.
 */
export function watchVersionCredits(api: Window['api'] | undefined = typeof window === 'undefined' ? undefined : window.api): () => void {
  if (!api?.getBibleVersions) return () => undefined;
  const take = (list: unknown) => {
    const rows = (list as { versions?: BibleVersionRow[] } | null | undefined)?.versions;
    if (Array.isArray(rows)) setVersionCredits(rows.filter((row) => row?.source === 'online'));
  };
  void api.getBibleVersions().then(take).catch(() => undefined);
  return api.onEngineEvent?.('on-bible-versions-changed', take) ?? (() => undefined);
}
