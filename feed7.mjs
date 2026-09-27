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
await ev(`(()=>{const n=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()==='LIVE');if(n)n.click();})()`);
await sleep(1200);
await ev(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.textContent.trim()==='dashboard');if(b.length)b[0].click();})()`);
await sleep(1500);
/* Crop to the bottom band: from the "PREACHING TODAY" eyebrow down. */
const box=await ev(`(()=>{const h=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/^preaching today$/i.test(e.textContent.trim()));if(!h)return null;const r=h.getBoundingClientRect();return JSON.stringify({y:r.y});})()`);
console.log('eyebrow y:',box.result?.value);
const y=box.result?.value?JSON.parse(box.result.value).y:null;
const vp=await ev(`JSON.stringify({w:innerWidth,h:innerHeight})`);
const v=JSON.parse(vp.result.value);
const s=await rpc("Page.captureScreenshot",{format:"png"});
writeFileSync(process.argv[2],Buffer.from(s.data,'base64'));
console.log('shot →',process.argv[2]);
ws.close();
