import './index.css';
import './ui/tokens.css';
import './design/sandbox.css';
import { trackDensity } from './ui/density';
import { restoreAurora } from './ui/aurora';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';

// This preview gets its own in-memory storage before any app module is loaded.
// Trying buttons can never overwrite the user's service, libraries or settings.
async function start() {
  if (window.api) throw new Error('Open this preview in the browser, outside the connected desktop app.');
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(String(key), String(value)); },
    removeItem: key => { values.delete(key); },
    clear: () => { values.clear(); },
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: storage });
  window.addEventListener('storage', event => event.stopImmediatePropagation(), true);
  trackDensity();
  restoreAurora();
  const { LiveHost } = await import('./screens/LiveHost');
  createRoot(document.getElementById('root')!).render(<StrictMode>
    <div className="flex h-dvh flex-col bg-[#0a0a0a] text-white">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/10 px-4 text-[11px] text-white/50">
        <span>Fresh install preview · temporary empty libraries</span>
        <a href="/empty-preview.html" className="hover:text-white">reset preview</a>
      </div>
      <div className="min-h-0 flex-1"><LiveHost /></div>
    </div>
  </StrictMode>);
}

void start().catch(error => {
  document.getElementById('root')!.textContent = String(error);
});
