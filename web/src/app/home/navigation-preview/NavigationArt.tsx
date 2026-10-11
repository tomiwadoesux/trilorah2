import type { ReactNode } from 'react';
import './navigation-art.css';

export type NavigationArtKind = 'presentation' | 'scripture' | 'companion' | 'guides' | 'blog' | 'updates';

/** Same shallow screen projection as the desktop app's PresentationEmptyArt. */
function Presentation() {
  return <g transform="matrix(1 .12 0 1 69 25)">
    <path className="nt-top" d="M0 0 6-4H174L168 0Z" />
    <path className="nt-side" d="m168 0 6-4v94l-6 4Z" />
    <path className="nt-face" d="M0 0h168v94H0Z" />
    <path className="nt-dim" d="M7 7h154v80H7Z" />
    <text className="nt-serif" x="84" y="45" textAnchor="middle" fontSize="21">Be still.</text>
    <text className="nt-caption" x="84" y="62" textAnchor="middle" fontSize="6" letterSpacing="1.4">PSALM 46:10</text>
    <path className="nt-dim" d="M76 103h16M22 105v5m62-5v5m62-5v5" />
    {[0, 1, 2].map(index => <g key={index} transform={`translate(${index * 60} 119)`}>
      <g className={`nt-motion nt-slide nt-slide-${index}`}>
        <path className="nt-top" d="M0 0 5-3h47l-5 3Z" />
        <path className="nt-side" d="m47 0 5-3v27l-5 3Z" />
        <path className="nt-face" d="M0 0h47v27H0Z" />
        {index === 0 ? <path className="nt-ink" d="M14 17V8l6-1v8m-6 1c-4-2-5 4-1 3m7-4c-4-2-5 4-1 3M27 10h12m-12 5h9" /> : index === 1 ? <>
          <path className="nt-ink" d="M10 9h5v5l-3 4m7-9h5v5l-3 4M29 11h10m-10 5h7" />
        </> : <path className="nt-ink" d="M12 7v14m-5-9h10M24 11h15m-15 5h11" />}
      </g>
    </g>)}
  </g>;
}

/** The raised quotation mark is the same silhouette used by ScriptureQuoteArt. */
function Quotation() {
  return <g transform="translate(-78 -55)">
    <path className="nt-top" d="m85 61 9-6h34l-9 6Z" />
    <path className="nt-side" d="m119 61 9-6v35c0 25-12 42-34 53l-9 6c22-11 34-28 34-53Z" />
    <path className="nt-side" d="m78 135 9-6 7 14-9 6Z" />
    <path className="nt-face" d="M85 61h34v35c0 25-12 42-34 53l-7-14c13-6 21-16 22-29H85Z" />
    <path className="nt-dim" d="M88 65h27" />
  </g>;
}

function Scripture() {
  return <>
    <g className="nt-dim" transform="matrix(1 .1 0 1 91 71)"><path d="M0 0h140M13 11h114M-8 91h138" /></g>
    <g transform="translate(62 31) scale(.68)"><g className="nt-motion nt-quote-left"><Quotation /></g></g>
    <g transform="translate(227 42) scale(.68)"><g className="nt-motion nt-quote-right"><Quotation /></g></g>
    <g transform="matrix(1 .1 0 1 82 106)"><g className="nt-motion nt-verse">
      <path className="nt-top" d="M0 0 5-4h148l-5 4Z" />
      <path className="nt-side" d="m148 0 5-4v54l-5 4Z" />
      <path className="nt-face" d="M0 0h148v54H0Z" />
      <text className="nt-serif" x="16" y="23" fontSize="14">Psalm 46:10</text>
      <path className="nt-ink" d="M16 35h114" />
      <path className="nt-soft" d="M16 42h78" />
    </g></g>
  </>;
}

