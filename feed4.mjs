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
await sleep(1000);
/* SHORT sentences, the case that was broken: each one used to occupy the
   pill alone and leave whole. They should now accumulate. */
const SHORT=['And the Lord is saying,','Be still.','Know that I am God.','He is faithful.','Every single morning.','His mercies are new.'];
const shots=[];
for (let i=0;i<SHORT.length;i++){
  await ev(`window.api.sendText(${JSON.stringify(SHORT[i])})`);
  await sleep(1200);
  if(i===2||i===SHORT.length-1){
    const s=await rpc('Page.captureScreenshot',{format:'png'});
    const p=process.argv[2].replace('.png',`-${i}.png`);
    writeFileSync(p,Buffer.from(s.data,'base64')); shots.push(p);
  }
}
console.log('shots →',shots.join(' '));
ws.close();
