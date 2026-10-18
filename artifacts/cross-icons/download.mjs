import { mkdir, writeFile } from 'node:fs/promises';

const dir = new URL('./', import.meta.url);
const icons = [
  { title: 'Minimal solid', family: 'Material Design Icons', id: 'mdi-cross', url: 'https://raw.githubusercontent.com/Templarian/MaterialDesign-SVG/master/svg/cross.svg', source: 'https://pictogrammers.com/library/mdi/icon/cross/' },
  { title: 'Thin outline', family: 'Phosphor · Thin', id: 'phosphor-thin', url: 'https://raw.githubusercontent.com/phosphor-icons/core/main/assets/thin/cross-thin.svg', source: 'https://github.com/phosphor-icons/core/blob/main/assets/thin/cross-thin.svg' },
  { title: 'Regular outline', family: 'Phosphor · Regular', id: 'phosphor-regular', url: 'https://raw.githubusercontent.com/phosphor-icons/core/main/assets/regular/cross.svg', source: 'https://github.com/phosphor-icons/core/blob/main/assets/regular/cross.svg' },
  { title: 'Bold outline', family: 'Phosphor · Bold', id: 'phosphor-bold', url: 'https://raw.githubusercontent.com/phosphor-icons/core/main/assets/bold/cross-bold.svg', source: 'https://github.com/phosphor-icons/core/blob/main/assets/bold/cross-bold.svg' },
  { title: 'Soft filled', family: 'Phosphor · Fill', id: 'phosphor-fill', url: 'https://raw.githubusercontent.com/phosphor-icons/core/main/assets/fill/cross-fill.svg', source: 'https://github.com/phosphor-icons/core/blob/main/assets/fill/cross-fill.svg' },
  { title: 'Rounded outline', family: 'Tabler · Outline', id: 'tabler-outline', url: 'https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/cross.svg', source: 'https://tabler.io/icons/icon/cross' },
  { title: 'Rounded filled', family: 'Tabler · Filled', id: 'tabler-fill', url: 'https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/filled/cross.svg', source: 'https://github.com/tabler/tabler-icons/blob/main/icons/filled/cross.svg' },
  { title: 'Classic filled', family: 'Font Awesome · Solid', id: 'fontawesome', url: 'https://raw.githubusercontent.com/FortAwesome/Font-Awesome/7.x/svgs/solid/cross.svg', source: 'https://fontawesome.com/icons/cross?f=classic&s=solid' },
  { title: 'Square outline', family: 'Material Design Icons', id: 'mdi-outline', url: 'https://raw.githubusercontent.com/Templarian/MaterialDesign-SVG/master/svg/cross-outline.svg', source: 'https://pictogrammers.com/library/mdi/icon/cross-outline/' },
  { title: 'Celtic cross', family: 'Material Design Icons', id: 'mdi-celtic', url: 'https://raw.githubusercontent.com/Templarian/MaterialDesign-SVG/master/svg/cross-celtic.svg', source: 'https://pictogrammers.com/library/mdi/icon/cross-celtic/' },
  { title: 'Bolnisi cross', family: 'Material Design Icons', id: 'mdi-bolnisi', url: 'https://raw.githubusercontent.com/Templarian/MaterialDesign-SVG/master/svg/cross-bolnisi.svg', source: 'https://pictogrammers.com/library/mdi/icon/cross-bolnisi/' },
  { title: 'Slender solid', family: 'Maki · Religious Christian', id: 'maki', url: 'https://raw.githubusercontent.com/mapbox/maki/main/icons/religious-christian.svg', source: 'https://github.com/mapbox/maki/blob/main/icons/religious-christian.svg' },
];
await mkdir(dir, { recursive: true });
const results = await Promise.allSettled(icons.map(async icon => {
  const response = await fetch(icon.url);
  if (!response.ok) throw new Error(`${icon.id}: ${response.status}`);
  const svg = await response.text();
  if (!svg.includes('<svg')) throw new Error(`${icon.id}: not SVG`);
  await writeFile(new URL(`${icon.id}.svg`, dir), svg);
  return { ...icon, file: `${icon.id}.svg` };
}));
for (let i = 0; i < results.length; i++) {
  const result = results[i];
  console.log(result.status === 'fulfilled' ? `OK ${icons[i].id}` : `FAILED ${result.reason}`);
}
await writeFile(new URL('sources.json', dir), JSON.stringify(results.filter(result => result.status === 'fulfilled').map(result => result.value), null, 2));
if (results.some(result => result.status === 'rejected')) process.exitCode = 1;
