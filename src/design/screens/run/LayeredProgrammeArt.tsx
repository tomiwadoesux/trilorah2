import type { CSSProperties } from 'react';
import { MicIcon, MusicIcon, NoteIcon } from '../../../ui/icons';
import './layeredProgrammeArt.css';

const SYMBOLS = { music: MusicIcon, notes: NoteIcon, microphone: MicIcon };
export type ProgrammeSymbol = keyof typeof SYMBOLS;

// Pick once per renderer launch so navigation and empty-state remounts keep
// the same cover. A new app launch can legitimately pick the same symbol.
const choices = Object.keys(SYMBOLS) as ProgrammeSymbol[];
const launchSymbol = choices[Math.floor(Math.random() * choices.length)];
const layers = [48, 32, 16, 0];
const lifts = [-4, -11, -18, -25];

/** Aligned schedule cards, lifting together into a more open stack on hover. */
export function LayeredProgrammeArt({ symbol = launchSymbol }: { symbol?: ProgrammeSymbol }) {
  const Symbol = SYMBOLS[symbol];

  return (
    <svg
      className="tri-run-programme"
      viewBox="0 0 220 220"
      aria-hidden="true"
      focusable="false"
      data-programme-symbol={symbol}
    >
      {layers.map((offset, index) => (
        <g key={offset} transform={`translate(0 ${offset})`}>
          <g
            className="tri-run-programme__layer"
            style={{ '--programme-lift': `${lifts[index]}px` } as CSSProperties}
          >
            <path className="tri-run-programme__right" d="M204 107v3.5l-70 35V142Z" />
            <path className="tri-run-programme__left" d="m16 83 118 59v3.5l-118-59Z" />
            <path className="tri-run-programme__top" d="m86 48 118 59-70 35L16 83Z" />
            <path className="tri-run-programme__rim" d="m16 83 70-35 118 59" />
            {/* The heading, time column and blank rows all share the card's
                plane. Empty dashes suggest a schedule without fake entries. */}
            <g transform="matrix(1 .5 -1 .5 86 48)">
              <path className="tri-run-programme__heading" d="M44 16h57M44 24h33" />
              <path className="tri-run-programme__rule" d="M10 33h98M34 40v23" />
              {[43, 53, 63].map(y => (
                <g key={y}>
                  <path className="tri-run-programme__time" d={`M13 ${y}h12`} />
                  <path className="tri-run-programme__entry" d={`M44 ${y}h${y === 53 ? 45 : 59}`} />
                </g>
              ))}
              {index === layers.length - 1 ? (
                <g className="tri-run-programme__symbol" transform="translate(12 8)">
                  <Symbol size={22} />
                </g>
              ) : (
                <rect className="tri-run-programme__rule" x={14} y={10} width={16} height={16} rx={3} />
              )}
            </g>
          </g>
        </g>
      ))}
    </svg>
  );
}
