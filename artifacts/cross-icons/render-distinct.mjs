import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('../../web/node_modules/sharp');
const dir = new URL('./distinct/', import.meta.url);
let sources = JSON.parse(await readFile(new URL('sources.json', dir), 'utf8'));
const additions = [
  { title: 'Wooden beams', id: 'wood', author: 'barnheartowl · OpenClipart', source: 'https://openclipart.org/detail/221561/christian-cross-outlined', url: 'https://openclipart.org/download/221561', file: 'wood.svg' },
  { title: 'Calvary and path', id: 'hill', author: 'centroacademico · OpenClipart', source: 'https://openclipart.org/detail/130333/calvary-silhouette', url: 'https://openclipart.org/download/130333', file: 'hill.svg' },
  { title: 'Radiating cross', id: 'sunburst', author: 'logoscambodia · OpenClipart', source: 'https://openclipart.org/detail/216709/jesus-reappearance', url: 'https://openclipart.org/download/216709', file: 'sunburst.svg' },
  { title: 'Cross and crown', id: 'crown', author: 'j4p4n · OpenClipart', source: 'https://openclipart.org/detail/296666/cross-and-crown', url: 'https://openclipart.org/download/296666', file: 'crown.svg' },
  { title: 'Light through the cross', id: 'geometric', author: 'OpenClipart', source: 'https://openclipart.org/detail/308021/stylized-cross-design', url: 'https://openclipart.org/download/308021', file: 'geometric.svg' },
  { title: 'Three-bar Orthodox', id: 'orthodox', author: 'Bartledan / Sarang · Wikimedia', source: 'https://commons.wikimedia.org/wiki/File:EastOrthodoxcross.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/8/83/EastOrthodoxcross.svg', file: 'orthodox-russian.svg' },
  { title: 'Three crosses on a hill', id: 'three-hill', author: 'barnheartowl · ClipSafari', source: 'https://www.clipsafari.com/clips/o214741-three-crosses-on-a-hill', url: 'https://images.clipsafari.com/h9xzgl9ij1i8xkn577hzuwr0b0wg?filename=three-crosses-on-a-hill.svg', file: 'three-hill.svg' },
];
for (const icon of additions) await copyFile(`/private/tmp/cross-research-agent/${icon.file}`, new URL(icon.file, dir));
sources = [...sources, ...additions];
const order = ['wood', 'cross-with-crown-of-thorns', 'thorns-cross', 'hill', 'sunburst', 'cross-and-heart', 'interlocking-geometric-cross', 'stylized-cross-silhouette', 'geometric', 'orthodox', 'three-hill', 'crown'];
sources = order.map(id => sources.find(icon => icon.id === id));
if (sources.some(icon => !icon)) throw new Error('Missing reference');
await writeFile(new URL('selected-sources.json', dir), JSON.stringify(sources, null, 2));

const width = 1440;
const height = 1350;
const colWidth = 336;
const rowHeight = 390;
const composites = [];
let labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>text{font-family:Arial,sans-serif;fill:#24231e}.muted{fill:#65645e}</style><text x="48" y="58" font-size="33">Distinct Christian cross designs</text><text x="48" y="92" class="muted" font-size="19">12 research references · Cross-only designs</text>`;
for (let index = 0; index < sources.length; index++) {
  const icon = sources[index];
  const x = 48 + (index % 4) * colWidth;
  const y = 138 + Math.floor(index / 4) * rowHeight;
  const bytes = await readFile(new URL(icon.file, dir));
  const png = await sharp(bytes, { density: 96, limitInputPixels: 150000000 }).resize(258, 270, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  composites.push({ input: png, left: x + 15, top: y + 44 });
  labels += `<text x="${x}" y="${y + 23}" font-size="23">${String(index + 1).padStart(2, '0')} · ${icon.title.replaceAll('&', '&amp;')}</text>`;
  labels += `<text x="${x}" y="${y + 351}" font-size="18" class="muted">${icon.author.includes(' · ') ? icon.author.split(' · ')[0] : 'OpenClipart / FreeSVG'}</text>`;
  if (index < 8) labels += `<path d="M${x} ${y + 377}h308" stroke="#e3e1d9"/>`;
}
labels += `<text x="48" y="1328" class="muted" font-size="17">Research references from OpenClipart, FreeSVG, Wikimedia Commons, and ClipSafari · Numbered for selection</text></svg>`;
const text = await sharp(Buffer.from(labels)).png().toBuffer();
await sharp({ create: { width, height, channels: 4, background: '#ffffff' } }).composite([{ input: text, left: 0, top: 0 }, ...composites]).png().toFile(new URL('distinct-cross-comparison.png', dir).pathname);
console.log('Rendered 12 distinct cross-only references.');
