import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

// Rebuild source metadata; executable actions still require a reviewed registration.
export function guideIndex(root: string): Plugin {
  const publicId = 'virtual:trilorah-guide-index';
  const id = '\0' + publicId;
  const collect = () => {
    const files: string[] = [];
    const walk = (dir: string) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, entry.name); if (entry.isDirectory()) walk(path); else if (/\.(tsx?|css)$/.test(path) && !/\.test\./.test(path)) files.push(path); } };
    walk(join(root, 'src'));
    files.push(join(root, 'docs/product-guide/product-map.json'));
    const hash = createHash('sha256'); const anchors = new Map<string, Set<string>>();
    for (const file of files.sort()) {
      const source = readFileSync(file, 'utf8'); hash.update(relative(root, file)); hash.update(source);
      for (const match of source.matchAll(/(?:data-guide|guideId)=["']([^"']+)["']/g)) {
        const refs = anchors.get(match[1]) ?? new Set<string>(); refs.add(relative(root, file)); anchors.set(match[1], refs);
      }
    }
    return { revision: hash.digest('hex').slice(0, 10), sourceFiles: files.length, anchors: [...anchors].sort(([a], [b]) => a.localeCompare(b)).map(([name, sources]) => ({ name, sources: [...sources] })) };
  };
  let index = collect(); let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = (server: ViteDevServer) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      index = collect(); const module = server.moduleGraph.getModuleById(id); if (module) server.moduleGraph.invalidateModule(module);
      server.ws.send({ type: 'custom', event: 'trilorah-guide-map-update', data: { revision: index.revision } });
    }, 150);
  };
  return {
    name: 'trilorah-guide-index',
    resolveId(source) { if (source === publicId) return id; },
    load(source) { if (source === id) return `export default ${JSON.stringify(index)}`; },
    buildStart() { index = collect(); },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'guide-index.json', source: JSON.stringify(index, null, 2) }); },
    configureServer(server) {
      const change = (file: string) => { if (file.startsWith(join(root, 'src')) || file === join(root, 'docs/product-guide/product-map.json')) refresh(server); };
      server.watcher.on('add', change).on('change', change).on('unlink', change);
      server.httpServer?.once('close', () => { clearTimeout(timer); server.watcher.off('add', change).off('change', change).off('unlink', change); });
    },
  };
}
