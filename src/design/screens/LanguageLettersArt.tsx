import './dashboardSymbols.css';

/** English stays anchored; only the Chinese character lifts on hover. */
export function LanguageLettersArt() {
  return <svg className="tri-dashboard-symbol tri-language-art" viewBox="30 64 236 156" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeLinejoin="round" strokeWidth=".9">
      <path d="M48 204H130M157 204H247" strokeOpacity=".16" />
      <g className="tri-language-art__english">
        <path d="M59 185L92 91H112L145 185H125L119 164H84L78 185ZM89 147H114L102 109Z" fill="#111" strokeOpacity=".3" transform="translate(5 -4)" fillRule="evenodd" />
        <path d="M59 185L92 91H112L145 185H125L119 164H84L78 185ZM89 147H114L102 109Z" fill="#242424" strokeOpacity=".82" fillRule="evenodd" />
        <path d="M59 185L64 181M92 91L97 87M112 91L117 87M145 185L150 181M125 185L130 181" fill="none" strokeOpacity=".45" strokeWidth=".7" />
      </g>
      <g className="tri-language-art__chinese">
        <g fill="#242424" strokeOpacity=".82">
          <path d="M189 90L196 87L205 103L197 107Z" />
          <path d="M157 110H239V118H157Z" />
          <path d="M172 120L181 118C185 141 206 166 244 183L239 192C200 176 177 148 172 120Z" />
          <path d="M217 119L227 122C217 154 193 177 157 193L152 185C186 170 208 148 217 119Z" />
        </g>
        <path d="M157 110L161 106H243L239 110M239 110L243 106V114L239 118M239 192L244 188M157 193L161 189" fill="none" strokeOpacity=".3" strokeWidth=".7" />
      </g>
    </g>
  </svg>;
}
