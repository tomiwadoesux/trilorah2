import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { STUDY_ICONS, STUDY_STYLES, studySvg } from '../src/design/entries/iconStudiesData.ts';

const destination = fileURLToPath(new URL('../public/icon-studies/', import.meta.url));
await mkdir(destination, { recursive: true });
for (const family of STUDY_STYLES) {
  for (const icon of STUDY_ICONS) {
    await writeFile(`${destination}${family.id}-${icon.id}.svg`, `${studySvg(icon.id, family.id)}\n`);
  }
}
await writeFile(`${destination}README.txt`, [
  'TRILORAH — 25 original icon studies / Edition 02',
  '',
  'Five subjects: Bible, microphone, songs, search, media.',
  `Five families: ${STUDY_STYLES.map(style => style.name).join(', ')}.`,
  '',
  'Each SVG uses a 32 × 32 viewBox. Scale with width and height.',
  'All artwork is monochrome, drawn for a dark surface.',
  'Use the color attribute or CSS color to change the ink.',
  'Contour and Soft Solid are best suited to small controls.',
  'Duotone adds a soft grey field; Stencil uses deliberate openings.',
  'Cutout uses square terminals and angular silhouettes.',
  '',
  'These 25 glyphs were drawn for Trilorah. They are separate from the',
  'Hairline library illustrations shown below the comparison sheet.',
  '',
].join('\n'));
console.log('Exported 25 original SVGs to public/icon-studies.');
