'use client';

import { useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { ArrowRight, Check, Download } from '../../components/icons';
import './line-studio.css';

export type LinePattern = 'orbit' | 'rays' | 'diamond' | 'waves' | 'weave' | 'contour' | 'grid' | 'arches' | 'bloom' | 'meridian';
export type LinePalette = 'forest' | 'blue' | 'violet' | 'amber' | 'silver';

const PATTERNS: { id: LinePattern; name: string }[] = [
  { id: 'orbit', name: 'Orbit' }, { id: 'rays', name: 'Radiate' },
  { id: 'diamond', name: 'Diamond' }, { id: 'waves', name: 'Wavelength' },
  { id: 'weave', name: 'Interlace' }, { id: 'contour', name: 'Contour' },
  { id: 'grid', name: 'Perspective' }, { id: 'arches', name: 'Arcade' },
  { id: 'bloom', name: 'Bloom' }, { id: 'meridian', name: 'Meridian' },
];

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

export default function LineStudio() {
  const [pattern, setPattern] = useState<LinePattern>('orbit');
  const [density, setDensity] = useState(16);
  const [dotted, setDotted] = useState(true);
  const [palette, setPalette] = useState<LinePalette>('forest');
  const [downloaded, setDownloaded] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const artwork = useRef<SVGSVGElement>(null);
  const controlId = useId();
  const activePattern = PATTERNS.find((item) => item.id === pattern)!;

  function saveArtwork() {
    if (!artwork.current) return;
    try {
      const svg = artwork.current.cloneNode(true) as SVGSVGElement;
      svg.setAttribute('width', String(Math.round(artwork.current.clientWidth * 2) || 1280));
      svg.setAttribute('height', String(Math.round(artwork.current.clientHeight * 2) || 880));
      svg.removeAttribute('class');
      const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trilorah-${pattern}-${palette}-${dotted ? 'dotted' : 'solid'}-${density}.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloaded(true);
      setDownloadError(false);
    } catch {
      setDownloadError(true);
    }
  }

  function changeSelection() {
    setDownloaded(false);
    setDownloadError(false);
  }

  return (
    <section id="line-studio" className="home-section line-studio" aria-labelledby={`${controlId}-heading`}>
      <div className="home-container">
        <div className="ls-heading">
          <div><p className="ls-eyebrow"><span /> Visual studio</p><h2 id={`${controlId}-heading`}>A little structure.<br />Endless possibilities.</h2></div>
          <p>Find a rhythm for your next idea. Explore a collection of original line patterns, make one your own, and take it with you.</p>
        </div>
        <div className="ls-workspace">
          <div className="ls-preview">
            <LineArtwork svgRef={artwork} pattern={pattern} density={density} dotted={dotted} palette={palette} label={`${activePattern.name} pattern in ${PALETTES[palette].name}, ${density} lines, ${dotted ? 'dotted' : 'solid'} strokes`} />
            <div className="ls-preview-top"><span>TRILORAH / PATTERN STUDIES</span><span>{String(PATTERNS.findIndex((item) => item.id === pattern) + 1).padStart(2, '0')} — 10</span></div>
            <div className="ls-preview-bottom"><span>{activePattern.name}</span><span>Made to make it yours <ArrowRight size={15} /></span></div>
          </div>
          <div className="ls-controls">
            <div className="ls-control-title"><span>Your composition</span><span className="ls-live"><span /> Live preview</span></div>
            <div className="ls-control-group">
              <label className="ls-label" htmlFor={`${controlId}-density`}>Line density <output htmlFor={`${controlId}-density`}>{density}</output></label>
              <input id={`${controlId}-density`} type="range" min="6" max="28" step="1" value={density} onChange={(event) => { setDensity(Number(event.target.value)); changeSelection(); }} />
              <div className="ls-range-labels"><span>Quiet</span><span>Intricate</span></div>
            </div>
            <fieldset className="ls-control-group"><legend className="ls-label">Line style</legend><div className="ls-segmented">
              <button type="button" aria-pressed={dotted} onClick={() => { setDotted(true); changeSelection(); }}><span className="ls-stroke-example ls-stroke-dotted" />Dotted</button>
              <button type="button" aria-pressed={!dotted} onClick={() => { setDotted(false); changeSelection(); }}><span className="ls-stroke-example" />Solid</button>
            </div></fieldset>
            <fieldset className="ls-control-group"><legend className="ls-label">Color <span>{PALETTES[palette].name}</span></legend><div className="ls-palettes">
              {(Object.keys(PALETTES) as LinePalette[]).map((item) => <button key={item} type="button" aria-label={PALETTES[item].name} title={PALETTES[item].name} aria-pressed={palette === item} style={{ '--ls-swatch': PALETTES[item].swatch } as CSSProperties} onClick={() => { setPalette(item); changeSelection(); }}>{palette === item && <Check size={14} />}</button>)}
            </div></fieldset>
            <div className="ls-export"><button type="button" className="ls-download" onClick={saveArtwork}>{downloaded ? <Check size={17} /> : <Download size={17} />}{downloaded ? 'Download again' : 'Download SVG'}</button><p role="status">{downloadError ? 'Download unavailable. Please try again.' : downloaded ? 'Your artwork is ready. Make another?' : 'Yours to use. Crisp at any size.'}</p></div>
          </div>
        </div>
        <div className="ls-presets" role="group" aria-label="Choose a line pattern">
          {PATTERNS.map((item, index) => <button key={item.id} type="button" className="ls-preset" aria-pressed={pattern === item.id} onClick={() => { setPattern(item.id); changeSelection(); }}><LineArtwork pattern={item.id} density={10} dotted={false} palette={palette} /><span><span>{item.name}</span><span className="ls-preset-number">{String(index + 1).padStart(2, '0')}</span></span></button>)}
        </div>
      </div>
    </section>
  );
}
