import type { CSSProperties } from 'react';
import './dashboardSymbols.css';

/** Figure C, developed into an upright chart for the empty trust history. */
export function RunningOrderArt() {
  return <svg className="tri-dashboard-symbol tri-trust-bars-art" viewBox="26 57 248 170" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth=".8" strokeLinejoin="round">
      <path d="M42 205L65 189H258L235 205Z" fill="#191919" strokeOpacity=".45" />
      <path d="M42 205H235V211H42ZM235 205L258 189V195L235 211Z" fill="#111" strokeOpacity=".3" />
      <path d="M45 184V80M42 94H46M42 125H46M42 156H46" fill="none" strokeOpacity=".2" strokeWidth=".6" />
      {[{x:65, top:150}, {x:123, top:124}, {x:181, top:88}].map(({ x, top }, index) => <g key={x} transform={`translate(${x} 0)`}>
        <g className="tri-trust-bars-art__bar" style={{ '--symbol-delay': `${index * 80}ms` } as CSSProperties}>
          <path d={`M0 ${top}L15 ${top-11}H50L35 ${top}Z`} fill="#292929" strokeOpacity=".8" />
          <path d={`M35 ${top}L50 ${top-11}V181L35 192Z`} fill="#121212" strokeOpacity=".5" />
          <path d={`M0 ${top}H35V192H0Z`} fill="#1c1c1c" strokeOpacity=".8" />
          <path d="M5 186H30" fill="none" strokeOpacity=".18" strokeWidth=".6" />
        </g>
      </g>)}
    </g>
  </svg>;
}
