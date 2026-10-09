import { useEffect, useState } from 'react';
import { Loupe, Plot, Riffle } from '@lucasmarkes/hairline/react';
import { STUDY_ICONS, STUDY_PATHS, STUDY_STYLES, studySvg, type StudyIcon, type StudyStyle } from './iconStudiesData';
import { CUTOUT_PATHS, CUTOUT_STYLES, cutoutSvg, type CutoutStyle } from './cutoutStudiesData';
import '../../ui/hairlineTheme.css';
import './iconStudies.css';

type Family = StudyStyle | CutoutStyle;
const ALL_STYLES = [...STUDY_STYLES, ...CUTOUT_STYLES];
const ALL_PATHS = { ...STUDY_PATHS, ...CUTOUT_PATHS };

function drawingSvg(icon: StudyIcon, family: Family) {
  return family in CUTOUT_PATHS ? cutoutSvg(icon, family as CutoutStyle) : studySvg(icon, family as StudyStyle);
}

function Glyph({ icon, family, size = 48 }: { icon: StudyIcon; family: Family; size?: number }) {
  const style = ALL_STYLES.find(item => item.id === family)!;
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor"
    strokeWidth={style.weight} strokeLinecap={style.cap} strokeLinejoin={style.join} aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: ALL_PATHS[family][icon] }} />;
}

