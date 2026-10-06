import './bellDisplayArt.css';

/** A hollow cast bell: the mouth, rolled rim, and suspended clapper have real depth. */
export function NotificationBellArt() {
  return (
    <svg className="tri-notification-bell-art" viewBox="40 43 220 206" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="150" cy="228" rx="39" ry="7" strokeOpacity=".1" />
        <g className="tri-notification-bell-art__shell">
          <path d="M141 78V69C141 56 159 56 159 69V78" strokeOpacity=".74" />
          <path d="M145 77V69C145 61 155 61 155 69V77" strokeOpacity=".26" strokeWidth=".6" />
          <ellipse cx="150" cy="80" rx="13" ry="4.5" fill="#242424" strokeOpacity=".65" />
          <path d="M150 80C122 80 106 99 106 124C106 145 98 164 85 180C101 207 199 207 215 180C202 164 194 145 194 124C194 99 178 80 150 80Z" fill="#1c1c1c" strokeOpacity=".8" />
          <path d="M143 87C123 90 115 105 115 126C115 148 108 164 100 175" strokeOpacity=".24" strokeWidth=".6" />
          <path d="M157 87C177 90 185 105 185 126C185 148 192 164 200 175" strokeOpacity=".19" strokeWidth=".6" />
          <path d="M103 148C128 157 172 157 197 148" strokeOpacity=".13" strokeWidth=".6" />
          <ellipse cx="150" cy="180" rx="65" ry="20" fill="#181818" strokeOpacity=".8" />
          <ellipse cx="150" cy="180" rx="57" ry="13" fill="#0e0e0e" strokeOpacity=".39" strokeWidth=".6" />
          <path d="M96 181C117 168 183 168 204 181" strokeOpacity=".13" strokeWidth=".6" />
          <g className="tri-notification-bell-art__clapper">
            <path d="M150 169V190" strokeOpacity=".68" strokeWidth="1.2" />
            <ellipse cx="150" cy="190.5" rx="6.5" ry="5" fill="#272727" strokeOpacity=".85" />
            <path d="M146.5 188.5C148.5 187 151.5 187 153.5 188.5" strokeOpacity=".3" strokeWidth=".6" />
          </g>
          <path d="M85 180V184C85 211 215 211 215 184V180C215 207 85 207 85 180Z" fill="#232323" strokeOpacity=".7" />
          <path d="M96 194C122 208 178 208 204 194" strokeOpacity=".28" strokeWidth=".6" />
        </g>
        <g className="tri-notification-bell-art__ring tri-notification-bell-art__ring--first" strokeOpacity=".65">
          <path d="M76 131C67 143 65 158 69 170" />
          <path d="M224 131C233 143 235 158 231 170" />
        </g>
        <g className="tri-notification-bell-art__ring tri-notification-bell-art__ring--second" strokeOpacity=".4">
          <path d="M65 126C53 143 51 162 57 179" />
          <path d="M235 126C247 143 249 162 243 179" />
        </g>
      </g>
    </svg>
  );
}
