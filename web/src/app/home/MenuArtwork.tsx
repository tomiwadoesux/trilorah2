import Image from 'next/image';
import valley from '../../../../src/assets/backgrounds/valley.jpg';
import { BookOpen, Check, Radio, StickyNote } from '@/components/icons';
import BrandMark from '../live/[slug]/components/BrandMark';
import { LineArtwork } from './LineStudio';
import './menu-artwork.css';

export type MenuArtworkKind = 'workspace' | 'companion' | 'notebook' | 'studio';

function ArtworkWordmark() {
  return <span className="home-menu-art-wordmark"><BrandMark />trilorah</span>;
}

function WorkspaceArtwork() {
  return (
    <>
      <div className="home-menu-art-window">
        <div className="home-menu-art-windowbar"><ArtworkWordmark /><span><i /><i /><i /></span></div>
        <div className="home-menu-art-workspace-layout">
          <div className="home-menu-art-sidebar"><span /><span className="is-active" /><span /><span /><div /><span /><span /></div>
          <div className="home-menu-art-stage-wrap">
            <div className="home-menu-art-stage-title"><span>Live presentation</span><i /></div>
            <div className="home-menu-art-stage"><Image src={valley} alt="" fill sizes="280px" /><div><p>Be still, and know<br />that I am God.</p><small>PSALM 46:10</small></div></div>
            <div className="home-menu-art-transcript"><Radio size={10} /><span>Live transcript</span><i /><i /><i /><i /></div>
            <div className="home-menu-art-text-lines"><i /><i /><i /></div>
          </div>
        </div>
      </div>
      <div className="home-menu-art-detail home-menu-art-detected"><BookOpen size={13} /><span>Psalm 46:10<small>Ready for the screen</small></span><Check size={11} /></div>
    </>
  );
}

function CompanionArtwork() {
  return (
    <>
      <div className="home-menu-art-connectors"><i /><i /><i /></div>
      <div className="home-menu-art-phone">
        <div className="home-menu-art-phone-top"><span>9:41</span><i /><span>▮▮▮</span></div>
        <ArtworkWordmark />
        <div className="home-menu-art-phone-service">SUNDAY GATHERING</div>
        <div className="home-menu-art-phone-verse"><span><BookOpen size={9} /> On screen now</span><p>“Be still, and know that I am God.”</p><small>Psalm 46:10</small></div>
        <div className="home-menu-art-phone-nav"><Radio size={12} /><BookOpen size={12} /><StickyNote size={12} /></div>
        <div className="home-menu-art-phone-home" />
      </div>
      <div className="home-menu-art-detail home-menu-art-note"><StickyNote size={13} /><span>A moment to be still.<small>From today’s message</small></span><Check size={10} /></div>
      <div className="home-menu-art-connected"><i /><span>Following along</span></div>
    </>
  );
}

function NotebookArtwork() {
  return (
    <>
      <svg className="home-menu-art-notebook-lines" viewBox="0 0 300 320" fill="none"><g stroke="currentColor" strokeWidth=".7">{Array.from({ length: 10 }, (_, i) => <path key={i} d={`M ${-60 + i * 15} 280 Q ${50 + i * 9} ${-10 + i * 9} ${320 + i * 13} 90`} />)}</g></svg>
      <div className="home-menu-art-book"><div className="home-menu-art-book-spine" /><div className="home-menu-art-book-cover"><BrandMark /><span>SERMON NOTES</span><strong>Room for<br />the message.</strong><div className="home-menu-art-book-rules"><i /><i /><i /></div><small>SUNDAY, TOGETHER</small></div></div>
      <div className="home-menu-art-detail home-menu-art-bookmark"><span /><span /><span /></div>
    </>
  );
}

function StudioArtwork() {
  return (
    <>
      <div className="home-menu-art-studio-lines"><LineArtwork pattern="bloom" density={18} palette="blue" dotted /></div>
      <div className="home-menu-art-studio-orbit"><LineArtwork pattern="orbit" density={12} palette="forest" dotted={false} /></div>
      <div className="home-menu-art-studio-diamond"><LineArtwork pattern="diamond" density={9} palette="violet" dotted /></div>
      <div className="home-menu-art-detail home-menu-art-controls"><span><i /><i /><i /><i /></span><div><i /><b /></div></div>
    </>
  );
}

/** Decorative product crops for the navigation's image cards. */
export function MenuArtwork({ kind }: { kind: MenuArtworkKind }) {
  return (
    <div className={`home-menu-art home-menu-art-${kind}`} aria-hidden="true">
      <div className="home-menu-art-scene">
        {kind === 'workspace' && <WorkspaceArtwork />}
        {kind === 'companion' && <CompanionArtwork />}
        {kind === 'notebook' && <NotebookArtwork />}
        {kind === 'studio' && <StudioArtwork />}
      </div>
      <div className="home-menu-art-fade" />
    </div>
  );
}
