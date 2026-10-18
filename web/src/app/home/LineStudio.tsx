'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { ArrowRight, Check, Download, RotateCcw } from '../../components/icons';
import GenerativeArtwork, { type ArtworkHandle } from './GenerativeArtwork';
import { ART_PALETTES, ART_PATTERNS, type ArtSettings, type ArtMode } from './generative-art';
import './line-studio.css';

export type LinePattern = 'orbit' | 'rays' | 'diamond' | 'waves' | 'weave' | 'contour' | 'grid' | 'arches' | 'bloom' | 'meridian';
export type LinePalette = 'forest' | 'blue' | 'violet' | 'amber' | 'silver';

const PALETTES: Record<LinePalette, { name: string; base: string; glow: string; line: string; swatch: string }> = {
  forest: { name: 'Forest', base: '#07120f', glow: '#2d785e', line: '#afdfcf', swatch: '#46c695' },
  blue: { name: 'Blue hour', base: '#0d1425', glow: '#375d9e', line: '#c3d6f7', swatch: '#719ee5' },
  violet: { name: 'Dusk', base: '#171122', glow: '#70508d', line: '#e2cfee', swatch: '#ad8bc9' },
  amber: { name: 'Amber', base: '#1c150d', glow: '#966939', line: '#edd9b7', swatch: '#d1a46c' },
  silver: { name: 'Graphite', base: '#101415', glow: '#536167', line: '#d3dddd', swatch: '#a0adae' },
};

// JS engines may differ in the last digits of trigonometric results. Keep every
// generated SVG number deterministic between the server and browser.
const svgNumber = (value: number) => Number(value.toFixed(3));
const svgPath = (value: string) => value.replace(/-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi, (number) => String(svgNumber(Number(number))));

function geometry(pattern: LinePattern, density: number): ReactNode[] {
  const n = Math.max(6, Math.min(28, Math.round(density)));
  const marks: ReactNode[] = [];
  const line = (key: string | number, d: string, opacity = 1) => <path key={key} d={svgPath(d)} opacity={svgNumber(opacity)} />;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    if (pattern === 'orbit') {
      marks.push(<circle key={i} cx="320" cy="220" r={svgNumber(34 + t * 260)} opacity={svgNumber(0.95 - t * 0.45)} />);
    } else if (pattern === 'rays') {
      const angle = (i / n) * Math.PI;
      const x = Math.cos(angle), y = Math.sin(angle);
      marks.push(line(i, `M ${320 - x * 440} ${220 - y * 440} L ${320 - x * 38} ${220 - y * 38} M ${320 + x * 38} ${220 + y * 38} L ${320 + x * 440} ${220 + y * 440}`));
    } else if (pattern === 'diamond') {
      const r = 20 + t * 340;
      marks.push(line(i, `M 320 ${220 - r} L ${320 + r} 220 L 320 ${220 + r} L ${320 - r} 220 Z`));
    } else if (pattern === 'waves') {
      const offset = (i - (n - 1) / 2) * (310 / n);
      const points = Array.from({ length: 81 }, (_, k) => {
        const x = k * 8;
        const y = 220 + offset + Math.sin(((x - 320) / 320) * Math.PI * 1.5) * 40 * Math.cos(offset / 240);
        return `${k ? 'L' : 'M'} ${x} ${y.toFixed(2)}`;
      }).join(' ');
      marks.push(line(i, points));
    } else if (pattern === 'weave') {
      const offset = (i - (n - 1) / 2) * (500 / n);
      marks.push(line(`${i}-a`, `M ${70 + offset} -40 C ${520 + offset} 110 ${120 + offset} 330 ${570 + offset} 480`, 0.85));
      marks.push(line(`${i}-b`, `M ${570 - offset} -40 C ${120 - offset} 110 ${520 - offset} 330 ${70 - offset} 480`, 0.5));
    } else if (pattern === 'contour') {
      const r = 22 + t * 264;
      marks.push(line(i, `M ${320 - r} 220 C ${320 - r} ${220 - r * 0.8} ${320 - r * 0.8} ${220 - r} 320 ${220 - r} C ${320 + r * 0.8} ${220 - r} ${320 + r} ${220 - r * 0.8} ${320 + r} 220 C ${320 + r} ${220 + r * 0.8} ${320 + r * 0.8} ${220 + r} 320 ${220 + r} C ${320 - r * 0.8} ${220 + r} ${320 - r} ${220 + r * 0.8} ${320 - r} 220 Z`));
    } else if (pattern === 'grid') {
      const x = (i / (n - 1)) * 800 - 80;
      marks.push(line(`${i}-v`, `M ${x} 0 L 320 220 L ${640 - x} 440`, 0.8));
      const y = 220 * t * t;
      marks.push(line(`${i}-h`, `M 0 ${220 - y} H 640 M 0 ${220 + y} H 640`, 0.6));
    } else if (pattern === 'arches') {
      const r = 28 + t * 275;
      marks.push(line(i, `M ${320 - r} 460 V 220 A ${r} ${r} 0 0 1 ${320 + r} 220 V 460`));
    } else if (pattern === 'bloom') {
      marks.push(<ellipse key={i} cx="320" cy="220" rx="164" ry="64" transform={`rotate(${svgNumber((180 * i) / n)} 320 220)`} opacity="0.78" />);
    } else if (pattern === 'meridian') {
      const r = svgNumber(172 * t);
      marks.push(<ellipse key={`${i}-v`} cx="320" cy="220" rx={r} ry="172" opacity="0.8" />);
      if (i % 2 === 0) marks.push(<ellipse key={`${i}-h`} cx="320" cy="220" rx="172" ry={r} opacity="0.45" />);
    }
  }
  return marks;
}