export function IconStudies({ cutout = false }: { cutout?: boolean }) {
  const styles = cutout ? CUTOUT_STYLES : STUDY_STYLES;
  const count = styles.length * STUDY_ICONS.length;
  const exportDirectory = cutout ? 'cutout-studies' : 'icon-studies';
  useEffect(() => {
    const previousTitle = document.title;
    document.title = cutout ? 'Trilorah · Cutout explorations' : 'Trilorah · 25 icon studies';
    return () => { document.title = previousTitle; };
  }, [cutout]);
  const [family, setFamily] = useState<Family>(cutout ? 'chisel' : 'contour');
  const [icon, setIcon] = useState<StudyIcon>('bible');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [tab, setTab] = useState<StudyIcon>('bible');
  const [listening, setListening] = useState(false);
  const selectedFamily = styles.find(item => item.id === family)!;
  const selectedIcon = STUDY_ICONS.find(item => item.id === icon)!;

  function choose(nextFamily: Family, nextIcon = icon) {
    setFamily(nextFamily);
    setIcon(nextIcon);
    setCopied(false);
    setCopyError(false);
  }
  async function copySvg() {
    try {
      await navigator.clipboard.writeText(drawingSvg(icon, family));
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  return <main className="icon-studies tri-hairline-theme" data-theme="dark">
    <div className="icon-studies__wrap">
      <header className="icon-studies__intro">
        <div className="icon-studies__eyebrow"><span>TRILORAH</span><span>{cutout ? 'CUTOUT EXPLORATIONS / 03' : 'DESIGN STUDY / 02'}</span></div>
        <div className="icon-studies__headline">
          <div><h1>{cutout ? 'Cutout.' : 'One language.'}<br /><span>{cutout ? 'Six directions.' : 'Five directions.'}</span></h1>
            <p>{cutout ? 'Your chosen style, taken further.' : 'Redrawn with clearer shapes and a consistent visual weight.'}<br />{cutout ? 'The original, plus five new ways to shape the light.' : 'Five service icons. Five distinct families.'}</p></div>
          <div className="icon-studies__downloads">
            <a className="icon-studies__download" href={`./${exportDirectory}/${cutout ? 'trilorah-cutout-30' : 'trilorah-25-icons'}.zip`} download>Download all {count} <span aria-hidden="true">↗</span></a>
            <a className="icon-studies__related" href={cutout ? './design.html?icon-studies' : './design.html?cutout-studies'}>{cutout ? '← Back to the five styles' : 'Explore Cutout variations →'}</a>
            <a className="icon-studies__related" href="./design.html?cutout-library">Open the full Cutout library →</a>
          </div>
        </div>
        <div className="icon-studies__meta"><span>{count} ORIGINAL SVGs</span><span>LIGHT ON DARK</span><span>{cutout ? '1 ORIGINAL + 5 NEW FAMILIES' : '5 COHERENT FAMILIES'}</span></div>
      </header>

      <section className="icon-studies__matrix" aria-label={`${count} icon designs`}>
        <div className="icon-studies__column-head" aria-hidden="true">
          <span>THE DIRECTION</span>{STUDY_ICONS.map((item, i) => <span key={item.id}><small>0{i + 1}</small>{item.name}</span>)}
        </div>
        {styles.map(style => <div className="icon-studies__row" key={style.id} data-selected={family === style.id}>
          <button className="icon-studies__family" onClick={() => choose(style.id)} aria-pressed={family === style.id}>
            <span className="icon-studies__letter">{style.code}</span>
            <strong>{style.name}</strong><span>{style.description}</span>
          </button>
          <div className="icon-studies__cells">
            {STUDY_ICONS.map((item, i) => <button type="button" key={item.id} className="icon-studies__cell"
              aria-label={`${style.code}${cutout ? '.' : ''}${i + 1}: ${style.name} ${item.name}`} aria-pressed={family === style.id && icon === item.id}
              onClick={() => choose(style.id, item.id)}>
              <span className="icon-studies__cell-id" aria-hidden="true">{style.code}{cutout ? '.' : ''}{i + 1}</span>
              <Glyph icon={item.id} family={style.id} />
              <span className="icon-studies__cell-name">{item.name}</span>
              <span className="icon-studies__selection" aria-hidden="true">↗</span>
            </button>)}
          </div>
        </div>)}
      </section>

      <section className="icon-studies__detail" aria-label="Selected icon preview">
        <div className="icon-studies__large"><Glyph icon={icon} family={family} size={112} /><span>ENLARGED VIEW</span></div>
        <div className="icon-studies__description">
          <span className="icon-studies__overline">{selectedFamily.code} / {selectedFamily.name}</span>
          <h2>{selectedIcon.name}</h2><p>{selectedIcon.where}</p>
          <div className="icon-studies__sizes">{[16, 20, 24, 32].map(size => <div key={size}><span><Glyph icon={icon} family={family} size={size} /></span><small>{size}px</small></div>)}</div>
        </div>
        <div className="icon-studies__actions">
          <p><span>Works best for</span>{selectedFamily.use}</p>
          <a href={`./${exportDirectory}/${family}-${icon}.svg`} download>Download SVG <span aria-hidden="true">↓</span></a>
          <button type="button" onClick={() => void copySvg()}>{copied ? 'SVG copied ✓' : 'Copy SVG'}</button>
          <span className="icon-studies__copy-status" role="status">{copyError ? 'Copy unavailable. Use Download SVG.' : copied ? 'Copied to clipboard.' : ''}</span>
        </div>
      </section>

      <section className="icon-studies__context" aria-labelledby="context-title">
        <div className="icon-studies__section-heading"><div><span className="icon-studies__overline">AT WORK</span><h2 id="context-title">{selectedFamily.name}, in the interface.</h2></div><p>Choose a row above to switch the whole set.</p></div>
        <div className="icon-studies__toolbar">
          <div className="icon-studies__tabs" aria-label="Example library tabs">{(['bible', 'songs', 'media'] as const).map(id => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}><Glyph icon={id} family={family} size={21} />{STUDY_ICONS.find(item => item.id === id)!.name}</button>)}</div>
          <label className="icon-studies__search"><Glyph icon="search" family={family} size={19} /><input aria-label="Example search" placeholder={`Search ${STUDY_ICONS.find(item => item.id === tab)!.name.toLowerCase()}…`} /></label>
          <button className="icon-studies__listen" type="button" aria-pressed={listening} onClick={() => setListening(!listening)}><Glyph icon="microphone" family={family} size={20} />{listening ? 'Listening…' : 'Start listening'}</button>
        </div>
        <p className="icon-studies__context-note">Interactive design preview · no audio is recorded</p>
      </section>

      {!cutout && <section className="icon-studies__hairline" aria-labelledby="hairline-title">
        <div className="icon-studies__section-heading"><div><span className="icon-studies__overline">THE ILLUSTRATION FAMILY</span><h2 id="hairline-title">Hairline, brought up to date.</h2></div><span className="icon-studies__version">v0.5.0</span></div>
        <p className="icon-studies__hairline-copy">Our empty-state drawings now share Hairline’s monochrome palette. These three library figures show the updated engine in motion.</p>
        <div className="icon-studies__figures">
          <figure><Riffle theme="dark" intensity={0.4} label="Interactive stack of cards" /><figcaption><strong>01 / Cards</strong><span>Move across the stack</span></figcaption></figure>
          <figure><Loupe theme="dark" intensity={0.4} label="Interactive magnifying glass" /><figcaption><strong>02 / Discovery</strong><span>Move across the lens</span></figcaption></figure>
          <figure><Plot theme="dark" intensity={0.4} label="Interactive empty chart" /><figcaption><strong>03 / Trends</strong><span>Brush across the chart</span></figcaption></figure>
        </div>
      </section>}
      <footer className="icon-studies__footer"><span>DRAWN FOR TRILORAH / {cutout ? 'CUTOUT EXPLORATIONS' : 'EDITION 02'}</span><span>{styles.map(style => style.name).join(' / ')}</span></footer>
    </div>
  </main>;
}
