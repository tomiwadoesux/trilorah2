import { useEffect, useState } from 'react';
import { alignClockHands, deviceClockHands, observeDeviceClock } from '../../lib/deviceClock';
import './pocketWatchArt.css';

/** The device's local wall clock, drawn as an upright pocket watch. */
export function PocketWatchArt() {
  const [hands, setHands] = useState(() => deviceClockHands(new Date()));

  useEffect(() => observeDeviceClock(next => {
    setHands(previous => alignClockHands(previous, next));
  }), []);

  return (
    <svg className="tri-pocket-watch-art" viewBox="56 22 196 240" aria-hidden="true" focusable="false">
      <ellipse cx="153" cy="245" rx="39" ry="5.5" fill="none" strokeOpacity=".12" strokeWidth=".55" />
      <g fill="none">
        <ellipse cx="153" cy="58" rx="16.5" ry="18.5" strokeOpacity=".35" strokeWidth=".75" />
        <ellipse cx="150" cy="56" rx="17" ry="18.5" fill="#171717" strokeOpacity=".8" strokeWidth=".85" />
        <ellipse cx="150" cy="56" rx="12.5" ry="14" fill="#101010" strokeOpacity=".5" strokeWidth=".7" />
        <path d="M140 45C143 41 150 39 156 43" strokeOpacity=".35" strokeWidth=".5" />
      </g>
      <path d="M146 70H154V85H146Z" fill="#171717" strokeOpacity=".57" strokeWidth=".7" />
      <path d="M142 75L145 73H160V82L157 85H142Z" fill="#121212" strokeOpacity=".5" strokeWidth=".7" />
      <rect x="142" y="75" width="15" height="10" rx="1.5" fill="#242424" strokeOpacity=".8" strokeWidth=".75" />
      <path d="M145 77V83M148 77V83M151 77V83M154 77V83" fill="none" strokeOpacity=".35" strokeWidth=".6" />
      <circle cx="155" cy="160" r="75" fill="#121212" strokeOpacity=".52" strokeWidth=".8" />
      <path d="M210 111C238 153 225 212 179 231" fill="none" strokeOpacity=".21" strokeWidth=".65" />
      <circle cx="150" cy="155" r="75" fill="#1c1c1c" strokeOpacity=".88" strokeWidth=".9" />
      <circle cx="150" cy="155" r="71.5" fill="none" strokeOpacity=".27" strokeWidth=".65" />
      <circle cx="150" cy="155" r="66" fill="#121212" strokeOpacity=".65" strokeWidth=".75" />
      <circle cx="150" cy="155" r="63.5" fill="none" strokeOpacity=".16" strokeWidth=".55" />
      <g>
        {Array.from({ length: 60 }, (_, index) => (
          <path
            key={index}
            d={`M150 ${index % 5 === 0 ? 100 : 96.5}V94.5`}
            transform={`rotate(${index * 6} 150 155)`}
            fill="none"
            strokeOpacity={index % 5 === 0 ? '.76' : '.31'}
            strokeWidth={index % 5 === 0 ? '.95' : '.6'}
          />
        ))}
      </g>
      <g fill="currentColor" fillOpacity=".56" stroke="none" fontFamily="Georgia, 'Times New Roman', serif" fontSize="9" textAnchor="middle">
        <text x="150" y="115">XII</text>
        <text x="196" y="158">III</text>
        <text x="150" y="201">VI</text>
        <text x="104" y="158">IX</text>
      </g>
      <g className="tri-pocket-watch-art__hand tri-pocket-watch-art__hour" style={{ transform: `rotate(${hands.hour}deg)` }}>
        <path d="M147 155L147.5 127L150 119L152.5 127L153 155Z" fill="#1c1c1c" strokeOpacity=".82" strokeWidth=".75" />
      </g>
      <g className="tri-pocket-watch-art__hand tri-pocket-watch-art__minute" style={{ transform: `rotate(${hands.minute}deg)` }}>
        <path d="M148 155L148.5 112L150 104L151.5 112L152 155Z" fill="#202020" strokeOpacity=".88" strokeWidth=".75" />
      </g>
      <g className="tri-pocket-watch-art__hand tri-pocket-watch-art__second" style={{ transform: `rotate(${hands.second}deg)` }} fill="none" strokeWidth=".9">
        <path d="M150 99V166" strokeOpacity=".94" />
        <circle cx="150" cy="169" r="2.7" strokeOpacity=".8" />
      </g>
      <circle cx="150" cy="155" r="3.6" fill="#262626" strokeOpacity=".85" strokeWidth=".8" />
      <circle cx="150" cy="155" r="1" fill="currentColor" fillOpacity=".67" stroke="none" />
      <path d="M96 111A70 70 0 0 1 182 93" fill="none" strokeOpacity=".28" strokeWidth=".6" />
    </svg>
  );
}