export interface LineArtworkProps {
  pattern?: LinePattern;
  density?: number;
  dotted?: boolean;
  palette?: LinePalette;
  className?: string;
  svgRef?: RefObject<SVGSVGElement>;
  label?: string;
}

/** A self-contained SVG: the downloaded artwork matches the preview, including its gradients. */
export function LineArtwork({ pattern = 'orbit', density = 16, dotted = true, palette = 'forest', className, svgRef, label }: LineArtworkProps) {
  const id = `line-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const colors = PALETTES[palette];
  return (
    <svg ref={svgRef} className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" preserveAspectRatio="xMidYMid slice" fill="none" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <defs>
        <linearGradient id={`${id}-background`} x1="0" y1="0" x2="640" y2="440" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors.glow} /><stop offset="0.63" stopColor={colors.base} /><stop offset="1" stopColor={colors.base} />
        </linearGradient>
        <radialGradient id={`${id}-light`} cx="0" cy="0" r="1" gradientTransform="translate(500 340) rotate(-145) scale(480 240)" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors.glow} stopOpacity="0.78" /><stop offset="1" stopColor={colors.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-fade`}>
          <stop offset="0.38" stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0.15" />
        </radialGradient>
        <mask id={`${id}-mask`}><rect width="640" height="440" fill={`url(#${id}-fade)`} /></mask>
      </defs>
      <rect width="640" height="440" fill={`url(#${id}-background)`} />
      <rect width="640" height="440" fill={`url(#${id}-light)`} />
      <g stroke={colors.line} strokeWidth={dotted ? 1.6 : 0.8} strokeLinecap="round" strokeDasharray={dotted ? '0.1 5.5' : undefined} mask={`url(#${id}-mask)`} opacity="0.7">
        {geometry(pattern, density)}
      </g>
    </svg>
  );
}

const INITIAL_ART: ArtSettings = { seed: '842719', mode: 'patterns', pattern: 'orbit', dotted: true, palette: 'aurora', tension: 48, openness: 56, density: 65 };
const clampControl = (n: number) => Math.max(0, Math.min(100, n));

