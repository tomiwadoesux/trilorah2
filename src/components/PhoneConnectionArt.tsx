import { useId, type CSSProperties } from 'react';
import { PhoneAudioMark } from './PhoneAudioMark';
import './phoneConnectionArt.css';

export interface PhoneConnectionArtProps {
  variant?: 'microphone' | 'remote' | 'stream';
  className?: string;
}

/** Paragraphs of text, repeated at a 120-unit pitch for a seamless downward scroll. */
function StreamScreenPage() {
  return (
    <g>
      {[0, 40, 80].map((offset, index) => (
        <g key={offset} transform={`translate(0 ${offset})`}>
          <path d={`M79 48h${[25, 32, 22][index]}`} strokeOpacity=".72" strokeWidth="1.7" />
          <path d={`M79 56h${[60, 54, 59][index]}M79 64h${[54, 60, 51][index]}M79 72h${[37, 43, 32][index]}`} strokeOpacity=".36" strokeWidth="1.4" />
        </g>
      ))}
    </g>
  );
}

function RemoteCards({ clipId }: { clipId: string }) {
  return <g className="tri-phone-connection-art__cards">
    <g clipPath={`url(#${clipId})`}>
      {[0, 1, 2, 3].map(index => <g key={index} className="tri-phone-connection-art__card"
        style={{
          '--remote-rest-y': `${index * 36}px`,
          '--remote-exit-x': index % 2 === 0 ? '-78px' : '78px',
          animationDelay: `${[-4.8, -2.4, 0, -7.2][index]}s`,
        } as CSSProperties}>
        <rect x="76" y="47" width="65" height="29" rx="4" fill="#22302b" strokeOpacity=".5" />
        <path d={`M82 55h${[25, 32, 22, 29][index]}M82 61h43M82 67h33`} strokeOpacity=".5" strokeWidth="1.2" />
      </g>)}
    </g>
    <rect x="90" y="155" width="37" height="15" rx="4" fill="#293833" strokeOpacity=".5" />
    <path d="M106 159l5 3.5-5 3.5Z" fill="currentColor" fillOpacity=".7" stroke="none" />
    <path d="M83 159l-3 3.5 3 3.5M135 159l3 3.5-3 3.5" strokeOpacity=".65" strokeWidth="1.2" />
  </g>;
}

/** Decorative phone artwork; connection state and the real pairing code belong to the caller. */
export function PhoneConnectionArt({ variant = 'microphone', className }: PhoneConnectionArtProps) {
  const id = `phone-${useId().replace(/:/g, '')}`;
  const screenClipId = `${id}-screen`;
  const cardsClipId = `${id}-cards`;
  const textFadeId = `${id}-text-fade`;
  const textMaskId = `${id}-text-mask`;
  const frameId = `${id}-frame`;

  return (
    <svg
      className={`tri-phone-connection-art${className ? ` ${className}` : ''}`}
      data-variant={variant}
      viewBox="0 0 220 208"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={screenClipId} clipPathUnits="userSpaceOnUse">
          <rect x="75" y="43" width="68" height="120" />
        </clipPath>
        <clipPath id={cardsClipId} clipPathUnits="userSpaceOnUse">
          <rect x="75" y="45" width="68" height="106" />
        </clipPath>
        <linearGradient id={frameId} x1="62" y1="14" x2="156" y2="192" gradientUnits="userSpaceOnUse">
          <stop stopColor="#373939" />
          <stop offset=".34" stopColor="#202222" />
          <stop offset="1" stopColor="#191a1a" />
        </linearGradient>
        <linearGradient id={textFadeId} x1="0" y1="43" x2="0" y2="163" gradientUnits="userSpaceOnUse">
          <stop stopColor="black" />
          <stop offset=".12" stopColor="white" />
          <stop offset=".88" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id={textMaskId} maskUnits="userSpaceOnUse" x="75" y="43" width="68" height="120">
          <rect x="75" y="43" width="68" height="120" fill={`url(#${textFadeId})`} />
        </mask>
      </defs>

      <g fill="none" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M62 52h-1.8v12H62M62 72h-1.8v21H62" fill="#343636" strokeOpacity=".5" />

        <rect x="62" y="14" width="94" height="178" rx="20" fill={`url(#${frameId})`} strokeOpacity=".82" strokeWidth="1" />
        <rect x="67" y="19" width="84" height="168" rx="15" fill="#101212" strokeOpacity=".19" strokeWidth=".65" />
        <path d="M65 48V35C65 23 71 17 83 17H123" strokeOpacity=".34" strokeWidth=".7" />
        <path d="M153 153V172C153 183 148 189 137 189" strokeOpacity=".16" strokeWidth=".6" />

        <rect x="97" y="26" width="24" height="6" rx="3" fill="#252828" stroke="none" />
        <circle cx="117.5" cy="29" r="1.2" fill="#090a0a" strokeOpacity=".14" strokeWidth=".5" />

        {variant === 'stream' ? (
          <g clipPath={`url(#${screenClipId})`} mask={`url(#${textMaskId})`}>
            <g className="tri-phone-connection-art__feed">
              <g transform="translate(0 -120)"><StreamScreenPage /></g>
              <StreamScreenPage />
            </g>
          </g>
        ) : variant === 'remote' ? <RemoteCards clipId={cardsClipId} /> : (
          <PhoneAudioMark />
        )}

        <path d="M98 179h22" strokeOpacity=".48" strokeWidth="1.7" />
      </g>
    </svg>
  );
}
