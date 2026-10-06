import './dashboardSymbols.css';

export function AppearancePaletteArt() {
  return <svg className="tri-dashboard-symbol tri-palette-art" viewBox="42 47 208 195" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth=".85" strokeLinejoin="round">
      <path d="M220 155C224 120 200 84 162 79C108 70 65 106 65 154C65 194 100 220 139 216C161 214 153 192 170 181C185 171 215 178 220 155Z" fill="#101010" strokeOpacity=".38" />
      <path d="M216 148C220 113 196 77 158 72C104 63 61 99 61 147C61 187 96 213 135 209C157 207 149 185 166 174C181 164 211 171 216 148Z" fill="#1c1c1c" strokeOpacity=".8" />
      <path d="M72 150C72 114 101 85 136 81" fill="none" strokeOpacity=".2" strokeWidth=".6" />
      <ellipse cx="182" cy="139" rx="12" ry="17" fill="#101010" strokeOpacity=".55" transform="rotate(-25 182 139)" />
      <path d="M175 124C167 130 169 145 176 151" fill="none" strokeOpacity=".25" />
      {[{x:94,y:124,r:10},{x:124,y:101,r:10},{x:157,y:104,r:9},{x:91,y:160,r:9},{x:119,y:183,r:8}].map(({x,y,r},i)=><g key={x+','+y}>
        <circle cx={x} cy={y} r={r} fill={['#303030','#242424','#383838','#202020','#2b2b2b'][i]} strokeOpacity=".5" />
        <path d={`M${x-r+3} ${y}a${r-3} ${r-3} 0 0 1 ${r-3} ${-r+3}`} fill="none" strokeOpacity=".22" strokeWidth=".6" />
      </g>)}
      <g className="tri-palette-art__brush">
        <path d="M166 190L223 72Q228 63 232 67Q236 70 232 78L178 196Z" fill="#252525" strokeOpacity=".85" />
        <path d="M171 190L229 73" fill="none" strokeOpacity=".28" strokeWidth=".6" />
        <path d="M165 186L179 193L173 207L159 200Z" fill="#353535" strokeOpacity=".8" />
        <path d="M162 191L176 198M161 195L174 202" fill="none" strokeOpacity=".35" strokeWidth=".6" />
        <path d="M159 200L173 207C169 219 157 228 143 226C153 220 149 207 159 200Z" fill="#171717" strokeOpacity=".8" />
        <path d="M163 207C160 216 153 222 148 224M166 209C164 217 158 223 153 225" fill="none" strokeOpacity=".35" strokeWidth=".6" />
      </g>
    </g>
  </svg>;
}
