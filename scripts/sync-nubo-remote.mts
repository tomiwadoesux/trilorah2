import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrilorahIcon } from '../src/ui/NuboIcon.tsx';
import type { TrilorahIconName } from '../shared/icons/nubo.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const remotePath = `${root}public/mobile-remote.html`;
const remote = await readFile(remotePath, 'utf8');
const marker = /<!-- BEGIN TRILORAH (?:CUTOUT|NUBO) ICONS -->[\s\S]*?<!-- END TRILORAH (?:CUTOUT|NUBO) ICONS -->/g;
if ([...remote.matchAll(marker)].length !== 1) throw new Error('Expected one icon generation block in mobile-remote.html');
const names: TrilorahIconName[] = ['more', 'search', 'chevron-left', 'chevron-right', 'arrow-up', 'close', 'pencil', 'play', 'pause', 'reset', 'microphone'];
const templates = names.map(name => `<template id="tri-nubo-${name}">${renderToStaticMarkup(createElement(TrilorahIcon, { name, size: 24 }))}</template>`).join('\n');
const license = await readFile(`${root}public/licenses/nubo.txt`, 'utf8');
const block = `<!-- BEGIN TRILORAH NUBO ICONS -->\n<!--\n${license.trim()}\n-->\n${templates}\n<!-- END TRILORAH NUBO ICONS -->`;
await writeFile(remotePath, remote.replace(marker, block));
console.log(`Synced ${names.length} Nubo icons and the MIT notice into the self-contained phone remote.`);
