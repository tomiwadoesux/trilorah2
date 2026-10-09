import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CUTOUT_ICONS, CUTOUT_NAMES, cutoutBody, cutoutSvg, type CutoutIconName } from '../shared/cutout/index.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = `${root}public/cutout-icons/`;
await mkdir(directory, { recursive: true });
const files: Array<{ name: string; data: Buffer }> = [];
async function asset(name: string, content: string) {
  const data = Buffer.from(content);
  await writeFile(`${directory}${name}`, data);
  files.push({ name, data });
}
for (const name of CUTOUT_NAMES) await asset(`${name}.svg`, `${cutoutSvg(name)}\n`);
await asset('manifest.json', JSON.stringify(CUTOUT_NAMES.map(name => ({ name, ...CUTOUT_ICONS[name] })), null, 2));
await asset('motion.css', await readFile(`${root}shared/cutout/motion.css`, 'utf8'));
await asset('CREATE-ICON.md', await readFile(`${root}docs/CUTOUT-ICONS.md`, 'utf8'));
await asset('sprite.svg', `<svg xmlns="http://www.w3.org/2000/svg">${CUTOUT_NAMES.map(name => `<symbol id="tri-cutout-${name}" viewBox="0 0 32 32" fill="currentColor">${cutoutBody(name)}</symbol>`).join('')}</svg>\n`);

// Portable, dependency-free ZIP (stored entries). Geometry is small enough that
// compression is unnecessary; a fixed DOS epoch keeps regeneration deterministic.
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const local: Buffer[] = [], central: Buffer[] = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(`trilorah-cutout/${file.name}`);
  const checksum = crc32(file.data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(0x21, 12); header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(file.data.length, 18); header.writeUInt32LE(file.data.length, 22); header.writeUInt16LE(name.length, 26);
  local.push(header, name, file.data);
  const index = Buffer.alloc(46);
  index.writeUInt32LE(0x02014b50, 0); index.writeUInt16LE(20, 4); index.writeUInt16LE(20, 6); index.writeUInt16LE(0x800, 8);
  index.writeUInt16LE(0x21, 14); index.writeUInt32LE(checksum, 16);
  index.writeUInt32LE(file.data.length, 20); index.writeUInt32LE(file.data.length, 24); index.writeUInt16LE(name.length, 28);
  index.writeUInt32LE(offset, 42); central.push(index, name);
  offset += header.length + name.length + file.data.length;
}
const directoryBytes = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directoryBytes.length, 12); end.writeUInt32LE(offset, 16);
await writeFile(`${directory}trilorah-cutout-icons.zip`, Buffer.concat([...local, directoryBytes, end]));

// The LAN remote is one self-contained HTML response, so embed the same groups.
const remotePath = `${root}public/mobile-remote.html`;
const remote = await readFile(remotePath, 'utf8');
const marker = /<!-- BEGIN TRILORAH CUTOUT ICONS -->[\s\S]*?<!-- END TRILORAH CUTOUT ICONS -->/g;
if ([...remote.matchAll(marker)].length !== 1) throw new Error('Expected one Cutout generation block in mobile-remote.html');
const remoteNames: CutoutIconName[] = ['more', 'search', 'chevron-left', 'chevron-right', 'arrow-up', 'close', 'pencil', 'play', 'pause', 'reset', 'microphone'];
const templates = remoteNames.map(name => `<template id="tri-cutout-${name}">${cutoutSvg(name, { size: 24, decorative: true })}</template>`).join('\n');
const motion = await readFile(`${root}shared/cutout/motion.css`, 'utf8');
await writeFile(remotePath, remote.replace(marker, `<!-- BEGIN TRILORAH CUTOUT ICONS -->\n<style>${motion}</style>\n${templates}\n<!-- END TRILORAH CUTOUT ICONS -->`));
console.log(`Exported ${CUTOUT_NAMES.length} Cutout icons, parts manifest, sprite, guide, motion CSS, ZIP, and phone templates.`);
