import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const Color=require('../../web/node_modules/@img/colour/color.cjs').default;
const dir=new URL('./deeper/',import.meta.url);
const output=new URL('black-white/',dir);
await mkdir(output,{recursive:true});
const sources=JSON.parse(await readFile(new URL('selected-sources.json',dir),'utf8'));
let excludedNumbers=new Set();
try{excludedNumbers=new Set(JSON.parse(await readFile(new URL('selection-policy.json',output),'utf8')).excludedNumbers);}catch(error){if(error.code!=='ENOENT')throw error;}
const originals=new Map();
for(const manifest of ['sources-ornamental.json','sources-modern.json']){
 try{for(const entry of JSON.parse(await readFile(new URL(`vector-originals/${manifest}`,dir),'utf8')))originals.set(entry.id,entry);}catch(error){if(error.code!=='ENOENT')throw error;}
}
const converted=[];
const missing=[];
for(const source of sources){
 if(excludedNumbers.has(source.number))continue;
 let input=new URL(source.file,dir);
 if(!source.file.endsWith('.svg'))input=new URL(`vector-originals/${source.id}.svg`,dir);
 let svg;
 try{svg=await readFile(input,'utf8');}catch{missing.push(source.id);continue;}
 if(!/<svg\b/.test(svg)||/<(?:\w+:)?image\b/i.test(svg))throw Error(`Not a pure vector: ${source.id}`);
 const original=originals.get(source.id);
 if(original)for(const key of ['author','source','original_source','url'])if(original[key])source[key]=original[key];
 const mapColour=(value)=>{
  if(['none','transparent','inherit','url','currentColor'].includes(value))return value;
  let color;try{color=Color(value);}catch{return value;}
  const [r,g,b]=color.rgb().array();
  const luminance=.2126*r+.7152*g+.0722*b;
  // Texture remains legible through tonal values; flat icon colours become ink or paper.
  const textured=source.number===13||source.number===31||source.number===35;
  const channel=textured?Math.round(luminance):(luminance>=145?255:0);
  const hex=channel.toString(16).padStart(2,'0');
  return `#${hex}${hex}${hex}`;
 };
 const paint=/(\b(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*(?:=\s*["']|:\s*))(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+\b)/g;
 svg=svg.replace(paint,(_,prefix,value)=>prefix+mapColour(value));
 // Keep the source attribution and document the colour-only adaptation in the SVG.
 const credit=`Black-and-white adaptation. Original: ${source.author}; ${source.original_source||source.source}; ${source.license}. Shapes preserved.`;
 svg=svg.replace(/(<svg\b[^>]*>)/,`$1\n<!-- ${credit.replaceAll('--','—')} -->`);
 const filename=`${source.number}-${source.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'')}.svg`;
 await writeFile(new URL(filename,output),svg);
 converted.push({...source,originalFile:source.file,file:filename,modification:'Black-and-white colour adaptation; source geometry preserved',vectorVerified:true});
}
await writeFile(new URL('selected-sources.json',output),JSON.stringify(converted,null,2));
console.log(`Converted ${converted.length} SVGs. Missing original vectors: ${missing.join(', ')||'none'}`);
if(missing.length&&!process.argv.includes('--partial'))process.exitCode=1;
