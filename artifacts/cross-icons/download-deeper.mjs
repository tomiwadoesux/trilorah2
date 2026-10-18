import { mkdir, writeFile } from 'node:fs/promises';
const dir = new URL('./deeper/symbolic/', import.meta.url);
await mkdir(dir, { recursive: true });
const sources = [
  { id:'canterbury', title:'Canterbury cross', author:'Life of Riley', source:'https://commons.wikimedia.org/wiki/File:Cantercross.svg', url:'https://upload.wikimedia.org/wikipedia/commons/6/6c/Cantercross.svg', license:'CC BY-SA 4.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/' },
  { id:'tau', title:'Tau cross', author:'Johannes Rössel', source:'https://commons.wikimedia.org/wiki/File:Cross_tau.svg', url:'https://upload.wikimedia.org/wikipedia/commons/8/86/Cross_tau.svg', license:'CC BY-SA 3.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/' },
  { id:'brigid', title:'Woven Brigid cross', author:'Melian', source:'https://commons.wikimedia.org/wiki/File:BridesCross1.svg', url:'https://upload.wikimedia.org/wikipedia/commons/0/08/BridesCross1.svg', license:'Public domain' },
  { id:'lorraine', title:'Cross of Lorraine', author:'Johannes Rössel', source:'https://commons.wikimedia.org/wiki/File:Cross_of_Lorraine.svg', url:'https://upload.wikimedia.org/wikipedia/commons/d/d4/Cross_of_Lorraine.svg', license:'Public domain' },
  { id:'dove', title:'Dove arch cross', author:'j4p4n', source:'https://openclipart.org/detail/321055/dove-arch-cross', url:'https://openclipart.org/download/321055', license:'CC0 / Public domain' },
  { id:'flowers', title:'Floral cross', author:'OpenClipart / FreeSVG', source:'https://freesvg.org/cross-with-flowers', url:'https://freesvg.org/img/Ornamental-Divider-Cross-3.png', license:'CC0 / Public domain' },
  { id:'bible', title:'Cross and Bible', author:'OpenClipart / FreeSVG', source:'https://freesvg.org/bible-and-cross', url:'https://freesvg.org/img/Bible-And-Cross.png', license:'CC0 / Public domain' },
];
const results = await Promise.allSettled(sources.map(async source => {
  const response = await fetch(source.url, { signal:AbortSignal.timeout(45000) });
  if (!response.ok) throw Error(`${source.id}: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if (bytes.length<100) throw Error(`${source.id}: empty body`);
  const ext=source.url.endsWith('.png')?'png':'svg';
  source.file=`${source.id}.${ext}`;
  await writeFile(new URL(source.file,dir),bytes);
  console.log(`Saved ${source.file}: ${bytes.length} bytes`);
  return source;
}));
for(const r of results) if(r.status==='rejected') console.log(String(r.reason));
await writeFile(new URL('sources.json',dir),JSON.stringify(results.filter(r=>r.status==='fulfilled').map(r=>r.value),null,2));
