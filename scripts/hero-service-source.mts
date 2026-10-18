/**
 * Isolated source renderer for the website's exported service demonstration.
 * Real LiveHost + native app controls; only Electron/recognition data is fixture-backed.
 * Run: node --import tsx scripts/hero-service-source.mts
 * Open http://127.0.0.1:5181/?phase=idle (see phases below).
 * Never reads personal localStorage or connects to the microphone/engine/outputs.
 */
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { guideIndex } from './guideIndex';
import { readFile } from 'node:fs/promises';
import { deckPage } from '../src/design/screens/deckPage';

const landscapeBytes = await readFile(new URL('../web/public/hero-landscape/dark.webp', import.meta.url));
const sampleSlide = deckPage(3, 0, {
  title: 'Be still', subtitle: 'Psalm 46:10 · Carry peace into your week', sections: [],
});

const psalm = [
  'God is our refuge and strength, a very present help in trouble.',
  'Therefore will not we fear, though the earth be removed, and though the mountains be carried into the midst of the sea;',
  'Though the waters thereof roar and be troubled, though the mountains shake with the swelling thereof. Selah.',
  'There is a river, the streams whereof shall make glad the city of God, the holy place of the tabernacles of the most High.',
  'God is in the midst of her; she shall not be moved: God shall help her, and that right early.',
  'The heathen raged, the kingdoms were moved: he uttered his voice, the earth melted.',
  'The LORD of hosts is with us; the God of Jacob is our refuge. Selah.',
  'Come, behold the works of the LORD, what desolations he hath made in the earth.',
  'He maketh wars to cease unto the end of the earth; he breaketh the bow, and cutteth the spear in sunder; he burneth the chariot in the fire.',
  'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.',
  'The LORD of hosts is with us; the God of Jacob is our refuge. Selah.',
].map((text, index) => ({ id: index + 1, text, ref: `Psalms 46:${index + 1}` }));
const song = {
  id: 'hero-amazing-grace', title: 'Amazing Grace', authors: ['John Newton'],
  sections: [
    { label: 'Verse 1', lines: ['Amazing grace! how sweet the sound', 'That saved a wretch like me!', 'I once was lost, but now am found,', 'Was blind, but now I see.'] },
    { label: 'Verse 2', lines: ["’Twas grace that taught my heart to fear,", 'And grace my fears relieved;', 'How precious did that grace appear', 'The hour I first believed!'] },
  ],
};
const fixture = `
  const phase = new URLSearchParams(location.search).get('phase') || 'idle';
  const psalm = ${JSON.stringify(psalm)};
  const song = ${JSON.stringify(song)};
  const imageUrl = new URL('/hero-landscape/dark.webp', location.origin).href;
  const slideUrl = ${JSON.stringify(sampleSlide)};
  const imageItem = {source:'media',id:'hero-landscape',label:'Quiet landscape',path:imageUrl,mediaKind:'photo',origin:'operator'};
  const slideItem = {source:'presentation',id:'hero-be-still:0',label:'Be still — slide 1',title:'Be still',path:slideUrl,deckId:'hero-be-still',deckIndex:0,deckPaths:[slideUrl],mediaKind:'photo',origin:'operator'};
  const run = [
    {key:'hero-songs',type:'music',label:'Songs',items:[{key:'hero-song-item',source:'song',label:'Amazing Grace — Verse 1',title:'Amazing Grace',section:'Verse 1',songId:song.id,lines:song.sections[0].lines}]},
    {key:'hero-sermon',type:'sermon',label:'Sermon',items:[1,2,10].map(verse=>({key:'hero-verse-'+verse,source:'scripture',label:'Psalms 46:'+verse,quote:psalm[verse-1].text}))},
    {key:'hero-images',type:'image',label:'Images',items:[{key:'hero-image-item',source:'media',label:'Quiet landscape',path:imageUrl,preview:imageUrl,mediaKind:'photo'}]},
    {key:'hero-slides',type:'slides',label:'Slides',items:[{key:'hero-slide-item',source:'presentation',label:'Be still — slide 1',title:'Be still',path:slideUrl,preview:slideUrl,mediaKind:'photo'}]},
  ];
  localStorage.setItem('trilorah.run.v1',JSON.stringify({segments:run,updatedAt:1}));
  localStorage.setItem('trilorah_saved_media_library',JSON.stringify([{id:'hero-landscape',label:'Quiet landscape',detail:'Sample service image',seed:0,style:'smoke',source:'local',url:imageUrl,kind:'photo',collection:'media'}]));
  localStorage.setItem('trilorah_hidden_presentation_decks',JSON.stringify(Array.from({length:100},(_,i)=>'deck-'+i)));
  const lyric = 'Amazing grace, how sweet the sound, that saved a wretch like me.';
  const introduction = 'Church, being still does not mean there is no trouble. It means knowing who is with us in the middle of it.';
  const allusion = 'God is our refuge and strength, a very present help in trouble.';
  const reference = 'Psalm forty-six, verse one. God is our refuge and strength, a very present help in trouble.';
  const noise = 'When life feels loud, we can bring that noise to God.';
  const next = 'Next verse. ' + psalm[1].text;
  const final = 'Psalm forty-six, verse ten. Be still, and know that I am God.';
  const closingWords = 'Today, take a breath. We do not have to carry everything alone. God is our refuge, even here.';
  const reading = (verse = 1) => ({reference: 'Psalms 46:' + verse, version:'KJV', text: psalm[verse-1].text, verses:[{verse,text:psalm[verse-1].text}]});
  const scripture = (verse = 1) => ({source:'scripture',id:'Psalms 46:'+verse,label:'Psalms 46:'+verse,...reading(verse),origin:'operator'});
  const songItem = {source:'song',id:song.id+'/'+song.id+':0/page-0',label:'Amazing Grace — Verse 1',title:song.title,section:'Verse 1',lines:song.sections[0].lines,origin:'operator'};
  const cleared = ['song-cleared','sermon','reference-ready','reference-find','reference'].includes(phase);
  let screen = cleared ? 'clear' : 'live';
  const isSong = phase.startsWith('song');
  const speechOverride = new URLSearchParams(location.search).get('spoken');
  const afterSermon = phase.startsWith('image') || phase.startsWith('slide');
  const closing = afterSermon || phase === 'closing' || (phase === 'last-live' && speechOverride !== null && speechOverride !== final);
  const last = phase.startsWith('last') || closing;
  const verse = phase === 'next-verse' ? 2 : last ? 10 : 1;
  const beforeNext = [lyric, introduction, allusion, reference, noise];
  const beforeLast = [...beforeNext, next];
  let finalLines = phase === 'idle' || isSong ? [] : phase === 'sermon' ? [lyric]
    : closing ? [...beforeLast, final] : last ? beforeLast : phase.startsWith('next') ? beforeNext
    : phase === 'reference-find' || phase === 'reference-ready' ? [lyric, introduction] : [lyric, introduction, allusion];
  // Optional exact history lets capture a different point without changing
  // native transcript markup or losing earlier service entries.
  try {
    const supplied = JSON.parse(new URLSearchParams(location.search).get('history') || 'null');
    if (Array.isArray(supplied) && supplied.every(line => typeof line === 'string')) finalLines = supplied.slice(-50);
  } catch { /* An invalid fixture query keeps the chronological defaults. */ }
  const nextCommand = {kind:'navigate-next',utterance:'Next verse.',phrase:'Next verse',ts:1};
  const partial = phase === 'idle' ? '' : isSong ? lyric : phase === 'sermon' ? introduction : closing ? closingWords : phase.startsWith('next') ? next : last ? final : phase === 'reference-find' || phase === 'reference-ready' ? allusion : reference;
  const spoken = {lines:finalLines.map((text,id)=>({id,text,...(text.startsWith('Next verse.')?{commands:[nextCommand]}:{})})),partial:speechOverride ?? partial, ...(phase.startsWith('next') ? {partialCommands:[nextCommand]} : {})};
  const preview = phase === 'slide-staged' || phase === 'slide-live' ? slideItem
    : phase === 'image-staged' || phase === 'image-live' || phase === 'slides-ready' || phase === 'slide-ready' ? imageItem
    : phase === 'image-ready' ? scripture(10)
    : ['song-staged','song-live'].includes(phase) ? songItem
    : phase === 'last-verse' ? scripture(2)
    : ['verse-staged','verse-live','next-ready','next-verse','last-staged','last-live','closing'].includes(phase) ? scripture(verse) : null;
  const live = phase === 'slide-live' ? slideItem
    : ['image-live','slides-ready','slide-ready','slide-staged'].includes(phase) ? imageItem
    : phase === 'image-ready' || phase === 'image-staged' ? scripture(10)
    : phase === 'song-live' || cleared || phase === 'verse-staged' ? songItem : ['verse-live','next-ready','next-verse','last-verse','last-staged','last-live','closing'].includes(phase) ? scripture(phase === 'last-verse' || phase === 'last-staged' ? 2 : verse) : null;
  const match = {reference:'Psalms 46:1',title:'God is our refuge',text:psalm[0].text,version:'KJV',kind:'meaning',evidence:['refuge','strength','help in trouble']};
  const events = new Map();
  const on = (type, fn) => {const listeners=events.get(type)||new Set();listeners.add(fn);events.set(type,listeners);return()=>listeners.delete(fn);};
  const emit = (type, value) => events.get(type)?.forEach(fn=>fn(value));
  const settings = new Map([['displayVersion','KJV'],['defaultBackgroundUrl',null],['voiceCommandsEnabled',true],['breakOnVerse',false],['operatorRunV1',{segments:run,updatedAt:1}]]);
  const api = {
    getSettings: async()=>Object.fromEntries(settings), getSetting:async key=>settings.get(key), setSetting:async(key,value)=>{settings.set(key,value);return {success:true};},
    getChapter:async(book,chapter)=>({success:true,data:book===18&&chapter===46?psalm:[]}),
    getAvailableVersions:async()=>['KJV'], getSessionVersion:async()=>'KJV',setSessionVersion:async()=>'KJV',
    getBibleVersions:async()=>({versions:[{code:'KJV',name:'King James Version',source:'bundled',available:true}]}),
    getScreenState:async()=>screen, onScreenState:fn=>on('screen',fn), setScreenState:value=>{screen=value;emit('screen',value);return Promise.resolve({success:true});},
    onEngineEvent:(type,fn)=>on(type,fn), onVersePreview:fn=>on('preview',fn),onVoiceCommand:fn=>on('voice',fn),
    getDbStatus:async()=>({connected:true}), getMicrophones:async()=>[], setCurrentSongLyrics:()=>{},setRunOrderContext:()=>{},onShowCleanBackground:fn=>on('clear',fn),
    songs:{list:async()=>[song],get:async()=>song},
    loadPresentations:async()=>[{id:'hero-be-still',title:'Be still',slides:[slideUrl],importedAt:1}],
    showMedia:async()=>({success:true}),
    findHeardScripture:async()=>({heard:allusion,matches:[match],meaning:true}),
    mobileVerse:async(ref,version='KJV')=>{const v=Number(/:(\\d+)/.exec(ref)?.[1]||1);return{...reading(v),book:'Psalms',chapter:46,verse:v,endVerse:v,version};},
    pushLiveContent:async()=>({success:true}), setLiveSlide:async()=>({success:true}), clearMedia:async()=>({success:true}),
    setTheme:async()=>({success:true}), setDisplayTheme:async()=>({success:true}), setDisplayFont:async()=>({success:true}),
  };
  window.__heroService={phase,psalm,song,spoken,reading,scripture,songItem,imageItem,slideItem,run,preview,live,screen,match,on,emit,api,isSong,verse};
  window.api=api;
`;

