'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { DEMOS, stepAt, type Crop, type DemoId, type Step } from './timelines';
import './feature-demos.css';
type Pack={initial?:string;fragments?:string[];states:Record<string,Record<string,number>|{html:string}>};
const cache=new Map<string,Promise<Pack>>();
function load(source:string) {
  const url=source==='hero'?'/hero-service/states.json':`/feature-demos/${source}.json`;
  if(!cache.has(url))cache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('Demo unavailable');return r.json();}).catch(e=>{cache.delete(url);throw e;}));
  return cache.get(url)!;
}
/** One clock drives both native crops; neither crop pans or changes magnification. */
export function FeatureDemo({id,fallback}:{id:DemoId;fallback:ReactNode}) {
  const demo=DEMOS[id];const host=useRef<HTMLDivElement>(null);const clock=useRef(0);
  const [near,setNear]=useState(false);const [visible,setVisible]=useState(false);const [pageVisible,setPageVisible]=useState(true);
  const [pack,setPack]=useState<Pack>();const [failed,setFailed]=useState(false);const [time,setTime]=useState(0);
  const [paused,setPaused]=useState(false);const [reduced,setReduced]=useState(false);const [ready,setReady]=useState(0);
  const complete=time>=demo.duration;const running=near&&visible&&pageVisible&&!!pack&&ready===2&&!paused&&!reduced&&!complete;
  const step=stepAt(demo,time);
  useEffect(()=>{
    const node=host.current!;
    const nearby=new IntersectionObserver(([e])=>setNear(e.isIntersecting),{rootMargin:'450px'});
    const onscreen=new IntersectionObserver(([e])=>setVisible(e.intersectionRatio>=.35),{threshold:[0,.35]});
    nearby.observe(node);onscreen.observe(node);
    const visibility=()=>setPageVisible(!document.hidden);visibility();
    const query=matchMedia('(prefers-reduced-motion: reduce)');
    const motion=()=>{setReduced(query.matches);if(query.matches){clock.current=demo.duration;setTime(demo.duration);setPaused(true);}};motion();
    document.addEventListener('visibilitychange',visibility);query.addEventListener('change',motion);
    return()=>{nearby.disconnect();onscreen.disconnect();document.removeEventListener('visibilitychange',visibility);query.removeEventListener('change',motion);};
  },[demo]);
  useEffect(()=>{if(!near||pack)return;let live=true;load(demo.source).then(data=>{if(live)setPack(data);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[near,pack,demo.source]);
  useEffect(()=>{if(!near)setReady(0);},[near]);
  useEffect(()=>{if(!running)return;let previous=performance.now();const timer=setInterval(()=>{const now=performance.now();clock.current=Math.min(demo.duration,clock.current+Math.min(now-previous,180));previous=now;setTime(clock.current);},100);return()=>clearInterval(timer);},[running,demo.duration]);
  const seek=(at:number)=>{clock.current=at;setTime(at);};
  const replay=()=>{seek(0);setPaused(reduced);};
  const backPhase=id==='screens'?(time<3500?'screens-projector':time<6500?'screens-stream':step.phase):step.phase;
  return <div className={`feature-demo fd-${id}`} ref={host} data-running={running} data-phase={step.phase}>
    <div className="fd-fallback" data-hidden={near&&!!pack&&ready===2}>{fallback}</div>
    {near&&pack&&<div className="fd-native" data-ready={ready===2}>
      <NativePane source={demo.source} pack={pack} phase={backPhase} crop={demo.back} kind="back" step={step} time={time} running={running} reduced={reduced} onReady={()=>setReady(n=>Math.min(2,n+1))}/>
      <NativePane source={demo.source} pack={pack} phase={step.phase} crop={demo.front} kind="front" step={step} time={time} running={running} reduced={reduced} onReady={()=>setReady(n=>Math.min(2,n+1))}/>
    </div>}
    <div className="fd-controls">
      <p aria-live={paused?'polite':'off'}>{failed?'Demo unavailable — showing the app preview':step.label}</p>
      <button type="button" disabled={!pack} onClick={()=>complete||reduced?replay():setPaused(p=>!p)} aria-label={`${complete||reduced?'Replay':paused?'Play':'Pause'} ${id} demo`}>{complete||reduced?'Replay':paused?'Play':'Pause'}</button>
      <button type="button" disabled={!pack} onClick={()=>{setPaused(true);const next=demo.steps.find(s=>s.at>time);seek(next?.at??0);}} aria-label={`Next step in ${id} demo`}>Next step <span aria-hidden="true">→</span></button>
    </div>
  </div>;
}
function NativePane({source,pack,phase,crop,kind,step,time,running,reduced,onReady}:{source:string;pack:Pack;phase:string;crop:Crop;kind:'front'|'back';step:Step;time:number;running:boolean;reduced:boolean;onReady:()=>void}) {
  const frame=useRef<HTMLIFrameElement>(null);const wrapper=useRef<HTMLDivElement>(null);const shell=useRef<HTMLDivElement>(null);const pointer=useRef<HTMLDivElement>(null);
  const lastPoint=useRef<{x:number;y:number}>();
  const current=useRef<{doc:Document;phase:string;parts:Record<string,number>}>();const [loaded,setLoaded]=useState(false);
  const viewport=source==='phone'?{width:390,height:844}:{width:1600,height:940};
  useLayoutEffect(()=>{const node=wrapper.current!;const resize=()=>{if(shell.current)shell.current.style.transform=`scale(${node.clientWidth/crop.width})`;};const observer=new ResizeObserver(resize);observer.observe(node);resize();return()=>observer.disconnect();},[crop]);
  useLayoutEffect(()=>{
    const doc=frame.current?.contentDocument;if(!loaded||!doc)return;
    if(current.current?.doc!==doc)current.current={doc,phase:'',parts:pack.initial?(pack.states[pack.initial] as Record<string,number>):{}};
    const state=current.current;
    if(state.phase!==phase){
      const oldRows=new Map(Array.from(doc.querySelectorAll<HTMLElement>('.run-schedule-row')).map(el=>[el.dataset.runSection,el.getBoundingClientRect()]));
      if(pack.fragments){
        const parts=pack.states[phase] as Record<string,number>;
        for(const [part,index] of Object.entries(parts)){if(state.parts[part]!==index){const node=doc.querySelector(`[data-native-part="${part}"]`);if(node)node.outerHTML=pack.fragments[index];}}
        state.parts=parts;
      }else doc.body.innerHTML=(pack.states[phase] as {html:string}).html;
      state.phase=phase;
      if(running&&!reduced&&source==='service'){
        doc.querySelectorAll<HTMLElement>('.run-schedule-row').forEach(el=>{const old=oldRows.get(el.dataset.runSection);if(!old)return;const dy=old.top-el.getBoundingClientRect().top;if(dy)el.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:450,easing:'cubic-bezier(.77,0,.175,1)'});});
        if(phase==='service-added')doc.querySelector('.run-content-grid')?.lastElementChild?.animate([{opacity:0},{opacity:1}],{duration:200,easing:'cubic-bezier(.23,1,.32,1)'});
      }
      // DOM captures omit scrollTop; the source picker was opened at this offset.
      if(source==='screens'){
        doc.querySelectorAll<HTMLElement>('[role="dialog"] .overflow-y-auto').forEach(el=>el.scrollTop=281);
        // The enlarged card is a separate view, so it does not inherit the dialog's dimmer.
        if(kind==='back')doc.querySelector('button[aria-label="close"]')?.remove();
      }
      doc.querySelectorAll<HTMLElement>('.preaching-card__history-scroll,.transcript-reader__scroll').forEach(el=>el.scrollTop=el.scrollHeight);
      doc.querySelectorAll('button,input,select,textarea,a').forEach(el=>el.setAttribute('tabindex','-1'));
    }
    if(source==='hero'){
      const words=Array.from(doc.querySelector('.preaching-card__caption [data-caption-id]:last-child .transcript-marked')?.children??[]) as HTMLElement[];
      const count=reduced?words.length:Math.ceil(Math.min(1,time/3000)*words.length);
      words.forEach((word,index)=>word.style.visibility=index<count?'':'hidden');
      const word=words[Math.max(0,count-1)];const area=word?.closest<HTMLElement>('.preaching-card__caption');
      if(area&&word){const overflow=word.getBoundingClientRect().bottom-area.getBoundingClientRect().bottom;if(overflow>0)area.scrollTop+=overflow;}
    }
    doc.getAnimations().forEach(animation=>{if(animation.playState==='finished')return;if(running&&animation.playState==='paused')animation.play();else if(!running&&animation.playState==='running')animation.pause();});
  },[loaded,pack,phase,time,source,running,reduced,kind]);
  useLayoutEffect(()=>{
    const cursor=pointer.current;const doc=frame.current?.contentDocument;if(!cursor||!doc||!loaded)return;
    const target=step.pane===kind&&step.target?doc.querySelectorAll(step.target)[step.targetIndex??0]:null;
    if(!target||reduced){cursor.style.opacity='0';return;}
    const r=target.getBoundingClientRect();const x=r.x+r.width*.65-crop.x;const y=r.y+r.height*.55-crop.y;
    cursor.style.opacity=x>=0&&y>=0&&x<crop.width&&y<crop.height?'1':'0';
    const previous=lastPoint.current;const distance=previous?Math.hypot(x-previous.x,y-previous.y):300;
    cursor.style.transitionDuration=`${Math.round(Math.min(700,Math.max(350,distance*1.15)))}ms,180ms`;
    cursor.style.transform=`translate(${x}px,${y}px)`;lastPoint.current={x,y};
    if(step.click)cursor.firstElementChild?.animate([{transform:'scale(1)'},{transform:'scale(.8)'},{transform:'scale(1)'}],{duration:140,easing:'ease-out'});
  },[step,loaded,crop,kind,reduced]);
  return <div className={`sc-${kind} fd-pane`} ref={wrapper} style={{aspectRatio:`${crop.width}/${crop.height}`}}>
    <div className="fd-canvas" ref={shell} style={{width:crop.width,height:crop.height}}>
      <iframe ref={frame} src={source==='hero'?'/hero-service/app.html':`/feature-demos/${source}.html`} sandbox="allow-same-origin" title={`Sample ${source} ${kind} view`} aria-hidden="true" tabIndex={-1} style={{width:viewport.width,height:viewport.height,left:-crop.x,top:-crop.y}} onLoad={()=>{setLoaded(true);onReady();}}/>
      <div className="fd-pointer" ref={pointer} aria-hidden="true"><svg width="22" height="28" viewBox="0 0 22 28"><path d="M2 2v21l5-5 4 8 4-2-4-8h8Z" fill="#f5f4df" stroke="#142920" strokeWidth="1.5"/></svg></div>
    </div>
  </div>;
}
