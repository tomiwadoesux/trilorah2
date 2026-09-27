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
// THEMES tab
console.log('tab:',(await ev(`(()=>{const n=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()==='THEMES');if(!n)return 'no THEMES';n.click();return 'ok';})()`)).result?.value);
await sleep(2000);
const shot=async(p)=>{const s=await rpc('Page.captureScreenshot',{format:'png'});writeFileSync(p,Buffer.from(s.data,'base64'));};
await shot(process.argv[2]);
console.log('a →',process.argv[2]);
// click the reference on the canvas
console.log('pick ref:',(await ev(`(()=>{const ps=[...document.querySelectorAll('p')].filter(p=>/^John 3:16$/.test(p.textContent.trim()));if(!ps.length)return 'not found';const p=ps[ps.length-1];const r=p.getBoundingClientRect();p.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));return 'clicked';})()`)).result?.value);
await sleep(800);
await shot(process.argv[3]);
console.log('b →',process.argv[3]);
ws.close();
