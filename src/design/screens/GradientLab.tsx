import { useId, useState, type CSSProperties } from 'react';
import './gradientLab.css';

const STYLES = [
  { id: 'fold', name: 'Fold', note: 'A sharp seam opening into a long, quiet wash.' },
  { id: 'tide', name: 'Undertow', note: 'A low ribbon pulled across an almost black field.' },
  { id: 'contour', name: 'Contour', note: 'Fine, irregular contours with light caught along their edges.' },
  { id: 'fracture', name: 'Split light', note: 'Offset planes, interrupted colour and a narrow luminous cut.' },
  { id: 'veil', name: 'Veil', note: 'Tall translucent folds, layered like smoked glass.' },
  { id: 'orbit', name: 'Afterimage', note: 'An off-centre arc that leaves a faint coloured echo.' },
] as const;
type Style = typeof STYLES[number]['id'];
const COLORS = [
  { name: 'Mineral', a: '#85b9a5', b: '#647e8b' },
  { name: 'Ink', a: '#aca0c9', b: '#656f95' },
  { name: 'Glacier', a: '#86b4c4', b: '#526e96' },
  { name: 'Copper', a: '#c99e75', b: '#986e66' },
  { name: 'Dusk', a: '#be91a0', b: '#7c7598' },
];

function Art({ style }: { style: Style }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`gradient-art gradient-art--${style}`} viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--lab-a)" stopOpacity=".02"/><stop offset=".48" stopColor="var(--lab-a)" stopOpacity=".7"/><stop offset=".53" stopColor="var(--lab-b)" stopOpacity=".24"/><stop offset="1" stopColor="var(--lab-b)" stopOpacity="0"/></linearGradient>
      <linearGradient id={`${id}-b`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="var(--lab-b)" stopOpacity="0"/><stop offset=".65" stopColor="var(--lab-b)" stopOpacity=".25"/><stop offset="1" stopColor="var(--lab-a)" stopOpacity=".8"/></linearGradient>
      <linearGradient id={`${id}-edge`}><stop stopColor="var(--lab-a)" stopOpacity="0"/><stop offset=".7" stopColor="var(--lab-a)" stopOpacity=".65"/><stop offset="1" stopColor="var(--lab-b)" stopOpacity="0"/></linearGradient>
    </defs>
    {style === 'fold' && <g>
      <path d="M-140 710 L930 -110 L530 730Z" fill={`url(#${id}-a)`}/>
      <path d="M930 -110 L530 730 L1250 730Z" fill={`url(#${id}-b)`} opacity=".48"/>
      <path d="M930 -110 L530 730" stroke="var(--lab-a)" strokeOpacity=".45" fill="none"/>
    </g>}
    {style === 'tide' && <g>
      <path d="M-120 540 C260 840 600 80 1320 440 L1320 650 C540 240 200 900 -120 680Z" fill={`url(#${id}-a)`}/>
      <path d="M-120 540 C260 840 600 80 1320 440" fill="none" stroke={`url(#${id}-edge)`} strokeWidth="2"/>
      <path d="M-100 620 C220 850 720 220 1300 500" fill="none" stroke={`url(#${id}-edge)`} strokeWidth=".7"/>
    </g>}
    {style === 'contour' && <g transform="translate(700 360) rotate(-22)">
      {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M${-450-i*20} -440 C${250+i*12} -500 ${-350+i*20} 100 ${140+i*22} 230 S${500+i*20} 700 720 730`} fill="none" stroke={`url(#${id}-edge)`} strokeWidth={i % 5 === 0 ? 2.4 : .7} opacity={.25 + i / 30}/>) }
    </g>}
    {style === 'fracture' && <g>
      <path d="M-50 120 L1050 350 L330 395Z" fill={`url(#${id}-b)`}/>
      <path d="M175 760 L330 410 L1050 365Z" fill={`url(#${id}-a)`}/>
      <path d="M340 402 L1050 360" stroke={`url(#${id}-edge)`} strokeWidth="2"/>
      <path d="M1050 365 L1260 80 L1260 760Z" fill={`url(#${id}-b)`} opacity=".18"/>
    </g>}
    {style === 'veil' && <g transform="rotate(14 600 350)">
      {[0,1,2,3,4].map(i => <path key={i} d={`M${150+i*170} -120 C${490+i*90} 120 ${50+i*120} 430 ${330+i*160} 850 L${530+i*160} 850 C${200+i*120} 410 ${570+i*90} 140 ${280+i*170} -120Z`} fill={`url(#${id}-${i % 2 ? 'b' : 'a'})`} opacity={.62-i*.08}/>)}
    </g>}
    {style === 'orbit' && <g transform="rotate(-24 790 290)">
      <ellipse cx="930" cy="160" rx="570" ry="370" fill="none" stroke={`url(#${id}-a)`} strokeWidth="90"/>
      <ellipse cx="930" cy="160" rx="524" ry="324" fill="none" stroke={`url(#${id}-edge)`} strokeWidth="1.5"/>
      <ellipse cx="930" cy="160" rx="590" ry="390" fill="none" stroke={`url(#${id}-edge)`} strokeWidth=".6"/>
    </g>}
  </svg>;
}

export function GradientLab() {
  const [chosen, setChosen] = useState<Style>('fold');
  const [color, setColor] = useState(0);
  const [context, setContext] = useState(true);
  const selected = STYLES.find(s => s.id === chosen)!;
  const vars = { '--lab-a': COLORS[color].a, '--lab-b': COLORS[color].b } as CSSProperties;
  return <section className="gradient-lab" aria-label="Temporary gradient studio" style={vars}>
    <div className="gradient-lab-heading"><span>STYLE STUDIES</span><span>temporary preview</span></div>
    <h2>Find the right atmosphere.</h2>
    <p>Six directions, all still. See how each sits behind the controls.</p>
    <div className="gradient-studies" aria-label="Gradient styles">
      {STYLES.map((s, i) => <button key={s.id} type="button" aria-pressed={chosen === s.id} onClick={() => setChosen(s.id)} aria-label={`${s.name} gradient`}>
        <span className="gradient-study-art"><Art style={s.id}/></span>
        <span className="gradient-study-name"><small>0{i+1}</small>{s.name}</span>
      </button>)}
    </div>
    <div className="gradient-preview">
      <Art key={chosen} style={chosen}/>
      {context && <div className="gradient-context" aria-hidden="true">
        <div className="gradient-context-top"><span>operator</span><span>listening <i/></span></div>
        <div className="gradient-context-grid"><div><small>TODAY’S RUN</small><span>Welcome</span><span>Worship</span><span>Sermon</span></div><div><small>PREVIEW</small><p>Let everything that has breath<br/>praise the Lord.</p><span className="gradient-context-live">go live ↗</span></div></div>
      </div>}
      <span className="gradient-preview-caption">{selected.name}</span>
    </div>
    <div className="gradient-lab-tools">
      <div className="gradient-colors" aria-label="Preview colour">{COLORS.map((c,i) => <button key={c.name} type="button" aria-label={`${c.name} preview colour`} title={c.name} aria-pressed={color===i} style={{'--swatch':c.a} as CSSProperties} onClick={() => setColor(i)}/>)}</div>
      <button type="button" aria-pressed={context} onClick={() => setContext(v => !v)}>{context ? 'Hide controls' : 'Show controls'}</button>
    </div>
    <p className="gradient-lab-note">{selected.note} These studies only change this preview.</p>
  </section>;
}
