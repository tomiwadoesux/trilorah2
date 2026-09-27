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
// back to LIVE, then the dashboard sub-tab (exact lowercase text)
await ev(`(()=>{const n=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()==='LIVE');if(n)n.click();})()`);
await sleep(1500);
await ev(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.textContent.trim()==='dashboard');if(b.length)b[0].click();return b.length;})()`);
await sleep(1500);
const shoot=async(p)=>{
  const box=await ev(`(()=>{const a=document.querySelector('[aria-label="next screen"]');if(!a)return null;const c=a.closest('section')||a.closest('div[class*="rounded"]').parentElement;const r=c.getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});})()`);
  const c=box.result?.value?JSON.parse(box.result.value):null;
  const s=await rpc('Page.captureScreenshot',c?{format:'png',clip:{x:c.x-10,y:c.y-10,width:c.w+20,height:c.h+20,scale:2}}:{format:'png'});
  writeFileSync(p,Buffer.from(s.data,'base64'));
  return c?'cropped':'full page';
};
console.log('a:',await shoot(process.argv[2]));
console.log('next:',(await ev(`(()=>{const b=document.querySelector('[aria-label="next screen"]');if(!b)return 'no arrow';b.click();return 'ok';})()`)).result?.value);
await sleep(700);
console.log('b:',await shoot(process.argv[3]));
ws.close();
