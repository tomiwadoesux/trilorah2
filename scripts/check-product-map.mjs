#!/usr/bin/env node
// Repository documentation check only. Does not run the app or any guide action.
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'docs/product-guide');
const accept = process.argv.includes('--snapshot-after-review');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--snapshot-after-review') || args.length > 1) {
  console.error('Usage: node scripts/check-product-map.mjs [--snapshot-after-review]');
  process.exit(2);
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