function Companion() {
  return <>
    <g transform="rotate(7 168 109)">
      <rect className="nt-top" x="128" y="26" width="82" height="164" rx="17" />
      <rect className="nt-face" x="132" y="30" width="74" height="156" rx="14" />
      <rect className="nt-screen" x="137" y="49" width="64" height="119" rx="4" />
      <path className="nt-soft" d="M128 65h-2v13h2m0 7h-2v17h2" />
      <rect x="157" y="36" width="24" height="5" rx="2.5" className="nt-inset" />
      <path className="nt-soft" d="M160 178h18" />
      <text className="nt-caption" x="145" y="125" fontSize="6" letterSpacing=".8">MY NOTES</text>
      <path className="nt-soft" d="M145 134h45m-45 8h39m-39 8h44m-44 8h27" />
    </g>
    <g transform="matrix(1 .1 0 1 75 63)"><g className="nt-motion nt-phone-verse">
      <path className="nt-top" d="M0 0 5-3h130l-5 3Z" />
      <path className="nt-side" d="m130 0 5-3v56l-5 3Z" />
      <rect className="nt-face" width="130" height="56" rx="5" />
      <text className="nt-serif" x="13" y="22" fontSize="13">Psalm 46:10</text>
      <path className="nt-ink" d="M13 33h102" /><path className="nt-soft" d="M13 42h81" />
    </g></g>
  </>;
}

/** A service programme, using the app's three-panel sermon-outline construction. */
function Guides() {
  return <g transform="matrix(.98 .12 0 1 66 31)">
    <path className="nt-side" d="m0 7 7-4h177v135l-6 5H0Z" />
    <g className="nt-motion nt-fold-left">
      <path className="nt-face" d="m0 0 60 8v134l-60-8Z" />
      <text className="nt-number" x="11" y="30" transform="skewY(7.6)">01</text>
      <path className="nt-ink" d="m11 46 34 4.5m-34 7 26 3.5" />
      <path className="nt-soft" d="m11 79 34 4.5m-34 6 30 4m-30 6 34 4.5" />
      <path className="nt-dim" d="m11 116 13 1.8" />
    </g>
    <path className="nt-fold-shadow" d="m60 8 58-8v134l-58 8Z" />
    <text className="nt-number" x="70" y="46" transform="skewY(-7.8)">02</text>
    <path className="nt-ink" d="m70 50 36-5m-36 16 27-3.7" />
    <path className="nt-soft" d="m70 83 36-5m-36 15 30-4m-30 14 35-4.8" />
    <path className="nt-dim" d="m70 120 13-1.8" />
    <g className="nt-motion nt-fold-right">
      <path className="nt-face" d="m118 0 60 8v134l-60-8Z" />
      <text className="nt-number" x="129" y="14" transform="skewY(7.6)">03</text>
      <path className="nt-ink" d="m129 46 34 4.5m-34 7 26 3.5" />
      <path className="nt-soft" d="m129 79 34 4.5m-34 6 30 4m-30 6 34 4.5" />
      <path className="nt-dim" d="m129 116 13 1.8" />
    </g>
  </g>;
}

/** The curved paper and binding follow the app's BibleBookmarkArt. */
function Journal() {
  return <g transform="translate(9 -32) scale(1 .94)">
    <path className="nt-side" d="m126 123.75 71.25 40.63 71.25 30.62-94.5 47.25-71.25-30.63L31.5 171Z" />
    <path className="nt-fold-shadow" d="M126 122.5c18.75-8.62 50.25 7.12 67.5 38.75l-87 43.5C89.25 173.12 57.75 157.38 39 166Z" />
    <path className="nt-fold-shadow" d="M193.5 161.25c17.25-14.37 48.75 1.37 67.5 28.75l-87 43.5c-18.75-27.38-50.25-43.12-67.5-28.75Z" />
    <path className="nt-soft" d="M39 162c18.75-8.62 50.25 7.12 67.5 38.75m0 0c17.25-14.37 48.75 1.37 67.5 28.75" />
    <path className="nt-face" d="M126 115.5c18.75-8.62 50.25 7.12 67.5 38.75l-87 43.5C89.25 166.12 57.75 150.38 39 159Z" />
    <g transform="matrix(.28 .14 -.28 .14 118 128)"><Quotation /><g transform="translate(73 0)"><Quotation /></g></g>
    <path className="nt-soft" d="m91 160 28 15m-38-9 22 12" />
    <g className="nt-motion nt-journal-page">
      <path className="nt-face" d="M193.5 154.25c17.25-14.37 48.75 1.37 67.5 28.75l-87 43.5c-18.75-27.38-50.25-43.12-67.5-28.75Z" />
      <path className="nt-ink" d="M194 174c12-2 24 3 35 10" />
      <path className="nt-soft" d="M181 181c12-2 24 3 35 10m-48-3c12-2 24 3 35 10m-48-3c10-2 21 2 29 7" />
      <path className="nt-top" d="m213 159-40 67 9-2 1 10 42-69Z" />
      <path className="nt-dim" d="m216 164-36 59" />
    </g>
    <path className="nt-soft" d="m193.5 154.25-87 43.5" />
  </g>;
}

