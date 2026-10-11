import './navigation-media.css';

export type NavigationMediaKind = 'presentation' | 'scripture' | 'companion' | 'branding' | 'guides' | 'blog' | 'updates';

/** Decorative, image-ready surfaces. The outer masks blend every composition into its tile. */
export function NavigationMedia({ kind }: { kind: NavigationMediaKind }) {
  return <div className={`ns-media nm-${kind}`} aria-hidden="true"><div className="nm-canvas">
    {kind === 'presentation' && <div className="nm-window">
      <div className="nm-window-bar"><span className="nm-dots"><i /><i /><i /></span><span>Sunday service</span><span className="nm-status">Live</span></div>
      <div className="nm-window-body"><div className="nm-rail"><span /><span /><span /><span /><span /></div><div className="nm-stage"><span>Be still,<br />and know.</span><small>PSALM 46:10</small></div></div>
      <div className="nm-filmstrip"><i /><i /><i /><i /></div>
    </div>}
    {kind === 'scripture' && <div className="nm-verse-stack">
      <div className="nm-verse-back" /><div className="nm-verse-card"><small>PSALM 46:10</small><p>Be still, and know<br />that I am God.</p><span className="nm-card-rule" /></div>
    </div>}
    {kind === 'companion' && <div className="nm-companion-cards">
      <div className="nm-companion-back"><div className="nm-thumb nm-thumb-moss" /><span /><span /></div>
      <div className="nm-companion-front"><div className="nm-companion-bar"><i /> Sunday gathering</div><div className="nm-thumb nm-thumb-moss"><small>FOLLOW ALONG</small><span>Be present.</span></div><div className="nm-note-lines"><i /><i /><i /></div></div>
    </div>}
    {kind === 'branding' && <div className="nm-branding-cards"><div className="nm-branding-back" /><div className="nm-branding-card"><small>YOUR CHURCH, YOUR WAY</small><div className="nm-branding-type">Aa<span>Make it yours.</span></div><div className="nm-branding-swatches"><i /><i /><i /><i /><i /></div><div className="nm-branding-samples"><span /><span /><span /></div></div></div>}
    {kind === 'guides' && <div className="nm-guide-cards">{['Prepare', 'Present', 'Connect'].map((title, index) => <div className={`nm-guide nm-guide-${index}`} key={title}><div className="nm-guide-image"><span>0{index + 1}</span></div><strong>{title}</strong><i /><i /></div>)}</div>}
    {kind === 'blog' && <div className="nm-editorial"><div className="nm-editorial-back" /><div className="nm-editorial-cover"><small>FROM TRILORAH</small><p>Made for<br />the message.</p><span /></div></div>}
    {kind === 'updates' && <div className="nm-release-card"><div className="nm-release-heading"><i /><span>What’s new</span><small>LATEST</small></div><div className="nm-release-image" /><div className="nm-release-row"><i /><span /><span /></div><div className="nm-release-row"><i /><span /><span /></div></div>}
  </div></div>;
}

export function NavigationThumbnail({ kind }: { kind: NavigationMediaKind }) {
  return <span className={`nm-thumbnail nm-thumbnail-${kind}`} aria-hidden="true" />;
}
