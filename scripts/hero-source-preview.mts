/**
 * Local source for the website's static app preview. Run from the repo root:
 *   node --import tsx scripts/hero-source-preview.mts
 * Fixtures only affect this Vite server; desktop source files stay untouched.
 */
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { guideIndex } from './guideIndex';

const verses = [
  'In the beginning God created the heaven and the earth.',
  'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.',
  'And God said, Let there be light: and there was light.',
  'And God saw the light, that it was good: and God divided the light from the darkness.',
  'And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.',
  'And God said, Let there be a firmament in the midst of the waters, and let it divide the waters from the waters.',
  'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament: and it was so.',
].map((text, index) => ({ id: index + 1, text, ref: `Genesis 1:${index + 1}` }));
const reading = {
  source: 'scripture', id: 'John 3:16', label: 'John 3:16',
  reference: 'John 3:16', version: 'KJV', origin: 'engine',
  text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
};
const run: unknown[] = [];
const referenceSpeech = 'John chapter three verse sixteen.';
const readingSpeech = 'For God so loved the world, that he gave his only begotten Son.';

function replace(source: string, before: string, after: string) {
  if (!source.includes(before)) throw new Error(`Hero capture source changed: ${before}`);
  return source.replace(before, after);
}

const server = await createServer({
  configFile: false,
  plugins: [
    {
      name: 'hero-capture-fixtures', enforce: 'pre',
      transform(source, id) {
        if (id.endsWith('/src/main.tsx')) return `
          import { createRoot } from 'react-dom/client';
          import './index.css'; import './ui/tokens.css'; import './design/sandbox.css';
          import { trackDensity } from './ui/density';
          // A fresh in-memory store keeps capture independent of personal app data.
          const values = new Map([['trilorah.run.v1', ${JSON.stringify(JSON.stringify(run))}]]);
          Object.defineProperty(window, 'localStorage', {value: {
            getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)),
            removeItem: k => values.delete(k), clear: () => values.clear(),
            key: i => [...values.keys()][i] ?? null, get length() { return values.size; }
          }});
          document.documentElement.dataset.theme = 'dark';
          document.documentElement.dataset.aurora = 'fern';
          trackDensity();
          const { LiveHost } = await import('./screens/LiveHost');
          createRoot(document.getElementById('root')).render(<div style={{height:'100vh'}}><LiveHost /></div>);
        `;
        if (id.endsWith('/src/lib/loadScriptureChapter.ts')) return `
          export async function loadScriptureChapter() {
            return { status: 'idle', data: ${JSON.stringify(verses)}, error: null };
          }
        `;
        if (id.endsWith('/src/design/screens/projector.tsx')) {
          return replace(source, 'const [preview, setPreview] = useState<LiveItem | null>(null);',
            `const [preview, setPreview] = useState<LiveItem | null>(new URLSearchParams(location.search).get('hero') === 'done' ? ${JSON.stringify(reading)} : null);`);
        }
        if (id.endsWith('/src/design/screens/engine.tsx')) {
          return replace(source, '<EngineContext.Provider value={value}>', '<EngineContext.Provider value={heroFixture}>') + `
            const heroPhase = new URLSearchParams(location.search).get('hero') || 'idle';
            const heroReading = ${JSON.stringify(reading)};
            const heroVerses = [{ verse: 16, text: heroReading.text }];
            const heroProposal = {
              id: 'hero-john-3-16', reference: heroReading.reference, version: 'KJV',
              text: heroReading.text, verses: heroVerses,
              slides: buildVerseSlides({book: 'John', chapter: 3, version: 'KJV'}, heroVerses, fitRules(heroVerses)),
              trust: null, missing: false, kind: 'said', group: 'hero-reference', arrivedAt: 1,
              heard: ${JSON.stringify(referenceSpeech)},
            };
            const heroFixture = {
              ...DEAD, caps: {bridge: true, db: true, outputs: false, resolver: 'yes'},
              asr: ['idle', 'done'].includes(heroPhase) ? 'idle' : 'listening',
              asrMessage: 'listening — practice sermon',
              spoken: heroPhase === 'idle' ? {lines: [], partial: ''}
                : heroPhase === 'book' ? {lines: [], partial: 'John'}
                : heroPhase === 'caught' ? {lines: [], partial: ${JSON.stringify(referenceSpeech)}}
                : {lines: [{id: 0, text: ${JSON.stringify(referenceSpeech)}}], partial: ${JSON.stringify(readingSpeech)}},
              proposals: ['caught', 'reading'].includes(heroPhase) ? [heroProposal] : [],
              proposalClocks: {'hero-john-3-16': {life: 6000, remaining: 6000, since: 1, held: true}},
              latestReference: ['idle', 'book'].includes(heroPhase) ? null : 'John 3:16',
            };
          `;
        }
        if (id.endsWith('/src/design/screens/dashboard/PreachingTile.tsx')) {
          return replace(source, 'const api = window.api;', `return Promise.resolve(new Set([16])); const api = window.api;`);
        }
        if (id.endsWith('/src/design/screens/Live.tsx')) {
          return replace(source, "backgroundId: 'quiet-sea',", "backgroundId: 'starter-valley',");
        }
      },
    },
    guideIndex(process.cwd()), react(), tailwindcss(),
  ],
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
});
await server.listen();
server.printUrls();
