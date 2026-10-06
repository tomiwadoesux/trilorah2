import type { CSSProperties } from 'react';
import './libraryEmptyArt.css';

/** Two companion screens, with decorative QR marks engraved into their faces. */
export function CompanionBoxesArt() {
  return <svg className="tri-library-art tri-companion-boxes-art" viewBox="42 75 218 148" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth=".8" strokeLinejoin="round">
      <path d="M58 202L80 187H242L220 202Z" fill="#191919" strokeOpacity=".4" />
      <path d="M58 202H220V208H58ZM220 202L242 187V193L220 208Z" fill="#121212" strokeOpacity=".25" />
      {[76, 151].map((x, index) => <g key={x} transform={`translate(${x} 0)`}>
        <g className="tri-library-art__motion" style={{ '--library-y': '-5px', '--library-delay': `${index * 90}ms` } as CSSProperties}>
          <path d="M0 111L17 98H73L56 111Z" fill="#282828" strokeOpacity=".8" />
          <path d="M56 111L73 98V181L56 194Z" fill="#121212" strokeOpacity=".5" />
          <path d="M0 111H56V194H0Z" fill="#1c1c1c" strokeOpacity=".8" />
          <g transform="translate(9 132)" fill="none" strokeOpacity=".85" strokeWidth="1.25">
            <path d="M0 0H13V13H0ZM25 0H38V13H25ZM0 25H13V38H0Z" />
            <path d="M4 4H9V9H4ZM29 4H34V9H29ZM4 29H9V34H4Z" fill="currentColor" fillOpacity=".55" stroke="none" />
            <path d="M18 0V5M18 10V18H25M0 19H8M13 18V22M30 18H38M19 26V32H25V38M30 25V30H38V38H32M19 38H15M38 19V22" strokeWidth="2.6" />
          </g>
          <path d="M9 183H31" fill="none" strokeOpacity=".2" strokeWidth=".6" />
        </g>
      </g>)}
    </g>
  </svg>;
}
