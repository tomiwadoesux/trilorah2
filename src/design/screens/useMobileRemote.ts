import { useEffect, useRef } from 'react';
import { useEngine, fitRules } from './engine';
import { useProjector, type LiveItem } from './projector';
import { useRun } from './run';
import { useMediaLibrary, mediaSrc } from './mediaLibrary';
import { buildVerseSlides } from '../../../shared/verseDisplay';
import { deckPage, type DeckPageSpec } from './deckPage';
import { BOOKS, CHAPTER_COUNTS, bookIdFromName } from '../../lib/books';
import { parts } from '../../../shared/referenceParts';

export function useMobileRemote() {
  const engine = useEngine();
  const projector = useProjector();
  const run = useRun();
  const media = useMediaLibrary();
  const current = useRef({engine,projector,run,media});
  current.current = {engine,projector,run,media};
  useEffect(() => {
    const api=window.api;
    if (!api) return;
    const offMedia=api.onShowMedia?.((path,kind)=>{
      const existing=current.current.media.find(m=>m.url===path || mediaSrc(m)===path);
      const qr=path.includes('trilorah-companion-qr');
      current.current.projector.reflect({source:'media',id:existing?.id || path,label:qr ? 'Congregation QR' : existing?.label || 'Desktop media',path,mediaKind:kind});
    });
    const offContent=api.onLiveContent?.(content=>{
      current.current.projector.reflect({source:content.kind==='song' ? 'song' : 'presentation',id:'desktop-content',label:content.title,title:content.title,section:content.label,lines:content.lines});
    });
    const offClear=api.onShowCleanBackground(()=>current.current.projector.reflect(null));
    return()=>{offMedia?.();offContent?.();offClear?.();};
  },[]);
  useEffect(() => {
    const api = window.api;
    if (!api?.onMobileRequest) return;
    const text = (v: unknown, max=200) => typeof v === 'string' ? v.slice(0,max) : '';
    const index = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : 0;
    const publicItem = (item: LiveItem | null) => item && ({source:item.source,id:item.id,label:item.label,reference:item.reference,version:item.version,text:item.text,lines:item.lines});
    async function decks(): Promise<{id:string;title:string;slides:string[]}[]> {
      const imported=await api!.loadPresentations();
      try {
        const custom=JSON.parse(localStorage.getItem('trilorah_custom_presentation_decks') || '[]') as {id:string;title:string;seed:number;rendered:number;spec:DeckPageSpec}[];
        return [...imported,...custom.filter(d=>d.id && d.spec && d.rendered>0).map(d=>({id:d.id,title:d.title,slides:Array.from({length:Math.min(d.rendered,300)},(_,i)=>deckPage(d.seed,i,d.spec))}))];
      } catch { return imported; }
    }
    async function verse(reference: string, version: string, live=false): Promise<LiveItem> {
      const d = await api!.mobileVerse(reference,version,live);
      const ref = `${d.book} ${d.chapter}:${d.verse}${d.endVerse ? `–${d.endVerse}` : ''}`;
      return {source:'scripture',id:`${ref}@${version}`,label:ref,reference:ref,version,text:d.text,verses:d.verses,
        slides:buildVerseSlides({book:d.book,chapter:d.chapter,version},d.verses,fitRules(d.verses)),origin:'operator'};
    }
    async function execute(command: string, a: Record<string,unknown>): Promise<unknown> {
      const {engine:e,projector:p,run:r,media:m} = current.current;
      const version = text(a.version,20) || String(await api!.getSetting('displayVersion') || 'KJV');
      switch(command) {
        case 'state': {
          const cloud = await api!.cloudStatus();
          return {preview:publicItem(p.preview),live:publicItem(p.live),screen:e.screen,asr:e.asr,asrMessage:e.asrMessage,
            proposals:e.proposals.map(x=>({id:x.id,reference:x.reference,version:x.version,text:x.text,missing:x.missing})),
            sharing:!!cloud.activeServiceId,cloudReady:cloud.configured && cloud.signedIn,
            timers:await api!.listTimers?.() || []};
        }
        case 'thumbnail': {
          const item=a.target==='live' ? p.live : p.preview;
          if (!item?.path || item.mediaKind==='video') return null;
          const image=await api!.mobileThumbnail(item.path);
          return image && image.length<4_000_000 ? image : null;
        }
        case 'library': {
          const [songs,presentations,versions] = await Promise.all([api!.songs?.list(),decks(),api!.getAvailableVersions()]);
          const themeKeys=['verseLayout','safeMargin','scriptureFontPreset','defaultFontSize','defaultTextColor','overlayOpacity'];
          const theme=Object.fromEntries(await Promise.all(themeKeys.map(async k=>[k,await api!.getSetting(k)])));
          return {songs:(songs || []).map(s=>({id:s.id,title:s.title,sections:s.sections})),
            decks:presentations.map(d=>({id:d.id,title:d.title,count:d.slides?.length || 0})),theme,
            media:m.filter(x=>x.url).map(x=>({id:x.id,title:x.label,kind:x.kind})),versions,
            run:r.segments.map(s=>({label:s.label,items:s.items.map(i=>({key:i.key,label:i.label,source:i.source}))}))};
        }
        case 'search': return api!.searchBibleText?.(text(a.query),{version,limit:40}) || [];
        case 'suggest': {
          const query=text(a.query); const parsed=parts(query); const book=bookIdFromName(parsed.book);
          if (parsed.chapter===null) {
            const matches=BOOKS.filter(b=>b.toLowerCase().startsWith(query.trim().toLowerCase()));
            if (!matches.length && book) matches.push(book.name);
            if (matches.length) return matches.slice(0,8).map(b=>({label:b,value:`${b} `,complete:false}));
            const hits=await api!.searchBibleText?.(query,{version,limit:8}) || [];
            return hits.map(h=>({label:`${h.book} ${h.chapter}:${h.verse}`,value:`${h.book} ${h.chapter}:${h.verse}`,detail:h.text,complete:true}));
          }
          if (!book) return [];
          if (parsed.verse===null) return Array.from({length:CHAPTER_COUNTS[book.id]},(_,i)=>i+1).filter(n=>String(n).startsWith(parsed.chapter || '')).slice(0,8).map(n=>({label:`${book.name} ${n}`,value:`${book.name} ${n}:`,complete:false}));
          const chapter=Number(parsed.chapter);
          if (chapter<1 || chapter>CHAPTER_COUNTS[book.id]) return [];
          const result=await api!.getChapter(book.id,chapter,version);
          const prefix=parsed.rangeEnd ?? parsed.verse;
          return (result.data || []).filter(v=>String(v.id).startsWith(prefix || '') && (parsed.rangeEnd===null || v.id>=Number(parsed.verse))).slice(0,8).map(v=>{
            const ref=`${book.name} ${chapter}:${parsed.rangeEnd===null ? v.id : `${parsed.verse}-${v.id}`}`;
            return {label:ref,value:ref,detail:v.text,complete:true};
          });
        }
        case 'verse': p.stage(await verse(text(a.reference),version)); return true;
        case 'proposal': {
          const proposal=e.proposals.find(x=>x.id===a.id);
          if (!proposal || proposal.missing) throw new Error('This detected scripture is no longer available.');
          if (a.dismiss) e.dismissProposal(proposal.id);
          else p.stage(await verse(proposal.reference,proposal.version));
          return true;
        }
        case 'song': {
          const song=await api!.songs?.get(text(a.id)); const n=index(a.index); const section=song?.sections[n];
          if (!song || !section) throw new Error('Song section not found. Refresh the library.');
          p.stage({source:'song',id:`${song.id}:${n}`,label:`${song.title} · ${section.label}`,title:song.title,section:section.label,lines:section.lines}); return true;
        }
        case 'deck': {
          const deck=(await decks()).find(d=>d.id===a.id); const n=index(a.index);
          if (!deck || typeof deck.slides?.[n] !== 'string') throw new Error('Slide not found. Import a presentation on the desktop first.');
          p.stage({source:'presentation',id:`${deck.id}:${n}`,label:`${deck.title} · ${n+1}`,title:deck.title,path:deck.slides[n],mediaKind:'photo'}); return true;
        }
        case 'media': {
          const item=m.find(x=>x.id===a.id && x.url); if (!item) throw new Error('Media not found.');
          p.stage({source:'media',id:item.id,label:item.label,path:item.url,mediaKind:item.kind}); return true;
        }
        case 'run': {
          const item=r.segments.flatMap(s=>s.items).find(i=>i.key===a.id);
          if (!item || item.source==='note') throw new Error('This run item cannot be presented.');
          if (item.source==='scripture') p.stage(await verse(item.label,version));
          else p.stage({...item,id:item.key,source:item.source});
          return true;
        }
        case 'live': {
          const item=p.preview;
          if (!item) throw new Error('Select something for preview first.');
          if (a.id !== item.id) throw new Error('The desktop preview changed. Review it before pressing Go live again.');
          if (item.reference) await api!.mobileVerse(item.reference,item.version || version,true);
          await p.promote(); return true;
        }
        case 'step': {
          const item=p.live; if (!item) throw new Error('Nothing is live.');
          const delta=a.delta===-1 ? -1 : 1;
          if (item.reference) {
            const match=/^(.+) (\d+):(\d+)(?:[–-](\d+))?$/.exec(item.reference);
            if (!match) throw new Error('Select a verse first.');
            const n=Number(delta>0 ? match[4] || match[3] : match[3])+delta;
            if (n<1) throw new Error('This is the first verse of the chapter.');
            const next=await verse(`${match[1]} ${match[2]}:${n}`,item.version || version,true); await p.send(next); p.stage(next);
          } else if (item.source==='song' || item.source==='presentation') {
            const split=item.id.lastIndexOf(':'); const id=item.id.slice(0,split); const n=Number(item.id.slice(split+1))+delta;
            if (split<0 || n<0) throw new Error('This is the first section or slide.');
            if (item.source==='song') {
              const song=await api!.songs?.get(id); const section=song?.sections[n]; if (!song || !section) throw new Error('Last song section reached.');
              const next:LiveItem={source:'song',id:`${id}:${n}`,label:`${song.title} · ${section.label}`,title:song.title,section:section.label,lines:section.lines}; await p.send(next); p.stage(next);
            } else {
              const d=(await decks()).find(d=>d.id===id); if (!d?.slides?.[n]) throw new Error('Last slide reached.');
              const next:LiveItem={source:'presentation',id:`${id}:${n}`,label:`${d.title} · ${n+1}`,title:d.title,path:d.slides[n],mediaKind:'photo'}; await p.send(next); p.stage(next);
            }
          } else throw new Error('Use the media playback controls for this item.');
          return true;
        }
        case 'screen': {
          if (!['live','clear','black','logo'].includes(String(a.value))) throw new Error('Invalid screen mode');
          const s=a.value as 'live'|'clear'|'black'|'logo'; await api!.setScreenState?.(s); p.setScreen(s); return true;
        }
        case 'listen': e.listen(a.enabled===true); return true;
        case 'openOutput': e.openProjector(); return true;
        case 'playback': {
          if (!['play','pause','restart','volume','loop'].includes(String(a.action))) throw new Error('Invalid playback action');
          return api!.mediaControl?.({type:a.action as 'play',value:typeof a.value==='number' ? Math.min(1,Math.max(0,a.value)) : a.value===true});
        }
        case 'alert': return a.dismiss ? api!.dismissAlert?.() : api!.showAlert?.(text(a.text,500),{target:'all',durationSec:15});
        case 'timer': {
          const id=text(a.id);
          if (a.action==='create') return api!.createTimer?.({name:text(a.name,80)||'Service timer',kind:'countdown',durationSec:Math.min(86400,Math.max(1,Number(a.seconds)||300))});
          if (a.action==='start') return api!.startTimer?.(id);
          if (a.action==='pause') return api!.pauseTimer?.(id);
          if (a.action==='reset') return api!.resetTimer?.(id);
          throw new Error('Invalid timer action');
        }
        case 'sharing': {
          const status=await api!.cloudStatus();
          if (a.enabled===true && (!status.configured || !status.signedIn)) throw new Error('Sign in and configure the church in the desktop Cloud tab first.');
          if (a.enabled===true && status.activeServiceId) return true;
          const result=a.enabled===true ? await api!.cloudStartService({isPublic:true,publishTranscript:true}) : await api!.cloudEndService();
          if (!result.success) throw new Error(result.error || 'Could not change public sharing.');
          return true;
        }
        case 'qr': {
          const result=await api!.showQr?.(); if (!result?.success) throw new Error(result?.error || 'Set up the public church link first.'); return {url:result.url};
        }
        case 'theme': {
          const key=text(a.key); const ranges:Record<string,[number,number]>={safeMargin:[3,20],refScale:[0.4,2],refGap:[0,10],defaultFontSize:[0.5,2],overlayOpacity:[0,1]};
          if (key==='backgroundId') { const bg=m.find(x=>x.id===a.value && x.url); if(!bg) throw new Error('Background not found'); return api!.setSetting('defaultBackgroundUrl',bg.url); }
          if (key==='scriptureFontPreset' && ['display-serif','classic-serif','modern-sans','bold-slab','display-rounded'].includes(String(a.value))) return api!.setSetting(key,a.value);
          if (key==='defaultTextColor' && /^#[0-9a-f]{6}$/i.test(String(a.value))) return api!.setSetting(key,a.value);
          if (key==='verseLayout' && ['top','bottom','bottom-left','bottom-right'].includes(String(a.value))) return api!.setSetting(key,a.value);
          if (ranges[key] && typeof a.value==='number' && Number.isFinite(a.value)) return api!.setSetting(key,Math.max(ranges[key][0],Math.min(ranges[key][1],a.value)));
          throw new Error('Unsupported theme setting');
        }
        default: throw new Error('Unsupported remote command');
      }
    }
    return api.onMobileRequest(request => {
      if (request.deadline < Date.now()) { api.mobileReply({id:request.id,error:'Command expired. Please try again.'}); return; }
      void execute(request.command,request.args).then(result=>api.mobileReply({id:request.id,result}),error=>api.mobileReply({id:request.id,error:error instanceof Error ? error.message : 'Command failed'}));
    });
  },[]);
}
