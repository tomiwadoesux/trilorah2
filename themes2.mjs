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
// LIVE tab, operator view
console.log('live:',(await ev(`(()=>{const n=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()==='LIVE');if(n)n.click();return 'ok';})()`)).result?.value);
await sleep(1500);
console.log('op:',(await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='operator');if(b)b.click();return 'ok';})()`)).result?.value);
await sleep(1200);
// the library rail's themes pill
console.log('themes pill:',(await ev(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>/^(themes)+$/.test(x.textContent.trim()));if(!b.length)return 'none';b[0].click();return 'clicked '+b.length;})()`)).result?.value);
await sleep(1800);
await shot(process.argv[2]);
console.log('a →',process.argv[2]);
ws.close();
