import { decodeEntities, youtubeCaptions, type YoutubeCaptionsResult } from './youtubeCaptions';

export type CaptionedVideo = { id: string; title: string; author: string; thumbnail: string; trackKind: 'manual' | 'auto' };
export type YoutubeSearchResult = { ok: true; videos: CaptionedVideo[] } | { ok: false; reason: 'setup' | 'offline' | 'error'; message: string };
const cache = new Map<string, { at: number; captions: Extract<YoutubeCaptionsResult, {ok:true}> }>();
export function cachedVideoCaptions(id: string) {
  const found = cache.get(id);
  return found && Date.now()-found.at < 600000 ? found.captions : null;
}

/** Official search filters captioned videos; only readable tracks become results. */
export async function searchYoutubeVideos(query: string, key: string, load = youtubeCaptions): Promise<YoutubeSearchResult> {
  if (!key.trim()) return {ok:false,reason:'setup',message:'Add a YouTube Data API key in Settings → API keys to search videos. You can still paste a video link.'};
  if (!query.trim()) return {ok:true,videos:[]};
  try {
    const params = new URLSearchParams({part:'snippet',type:'video',videoCaption:'closedCaption',q:query.trim().slice(0,200),maxResults:'12',key:key.trim()});
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {signal:AbortSignal.timeout(12000)});
    if (!response.ok) return {ok:false,reason:'error',message:response.status===403 ? 'YouTube could not run this search. Check that the Data API is enabled and the key has quota remaining.' : 'YouTube search is unavailable. Try again.'};
    const body = await response.json() as {items?: {id?:{videoId?:string};snippet?:{title?:string;channelTitle?:string}}[]};
    const candidates = (body.items ?? []).filter(item => /^[\w-]{11}$/.test(item.id?.videoId ?? ''));
    const result: (CaptionedVideo | null)[] = candidates.map(() => null);
    let next = 0;
    await Promise.all(Array.from({length:3},async()=>{
      while(next<candidates.length) {
        const at=next++, item=candidates[at], id=item.id!.videoId!;
        const captions=cachedVideoCaptions(id) ?? await load(id);
        if (!captions.ok || !captions.lines.length) continue;
        cache.set(id,{at:Date.now(),captions});
        while(cache.size>60) cache.delete(cache.keys().next().value!);
        result[at]={id,title:decodeEntities(item.snippet?.title ?? captions.title),author:decodeEntities(item.snippet?.channelTitle ?? captions.author),thumbnail:`https://i.ytimg.com/vi/${id}/mqdefault.jpg`,trackKind:captions.trackKind};
      }
    }));
    return {ok:true,videos:result.filter((item):item is CaptionedVideo=>!!item)};
  } catch { return {ok:false,reason:'offline',message:'Could not reach YouTube. Check your connection and try again.'}; }
}
