import './scriptureQuoteArt.css';

/** Two small quotation marks lift and separate while the scripture rail waits. */
export function ScriptureQuoteArt() {
  return (
    <svg className="tri-scripture-art" viewBox="75 78 150 120" aria-hidden="true" focusable="false">
      {/* Keep the approved smaller size, centered in the empty-state frame. */}
      <g transform="translate(41.32 62.48) scale(.76)">
        {[0, 80].map((offset, index) => (
          <g key={offset} transform={`translate(${offset} 0)`}>
            <g className={`tri-scripture-art__motion tri-scripture-art__quote--${index === 0 ? 'left' : 'right'}`}>
              <path className="tri-scripture-art__quote-top" d="M85 61 94 55H128L119 61Z" />
              <path className="tri-scripture-art__quote-side" d="M119 61 128 55V90C128 115 116 132 94 143L85 149C107 138 119 121 119 96Z" />
              <path className="tri-scripture-art__quote-bottom" d="m78 135 9-6 7 14-9 6Z" />
              <path className="tri-scripture-art__quote-face" d="M85 61H119V96C119 121 107 138 85 149L78 135C91 129 99 119 100 106H85Z" />
              <path className="tri-scripture-art__quote-highlight" d="M88 65H115" />
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
