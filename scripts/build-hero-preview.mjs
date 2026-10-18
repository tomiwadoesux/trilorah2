/** Package the DOM/CSS exported from hero-source-preview.mts into a script-free preview. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { transform } from 'esbuild';

const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [resolve('web')] }));
const phases = ['idle', 'book', 'caught', 'reading', 'done'];
const captures = Object.fromEntries(await Promise.all(phases.map(async phase =>
  [phase, JSON.parse(await readFile(`artifacts/hero/app-${phase}.json`, 'utf8'))])));
const source = captures.idle;
// A marketing capture must never carry a saved service into the preview.
for (const [phase, capture] of Object.entries(captures)) {
  if (!capture.html.includes('run of show (0)') || /\bdata-run-section=/.test(capture.html)) {
    throw new Error(`Expected the app's empty run of show in ${phase}`);
  }
  if (JSON.stringify(capture).includes('[Truncated]')) {
    throw new Error(`Incomplete ${phase} capture; export HTML and CSS in chunks`);
  }
}
const output = 'web/public/hero-preview';
await mkdir(output, { recursive: true });

// No app script, links, editable fields, file pickers, or form submission survive.
const sanitize = html => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<input\b[^>]*type="file"[^>]*>/gi, '')
  // Restrict attribute stripping to tags: words such as “only” are scripture text.
  .replace(/<[a-z][^>]*>/gi, tag => tag.replace(/\s(?:on[a-z]+|autofocus|contenteditable|draggable|title|tabindex|disabled|aria-disabled)(?:="[^"]*")?(?=[\s>])/gi, ''))
  .replace(/<(\/?)(?:form)\b/g, '<$1div')
  .replace(/<a\b([^>]*)>/gi, (_, attrs) => `<a${attrs.replace(/\s(?:href|target|download)="[^"]*"/gi, '')} tabindex="-1">`)
  .replace(/<button\b([^>]*)>/gi, (_, attrs) => `<button${attrs.replace(/\stype="[^"]*"/g, '')} type="button" tabindex="-1">`)
  .replace(/<(input|textarea)\b([^>]*)>/gi, '<$1$2 readonly tabindex="-1">')
  .replaceAll('/src/assets/backgrounds/valley.jpg', '/hero-preview/valley.webp');

const mark = (html, part) => html.replace(/^<(\w+)/, `<$1 data-hero-part="${part}"`);
let html = source.html;
for (const [part, fragment] of Object.entries(source.parts)) {
  if (!fragment || !html.includes(fragment)) throw new Error(`Missing native hero part: ${part}`);
  html = html.replace(fragment, mark(fragment, part));
}
html = sanitize(html);
const templates = phases.flatMap(phase => Object.entries(captures[phase].parts).map(([part, fragment]) => {
  if (!fragment) throw new Error(`Missing ${phase} ${part}`);
  return `<template id="hero-${phase}-${part}">${sanitize(mark(fragment, part))}</template>`;
})).join('\n');

let css = source.css.replace(/\/\*[\s\S]*?\*\//g, '');
for (const font of ['geist-variable', 'geist-mono-variable', 'geist-italic-variable', 'geist-mono-italic-variable']) {
  css = css.replaceAll(`/src/ui/fonts/${font}.woff2`, `/hero-preview/${font}.woff2`);
  await copyFile(`src/ui/fonts/${font}.woff2`, `${output}/${font}.woff2`);
}
css += `
  html, body { margin: 0; width: 1440px; height: 900px; overflow: hidden; }
  body { font-family: 'Geist', sans-serif; }
  [data-shell] { width: 1440px !important; height: 900px !important; }
  button, [role='button'] { cursor: pointer; touch-action: manipulation; }
  button:active { filter: brightness(1.2); }
  button:focus { outline: none; }
  input, textarea { caret-color: transparent; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;
const minimized = await transform(css, { loader: 'css', minify: true, legalComments: 'none' });
await writeFile(`${output}/app.css`, minimized.code);
await sharp('src/assets/backgrounds/valley.jpg').resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${output}/valley.webp`);
await copyFile('public/fonts/GEIST-LICENSE.txt', `${output}/GEIST-LICENSE.txt`);
const document = `<!doctype html>
<!-- Generated from the actual desktop app. Refresh using scripts/hero-source-preview.mts. -->
<html lang="en" data-theme="dark" data-density="comfortable" data-aurora="fern">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'">
<title>Trilorah desktop preview</title><link rel="stylesheet" href="/hero-preview/app.css"><link rel="stylesheet" href="/hero-preview/transcript-demo.css"></head>
<body role="img" aria-label="Trilorah's desktop interface playing a sample practice sermon.">${html}${templates}</body></html>`;
if (/<script\b|\son[a-z]+="|(?:src|href)="(?:https?:|file:|\/src\/|\/@)/i.test(document)) throw new Error('Unexpected live dependency in hero preview');
await writeFile(`${output}/app.html`, document);
// Optional browser capture source for the lightweight marketing hero image.
// Open at 1600 × 940, capture after fonts settle, then encode as interface.webp.
if (process.argv.includes('--poster')) {
  let poster = source.html;
  for (const [part, fragment] of Object.entries(source.parts)) {
    poster = poster.replace(fragment, captures.reading.parts[part]);
  }
  await writeFile(`${output}/capture.html`, document
    .replace(`${html}${templates}`, sanitize(poster))
    .replace('</head>', '<style>html,body,[data-shell]{width:1600px!important;height:940px!important}*,*::before,*::after{animation:none!important;transition:none!important}</style></head>'));
}
console.log(`App HTML + CSS: ${Math.round((gzipSync(document).length + gzipSync(minimized.code).length) / 1024)} KiB gzipped; no app JavaScript.`);
