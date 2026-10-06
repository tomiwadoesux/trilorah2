import './bellDisplayArt.css';

const CABLE = 'M181 208C215 228 249 201 232 179C220 164 198 182 198 163V152.5';

/** A stationary display and compact receiver, joined by a slow traveling signal. */
export function DisplayConnectionArt({ reference = '1 Peter 4:10' }: { reference?: string } = {}) {
  const label = reference.trim() || '1 Peter 4:10';
  const fontSize = label.length > 18 ? 16 : label.length > 14 ? 19 : 23;
  return (
    <svg className="tri-display-connection-art" viewBox="43 28 214 214" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round">
        <path d={CABLE} strokeOpacity=".35" strokeWidth="1.15" />
        <path className="tri-display-connection-art__signal" d={CABLE} pathLength="100" strokeWidth="1.8" />
        <g className="tri-display-connection-art__box">
          <path d="M117 203L123 198H183L177 203Z" fill="#292929" strokeOpacity=".65" />
          <path d="M117 203H177V218H117Z" fill="#1c1c1c" strokeOpacity=".68" />
          <path d="M177 203L183 198V213L177 218Z" fill="#121212" strokeOpacity=".45" />
          <path d="M123 210H137" strokeOpacity=".24" strokeWidth=".6" />
          <path d="M123 213H132" strokeOpacity=".15" strokeWidth=".6" />
          <circle cx="168" cy="210.5" r="1.1" fill="currentColor" fillOpacity=".65" stroke="none" />
          <path d="M180 205V210" strokeOpacity=".8" strokeWidth="1.2" />
        </g>
        <g className="tri-display-connection-art__screen" transform="translate(63 52)">
          <path d="M0 0L6 -4H174L168 0Z" fill="#292929" strokeOpacity=".7" />
          <path d="M168 0L174 -4V90.5L168 94.5Z" fill="#121212" strokeOpacity=".46" />
          <path d="M0 0H168V94.5H0Z" fill="#1c1c1c" strokeOpacity=".85" />
          <path d="M6 6H162V88.5H6Z" fill="#161616" strokeOpacity=".17" strokeWidth=".6" />
          <text x="84" y="49" dominantBaseline="middle" textAnchor="middle" fill="currentColor" fillOpacity=".9" stroke="none" fontFamily="Georgia, 'Times New Roman', serif" fontSize={fontSize} textLength={label.length > 23 ? 146 : undefined} lengthAdjust="spacingAndGlyphs">{label}</text>
          <path d="M131 94.5H139" strokeOpacity=".9" strokeWidth="1.4" />
          <circle cx="154" cy="91.5" r="1" fill="currentColor" fillOpacity=".3" stroke="none" />
        </g>
        <path d="M194.5 146.5H201.5V152.5H194.5Z" fill="#242424" strokeOpacity=".62" />
      </g>
    </svg>
  );
}