/** Cast bell geometry from NotificationBellArt, accompanying a new release sheet. */
function Bell() {
  return <g className="nt-motion nt-bell">
    <path className="nt-ink" d="M141 78v-9c0-13 18-13 18 0v9" />
    <ellipse className="nt-top" cx="150" cy="80" rx="13" ry="4.5" />
    <path className="nt-face" d="M150 80c-28 0-44 19-44 44 0 21-8 40-21 56 16 27 114 27 130 0-13-16-21-35-21-56 0-25-16-44-44-44Z" />
    <path className="nt-dim" d="M143 87c-20 3-28 18-28 39 0 22-7 38-15 49m57-88c20 3 28 18 28 39 0 22 7 38 15 49" />
    <ellipse className="nt-side" cx="150" cy="180" rx="65" ry="20" />
    <ellipse className="nt-screen" cx="150" cy="180" rx="57" ry="13" />
    <path className="nt-ink" d="M150 169v21" />
    <ellipse className="nt-top" cx="150" cy="190" rx="6.5" ry="5" />
    <path className="nt-top" d="M85 180v4c0 27 130 27 130 0v-4c0 27-130 27-130 0Z" />
    <g className="nt-bell-ring"><path d="M72 134c-7 11-9 24-6 35m162-35c7 11 9 24 6 35" /></g>
  </g>;
}

function Updates() {
  return <>
    <g transform="matrix(1 .16 -.16 .94 88 33)">
      {[16, 8].map(offset => <g key={offset} transform={`translate(${-offset / 2} ${offset})`}><path className="nt-side" d="M0 0h103v128H0Z" /><path className="nt-dim" d="M7 122h85" /></g>)}
      <g className="nt-motion nt-release">
        <path className="nt-face" d="M0 0h81l22 22v106H0Z" />
        <path className="nt-top" d="M81 0v22h22Z" />
        <text className="nt-caption" x="13" y="28" fontSize="7" letterSpacing="1.1">WHAT’S NEW</text>
        {[48, 72, 96].map(y => <g key={y}><path className="nt-ink" d={`m13 ${y} 3 3 5-6M29 ${y}h49`} /><path className="nt-soft" d={`M29 ${y + 8}h35`} /></g>)}
      </g>
    </g>
    <g transform="translate(164 41) scale(.48)"><Bell /></g>
  </>;
}

const scenes: Record<NavigationArtKind, () => ReactNode> = {
  presentation: Presentation, scripture: Scripture, companion: Companion,
  guides: Guides, blog: Journal, updates: Updates,
};

export function NavigationArt({ kind }: { kind: NavigationArtKind }) {
  const Scene = scenes[kind];
  return <svg className={`ns-figure nt-art nt-art-${kind}`} viewBox="0 0 320 220" aria-hidden="true" focusable="false"><Scene /></svg>;
}

/** Small marks share the illustrations' silhouettes, without their perspective detail. */
export function NavigationIcon({ kind }: { kind: NavigationArtKind }) {
  const paths: Record<NavigationArtKind, ReactNode> = {
    presentation: <><rect x="3" y="3" width="18" height="12" rx="2" /><path d="M5 19h3m3 0h3m3 0h3M8 8h8M10 11h4" /></>,
    scripture: <><path d="M4 5h6v6c0 4-2 6-5 8l-2-3c2-1 3-2 3-4H4Zm10 0h6v6c0 4-2 6-5 8l-2-3c2-1 3-2 3-4h-2Z" /></>,
    companion: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 5h4M10 18h4M9 9h6m-6 3h4" /></>,
    guides: <><path d="m3 4 6 2 6-2 6 2v15l-6-2-6 2-6-2Z" /><path d="M9 6v15M15 4v15M5.5 9l1 .3m5-1 1-.3m5 1 1 .3" /></>,
    blog: <><path d="M12 6C8 3 5 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 2Zm0 0v15" /><path d="M16 4v8l2-1 2 1V4" /></>,
    updates: <><path d="M9 5a3 3 0 0 1 6 0m-9 6a6 6 0 0 1 12 0c0 4 1 5 2 6H4c1-1 2-2 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0M2 9v4m20-4v4" /></>,
  };
  return <svg className="nt-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}
