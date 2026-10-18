/**
 * Package native desktop captures into a script-free service demonstration.
 *
 * Input: artifacts/hero/service/<phase>.json
 *   { html, css, parts: { transcript, stage, live, catches, listen, orb, actions,
 *       run?, navigation?, overlay? }, viewport?: { width, height } }
 *
 * Run: node scripts/build-hero-service.mjs
 * Optional: --input <directory> --output <directory> --width 1600 --height 940
 *
 * states.json interns repeated HTML. The parent resolves a part with
 * fragments[states[phase][part]], then replaces [data-native-part="part"].
 * No desktop bundle, audio engine, or captured event handlers are included.
 * Only the sample landscape and native sample deck are retained as content
 * images; decorative app backgrounds are removed. The parent owns the timeline.
 */
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import postcss from 'postcss';
import { transform } from 'esbuild';

const argument = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1];
};
const input = resolve(argument('--input', 'artifacts/hero/service'));
const output = resolve(argument('--output', 'web/public/hero-service'));
// This rehearsal stays in the operator workspace, including its native dialogs.
const excludedPhases = new Set(['dashboard', 'transcript-open']);
const files = (await readdir(input)).filter(file => file.endsWith('.json')
  && !excludedPhases.has(basename(file, '.json'))).sort();
const captures = Object.fromEntries(await Promise.all(files.map(async file => [
  basename(file, '.json'), JSON.parse(await readFile(resolve(input, file), 'utf8')),
])));
const source = captures.idle;
if (!source) throw new Error(`Missing ${input}/idle.json; capture the native idle screen first.`);
const width = Number(argument('--width', source.viewport?.width ?? 1600));
const height = Number(argument('--height', source.viewport?.height ?? 940));
if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 4096)) {
  throw new Error('Capture dimensions must be finite and between 1 and 4096 pixels.');
}

const requiredParts = ['transcript', 'stage', 'live', 'catches', 'listen', 'orb', 'actions'];
for (const [phase, capture] of Object.entries(captures)) {
  if (typeof capture.html !== 'string' || typeof capture.css !== 'string' || !capture.parts) {
    throw new Error(`${phase}: expected html, css, and native parts.`);
  }
  if (!capture.html.includes('data-shell=')) throw new Error(`${phase}: missing the real app shell.`);
  if (JSON.stringify(capture).includes('[Truncated]')) throw new Error(`${phase}: truncated capture.`);
  const catchActions = capture.html.match(/<div\b[^>]*data-guide-area="catches"[^>]*class="catch-actions"[^>]*>[^]*?<\/div>/)?.[0];
  if (catchActions) capture.parts.catchActions = catchActions;
  for (const part of requiredParts) {
    if (typeof capture.parts[part] !== 'string' || !capture.parts[part].trim()) {
      throw new Error(`${phase}: missing native ${part} outerHTML.`);
    }
  }
  delete capture.parts.dashboardfull;
  // Keep the listening orb mounted between phases. Captured pose differences
  // would otherwise restart its CSS animation at every native content switch.
  if (phase !== 'idle' && captures['song-ready']) {
    const orb = captures['song-ready'].parts.orb;
    capture.html = capture.html.replace(capture.parts.orb, orb);
    capture.parts.orb = orb;
  }
  // Portaled run dialogs are outside [data-shell]. Every state needs a target
  // so a following state can close the dialog by replacing it with this blank.
  capture.parts.overlay = capture.parts.overlay || capture.overlay || '<div></div>';
}

