import type { RunSegment } from './operatorRun';

/** One entry per song, in first-use order across the current run. */
export function scheduledSongs<T extends { id: string; title: string }>(songs: readonly T[], segments: readonly Pick<RunSegment, 'label' | 'items'>[]) {
  const entries: { key: string; title: string; section: string; song?: T }[] = [];
  const seen = new Set<string>();
  const normalise = (value: string) => value.trim().toLocaleLowerCase();
  for (const segment of segments) {
    for (const item of segment.items) {
      if (item.source !== 'song') continue;
      const title = item.title?.trim() || item.label.split(' — ')[0].trim();
      const song = songs.find(song => song.id === item.songId)
        ?? songs.find(song => normalise(song.title) === normalise(title));
      const key = song?.id ?? `missing:${item.songId || normalise(title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ key, title: song?.title ?? title, section: segment.label, song });
    }
  }
  return entries;
}
