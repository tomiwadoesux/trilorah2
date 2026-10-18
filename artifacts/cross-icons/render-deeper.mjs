import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('../../web/node_modules/sharp');
const monochrome=process.argv.includes('--monochrome');
const dir=new URL(monochrome?'./deeper/black-white/':'./deeper/',import.meta.url);
const read=async folder=>(JSON.parse(await readFile(new URL(`${folder}/sources.json`,dir),'utf8'))).map(s=>({...s,file:`${folder}/${s.file}`}));
const selections=monochrome?JSON.parse(await readFile(new URL('selected-sources.json',dir),'utf8')):null;
const modern=monochrome?null:await read('modern');
const ornamental=monochrome?null:await read('ornamental');
const symbolic=monochrome?null:await read('symbolic');
const curated=monochrome&&selections.length!==24;
const groups=curated?Array.from({length:Math.ceil(selections.length/12)},(_,i)=>({title:'Cross designs for Jesus Christ',name:`selected-${i+1}`,items:selections.slice(i*12,(i+1)*12)})):monochrome?[
 {title:'Graphic, textured & geometric',name:'01-graphic',items:selections.slice(0,8)},
 {title:'Knots, latticework & ornamental forms',name:'02-ornamental',items:selections.slice(8,16)},
 {title:'Traditional forms & symbolic compositions',name:'03-traditional',items:selections.slice(16,24)},
]:[
 {title:'Graphic, textured & geometric',name:'01-graphic',items:modern},
 {title:'Knots, latticework & ornamental forms',name:'02-ornamental',items:ornamental.filter(s=>s.id!=='coptic')},
 {title:'Traditional forms & symbolic compositions',name:'03-traditional',items:[...symbolic,ornamental.find(s=>s.id==='coptic')]},
];
if(groups.some(g=>!g.items.length||g.items.some(s=>!s)))throw Error('Missing verified references');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let number=13;
const all=[];
for(const group of groups){
 const width=1440,height=184+Math.ceil(group.items.length/4)*398,col=336,row=398;
 const composites=[];
 let labels=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>text{font-family:Arial,sans-serif;fill:#24231e}.muted{fill:#66645f}</style><text x="48" y="56" font-size="33">${esc(group.title)}</text><text x="48" y="91" font-size="19" class="muted">${curated?`${group.items.length} selected designs · Original numbers retained`:`Cross design research · ${number}–${number+7}`} · SVG source references</text>`;
 for(const [i,icon] of group.items.entries()){
  if(!monochrome)icon.number=number;
  number++;all.push(icon);
  const x=48+(i%4)*col,y=135+Math.floor(i/4)*row;
  const bytes=await readFile(new URL(icon.file,dir));
  const png=await sharp(bytes,{density:96,limitInputPixels:150000000}).resize(278,278,{fit:'contain',background:{r:255,g:255,b:255,alpha:0}}).png().toBuffer();
  composites.push({input:png,left:x+14,top:y+44});
  labels+=`<text x="${x}" y="${y+24}" font-size="22">${icon.number} · ${esc(icon.title)}</text><text x="${x}" y="${y+350}" font-size="16" class="muted">${esc(icon.author||'OpenClipart')}</text>`;
  const license=icon.license?.startsWith('CC BY')?icon.license:'Public domain / CC0';
  labels+=`<text x="${x}" y="${y+373}" font-size="14" class="muted">${esc(license)}</text>`;
  if(Math.floor(i/4)<Math.ceil(group.items.length/4)-1)labels+=`<path d="M${x} ${y+390}h306" stroke="#e3e1d9"/>`;
 }
 labels+=`<text x="48" y="${height-21}" font-size="15" class="muted">${monochrome?'Black-and-white adaptation · Editable SVGs':'Research preview'} · Full source links and licenses: gallery.html${monochrome?'':' · Artwork shown in its original colours'}</text></svg>`;
 await sharp({create:{width,height,channels:4,background:'white'}}).composite([{input:Buffer.from(labels)},...composites]).png().toFile(new URL(`${group.name}.png`,dir).pathname);
}
await writeFile(new URL('selected-sources.json',dir),JSON.stringify(all,null,2));
let html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>24 more cross designs</title><style>body{font:16px/1.5 system-ui,sans-serif;background:#f8f7f4;color:#23221e;margin:0;padding:40px}main{max-width:1440px;margin:auto}h1{font-size:36px;margin:0}p{color:#666}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}article{background:white;border:1px solid #e5e2da;border-radius:16px;padding:20px}img{width:100%;height:260px;object-fit:contain;margin:15px 0}h2{font-size:19px;margin:0}a{color:#3b5a69}small{display:block;color:#67645d}.actions{display:flex;gap:18px;margin-top:12px}</style><main><h1>24 more cross designs</h1><p>References 13–36. Crosses without a human figure. The preview sheets are PNGs; every reference has an SVG source. Some local assets are official PNG previews. Source artwork is unmodified apart from display size.</p><section>`;
for(const s of all){
 const lic=s.licenseUrl||s.license_url;
 html+=`<article><h2>${s.number} · ${esc(s.title)}</h2><img src="${esc(s.file)}" alt="${esc(s.title)}"><small>${esc(s.author)}</small><small>${lic?`<a href="${esc(lic)}">${esc(s.license)}</a>`:esc(s.license)}</small><div class="actions"><a href="${esc(s.original_source||s.source)}" target="_blank" rel="noreferrer">Original source ↗</a><a href="${esc(s.file)}" download>Local ${s.file.endsWith('.svg')?'SVG':'PNG preview'} ↓</a></div></article>`;
}
html+='</section></main></html>';
if(monochrome)html=html.replace('24 more cross designs',`${all.length} black-and-white cross designs`).replace('<h1>24 more cross designs</h1>',`<h1>${curated?'Cross designs for Jesus Christ':`${all.length} black-and-white cross designs`}</h1>`).replace('References 13–36.',curated?'Selected designs, with their original reference numbers.':'References 13–36.').replace('The preview sheets are PNGs; every reference has an SVG source. Some local assets are official PNG previews. Source artwork is unmodified apart from display size.',`All ${all.length} downloads are editable vector SVGs. Colours have been converted to black and white; tonal detail is retained in textured designs. The preview sheets are PNGs. Original geometry and attribution are preserved.`);
await writeFile(new URL('gallery.html',dir),html);
console.log(`Rendered ${all.length} references in ${groups.length} sheets and a linked source gallery.`);
