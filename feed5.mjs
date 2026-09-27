import WebSocket from 'ws';
import { writeFileSync } from 'node:fs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const list=(await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(t=>t.type==='page');
const t=list.find(x=>x.url.includes('localhost')&&!x.url.includes('design.html'));
if(!t){console.error('no app window');process.exit(1)}
const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false});
const seq={next:1};
const rpc=(m,p={})=>new Promise((res,rej)=>{const id=seq.next++;const on=r=>{let x;try{x=JSON.parse(r)}catch{return}if(x.id!==id)return;ws.off('message',on);x.error?rej(new Error(x.error.message)):res(x.result)};ws.on('message',on);ws.send(JSON.stringify({id,method:m,params:p}))});
await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j)});
const ev=e=>rpc('Runtime.evaluate',{expression:e,returnByValue:true});
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='dashboard');if(b)b.click();})()`);
await sleep(1200);
/* Crop to the outputs card so the arrows are legible. */
const box=await ev(`(()=>{const h=[...document.querySelectorAll('*')].find(e=>e.textContent.trim()==='OUTPUTS'&&e.children.length===0);if(!h)return null;const p=h.closest('section,div[class*="rounded"]');const r=(p||h).getBoundingClientRect();return JSON.stringify({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)});})()`);
console.log('box',box.result?.value);
const clip=box.result?.value?JSON.parse(box.result.value):null;
const shot=await rpc('Page.captureScreenshot', clip?{format:'png',clip:{x:clip.x-8,y:clip.y-8,width:clip.w+16,height:clip.h+16,scale:2}}:{format:'png'});
writeFileSync(process.argv[2],Buffer.from(shot.data,'base64'));
console.log('shot →',process.argv[2]);
/* Then click next twice and shoot again, to prove paging. */
await ev(`(()=>{const b=document.querySelector('[aria-label="next screen"]');if(b){b.click();b.click();}return 'stepped';})()`);
await sleep(600);
const s2=await rpc('Page.captureScreenshot', clip?{format:'png',clip:{x:clip.x-8,y:clip.y-8,width:clip.w+16,height:clip.h+16,scale:2}}:{format:'png'});
writeFileSync(process.argv[3],Buffer.from(s2.data,'base64'));
console.log('shot2 →',process.argv[3]);
ws.close();
