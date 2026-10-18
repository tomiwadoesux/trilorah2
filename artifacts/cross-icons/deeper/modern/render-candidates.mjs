import {readFile,writeFile} from 'node:fs/promises';
import sharp from '../../../../web/node_modules/sharp/lib/index.js';
const items=JSON.parse(await readFile(new URL('candidates.json',import.meta.url)));
const w=1200,h=Math.ceil(items.length/4)*300;let layers=[];
for(let i=0;i<items.length;i++){
 const x=(i%4)*300,y=Math.floor(i/4)*300;
 try{const img=await sharp(await readFile(new URL(items[i].file,import.meta.url)),{density:120}).resize(260,230,{fit:'inside'}).png().toBuffer();const m=await sharp(img).metadata();layers.push({input:img,left:x+(300-m.width)/2|0,top:y+20});}catch(e){console.log(items[i].id,e.message)}
 layers.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="40"><text y="18" font-family="Arial" font-size="16">${items[i].id} ${items[i].slug.slice(0,23)}</text></svg>`),left:x+10,top:y+260});
}
await sharp({create:{width:w,height:h,channels:4,background:'white'}}).composite(layers).png().toFile(new URL('candidates.png',import.meta.url).pathname);
