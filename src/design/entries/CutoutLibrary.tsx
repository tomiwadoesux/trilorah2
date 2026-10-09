import { useEffect, useState } from 'react';
import { CUTOUT_ICONS, CUTOUT_NAMES, cutoutSvg, type CutoutCategory, type CutoutDefinition, type CutoutIconName } from '../../../shared/cutout';
import { CutoutIcon } from '../../ui/CutoutIcon';
import './iconStudies.css';
import './cutoutLibrary.css';

const CATEGORIES: CutoutCategory[] = ['Service', 'Actions', 'Navigation', 'Devices', 'Status', 'Giving'];
const REDRAWN: CutoutIconName[] = ['settings', 'reset', 'grip', 'pencil', 'minimize', 'qr', 'dashboard', 'profile', 'globe', 'palette', 'language', 'tuning'];
export function CutoutLibrary() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CutoutCategory | 'All' | 'Redrawn'>(() => new URLSearchParams(window.location.search).has('redrawn') ? 'Redrawn' : 'All');
  const [selected, setSelected] = useState<CutoutIconName>(() => new URLSearchParams(window.location.search).has('redrawn') ? 'settings' : 'microphone');
  const [size, setSize] = useState(36);
  const [cycle, setCycle] = useState(0);
  const [part, setPart] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const current: CutoutDefinition = CUTOUT_ICONS[selected];
  const visible = (category === 'Redrawn' ? REDRAWN : CUTOUT_NAMES).filter(name => (category === 'All' || category === 'Redrawn' || CUTOUT_ICONS[name].category === category)
    && `${name} ${CUTOUT_ICONS[name].label}`.toLowerCase().includes(query.toLowerCase().trim()));
  useEffect(() => {
    const before = document.title;
    document.title = 'Trilorah · Cutout icon library';
    return () => { document.title = before; };
  }, []);
  function choose(name: CutoutIconName) { setSelected(name); setPart(null); setMessage(''); setCycle(0); }
  async function copy() {
    try { await navigator.clipboard.writeText(cutoutSvg(selected)); setMessage('SVG copied, including its named parts.'); }
    catch { setMessage('Copy unavailable. Use the SVG download.'); }
  }
  return <main className="icon-studies cutout-library">
    <div className="icon-studies__wrap">
      <header className="icon-studies__intro">
        <div className="icon-studies__eyebrow"><span>TRILORAH</span><span>THE ORIGINAL CUTOUT FAMILY</span></div>
        <div className="icon-studies__headline">
          <div><h1>Cutout.<br /><span>The complete set.</span></h1><p>One family for the whole app.<br />Every icon has named parts, ready to animate.</p></div>
          <div className="icon-studies__downloads"><a className="icon-studies__download" href="./cutout-icons/trilorah-cutout-icons.zip" download>Download all {CUTOUT_NAMES.length} <span aria-hidden>↗</span></a><a className="icon-studies__related" href="./cutout-icons/CREATE-ICON.md" download>Get the new-icon guide ↓</a></div>
        </div>
        <div className="icon-studies__meta"><span>{CUTOUT_NAMES.length} ORIGINAL ICONS</span><span>32 × 32 GRID</span><span>ANIMATION PARTS INCLUDED</span></div>
      </header>
      <section className="cutout-library__inspector" aria-label="Selected icon and animation parts">
        <div className="cutout-library__specimen" data-highlight={part ?? undefined}>
          <CutoutIcon key={`${selected}-${cycle}`} name={selected} size={108} animated={cycle > 0} label={current.label} />
          {part && <style>{`.cutout-library__specimen [data-part]:not([data-part="${part}"]) { opacity:.15; }`}</style>}
          <span>{part ? `${part} · selected part` : 'LIVE SVG · ORIGINAL CUTOUT'}</span>
        </div>
        <div className="cutout-library__details"><span className="icon-studies__overline">{current.category}</span><h2>{current.label}</h2><p>{selected}</p>
          <div className="icon-studies__sizes">{[14, 16, 20, 24, 32].map(value => <div key={value}><span><CutoutIcon name={selected} size={value} /></span><small>{value}px</small></div>)}</div>
          <div className="cutout-library__parts" aria-label="Animation parts"><button aria-pressed={part === null} onClick={() => setPart(null)}>All parts</button>{current.parts.map(p => <button key={p.name} aria-pressed={part === p.name} onClick={() => setPart(part === p.name ? null : p.name)}>{p.name}</button>)}</div>
        </div>
        <div className="icon-studies__actions"><button onClick={() => { setPart(null); setCycle(value => value + 1); }}>Preview motion ↻</button><a href={`./cutout-icons/${selected}.svg`} download>Download SVG <span aria-hidden>↓</span></a><button onClick={() => void copy()}>Copy SVG</button><span className="icon-studies__copy-status" role="status">{message}</span><p className="cutout-library__motion-note">Still by default.<br />Motion respects reduced-motion settings.</p></div>
      </section>
      <section className="cutout-library__browser" aria-label="Browse all Cutout icons">
        <div className="cutout-library__tools"><label className="icon-studies__search"><CutoutIcon name="search" size={18} /><input aria-label="Find an icon" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an icon…" /></label>
          <div className="cutout-library__size" aria-label="Icon preview size">{[20, 28, 36].map(value => <button key={value} aria-pressed={size === value} onClick={() => setSize(value)}>{value}px</button>)}</div>
        </div>
        <div className="cutout-library__categories" aria-label="Icon category">{(['All', 'Redrawn', ...CATEGORIES] as const).map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}<span>{value === 'All' ? CUTOUT_NAMES.length : value === 'Redrawn' ? REDRAWN.length : CUTOUT_NAMES.filter(name => CUTOUT_ICONS[name].category === value).length}</span></button>)}</div>
        <div className={`cutout-library__grid${category === 'Redrawn' ? ' cutout-library__grid--redrawn' : ''}`}>{visible.map(name => <button key={name} className="cutout-library__tile" aria-label={`${CUTOUT_ICONS[name].label} icon`} aria-pressed={selected === name} onClick={() => choose(name)}><CutoutIcon name={name} size={size} /><span>{CUTOUT_ICONS[name].label}</span><small>{CUTOUT_ICONS[name].parts.length} {CUTOUT_ICONS[name].parts.length === 1 ? 'part' : 'parts'}</small></button>)}</div>
        {!visible.length && <p className="cutout-library__no-results">No icons match “{query}”. Try another name or category.</p>}
      </section>
      <footer className="icon-studies__footer"><span>TRILORAH CUTOUT / BUILT FOR MOTION</span><a href="./design.html?cutout-studies">Back to the explorations ↗</a></footer>
    </div>
  </main>;
}
