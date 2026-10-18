import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DitheredPatches } from '../../src/design/screens/DitheredPatches';
import '../../src/design/screens/liveHeader.css';

// Review-only instrumentation; nothing is imported by the application.
let paints = 0, sampling = false;
let durations: number[] = [];
const starts = new WeakMap<CanvasRenderingContext2D, {start:number;fills:number}>();
const clear = CanvasRenderingContext2D.prototype.clearRect;
const draw = CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.clearRect = function(...args) {
  if (sampling) starts.set(this, {start:performance.now(),fills:0});
  return clear.apply(this, args);
};
CanvasRenderingContext2D.prototype.drawImage = function(...args) {
  const result = draw.apply(this, args as any);
  const sample = starts.get(this);
  if (sampling && sample && ++sample.fills === 2) { paints++; durations.push(performance.now()-sample.start); }
  return result;
};
const nativeMatch = window.matchMedia.bind(window);
const motion = new EventTarget();
let reduced = false;
window.matchMedia = query => query === '(prefers-reduced-motion: reduce)' ? {
  get matches(){return reduced;}, media:query, onchange:null,
  addEventListener:motion.addEventListener.bind(motion), removeEventListener:motion.removeEventListener.bind(motion),
} as any : nativeMatch(query);
function Review() {
 const [mode,setMode]=useState(false),[hidden,setHidden]=useState(false),[mounted,setMounted]=useState(true),[narrow,setNarrow]=useState(false);
 const [result,setResult]=useState('Ready'),[clicks,setClicks]=useState(0),[response,setResponse]=useState('Click a dotted surface to check its color.'),[shots,setShots]=useState<{src:string;label:string}[]>([]);
 function readRipple(event: React.PointerEvent<HTMLElement>) {
   const canvas=event.currentTarget.querySelector('canvas')!;
   const rect=canvas.getBoundingClientRect(),ctx=canvas.getContext('2d')!;
   const x=(event.clientX-rect.left)*canvas.width/rect.width;
   const y=(event.clientY-rect.top)*canvas.height/rect.height;
   const brightness=()=>{
     const left=Math.max(0,Math.round(x-60)),top=Math.max(0,Math.round(y-60));
     const data=ctx.getImageData(left,top,Math.min(120,canvas.width-left),Math.min(120,canvas.height-top)).data;
     let total=0;for(let i=3;i<data.length;i+=4)total+=data[i];return total;
   };
   const before=brightness();
   setTimeout(()=>{
     const left=Math.max(0,Math.round(x-14)),top=Math.max(0,Math.round(y-14));
     const pixels=ctx.getImageData(left,top,Math.min(28,canvas.width-left),Math.min(28,canvas.height-top)).data;
     let r=0,g=0,b=0,a=0;
     for(let i=0;i<pixels.length;i+=4){r+=pixels[i]*pixels[i+3];g+=pixels[i+1]*pixels[i+3];b+=pixels[i+2]*pixels[i+3];a+=pixels[i+3];}
     setShots(previous=>[...previous.slice(-3),{src:canvas.toDataURL(),label:`rgb(${Math.round(r/Math.max(1,a))}, ${Math.round(g/Math.max(1,a))}, ${Math.round(b/Math.max(1,a))})`}]);
     setResponse(`Click center: rgb(${Math.round(r/Math.max(1,a))}, ${Math.round(g/Math.max(1,a))}, ${Math.round(b/Math.max(1,a))}); alpha change ${brightness()-before} (${reduced?'reduced motion':'motion enabled'}).`);
   },180);
   setTimeout(()=>{
     if (canvas.isConnected) setShots(previous=>[...previous.slice(-3),{src:canvas.toDataURL(),label:'Ripple contour · 600 ms after click'}]);
   },600);
 }
 async function measure() {
   paints=0;durations=[];sampling=true;setResult('Measuring for 5 seconds…');
   await new Promise(resolve=>setTimeout(resolve,5000));sampling=false;
   const total=durations.reduce((s,n)=>s+n,0);const ordered=[...durations].sort((a,b)=>a-b);
   setResult(`${paints} surface frames; average ${(total/Math.max(1,paints)).toFixed(3)} ms; p95 ${(ordered[Math.floor(ordered.length*.95)]??0).toFixed(3)} ms; total ${(total/5).toFixed(1)} ms rendering per second.`);
 }
 return <main style={{background:'#111',color:'#e5ebf3',fontFamily:'system-ui',minHeight:'100vh',padding:24}}>
  <h1 style={{fontSize:20}}>Living dither · motion review</h1>
  <p>Six rapid clicks start six growing red hearts, 0.4 seconds apart. The next sequence opens four ruffled red blooms with uneven, layered petals at the same quicker pace.</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   <button onClick={measure}>Measure 5 seconds</button>
   <button onClick={()=>{reduced=!reduced;motion.dispatchEvent(new Event('change'));setMode(reduced);}}>Reduced motion: {mode?'on':'off'}</button>
   <button onClick={()=>setHidden(!hidden)}>Surfaces: {hidden?'hidden':'visible'}</button>
   <button onClick={()=>setMounted(!mounted)}>Mounted: {mounted?'yes':'no'}</button>
   <button onClick={()=>setNarrow(!narrow)}>Width: {narrow?'narrow':'wide'}</button>
  </div>
  <p role="status">{result}</p><p>Control clicks: {clicks} · {response}</p>
  <div style={{maxWidth:narrow?340:1500,display:hidden?'none':'grid',gridTemplateColumns:narrow?'1fr':'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:12}}>
   {mounted && ['Preview','Live'].map((name,i)=><section key={name} onPointerDown={readRipple} aria-label={name+' panel'} style={{isolation:'isolate',position:'relative',height:340,borderRadius:12,overflow:'hidden',border:'1px solid #444'}}>
    <div className="stage-backdrop" style={{inset:0}}>
     <img className="stage-backdrop-image" src="/artifacts/sample-background.jpg"/><span className="stage-backdrop-shade"/>
     <DitheredPatches className="stage-backdrop-dots" interactionParent/>
    </div>
    <span style={{position:'absolute',left:16,top:16,fontSize:12}}>{name.toLowerCase()}</span>
    <div style={{position:'absolute',inset:narrow?'44px 28px':'44px 95px',display:'grid',placeContent:'center',textAlign:'center',background:'linear-gradient(145deg,#1b2925,#283b32)',border:'1px solid #ffffff22',padding:20}}>
     <p style={{fontFamily:'Georgia',fontSize:20,lineHeight:1.4}}>JESUS SAITH UNTO HIM, I AM THE WAY, THE TRUTH, AND THE LIFE.</p><small>JOHN 14:6</small>
    </div>
    <button style={{position:'absolute',right:12,bottom:12,padding:10}} onClick={()=>setClicks(n=>n+1)}>{i?'Display':'Go live'}</button>
   </section>)}
   {mounted && Array.from({length:8},(_,i)=><section key={i} onPointerDown={readRipple} aria-label={`Quiet surface ${i+1}`} className="tri-empty-surface" style={{height:140,border:'1px solid #333',borderRadius:12,overflow:'hidden',display:'grid',placeItems:'center'}}><DitheredPatches/><span style={{pointerEvents:'none',userSelect:'none'}}>Quiet surface {i+1}</span></section>)}
  </div>
  {shots.length>0 && <section aria-label="Recent click colors" style={{marginTop:20}}><h2 style={{fontSize:16}}>Recent click colors</h2><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>{shots.map((shot,i)=><figure key={i} style={{margin:0}}><img src={shot.src} alt={shot.label} style={{width:'100%',background:'#111',border:'1px solid #444',borderRadius:8}}/><figcaption style={{fontSize:12,color:'#aaa'}}>{shot.label}</figcaption></figure>)}</div></section>}
  <style>{`button{background:#25312f;color:#e5ebf3;border:1px solid #ffffff33;border-radius:6px;padding:8px 12px;cursor:pointer}button:focus-visible{outline:2px solid #b4e1c1}`}</style>
 </main>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Review/></React.StrictMode>);
