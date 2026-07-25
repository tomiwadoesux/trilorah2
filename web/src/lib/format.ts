/**
 * Shared date/duration formatting for service listings.
 * Locale is pinned so server-rendered output is deterministic.
 */

export function formatServiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatServiceTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "1h 12m" / "48m" — null while the service is still running or on bad data. */
export function formatDuration(
  startedAt: string,
  endedAt: string | null,
): string | null {
  if (!endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 1) return "<1m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Sermon title with the archive fallback: "Sunday Service — Jul 20, 2026". */
export function serviceTitle(
  sermonTitle: string | null,
  startedAt: string,
): string {
  return sermonTitle || `Sunday Service — ${formatServiceDate(startedAt)}`;
}