export default function LineStudio() {
  const [settings, setSettings] = useState<ArtSettings>(INITIAL_ART);
  const [seedDraft, setSeedDraft] = useState(INITIAL_ART.seed);
  const [playing, setPlaying] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  const [keepPalette, setKeepPalette] = useState(true);
  const [status, setStatus] = useState('');
  const artwork = useRef<ArtworkHandle>(null);
  const id = useId();
  const variations = useMemo(() => [
    { name: 'Unfold', tension: -20, openness: 20, density: -6 },
    { name: 'Gather', tension: 16, openness: -24, density: 10 },
    { name: 'Drift', tension: -30, openness: -10, density: -18 },
    { name: 'Intensify', tension: 26, openness: 12, density: 18 },
  ].map(v => ({ name: v.name, settings: { ...settings,
    tension: clampControl(settings.tension + v.tension),
    openness: clampControl(settings.openness + v.openness),
    density: clampControl(settings.density + v.density),
  } })), [settings]);

  function update(next: Partial<ArtSettings>) {
    setSettings(current => ({ ...current, ...next }));
    setStatus('');
  }
  function generate() {
    if (!seedDraft.trim()) { setStatus('Enter a number to begin.'); return; }
    update({ seed: seedDraft });
    artwork.current?.reset();
  }
  function surprise() {
    const values = crypto.getRandomValues(new Uint32Array(2));
    const seed = String(values[0]);
    setSeedDraft(seed);
    update({ seed, palette: keepPalette ? settings.palette : ART_PALETTES[values[1] % ART_PALETTES.length].id });
  }
  function download() {
    try {
      artwork.current?.downloadSVG();
      setStatus('Your frame is ready. Keep exploring.');
    } catch { setStatus('Could not download. Please try again.'); }
  }

  return <section id="line-studio" className="home-section line-studio" aria-labelledby={`${id}-heading`}>
    <div className="home-container">
      <div className="ls-heading">
        <div><p className="ls-eyebrow"><span /> The art of possibility</p><h2 id={`${id}-heading`}>A little structure.<br /><span>Endless possibilities.</span></h2></div>
        <p>Enter a number.<br />See what unfolds.</p>
      </div>
      <div className="ls-instrument">
        <div className="ls-art-stage">
          <GenerativeArtwork ref={artwork} settings={settings} playing={playing && !reducedMotion} className="ls-generative-canvas" />
          <div className="ls-stage-top">
            <div className="ls-modes" role="group" aria-label="Art form">
              {([{ id: 'patterns', label: 'Patterns' }, { id: 'flow', label: 'Flow field' }] as { id: ArtMode; label: string }[]).map(mode => <button key={mode.id} type="button" aria-pressed={settings.mode === mode.id} onClick={() => update({ mode: mode.id })}>{mode.label}</button>)}
            </div>
            <span className="ls-edition">GENERATIVE STUDIES / 001</span>
          </div>
          <div className="ls-stage-bottom">
            <div><span className="ls-art-kicker">{settings.mode === 'patterns' ? `${ART_PATTERNS.find(pattern => pattern.id === (settings.pattern ?? 'orbit'))?.name} / Pattern studies` : 'Weather of light'}</span><span className="ls-art-number">Nº {settings.seed}</span></div>
            <button type="button" className="ls-motion-toggle" disabled={reducedMotion} title={reducedMotion ? "Motion follows your reduced-motion preference" : undefined} aria-pressed={!playing || reducedMotion} onClick={() => setPlaying(!playing)}>
              <span className={playing && !reducedMotion ? 'ls-pause-icon' : 'ls-play-icon'} aria-hidden="true" />{reducedMotion ? 'Still frame' : playing ? 'Freeze frame' : 'Resume motion'}
            </button>
          </div>
        </div>
        <div className="ls-command-bar">
          <form className="ls-seed-form" onSubmit={event => { event.preventDefault(); generate(); }}>
            <label htmlFor={`${id}-seed`}>Your seed</label>
            <div className="ls-seed-field"><span aria-hidden="true">#</span><input id={`${id}-seed`} inputMode="numeric" pattern="[0-9]+" maxLength={12} required value={seedDraft} onChange={event => setSeedDraft(event.target.value.replace(/[^0-9]/g, ''))} aria-describedby={`${id}-seed-note`} /><button type="submit" aria-label="Generate from seed" title="Generate from seed"><ArrowRight size={17} /></button></div>
          </form>
          <button className="ls-surprise" type="button" onClick={surprise}><RotateCcw size={15} />Surprise me</button>
          <p id={`${id}-seed-note`}>Your number. Your starting point.</p>
          <button className="ls-save" type="button" onClick={download}><Download size={15} /><span>Save frame</span></button>
        </div>
        {settings.mode === 'patterns' && <div className="ls-pattern-library">
          <div className="ls-pattern-heading"><span>Choose a structure</span><div role="group" aria-label="Pattern stroke" className="ls-stroke-controls">
            <button type="button" aria-pressed={!!settings.dotted} onClick={() => update({ dotted: true })}>Dotted</button>
            <button type="button" aria-pressed={!settings.dotted} onClick={() => update({ dotted: false })}>Solid</button>
          </div></div>
          <div className="ls-pattern-options" role="group" aria-label="Pattern structure">{ART_PATTERNS.map(pattern => <button type="button" key={pattern.id} aria-label={`${pattern.name} pattern`} aria-pressed={(settings.pattern ?? 'orbit') === pattern.id} onClick={() => update({ pattern: pattern.id })}>
            <LineArtwork pattern={pattern.id} density={12} dotted={false} palette={({ aurora: 'forest', ember: 'amber', glacier: 'blue', orchid: 'violet', pearl: 'silver' } as const)[settings.palette]} />
            <span>{pattern.name}</span>
          </button>)}</div>
        </div>}
        <div className="ls-tuning">
          <div className="ls-dials">
            {([{ key: 'tension', label: 'Tension', low: 'Soft', high: 'Sculpted' }, { key: 'openness', label: 'Openness', low: 'Gathered', high: 'Expansive' }, { key: 'density', label: 'Detail', low: 'Quiet', high: 'Intricate' }] as const).map(control => <div className="ls-dial" key={control.key}>
              <label htmlFor={`${id}-${control.key}`}>{control.label}<output htmlFor={`${id}-${control.key}`}>{settings[control.key]}</output></label>
              <input type="range" id={`${id}-${control.key}`} min="0" max="100" value={settings[control.key]} onChange={event => update({ [control.key]: Number(event.target.value) })} />
              <div><span>{control.low}</span><span>{control.high}</span></div>
            </div>)}
          </div>
          <fieldset className="ls-palette-group"><legend>Color atmosphere</legend><div className="ls-palette-row">
            {ART_PALETTES.map(palette => <button key={palette.id} type="button" className="ls-color" aria-label={palette.name} title={palette.name} aria-pressed={settings.palette === palette.id} style={{ '--art-swatch': palette.swatch } as CSSProperties} onClick={() => update({ palette: palette.id })}>{settings.palette === palette.id && <Check size={12} />}</button>)}
          </div><label className="ls-color-lock"><input type="checkbox" checked={keepPalette} onChange={event => setKeepPalette(event.target.checked)} />Keep colors on surprise</label></fieldset>
        </div>
      </div>
      <div className="ls-variations-heading"><div><span>Stay in this world</span><p>Four ways to take this form a little further.</p></div><span className="ls-variation-note">SAME SEED · NEW POSSIBILITIES</span></div>
      <div className="ls-variations" role="group" aria-label="Explore nearby variations">
        {variations.map((variation, index) => <button type="button" key={variation.name} onClick={() => update(variation.settings)} aria-label={`Explore ${variation.name} variation`}>
          <div className="ls-variation-art"><GenerativeArtwork settings={variation.settings} playing={false} still label={`${variation.name} variation preview`} /></div>
          <span><span><small>0{index + 1}</small>{variation.name}</span><ArrowRight size={14} /></span>
        </button>)}
      </div>
      <div className="ls-footnote"><span>Made with mathematics. Yours to make something of.</span><span role="status">{status || 'Download a still as SVG · No account needed'}</span></div>
    </div>
  </section>;
}
