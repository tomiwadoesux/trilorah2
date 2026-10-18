import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';

// Rebuild the catalogue from source: a new component should never need a second
// manual inventory entry just to appear in the brand workspace.
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFile(path.join(root, file), 'utf8');
const clean = value => value.replace(/\*\*|`/g, '').trim();
const files = [];
async function walk(dir) {
  for (const item of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) await walk(file);
    else if (/\.tsx$/.test(file) && !/\.test\.|\.spec\.|\/registry\.tsx$/.test(file)) files.push(file);
  }
}
await Promise.all(['src/ui', 'src/components', 'src/screens', 'src/design/screens', 'src/design/orb', 'web/src/components', 'web/src/app/live', 'web/src/app/mic', 'web/src/app/app'].map(async dir => {
  try { await walk(dir); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}));
files.push('src/App.tsx', 'src/output.tsx');

const groups = ['Foundations', 'Controls', 'Content & feedback', 'Service & scripture', 'Dashboard', 'Songs & media', 'Connections', 'Settings', 'Companion & web', 'Screens', 'Illustrations', 'Legacy UI'];
function groupFor(file) {
  if (file.startsWith('web/')) return 'Companion & web';
  if (/Art\.tsx|\/orb\/|CardArt|Phone.*Mark/.test(file)) return 'Illustrations';
  if (/\/ui\//.test(file)) return 'Controls';
  if (/\/components\/ui\.tsx/.test(file)) return 'Legacy UI';
  if (/\/dashboard\//.test(file)) return 'Dashboard';
  if (/Settings|settingsRows|Preachers/.test(file)) return 'Settings';
  if (/songs\/|library|presentations|stockSearch/.test(file)) return 'Songs & media';
  if (/Mobile|Phone|MicPicker|Connection/.test(file)) return 'Connections';
  if (/\/run\/|Scripture|Sermon|Catches|Transcript|\/transcript\/|LogHistory|OperatorRail/.test(file)) return 'Service & scripture';
  if (/\/screens\/[^/]+\.tsx$|\/App\.tsx|\/output\.tsx/.test(file) && !/parts|slide|settingsRows/.test(file)) return 'Screens';
  return 'Content & feedback';
}
const previewFor = {
  Button: 'sheet:C-01', Slider: 'sheet:C-20', SegmentedControl: 'sheet:C-04', DisplayFontPicker: 'sheet:C-05', TextPositionPicker: 'sheet:C-06', Select: 'sheet:C-07', ScriptureReferenceInput: 'sheet:C-08', DashboardButton: 'sheet:D-111',
  SearchField: 'extra:search', ActionMenu: 'extra:action-menu', ArrangeList: 'extra:arrange', SlideThumb: 'extra:slide-thumb', AddCard: 'extra:add-card', TextTransitionPicker: 'extra:transition',
};
const sources = {};
const components = [];
function containsJsx(node) {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
  return ts.forEachChild(node, containsJsx) || false;
}
for (const file of [...new Set(files)].sort()) {
  if (/\/icons\.tsx$|\/NuboIcon\.tsx$|shaderBox/.test(file)) continue;
  const text = await read(file);
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    const initializer = ts.isVariableDeclaration(node) ? node.initializer : undefined;
    const componentVariable = initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer) || (ts.isCallExpression(initializer) && /^(memo|forwardRef|React\.memo|React\.forwardRef)$/.test(initializer.expression.getText(tree))));
    const candidate = ts.isFunctionDeclaration(node) || componentVariable || ts.isClassDeclaration(node);
    if (candidate && node.name && ts.isIdentifier(node.name) && /^[A-Z]/.test(node.name.text) && containsJsx(node)) {
      const name = node.name.text;
      const id = `source:${createHash('sha1').update(`${file}:${name}`).digest('hex').slice(0, 12)}`;
      const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      const preview = file.startsWith('src/ui/primitives/') ? previewFor[name] : undefined;
      const owner = ts.isVariableDeclaration(node) ? node.parent.parent : node;
      const exported = !!owner.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword);
      components.push({ id, title: name, group: groupFor(file), file, line, scope: exported ? 'Exported component' : 'Internal component', preview: preview ?? null });
      sources[id] = node.getText(tree);
      // Nested named JSX functions are still useful design units; index them too.
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
const registry = await read('src/design/registry.tsx');
const sheets = [...registry.matchAll(/\{ id: '([^']+)', title: '([^']+)', Component: (\w+) \}/g)].map(([, id, title]) => ({
  id: `sheet:${id}`, title: id.startsWith('~') ? `${title} · legacy` : id === 'F-03' ? 'Type scale · baseline' : title,
  group: id.startsWith('F-') ? 'Foundations' : id.startsWith('~') ? 'Legacy UI' : id.startsWith('C-') && !id.includes('65') ? 'Controls' : 'Content & feedback',
  description: id.startsWith('~') ? 'The original UI implementation, retained for comparison.' : 'The app’s existing component study, rendered from its source with example data.',
  file: 'src/design/registry.tsx', kind: 'Component study', preview: `sheet:${id}`,
}));
const extras = [
  ['search', 'Search field', 'Controls', 'SearchField', 'Type, clear, submit, and compare disabled states.'],
  ['action-menu', 'Action menu', 'Controls', 'ActionMenu', 'Grouped actions and nested menus. All actions stay in the example.'],
  ['arrange', 'Arrangement list', 'Service & scripture', 'ArrangeList', 'Choose service segments and rearrange their order.'],
  ['slide-thumb', 'Slide thumbnails', 'Songs & media', 'SlideThumb', 'Resting, selected, and live cards with real hover actions.'],
  ['add-card', 'Add card', 'Controls', 'AddCard', 'The empty slot that starts the next piece of a service.'],
  ['transition', 'Text transitions', 'Content & feedback', 'TextTransitionPicker', 'The actual picker, with repeatable animation previews.'],
  ['panels', 'Panels & empty states', 'Content & feedback', 'Panel', 'Panel headers, scripture, live, empty, and unavailable states.'],
  ['status', 'Status & audio', 'Content & feedback', 'Meter', 'Status dots, pills, meters, and audio-level feedback.'],
  ['icons', 'Icons · line & duo', 'Foundations', 'Icons', 'The app’s Nubo icon wrappers. Switch to the selected duo treatment.'],
].map(([key, title, group, name, description]) => ({ id: `extra:${key}`, preview: `extra:${key}`, title, group, description, kind: 'Interactive specimen', file: name === 'Icons' ? 'src/ui/icons.tsx' : components.find(c => c.title === name && c.file.startsWith('src/'))?.file ?? 'src/brand-system/specimens.tsx' }));
const screens = [
  ['S-01', 'App shell', 'The app frame, navigation, and connection states.', 'Screen study'],
  ['S-02', 'Live workspace', 'The service workspace with fourteen scenario fixtures. Device and cloud actions need the desktop app.', 'Screen study'],
  ['S-03', 'Dashboard arrangement', 'An existing wireframe for exploring the dashboard layout; boxes are intentional.', 'Wireframe'],
  ['S-10', 'Settings', 'The settings pages with example engine state.', 'Screen study'],
  ['S-18', 'Popup dimensions', 'Empty frames at the app’s popup sizes. These are layout studies, not complete modal previews.', 'Wireframe'],
].map(([key, title, description, kind]) => ({ id: `screen:${key}`, preview: `screen:${key}`, title, description, kind, group: 'Screens', file: 'src/design/screens/registry.tsx' }));
const companion = [
  ['notes', 'Companion notes', 'NotesTab', 'Populated and empty sermon notes, using the companion’s actual component.'],
  ['reading', 'Reading options', 'ReadingOptions', 'Text size, colour, and background preferences in a phone-sized canvas.'],
  ['badges', 'Service badges', 'SegmentBadge', 'The companion’s service-segment labels.'],
].map(([key, title, name, description]) => ({ id: `web:${key}`, preview: `web:${key}`, title, description, kind: 'Companion specimen', group: 'Companion & web', file: components.find(c => c.title === name)?.file ?? '' }));
for (const item of components) {
  const study = companion.find(study => study.file === item.file);
  if (study) item.preview = study.preview;
}
const checklist = [];
let section = '';
for (const line of (await read('design/UI-INVENTORY.md')).split('\n')) {
  if (/^#{1,3} /.test(line)) section = clean(line.replace(/^#+ /, ''));
  const match = line.match(/^\|\s*([FCDOSM]-[\w+.-]+)\s*\|\s*([^|]+)\|\s*([^|]*)/);
  if (match) checklist.push({ id: match[1].trim(), title: clean(match[2]), description: clean(match[3]), section });
}
const out = path.join(root, 'web/src/app/brand/components');
const publicOut = path.join(root, 'web/public/brand/component-library');
await fs.mkdir(out, { recursive: true });
await fs.mkdir(publicOut, { recursive: true });
await fs.writeFile(path.join(out, 'catalog.json'), JSON.stringify({ groups, studies: [...sheets, ...extras, ...screens, ...companion], components, checklist }, null, 2) + '\n');
await fs.writeFile(path.join(publicOut, 'sources.json'), JSON.stringify(sources));
const fonts = path.join(root, 'web/public/brand/fonts');
await fs.mkdir(fonts, { recursive: true });
for (const file of ['geist-variable.woff2', 'geist-mono-variable.woff2']) await fs.copyFile(path.join(root, 'src/ui/fonts', file), path.join(fonts, file));
await fs.copyFile(path.join(root, 'public/fonts/GEIST-LICENSE.txt'), path.join(fonts, 'LICENSE.txt'));
console.log(`Brand library: ${components.length} source components, ${sheets.length + extras.length + screens.length + companion.length} studies, ${checklist.length} design checklist entries.`);
