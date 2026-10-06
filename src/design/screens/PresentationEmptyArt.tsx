import type { CSSProperties } from 'react';
import './libraryEmptyArt.css';

/** One shared projection keeps the screen and its three thumbnails aligned. */
export function PresentationEmptyArt() {
  return (
    <svg className="tri-library-art" viewBox="0 0 300 280" aria-hidden="true" focusable="false">
      <g transform="matrix(1 .2 0 1 63 50)" stroke="currentColor" strokeWidth=".8" fill="none">
        <g>
          <path d="M0 0L6 -4H174L168 0Z" fill="#292929" strokeOpacity=".7" />
          <path d="M168 0L174 -4V90.5L168 94.5Z" fill="#121212" strokeOpacity=".45" />
          <path d="M0 0H168V94.5H0Z" fill="#1c1c1c" strokeOpacity=".85" />
          <path d="M6 6H162V88.5H6Z" strokeOpacity=".16" strokeWidth=".6" />
          <path d="M50 42H118" strokeOpacity=".65" strokeWidth="1.2" />
          <path d="M62 53H106" strokeOpacity=".3" strokeWidth="1.2" />
        </g>
        {[0, 1, 2].map(index => (
          <g key={index} transform={`translate(${index * 60} 120)`}>
            <g className="tri-library-art__motion" style={{
              '--library-y': '-8px', '--library-delay': `${index * 90}ms`,
            } as CSSProperties}>
              <path d="M0 0L6 -4H54L48 0Z" fill="#292929" strokeOpacity=".55" />
              <path d="M48 0L54 -4V23L48 27Z" fill="#121212" strokeOpacity=".4" />
              <path d="M0 0H48V27H0Z" fill="#1a1a1a" strokeOpacity=".65" />
              <path d="M14 11H34" strokeOpacity=".4" />
              <path d="M18 16H30" strokeOpacity=".2" strokeWidth=".6" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
