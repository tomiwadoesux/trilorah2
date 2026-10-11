import { afterEach, expect, it, vi } from 'vitest';
import { searchYoutubeVideos, cachedVideoCaptions } from './youtubeSearch';
afterEach(()=>vi.unstubAllGlobals());
it('requests caption-filtered video search and excludes videos without readable captions',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({items:[{id:{videoId:'abcdefghijk'},snippet:{title:'A &amp; B'}},{id:{videoId:'lmnopqrstuv'}},{id:{videoId:'123456789ab'}}]})});
 vi.stubGlobal('fetch',fetcher);
 const result=await searchYoutubeVideos('worship','test-key',async id=>id==='lmnopqrstuv' ? {ok:false,reason:'no-captions',message:'none'} : {ok:true,title:'Song',author:'Band',lines:['words'],trackKind:id==='abcdefghijk'?'manual':'auto'});
 expect(result).toMatchObject({ok:true,videos:[{id:'abcdefghijk',title:'A & B',trackKind:'manual'},{id:'123456789ab',trackKind:'auto'}]});
 const requested=new URL(fetcher.mock.calls[0][0]);
 expect(requested.searchParams.get('videoCaption')).toBe('closedCaption');
 expect(requested.searchParams.get('type')).toBe('video');
 expect(cachedVideoCaptions('abcdefghijk')?.lines).toEqual(['words']);
});
it('gives setup guidance without making a request when no API key is configured',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 expect(await searchYoutubeVideos('worship','')).toMatchObject({ok:false,reason:'setup'});
 expect(fetcher).not.toHaveBeenCalled();
});
it('does not leak provider errors or credentials into the UI',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('secret-key')));
 const result=await searchYoutubeVideos('worship','secret-key');
 expect(result).toMatchObject({ok:false,reason:'offline'});
 expect(JSON.stringify(result)).not.toContain('secret-key');
});
