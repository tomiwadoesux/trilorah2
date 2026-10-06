import type { ChristianSong } from '../../shared/christianSongs';

export interface MusicRecord {
  trackId?: number; trackName?: string; artistName?: string; primaryGenreName?: string;
  artworkUrl100?: string; trackViewUrl?: string;
}
export function christianMusicResults(records: MusicRecord[]): ChristianSong[] {
  const seen = new Set<string>();
  return records.flatMap(record => {
    if (!record || typeof record.trackId !== 'number' || typeof record.trackName !== 'string' || typeof record.artistName !== 'string' || !/christian|gospel|inspirational|worship/i.test(record.primaryGenreName ?? '')) return [];
    const key = `${record.trackName.toLowerCase()}|${record.artistName.toLowerCase()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id: `online-${record.trackId}`, title: record.trackName, artist: record.artistName,
      category: record.primaryGenreName ?? 'Christian',
      artwork: /^https:\/\/[^/]+\.mzstatic\.com\//.test(record.artworkUrl100 ?? '') ? record.artworkUrl100!.replace('100x100bb', '600x600bb') : '',
      storeUrl: /^https:\/\/music\.apple\.com\//.test(record.trackViewUrl ?? '') ? record.trackViewUrl! : '' }];
  });
}

export async function discoverChristianSongs(query: string): Promise<{ ok: true; songs: ChristianSong[] } | { ok: false; reason: string }> {
  const term = query.trim().slice(0, 200);
  if (!term) return { ok: true, songs: [] };
  try {
    const response = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term, entity: 'song', limit: '200', media: 'music' })}`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return { ok: false, reason: 'unavailable' };
    const data = await response.json() as { results?: MusicRecord[] } | null;
    if (!Array.isArray(data?.results)) return { ok: false, reason: 'unavailable' };
    return { ok: true, songs: christianMusicResults(data.results) };
  } catch { return { ok: false, reason: 'offline' }; }
}
