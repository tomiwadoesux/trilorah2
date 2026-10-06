import './sermonOutlineArt.css';

/** Three folds of one outline sheet open slightly around their shared creases. */
export function SermonOutlineArt() {
  return (
    <svg className="tri-outline-art" viewBox="0 0 300 280" aria-hidden="true" focusable="false">
      <g transform="matrix(.96 .20 0 1 62 45)">
        <path d="M0 10L7 5H185V161L178 166H0Z" fill="#111" strokeOpacity=".35" />
        <g className="tri-outline-art__fold tri-outline-art__fold--left">
          <path d="M0 0L60 8V156L0 148Z" fill="#202020" strokeOpacity=".8" />
          <path d="M9 23L46 28M9 31L34 34M14 52L46 56M14 62L42 66M14 94L46 98M14 104L37 107" className="tri-outline-art__lines" />
          <path d="M8 51L9 51M8 93L9 93" strokeOpacity=".7" strokeWidth="2" />
        </g>
        <path d="M60 8L118 0V148L60 156Z" fill="#151515" strokeOpacity=".65" />
        <path d="M70 30L106 25M70 38L94 35M76 59L105 55M76 69L102 65M76 100L106 96M76 110L97 107" className="tri-outline-art__lines" />
        <path d="M70 60L71 60M70 101L71 101" strokeOpacity=".7" strokeWidth="2" />
        <g className="tri-outline-art__fold tri-outline-art__fold--right">
          <path d="M118 0L178 8V156L118 148Z" fill="#222" strokeOpacity=".8" />
          <path d="M128 23L165 28M128 31L153 34M134 52L165 56M134 62L160 66M134 94L165 98M134 104L156 107" className="tri-outline-art__lines" />
          <path d="M128 51L129 51M128 93L129 93" strokeOpacity=".7" strokeWidth="2" />
        </g>
      </g>
    </svg>
  );
}
