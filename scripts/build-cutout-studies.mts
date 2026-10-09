import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { STUDY_ICONS } from '../src/design/entries/iconStudiesData.ts';
import { CUTOUT_STYLES, cutoutSvg } from '../src/design/entries/cutoutStudiesData.ts';

const destination = fileURLToPath(new URL('../public/cutout-studies/', import.meta.url));
await mkdir(destination, { recursive: true });
for (const family of CUTOUT_STYLES) {
  for (const icon of STUDY_ICONS) {
    await writeFile(`${destination}${family.id}-${icon.id}.svg`, `${cutoutSvg(icon.id, family.id)}\n`);
  }
}
await writeFile(`${destination}README.txt`, [
  'TRILORAH — Cutout explorations',
  '',
  '30 original SVGs: the chosen Cutout family and five new variations.',
  'Subjects: Bible, microphone, songs, search, media.',
  '',
  ...CUTOUT_STYLES.map(family => `${family.code}. ${family.name}: ${family.description}`),
  '',
  'Each icon uses a 32 × 32 viewBox. Scale with width and height.',
  'Set color to change the ink. Every cutout is genuinely transparent.',
  'Original is the approved starting point; the other families are studies.',
  '',
].join('\n'));
console.log('Exported 30 Cutout SVGs to public/cutout-studies.');
