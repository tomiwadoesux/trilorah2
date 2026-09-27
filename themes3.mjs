import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const list=(await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(t=>t.type==='page');
const t=list.find(x=>x.url.includes('localhost')&&!x.url.includes('design.html'));
const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false});
const seq={next:1};
const rpc=(m,p={})=>new Promise((res,rej)=>{const id=seq.next++;const on=r=>{let x;try{x=JSON.parse(r)}catch{return}if(x.id!==id)return;ws.off('message',on);x.error?rej(new Error(x.error.message)):res(x.result)};ws.on('message',on);ws.send(JSON.stringify({id,method:m,params:p}))});
await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});
const ev=e=>rpc('Runtime.evaluate',{expression:e,returnByValue:true});
const shot=async(p)=>{const s=await rpc('Page.captureScreenshot',{format:'png'});writeFileSync(p,Buffer.from(s.data,'base64'));};
const click=async(sel,label)=>{
  const r=await ev(`(()=>{
    ${sel}
    if(!el) return 'not found';
    const r=el.getBoundingClientRect();
    const opts={bubbles:true,cancelable:true,button:0,clientX:r.x+r.width/2,clientY:r.y+r.height/2,pointerId:1,isPrimary:true};
    el.dispatchEvent(new PointerEvent('pointerdown',opts));
    return 'hit '+Math.round(r.width)+'x'+Math.round(r.height);
  })()`);
  console.log(label,'→',r.result?.value);
};
// click the reference line on the canvas
await click(`const ps=[...document.querySelectorAll('p')].filter(p=>p.textContent.trim()==='John 3:16'); const el=ps[ps.length-1];`,'reference');
await sleep(700); await shot(process.argv[2]);
// click the verse body
await click(`const ps=[...document.querySelectorAll('p')].filter(p=>/For God so loved/.test(p.textContent)); const el=ps[ps.length-1];`,'verse');
await sleep(700); await shot(process.argv[3]);
ws.close();
