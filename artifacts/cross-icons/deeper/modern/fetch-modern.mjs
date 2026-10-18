import {writeFile} from 'node:fs/promises';
const candidates = [
 [318217,'palm-cross'],[216517,'old-rugged-cross'],[193094,'grunge-cross'],[193034,'christian-cross-frame'],
 [316723,'simple-cross-silhouette-design-3'],[316722,'simple-cross-silhouette-design-2'],[316721,'simple-cross-silhouette-design'],
 [305604,'simple-projecting-cross'],[305603,'simple-geometric-cross'],[266367,'cross-in-squares'],[266269,'cross'],[262493,'simple-cross-3'],
 [260036,'simple-geometric-cross-2'],[260035,'simple-geometric-cross'],[259681,'cross-and-ribbon'],[23580,'cross']
];
const out=[];
for(let i=0;i<candidates.length;i+=4){
 const results = await Promise.allSettled(candidates.slice(i,i+4).map(async ([id,slug])=>{
 const url=`https://openclipart.org/download/${id}`;
 const r=await fetch(url,{signal:AbortSignal.timeout(20000)});
 const svg=await r.text();
 if(!r.ok||!svg.includes('<svg')) throw new Error(`${id} invalid SVG`);
 const file=`${id}-${slug}.svg`;
 await writeFile(new URL(file,import.meta.url),svg);
 const icon={id,slug,title:slug.replaceAll('-',' '),file,source:`https://openclipart.org/detail/${id}/${slug}`,url,license:'CC0 / Public Domain',author:'OpenClipart'};
 console.log('OK',file);return icon;
 }));
 for(const r of results)if(r.status==='fulfilled')out.push(r.value);else console.log(r.reason.message);
}
await writeFile(new URL('candidates.json',import.meta.url),JSON.stringify(out,null,2));
