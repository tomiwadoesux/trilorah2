import type { CSSProperties } from 'react';
import { MusicIcon } from '../../ui/icons';
import './libraryEmptyArt.css';

/** Figure A, with its open front position filled by a music card. */
export function SongRackArt() {
  return (
    <svg className="tri-library-art" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <g transform="translate(0 -15)" stroke="currentColor" strokeWidth=".8">
        <path d="M241.56 206V210L143.28 259.14V255.14Z" fill="#101010" strokeOpacity=".2" />
        <path d="M51.72 209.36L143.28 255.14V259.14L51.72 213.36Z" fill="#111" strokeOpacity=".27" />
        <path d="M150 160.22L241.56 206L143.28 255.14L51.72 209.36Z" fill="#161616" strokeOpacity=".45" />
        <path d="M157.56 166.36L66 212.14M227.28 201.22L135.72 247" fill="none" strokeOpacity=".22" strokeWidth=".5" />
        {[0, 18, 36, 54, 72, 100].map((offset, index) => (
          <g key={offset} transform={`translate(${-0.84 * offset} ${0.42 * offset})`}>
            <g className="tri-library-art__motion" style={{
              '--library-x': `${5 - index * 2.5}px`,
              '--library-y': `${-10 - index * 2}px`,
            } as CSSProperties}>
              <path d="M229.8 120V205L227.53 206.13V121.13Z" fill="#121212" strokeOpacity=".49" />
              <path d="M147.73 81.23L227.53 121.13V206.13L147.73 166.23Z" fill="#181818" strokeOpacity=".68" />
              <path d="M150 80.1L229.8 120L227.53 121.13L147.73 81.23Z" fill="#292929" strokeOpacity=".82" />
              <path d="M147.73 81.23L150 80.1L229.8 120" fill="none" strokeOpacity=".8" />
              <path d="M151.93 162.33V89.33L221.65 124.19" fill="none" strokeOpacity=".15" strokeWidth=".5" />
              {index === 5 && (
                <g transform="matrix(.84 .42 0 1 173.35 119.54)" stroke="none" opacity=".85">
                  <MusicIcon size={34} />
                </g>
              )}
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
