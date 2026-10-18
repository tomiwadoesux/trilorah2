import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('../../web/node_modules/sharp');
const dir = new URL('./', import.meta.url);
const icons = JSON.parse(await readFile(new URL('sources.json', dir), 'utf8'));
const ink = '#edecec';
const background = '#14120b';
const width = 1240;
const height = 1120;
const colWidth = 292;
const rowHeight = 308;
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const composites = [];
let labels = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>text{font-family:Arial,sans-serif;fill:${ink}}.muted{fill:#a6a59d}</style><text x="40" y="55" font-size="30">12 cross icon variations</text><text x="40" y="88" class="muted" font-size="17">Original library icons · Large view + 12px navigation sample shown at 2×</text>`;

for (let index = 0; index < icons.length; index++) {
  const icon = icons[index];
  const x = 40 + (index % 4) * colWidth;
  const y = 132 + Math.floor(index / 4) * rowHeight;
  let svg = await readFile(new URL(icon.file, dir), 'utf8');
  svg = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/currentColor|#000000|#000\b|\bblack\b/g, ink);
  svg = svg.replace(/<svg\b([^>]*)>/, (_, attributes) => `<svg${attributes} color="${ink}"${/\bfill=/.test(attributes) ? '' : ` fill="${ink}"`}>`);
  const iconBuffer = Buffer.from(svg);
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const large = await sharp(iconBuffer).resize(92, 92, { fit: 'contain', background: transparent }).png().toBuffer();
  const small = await sharp(iconBuffer).resize(24, 24, { fit: 'contain', background: transparent }).png().toBuffer();
  composites.push({ input: large, left: x + 96, top: y + 53 });
  composites.push({ input: small, left: x + 88, top: y + 242 });
  labels += `<text x="${x}" y="${y + 23}" font-size="21">${String(index + 1).padStart(2, '0')} · ${escape(icon.title)}</text>`;
  labels += `<text x="${x}" y="${y + 190}" font-size="17" class="muted">${escape(icon.family)}</text>`;
  labels += `<text x="${x + 118}" y="${y + 264}" font-size="28">Support</text>`;
  if (index < 8) labels += `<path d="M${x} ${y + 296}h268" stroke="#343228"/>`;
}
labels += `<text x="40" y="1091" class="muted" font-size="17">Sources: Pictogrammers / MDI · Phosphor · Tabler · Font Awesome · Mapbox Maki</text></svg>`;
const textImage = await sharp(Buffer.from(labels)).png().toBuffer();
await sharp({ create: { width, height, channels: 4, background } }).composite([{ input: textImage, left: 0, top: 0 }, ...composites]).png().toFile(new URL('cross-comparison.png', dir).pathname);
await writeFile(new URL('cross-comparison-labels.svg', dir), labels);
console.log(`Rendered ${icons.length} cross icons.`);