/** Work on tags, never scripture text (which can contain words such as "only"). */
const TAG = /<[a-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/gi;
const ATTRIBUTE = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const imageFiles = new Map();
function contentImage(source) {
  if (!source) return null;
  // A browser capture resolves the fixture's relative URL against its server.
  if (source === '/hero-landscape/dark.webp'
    || /^http:\/\/(?:127\.0\.0\.1|localhost):5181\/hero-landscape\/dark\.webp$/.test(source)) {
    return '/hero-landscape/dark.webp';
  }
  if (!source.startsWith('data:image/svg+xml;charset=utf-8,')) return null;
  let svg;
  try { svg = decodeURIComponent(source.slice(source.indexOf(',') + 1)); }
  catch { return null; }
  // The source fixture's deckPage(3, 0, ...) creates this one native title slide.
  // Other data SVGs are app backgrounds, not selected presentation content.
  if (!svg.includes('viewBox="0 0 320 180"')
    || !svg.includes('>Be still</tspan>')
    || !svg.includes('>Psalm 46:10 · Carry peace into your week</tspan>')
    || /<(?!\/?(?:svg|defs|rect|text|tspan)\b)[^>]+>/i.test(svg)
    || /\son[a-z]+\s*=|(?:href|src)\s*=|url\(|javascript:/i.test(svg)) return null;
  // This is imported sample artwork, not an app panel. Retain the native
  // deck renderer's typography but let its selected landscape fill the slide.
  svg = svg.replace('<rect width="320" height="180" fill="#1b1d21"/>', '')
    .replaceAll('#99a0a8', '#e5f3f2').replaceAll('#5aa9a0', '#e4d87a');
  imageFiles.set('demo-be-still.svg', svg);
  return '/hero-service/demo-be-still.svg';
}

function sanitize(html) {
  return html
    // Native design seeds are incidental to this sample service. Keep their
    // real markup, but publish reserved example addresses and a neutral name.
    .replaceAll('give@vrcministries.org', 'giving@example.org')
    .replaceAll('vrcministries.org/give', 'example.org/give')
    .replaceAll('@vrcministries', '@samplechurch')
    .replace(/Pastor Dan/gi, 'Sample preacher')
    .replace(/(<span\b[^>]*)(>)(nothing staged|nothing on the projector)(<\/span>)/gi,
      (_match, start, _end, label, close) => `${start} data-native-empty="${label.toLowerCase() === 'nothing staged' ? 'preview' : 'live'}">${label.toLowerCase() === 'nothing staged' ? 'Nothing is previewed yet' : 'Nothing is live yet'}${close}`)
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|video|audio|picture)\b[^>]*>[^]*?<\/\1\s*>/gi, '')
    .replace(/<(?:script|style|iframe|object|embed|video|audio|picture|source|link|meta|base)\b[^>]*\/?\s*>/gi, '')
    .replace(/<(\/?)(?:form)\b/gi, '<$1div')
    .replace(TAG, tag => {
      const name = /^<([\w:-]+)/.exec(tag)?.[1]?.toLowerCase();
      if (!name) return tag;
      const captured = [...tag.matchAll(ATTRIBUTE)];
      const imageSource = name === 'img' ? captured.find(match => match[1].toLowerCase() === 'src') : null;
      const image = imageSource ? contentImage(imageSource[2] ?? imageSource[3] ?? imageSource[4]) : null;
      if (name === 'img' && !image) return '';
      const attrs = [];
      let inputType = '';
      for (const match of captured) {
        const attr = match[1].toLowerCase();
        const value = match[2] ?? match[3] ?? match[4];
        if (attr === 'type') inputType = value ?? '';
        if (/^on/i.test(attr) || ['autofocus', 'contenteditable', 'draggable', 'tabindex', 'action', 'formaction', 'srcdoc'].includes(attr)) continue;
        if (name === 'button' && attr === 'type') continue;
        if (name === 'a' && ['href', 'target', 'download', 'ping'].includes(attr)) continue;
        if ((attr === 'href' || attr === 'xlink:href') && value && !value.startsWith('#')) continue;
        if (attr === 'src' || attr === 'srcset') continue;
        // Native SVG masks are inline and cost no request; external images are removed.
        // Tailwind's layered !important utility outranks even an unlayered
        // !important override. Remove that one fill from the two canvases'
        // parent panels so the requested landscape can show through.
        const canvasPanel = /\bdata-guide-area=["'](?:preview|live)["']/.test(tag);
        const safeValue = attr === 'class' && value && canvasPanel
          ? value.split(/\s+/).filter(token => token !== '!bg-[#111111]').join(' ')
          : attr === 'style' && value
          ? value.replace(/--tri-dot-patches\s*:\s*url\([^)]*\)\s*;?/gi, '')
            .replace(/--tri-dot-[\w-]+\s*:\s*[^;]+;?/gi, '')
            .replace(/url\((?:&quot;|&#39;|["'])?(?!data:image\/svg\+xml|#)[^)]*\)/gi, 'none')
          : value;
        attrs.push(safeValue === undefined ? attr : `${attr}="${safeValue.replaceAll('"', '&quot;')}"`);
      }
      if (name === 'input' && inputType.toLowerCase() === 'file') return '';
      if (image) attrs.push(`src="${image}"`, `data-native-content-image="${image.includes('landscape') ? 'landscape' : 'slide'}"`, 'decoding="async"');
      if (['a', 'button', 'input', 'textarea', 'select', 'summary'].includes(name)) attrs.push('tabindex="-1"');
      if (name === 'button') attrs.push('type="button"');
      if ((name === 'input' || name === 'textarea') && !attrs.some(attr => /^readonly(?:=|$)/i.test(attr))) attrs.push('readonly');
      return `<${name}${attrs.length ? ` ${attrs.join(' ')}` : ''}${tag.endsWith('/>') ? ' /' : ''}>`;
    });
}

const mark = (html, part) => html.replace(/^(\s*<[\w:-]+)\b/, `$1 data-native-part="${part}"`);
function markParts(html, parts) {
  // Largest first preserves substring matches when a part contains another part.
  for (const [part, fragment] of Object.entries(parts).sort((a, b) => b[1].length - a[1].length)) {
    if (part === 'overlay') continue;
    if (!html.includes(fragment)) throw new Error(`Native shell does not contain its captured ${part} fragment.`);
    html = html.replace(fragment, mark(fragment, part));
  }
  return html;
}

const html = sanitize(markParts(source.html, source.parts) + mark(source.parts.overlay, 'overlay'));
const fragments = [];
const indices = new Map();
const states = {};
for (const [phase, capture] of Object.entries(captures)) {
  states[phase] = {};
  for (const [part, fragment] of Object.entries(capture.parts)) {
    const nested = markParts(fragment, Object.fromEntries(Object.entries(capture.parts)
      .filter(([key, child]) => key !== part && fragment.includes(child))));
    const cleaned = sanitize(mark(nested, part));
    let index = indices.get(cleaned);
    if (index === undefined) {
      index = fragments.length;
      fragments.push(cleaned);
      indices.set(cleaned, index);
    }
    states[phase][part] = index;
  }
}

// Captures already contain only browser-matched CSS. Dedupe exact rules inside
// matching at-rule contexts without flattening @layer, @media, or @supports.
const seenCSS = new Set();
const combined = postcss.root();
function collect(node, context = []) {
  if (node.type === 'comment') return;
  if (node.type === 'atrule' && /^(?:font-face|import|charset)$/i.test(node.name)) return;
  if (node.type === 'atrule' && node.nodes && !/keyframes$/i.test(node.name)
    && node.nodes.some(child => child.type !== 'decl' && child.type !== 'comment')) {
    for (const child of node.nodes) collect(child, [...context, { name: node.name, params: node.params }]);
    return;
  }
  const key = JSON.stringify(context) + node.toString();
  if (seenCSS.has(key)) return;
  seenCSS.add(key);
  let wrapped = node.clone();
  for (let i = context.length - 1; i >= 0; i--) wrapped = postcss.atRule(context[i]).append(wrapped);
  combined.append(wrapped);
}
for (const capture of Object.values(captures)) {
  postcss.parse(capture.css).nodes.forEach(node => collect(node));
}
function mergeAdjacentGroups(container) {
  for (const node of [...(container.nodes ?? [])]) {
    const previous = node.prev();
    if (node.type === 'atrule' && /^(?:layer|media|supports|container)$/i.test(node.name)
      && node.nodes && previous?.type === 'atrule' && previous.nodes
      && node.name === previous.name && node.params === previous.params) {
      previous.append(node.nodes);
      node.remove();
    }
  }
  for (const node of container.nodes ?? []) if (node.nodes) mergeAdjacentGroups(node);
}
mergeAdjacentGroups(combined);
combined.walkDecls(declaration => {
  if (declaration.prop.startsWith('--tri-dot-')) { declaration.remove(); return; }
  declaration.value = declaration.value.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (url, _quote, resource) =>
    resource.startsWith('#') || resource.startsWith('data:image/svg+xml') ? url : 'none');
});

const additions = `
  @font-face { font-family: 'Geist'; src: url('/hero-service/geist-variable.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
  @font-face { font-family: 'Geist Mono'; src: url('/hero-service/geist-mono-variable.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
  html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: transparent !important; }
  body { font-family: 'Geist', sans-serif; }
  [data-shell] { width: ${width}px !important; height: ${height}px !important; background: transparent !important; }
  [data-shell] > main, .tri-workspace-aurora { background: transparent !important; }
  .tri-workspace-aurora::before, .tri-workspace-aurora::after { background: none !important; }
  .tri-live-header { background: rgb(1 8 6 / .94) !important; }
  .tri-dotted-surface::before, .tri-empty-surface::before, .verse-nav-hint::before {
    content: none !important; display: none !important; background-image: none !important; animation: none !important;
  }
  :root { --hero-output-image: url('/hero-landscape/dark.webp'); }
  :root[data-hero-theme='light'] { --hero-output-image: url('/hero-landscape/light.webp'); }
  [data-guide-area='preview'], [data-guide-area='live'] { background: #111 !important; }
  [data-native-part='transcript'], .operator-rail { background-color: rgb(1 8 6 / .64) !important; }
  [class~='group/canvas'] { background: #010806 var(--hero-output-image) center / cover no-repeat !important; }
  [class~='group/canvas'] > .bg-black { background: #010806 !important; opacity: .3 !important; }
  [data-native-content-image='slide'] {
    background: linear-gradient(rgb(1 8 6 / .3), rgb(1 8 6 / .3)), var(--hero-output-image) center / cover no-repeat, #010806 !important;
  }
  [data-native-content-image] { display: block !important; }
  [data-native-empty] { font-size: 14px; font-style: italic; line-height: 1.5; color: rgb(229 243 242 / .55); text-transform: none !important; }
  /* SvgOrbsPill's captured path buckets are the actual orb. Move that small
     vector and its accent light; no per-dot JS, renderer, or engine is loaded. */
  .tri-header-orb svg { transform-origin: 50% 50%; animation: hero-native-orb-turn 7s ease-in-out infinite; }
  .tri-header-orb svg > path:not([fill='#e5f3f2']) { animation: hero-native-orb-light 3.2s ease-in-out infinite; }
  .tri-header-orb svg > path:nth-child(3n) { animation-delay: -.8s; }
  .tri-header-orb svg > path:nth-child(3n + 1) { animation-delay: -1.6s; }
  @keyframes hero-native-orb-turn {
    0%, 100% { transform: rotate(-7deg) scale(.96); }
    50% { transform: rotate(9deg) scale(1.03); }
  }
  @keyframes hero-native-orb-light { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
  input, textarea { caret-color: transparent; }
  button, a, input, textarea, select, summary { pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;
const minimized = await transform(combined.toString() + additions, { loader: 'css', minify: true, legalComments: 'none' });
const document = `<!doctype html>
<!-- Generated from native desktop captures by scripts/build-hero-service.mjs. -->
<html lang="en" data-theme="dark" data-density="comfortable" data-aurora="fern">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'">
<title>Trilorah sample service</title>
<link rel="preload" href="/hero-service/geist-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/hero-service/app.css"></head>
<body>${html}</body></html>`;
const stateJSON = JSON.stringify({ version: 1, initial: 'idle', width, height, fragments, states });
if (/<script\b|\son[a-z]+\s*=|(?:src|href)="(?:https?:|file:|\/src\/|\/@)/i.test(document + stateJSON)) {
  throw new Error('Unexpected live dependency or event handler survived the native export.');
}

await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(resolve(output, 'app.html'), document),
  writeFile(resolve(output, 'app.css'), minimized.code),
  writeFile(resolve(output, 'states.json'), stateJSON),
  ...[...imageFiles].map(([name, contents]) => writeFile(resolve(output, name), contents)),
  ...['geist-variable', 'geist-mono-variable'].map(font => copyFile(`src/ui/fonts/${font}.woff2`, resolve(output, `${font}.woff2`))),
  copyFile('public/fonts/GEIST-LICENSE.txt', resolve(output, 'GEIST-LICENSE.txt')),
]);
const raw = Buffer.byteLength(document + minimized.code + stateJSON);
const zipped = [document, minimized.code, stateJSON].reduce((total, item) => total + gzipSync(item).length, 0);
console.log(`Native service: ${Object.keys(states).length} states, ${fragments.length} unique parts; ${Math.round(raw / 1024)} KiB raw / ${Math.round(zipped / 1024)} KiB gzipped (+ two local font files).`);
