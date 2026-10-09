// Exercise EasyWorship with the same native SQLite binary used by the desktop app.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-native-import-'));
try {
  const bundle = path.join(dir, 'check.cjs');
  require('esbuild').buildSync({ entryPoints: [path.join(__dirname, 'foreign-import-smoke.ts')], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', external: ['better-sqlite3', 'yauzl'] });
  const result = spawnSync(require('electron'), [bundle], { cwd: root, stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: path.join(root, 'node_modules') } });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