function replace(source: string, before: string, after: string) {
  if (!source.includes(before)) throw new Error(`Hero service source changed: ${before}`);
  return source.replace(before, after);
}

const server = await createServer({
  configFile: false,
  plugins: [
    {
      name: 'hero-service-fixtures', enforce: 'pre',
      configureServer(server) {
        server.middlewares.use('/hero-landscape/dark.webp', (_request, response) => {
          response.setHeader('Content-Type','image/webp');
          response.end(landscapeBytes);
        });
      },
      transform(source, id) {
        // Capture the native outputs controls with their built-in sample room.
        if (id.endsWith('/src/design/screens/dashboard/OutputsTile.tsx')) return source.replace("!design && typeof window !== 'undefined' && !!window.api", "!design && typeof window !== 'undefined' && !!window.api && new URLSearchParams(location.search).get('phase') !== 'outputs'");
        if (id.endsWith('/src/lib/audioDevices.ts')) return `export async function listAudioInputs(){return [{id:'demo',label:'Sample service'}];} export function onDeviceChange(){return ()=>{};}`;
        if (id.endsWith('/src/main.tsx')) return `
          import { createRoot } from 'react-dom/client';
          import './index.css'; import './ui/tokens.css'; import './design/sandbox.css';
          import { trackDensity } from './ui/density';
          const values = new Map([['trilorah.run.v1','[]']]);
          Object.defineProperty(window,'localStorage',{value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,get length(){return values.size;}}});
          ${fixture}
          document.documentElement.dataset.theme='dark'; document.documentElement.dataset.aurora='fern';
          trackDensity();
          const {useSongListeningStore}=await import('./stores/songListeningStore');
          const {useScriptureFindStore}=await import('./stores/scriptureFindStore');
          if(phase==='song'||phase==='song-staged'||phase==='song-live')useSongListeningStore.getState().setActive(true);
          if(phase==='reference-find')useScriptureFindStore.getState().open('God is our refuge and strength, a very present help in trouble.',[match]);
          const {LiveHost}=await import('./screens/LiveHost');
          createRoot(document.getElementById('root')).render(<div style={{height:'100vh'}}><LiveHost/></div>);
        `;
        if (id.endsWith('/src/design/screens/engine.tsx')) {
          return replace(source,'export function EngineProvider(', 'function DesktopEngineProvider(') + `
            export function EngineProvider({children}:{children:ReactNode}) {
              const hero=(window as any).__heroService;
              const [asr,setAsr]=useState<AsrStatus>(hero.phase==='idle'?'idle':'listening');
              const [screen,setScreenState]=useState<ScreenState>(hero.screen);
              useEffect(()=>hero.on('screen',setScreenState),[]);
              const [dismissed,setDismissed]=useState<string[]>([]);
              const callbacks=useRef(new Set<(item:LiveItem)=>void>());
              const data=hero.reading(hero.verse);
              const proposal={id:'hero-psalm-'+hero.verse,...data,slides:buildVerseSlides({book:'Psalms',chapter:46,version:'KJV'},data.verses,fitRules(data.verses)),trust:null,missing:false,kind:'said',group:'hero-reference',arrivedAt:1,heard:hero.spoken.partial};
              const eligible=['reference','last-verse'].includes(hero.phase)&&!dismissed.includes(proposal.id);
              const show=(ref:string)=>{const v=Number(/:(\\d+)/.exec(ref)?.[1]||1);hero.emit('stage',hero.scripture(v));hero.emit('preview',{book:'Psalms',chapter:46,verse:v});return true;};
              const pushReference=(ref:string)=>{const v=Number(/:(\\d+)/.exec(ref)?.[1]||1);const item=hero.scripture(v);hero.emit('stage',item);callbacks.current.forEach(fn=>fn(item));void hero.api.setScreenState('live');return true;};
              const value={...DEAD,caps:{bridge:true,db:true,outputs:false,resolver:'yes'},asr,screen,setScreen:(next:ScreenState)=>{void hero.api.setScreenState(next);},asrMessage:'',level:asr==='listening'?0.28:0,spoken:hero.spoken,transcript:hero.spoken.lines.map((line:any)=>line.text),listen:(on:boolean)=>setAsr(on?'listening':'idle'),show,pushReference,pushEnginePreview:(ref?:string)=>pushReference(ref||data.reference),lookup:async(_book:string,_chapter:number,verse:number)=>hero.reading(verse),proposals:eligible?[proposal]:[],latestReference:eligible?data.reference:null,proposalClocks:{[proposal.id]:{life:60000,remaining:60000,since:1,held:true}},dismissProposal:(id:string)=>setDismissed(previous=>[...previous,id]),onEngineLive:(fn:(item:LiveItem)=>void)=>{callbacks.current.add(fn);return()=>callbacks.current.delete(fn);}};
              return <EngineContext.Provider value={value as EngineValue}>{children}</EngineContext.Provider>;
            }
          `;
        }
        if (id.endsWith('/src/design/screens/projector.tsx')) {
          let transformed=replace(source,'const [live, setLive] = useState<LiveItem | null>(null);','const [live, setLive] = useState<LiveItem | null>((window as any).__heroService.live);');
          transformed=replace(transformed,'const [preview, setPreview] = useState<LiveItem | null>(null);','const [preview, setPreview] = useState<LiveItem | null>((window as any).__heroService.preview);\n  useEffect(() => (window as any).__heroService.on("stage", setPreview), []);');
          transformed=replace(transformed,"const [screen, setScreen] = useState<ScreenState>('live');",'const [screen, setScreen] = useState<ScreenState>((window as any).__heroService.screen);');
          return transformed;
        }
        if (id.endsWith('/src/design/screens/Live.tsx')) {
          let transformed=replace(source,"const OPENS_AT: ResolvedReference = { bookIndex: 0, book: 'Genesis', chapter: 1, verse: null };","const OPENS_AT: ResolvedReference = { bookIndex: 18, book: 'Psalms', chapter: 46, verse: null };");
          transformed=replace(transformed,"backgroundId: 'quiet-sea',","backgroundId: 'starter-valley',");
          return transformed;
        }
      },
    },
    guideIndex(process.cwd()), react(), tailwindcss(),
  ],
  server:{host:'127.0.0.1',port:Number(process.env.PORT || 5181),strictPort:true},
});
await server.listen();
server.printUrls();
