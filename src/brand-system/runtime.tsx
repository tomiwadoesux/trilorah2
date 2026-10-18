import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import '../ui/tokens.css';
import '../design/sandbox.css';
import './runtime.css';

const SheetPreview = lazy(async () => {
  const { ALL_ENTRIES } = await import('../design/registry');
  return { default: ({ id }: { id: string }) => {
    const entry = ALL_ENTRIES.find(item => item.id === id);
    return entry ? <entry.Component /> : <p>No registered sheet for this item.</p>;
  } };
});
const ScreenPreview = lazy(async () => {
  const { SCREENS, ArtboardProvider } = await import('../design/screens/registry');
  return { default: ({ id }: { id: string }) => {
    const screen = SCREENS.find(item => item.id === id);
    const [state, setState] = useState(screen?.states[0]?.id ?? '');
    if (!screen) return <p>Screen not found.</p>;
    return <><label className="specimen-screen-label">Screen state<select value={state} onChange={event => setState(event.target.value)}>{screen.states.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><p className="specimen-screen-note">{screen.states.find(item => item.id === state)?.note}</p><div className="specimen-screen"><ArtboardProvider value={{ id: 'brand', label: 'Brand study', note: 'Isolated component study', w: 1280, h: 800, tier: 'comfortable' }}><screen.Component state={state} /></ArtboardProvider></div></>;
  } };
});
const ExtraPreview = lazy(() => import('./specimens'));

class PreviewBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div role="alert" className="specimen-error"><h1>This example needs a fixture update.</h1><p>The component is indexed. Its current dependencies could not render in this isolated preview.</p><button onClick={() => location.reload()}>Retry preview</button></div> : this.props.children; }
}

function Runtime() {
  const params = new URLSearchParams(location.search);
  const key = params.get('preview') ?? 'sheet:C-01';
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'trilorah-brand-tokens') return;
      const { density, radius } = event.data;
      if (['compact', 'comfortable', 'touch'].includes(density)) document.documentElement.dataset.density = density;
      if (typeof radius === 'number' && Number.isFinite(radius)) document.documentElement.style.setProperty('--tri-radius-control', `${Math.max(0, Math.min(20, radius))}px`);
    };
    window.addEventListener('message', receive);
    parent.postMessage({ type: 'trilorah-brand-ready' }, location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <PreviewBoundary><main className="specimen-root"><Suspense fallback={<p role="status">Loading the app component…</p>}>{key.startsWith('sheet:') ? <SheetPreview id={key.slice(6)} /> : key.startsWith('screen:') ? <ScreenPreview id={key.slice(7)} /> : <ExtraPreview name={key.slice(6)} />}</Suspense></main></PreviewBoundary>;
}

createRoot(document.getElementById('root')!).render(<Runtime />);
