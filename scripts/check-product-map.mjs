#!/usr/bin/env node
// Repository documentation check only. Does not run the app or any guide action.
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'docs/product-guide');
const accept = process.argv.includes('--snapshot-after-review');
const anchorsOnly = process.argv.includes('--anchors');
const args = process.argv.slice(2);
if (args.some(arg => !['--snapshot-after-review', '--anchors'].includes(arg)) || args.length > 1) {
  console.error('Usage: node scripts/check-product-map.mjs [--snapshot-after-review | --anchors]');
  process.exit(2);
}
const isSelector = value => /^[[.#]/.test(value) || value.includes('[');
const neverClick = ['listen', 'go-live', 'clear', 'run-apply', 'stock-result', 'tri-confirm', 'tri-save', 'remote-approve', 'remote-enable', 'remote-code', 'phone-allow', 'phone-use', 'song-save', 'audio-option-phone'];

/** Every data-guide / guideId anchor and data-guide-area in app source, with the files that declare them. */
async function anchorInventory() {
  const anchors = new Map(); const areas = new Map();
  for (const file of await collect('src')) {
    if (file.includes('/ProductGuide.tsx') || file.includes('/guideWalkthroughs')) continue; // the guide's own selectors are not controls
    const source = await readFile(resolveSource(file), 'utf8');
    // Literal names, names inside a JSX expression ("x" : undefined), and template prefixes (library-${id} -> library-).
    for (const match of source.matchAll(/(?:data-guide|guideId)=(?:"([^"]+)"|'([^']+)'|\{([^}]*)\})/g)) {
      const names = match[1] || match[2] ? [match[1] || match[2]] : [...match[3].matchAll(/["']([a-z0-9.-]+)["']|`([a-z0-9.-]+-)\$\{/gi)].map(hit => hit[1] || hit[2]);
      for (const name of names.filter(name => name.length > 1 && !/[${]/.test(name))) { const refs = anchors.get(name) ?? new Set(); refs.add(file); anchors.set(name, refs); }
    }
    for (const match of source.matchAll(/data-guide-area=["']([^"']+)["']/g)) { const refs = areas.get(match[1]) ?? new Set(); refs.add(file); areas.set(match[1], refs); }
  }
  return { anchors, areas };
}
// A template anchor in code (`library-${id}`) is recorded as its prefix "library-"; a lesson may use any suffix of it.
const isPrefix = name => name.endsWith('-');
function anchorExists(name, anchors) {
  if (anchors.has(name)) return true;
  return [...anchors.keys()].some(known => isPrefix(known) && name.startsWith(known));
}

/** Lessons must point at anchors that exist; anchors nobody teaches are listed so a new feature cannot be forgotten. */
async function checkAnchors(map, packageVersion) {
  const { anchors, areas } = await anchorInventory();
  const errors = []; const warnings = [];
  if (map.packageVersion !== packageVersion) errors.push(`Map says version ${map.packageVersion}; package.json says ${packageVersion}. Review the map for this release, then update packageVersion.`);
  const taught = new Set();
  for (const task of map.tasks) {
    for (const name of task.guideAnchors ?? []) taught.add(name);
    if (task.near) for (const area of task.near) if (!areas.has(area) && !['dashboard', 'settings', 'profile', 'operator'].includes(area)) warnings.push(`${task.id}: near "${area}" has no data-guide-area in code`);
    if (!task.lesson) continue;
    if (!Array.isArray(task.asks) || !task.asks.length) errors.push(`${task.id}: a lesson needs asks (the questions people type)`);
    if (!task.since) errors.push(`${task.id}: a lesson needs since (the version it arrived in)`);
    const ids = new Set();
    for (const point of task.lesson) {
      if (!point.id || ids.has(point.id)) errors.push(`${task.id}: lesson point ids must be present and unique`); ids.add(point.id);
      if (!Array.isArray(point.say) || point.say.length < 1 || point.say.length > 4 || point.say.some(line => typeof line !== 'string' || !line.trim())) errors.push(`${task.id}/${point.id}: say needs one to four written lines`);
      for (const line of point.say ?? []) if (line.split(/\s+/).length > 14) warnings.push(`${task.id}/${point.id}: "${line}" is over twelve words`);
      if (!['click', 'focus', 'point', 'input', 'listen', 'check', 'write', 'choose'].includes(point.do)) errors.push(`${task.id}/${point.id}: unknown action ${point.do}`);
      if (point.do === 'click' && !point.done) errors.push(`${task.id}/${point.id}: a click needs a done signal`);
      if (point.do === 'click' && neverClick.includes(point.anchor)) errors.push(`${task.id}/${point.id}: "${point.anchor}" may never be clicked by the Messenger`);
      for (const value of [point.anchor, point.done]) {
        if (!value) continue;
        if (isSelector(value)) { for (const match of value.matchAll(/data-guide="([^"$]+)"/g)) { taught.add(match[1]); if (!anchorExists(match[1], anchors)) errors.push(`${task.id}/${point.id}: anchor "${match[1]}" is not in the code`); } continue; }
        taught.add(value);
        if (!anchorExists(value, anchors)) errors.push(`${task.id}/${point.id}: anchor "${value}" is not in the code`);
      }
    }
  }
  for (const [key, trouble] of Object.entries(map.troubles ?? {})) {
    if (!map.tasks.some(task => task.id === trouble.task)) errors.push(`trouble ${key}: unknown task ${trouble.task}`);
    if (!Array.isArray(trouble.say) || !trouble.say.length) errors.push(`trouble ${key}: needs lines`);
  }
  const orphans = [...anchors.keys()].filter(name => !name.startsWith('demo-') && !isPrefix(name) && !taught.has(name) && ![...taught].some(known => isPrefix(known) ? name.startsWith(known) : false)).sort();
  return { errors, warnings, orphans, anchors: anchors.size, areas: areas.size };
}
const digest = value => createHash('sha256').update(value).digest('hex');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html']);
const ignored = new Set(['node_modules', '.git', '.next', 'dist', 'dist-electron', 'coverage']);

function resolveSource(relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('Source paths must be relative to the repository.');
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep)) throw new Error(`Source path escapes repository: ${relative}`);
  return absolute;
}

async function collect(relative) {
  const absolute = resolveSource(relative);
  const info = await stat(absolute);
  if (info.isFile()) return [relative];
  const result = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await collect(child));
    else if (sourceExtensions.has(path.extname(entry.name)) && !/\.(test|spec)\./.test(entry.name)) result.push(child);
  }
  return result.sort();
}

async function main() {
  const map = JSON.parse(await readFile(path.join(directory, 'product-map.json'), 'utf8'));
  const { version: packageVersion } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (map.schemaVersion !== 1 || !Array.isArray(map.tasks) || !map.tasks.length) throw new Error('Invalid or empty product map.');
  if (!Array.isArray(map.watchGroups) || !map.watchGroups.length) throw new Error('Missing watch groups.');
  const ids = new Set();
  const evidence = new Set();
  for (const task of map.tasks) {
    if (typeof task.id !== 'string' || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(task.id) || ids.has(task.id)) throw new Error(`Invalid or duplicate task ID: ${task.id}`);
    ids.add(task.id);
    for (const key of ['title', 'area', 'entry']) if (typeof task[key] !== 'string' || !task[key].trim()) throw new Error(`${task.id}: missing ${key}`);
    for (const key of ['controls', 'preconditions', 'completion', 'limitations']) {
      if (!Array.isArray(task[key]) || task[key].some(item => typeof item !== 'string')) throw new Error(`${task.id}: invalid ${key}`);
    }
    if (!['wired', 'partial', 'unverified'].includes(task.status)) throw new Error(`${task.id}: invalid status`);
    if (typeof task.runtimeTested !== 'boolean' || typeof task.guideReady !== 'boolean') throw new Error(`${task.id}: missing verification status`);
    if (!Array.isArray(task.sources) || !task.sources.length) throw new Error(`${task.id}: missing source evidence`);
    for (const source of task.sources) {
      resolveSource(source.path);
      if (typeof source.symbol !== 'string' || !source.symbol.trim()) throw new Error(`${task.id}: source needs a symbol or search phrase`);
      evidence.add(source.path);
    }
  }

  // Anchors first: a lesson pointing at a control that no longer exists is a hard failure.
  const anchorReport = await checkAnchors(map, packageVersion);
  for (const warning of anchorReport.warnings) console.warn(`warning: ${warning}`);
  if (anchorReport.orphans.length) {
    console.warn(`${anchorReport.orphans.length} control${anchorReport.orphans.length === 1 ? '' : 's'} with no lesson yet (new feature, nothing written): ${anchorReport.orphans.join(', ')}`);
  }
  if (anchorReport.errors.length) {
    for (const error of anchorReport.errors) console.error(`- ${error}`);
    throw new Error(`${anchorReport.errors.length} lesson/anchor problem${anchorReport.errors.length === 1 ? '' : 's'}`);
  }
  console.log(`Anchors: ${anchorReport.anchors} controls and ${anchorReport.areas} areas in code; every lesson points at a real control.`);
  if (anchorsOnly) return;

  const allFiles = new Map();
  const groups = {};
  for (const group of map.watchGroups) {
    if (!group.id || groups[group.id] || !Array.isArray(group.roots) || !group.roots.length) throw new Error('Invalid or duplicate watch group.');
    const files = [...new Set((await Promise.all(group.roots.map(collect))).flat())].sort();
    for (const file of files) if (!allFiles.has(file)) allFiles.set(file, digest(await readFile(resolveSource(file))));
    groups[group.id] = { fileCount: files.length, sha256: digest(files.map(file => `${file}\0${allFiles.get(file)}\n`).join('')) };
  }
  const sources = {};
  for (const file of [...evidence].sort()) sources[file] = allFiles.get(file) ?? digest(await readFile(resolveSource(file)));
  const snapshot = { schemaVersion: 1, sources, groups };
  if (accept) {
    await writeFile(path.join(directory, 'source-snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n');
    console.log(`Recorded reviewed source snapshot: ${map.tasks.length} tasks, ${evidence.size} evidence files, ${allFiles.size} watched files.`);
    console.log('This does not certify runtime behavior or make the guides executable.');
    return;
  }

  const previous = JSON.parse(await readFile(path.join(directory, 'source-snapshot.json'), 'utf8'));
  if (previous.schemaVersion !== 1 || !previous.sources || !previous.groups) throw new Error('Invalid source snapshot.');
  const changedSources = [...new Set([...Object.keys(previous.sources), ...Object.keys(sources)])].filter(file => previous.sources[file] !== sources[file]);
  const changedGroups = [...new Set([...Object.keys(previous.groups), ...Object.keys(groups)])].filter(id => previous.groups[id]?.sha256 !== groups[id]?.sha256);
  if (changedSources.length || changedGroups.length) {
    console.error('Product map needs review.');
    for (const file of changedSources) {
      const affected = map.tasks.filter(task => task.sources.some(source => source.path === file)).map(task => task.id);
      console.error(`- ${file}: ${affected.join(', ') || 'evidence removed from map'}`);
    }
    for (const id of changedGroups) console.error(`- Changed source area: ${id}. Check for added, removed, or changed features, including tasks not yet mapped.`);
    console.error('Review and update the map first, then run with --snapshot-after-review.');
    process.exitCode = 1;
    return;
  }
  console.log(`Product map source check passed: ${map.tasks.length} task records; ${evidence.size} evidence files; ${allFiles.size} watched files unchanged.`);
  console.log('Source consistency only: runtime walkthroughs and guide anchors remain separately verified.');
}

main().catch(error => {
  console.error(`Product map check failed: ${error.message}`);
  process.exitCode = 2;
});
