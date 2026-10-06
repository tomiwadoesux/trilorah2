import './portraitMediaArt.css';

/** A photographic slide with a recessed landscape and a separate glass face. */
export function MediaSlideArt() {
  return (
    <svg className="tri-media-art" viewBox="0 0 300 280" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth=".8" transform="translate(68 79)">
        <g className="tri-media-art__back">
          <path d="M0 0L8 -6H168L160 0Z" fill="#2a2a2a" strokeOpacity=".75" />
          <path d="M160 0L168 -6V118L160 124Z" fill="#101010" strokeOpacity=".44" />
          <path d="M0 0H160V124H0Z" fill="#171717" strokeOpacity=".74" />
          <path d="M7 7H153V117H7Z" strokeOpacity=".22" strokeWidth=".6" />
          <path d="M11 121H149" strokeOpacity=".18" strokeWidth=".5" />
        </g>

        <g className="tri-media-art__picture">
          <path d="M10 8H150V108H10Z" fill="#121212" strokeOpacity=".36" />
          <path d="M10 8L13 5H153L150 8Z" fill="#242424" strokeOpacity=".35" />
          <path d="M150 8L153 5V105L150 108Z" fill="#151515" strokeOpacity=".26" />

          <g className="tri-media-art__sun">
            <path d="M101 35A10 10 0 0 1 121 35V38A10 10 0 0 1 101 38Z" fill="#141414" strokeOpacity=".48" />
            <circle cx="111" cy="35" r="10" fill="#303030" strokeOpacity=".84" />
            <path d="M105 30A7 7 0 0 1 113 28" strokeOpacity=".28" strokeWidth=".6" />
          </g>

          {/* Each peak has a lit face, a shaded fold, and a short bottom edge. */}
          <path d="M69 92L106 58L140 92V96H69Z" fill="#141414" strokeOpacity=".42" />
          <path d="M69 92L106 58L99 92Z" fill="#262626" strokeOpacity=".66" />
          <path d="M106 58L140 92H99Z" fill="#1b1b1b" strokeOpacity=".53" />
          <path d="M24 94L65 45L110 94V98H24Z" fill="#141414" strokeOpacity=".5" />
          <path d="M24 94L65 45L60 94Z" fill="#303030" strokeOpacity=".84" />
          <path d="M65 45L110 94H60Z" fill="#1d1d1d" strokeOpacity=".65" />
          <path d="M60 94V98M99 92V96" strokeOpacity=".3" />
          <path d="M24 102H140" strokeOpacity=".14" strokeWidth=".6" />
        </g>

        <g className="tri-media-art__glass">
          <path d="M-4 4L-1 2H163L160 4Z" fill="#2c2c2c" strokeOpacity=".72" />
          <path d="M160 4L163 2V126L160 128Z" fill="#141414" strokeOpacity=".45" />
          <path d="M-4 4H160V128H-4ZM8 15V108H148V15Z" fill="#202020" fillRule="evenodd" strokeOpacity=".82" />
          <path d="M8 15H148V108H8Z" fill="#ededed" fillOpacity=".025" strokeOpacity=".36" strokeWidth=".65" />
          <path d="M13 40V20H33M123 103H143V83" strokeOpacity=".23" strokeWidth=".6" />
          <path d="M11 117H34M42 117H53" strokeOpacity=".32" strokeWidth=".7" />
          <path d="M131 116H147V120H131Z" strokeOpacity=".22" strokeWidth=".6" />
        </g>
      </g>
    </svg>
  );
}
