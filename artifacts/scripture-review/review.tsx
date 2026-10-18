import '../../src/index.css';
import '../../src/ui/tokens.css';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { EngineProvider } from '../../src/design/screens/engine';
import { ProjectorProvider, useProjector } from '../../src/design/screens/projector';
import { ScriptureTools } from '../../src/design/screens/ScriptureTools';
import { CatchesPane } from '../../src/design/screens/CatchesPane';
import { AutoAdvance } from '../../src/design/screens/AutoAdvance';
import { useAutoAdvanceStore } from '../../src/stores/autoAdvanceStore';

const texts = {
  16: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
  17: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.',
  18: 'He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.',
  19: 'And this is the condemnation, that light is come into the world, and men loved darkness rather than light, because their deeds were evil.',
};
const listeners = new Map<string, Set<Function>>();
const on = (name: string) => (fn: Function) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(fn); return () => listeners.get(name)!.delete(fn); };
const emit = (name: string, payload: unknown) => listeners.get(name)?.forEach(fn => fn(payload));
let wall: any = null;
let following = false;
let delay = 0;
const api = {
  getDbStatus: async () => ({ connected: true }),
  getSetting: async () => undefined,
  getScreenState: async () => 'live',
  getSessionVersion: async () => 'KJV',
  getChapter: async () => ({ success: true, data: Object.entries(texts).map(([id, text]) => ({ id: Number(id), text, version: 'KJV' })) }),
  mobileVerse: async (reference: string, version: string, _live: boolean, guard?: {reference: string}) => {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (guard && (!following || wall?.reference !== guard.reference)) return { superseded: true };
    const verse = Number(reference.split(':')[1]);
    const value = { book: 'John', chapter: 3, verse, text: texts[verse], verses: [{ verse, text: texts[verse] }], version };
    wall = { ...value, reference }; return value;
  },
  setLiveSlide: () => {},
  setReadAlong: (value: boolean) => { following = value; },
  onReadAlongNav: on('nav'), onTranscriptLine: on('speech'), onAsrStatus: on('asr'), onVersePreview: on('catch'),
  startListening: () => emit('asr', 'Listening...'),
};
window.api = api as any;
function Review() {
  const projector = useProjector();
  const [narrow, setNarrow] = useState(false);
  const [slow, setSlow] = useState(false);
  const [log, setLog] = useState('');
  async function show(verse: number) {
    const reference = `John 3:${verse}`;
    await projector.send({ source: 'scripture', id: reference, label: reference, reference, version: 'KJV', text: texts[verse], verses: [{ verse, text: texts[verse] }], origin: 'operator' });
  }
  function say(text: string) {
    emit('speech', { text, isFinal: true }); setLog(text);
  }
  const btn = { background: '#242424', borderRadius: 6, padding: '8px 12px', fontSize: 13 };
  return <main style={{ padding: 24, background: '#101010', color: '#e5f3f2', minHeight: '100vh', fontFamily: 'sans-serif' }}>
    <h1 style={{ fontSize: 18, marginBottom: 16 }}>Scripture controls · isolated review</h1>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
      <button style={btn} onClick={() => void show(16)}>Put John 3:16 live</button>
      <button style={btn} onClick={() => void show(18)}>Put John 3:18 live</button>
      <button style={btn} onClick={() => say(`${texts[16]} For God sent not his Son`)}>Read into verse 17</button>
      <button style={btn} onClick={() => { if (following) emit('nav', 'next'); }}>Say next verse</button>
      <button style={btn} onClick={() => say('his Son into the world to condemn the world but that the world through him might be saved')}>Finish verse 17</button>
      <button style={btn} onClick={() => { emit('speech', { text: 'He that believeth on him is not condemned', isFinal: true }); }}>Read into verse 18</button>
      <button style={btn} onClick={() => { delay = slow ? 0 : 700; setSlow(!slow); }}>Delay delivery: {slow ? 'on' : 'off'}</button>
      <button style={btn} onClick={() => setNarrow(!narrow)}>Width: {narrow ? '320' : '540'}</button>
      <button style={btn} onClick={() => { const verse = 19; emit('catch', { book: 'John', chapter: 3, verse, text: texts[verse], verses: [{verse, text: texts[verse]}], version: 'KJV', confidence: .95 }); }}>Catch verse 19</button>
      <button style={btn} onClick={() => projector.setScreen(projector.screen === 'live' ? 'black' : 'live')}>Toggle black screen</button>
    </div>
    <p style={{ marginBottom: 10 }} role="status">Live: {projector.live?.reference ?? 'nothing'} · screen: {projector.screen}</p>
    <p style={{ minHeight: 50, maxWidth: 700, marginBottom: 16, color: '#aebcba' }}>Last speech: {log || 'nothing yet'}</p>
    <div style={{ width: narrow ? 320 : 540, height: 370, background: '#161616', borderRadius: 12, overflow: 'hidden', border: '1px solid #333' }}><ScriptureTools><CatchesPane /></ScriptureTools></div>
    <AutoAdvance />
  </main>;
}
createRoot(document.getElementById('root')!).render(<EngineProvider><ProjectorProvider><Review /></ProjectorProvider></EngineProvider>);
