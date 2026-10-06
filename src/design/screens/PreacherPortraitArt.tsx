import './preacherPortraitArt.css';

/** A neutral human figure, shaped in smooth planes without facial or clothing details. */
export function PreacherPortraitArt() {
  return <svg className="tri-portrait-art" viewBox="0 0 300 280" aria-hidden="true" focusable="false">
    <g stroke="currentColor" strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="150" cy="244" rx="69" ry="6" fill="none" strokeOpacity=".1" strokeWidth=".6" />
      <path d="M87 221L103 211H203L217 221L203 232H101Z" fill="#242424" strokeOpacity=".6" />
      <path d="M101 232H203V239H101ZM203 232L217 221V228L203 239Z" fill="#121212" strokeOpacity=".38" />
      <path d="M107 235H196" fill="none" strokeOpacity=".17" strokeWidth=".6" />
      {/* The neck flows directly into the shoulders: one quiet, ungendered form. */}
      <path d="M140 129L138 148C137 158 121 159 109 169C96 180 93 199 93 216C113 229 178 232 206 217C207 195 199 177 186 168C174 160 165 157 164 147L162 128Z" fill="#232323" strokeOpacity=".83" />
      <path d="M158 136L155 150C154 164 168 169 176 183C183 195 184 215 178 226C190 224 200 221 206 217C207 195 199 177 186 168C174 160 165 157 164 147L162 128Z" fill="#141414" stroke="none" />
      <path d="M139 147C140 157 151 162 162 158" fill="none" strokeOpacity=".22" strokeWidth=".65" />
      <path d="M120 170C107 184 105 200 107 213" fill="none" strokeOpacity=".2" strokeWidth=".65" />
      <path d="M190 185C195 195 197 207 195 216" fill="none" strokeOpacity=".18" strokeWidth=".65" />
      <path d="M110 217C132 225 170 226 188 219" fill="none" strokeOpacity=".15" strokeWidth=".6" />
      {/* A smooth, featureless oval replaces the hair, face, ears and suit. */}
      <path d="M150 61C168 61 179 75 179 94C179 115 168 137 152 141C136 138 123 119 122 98C121 77 132 62 150 61Z" fill="#272727" strokeOpacity=".86" />
      <path d="M155 62C169 68 174 83 172 99C170 118 162 132 152 141C168 137 179 115 179 94C179 75 168 61 155 62Z" fill="#141414" stroke="none" />
      <path d="M158 67C169 77 171 92 167 108" fill="none" strokeOpacity=".16" strokeWidth=".65" />
      <path className="tri-portrait-art__highlight" d="M129 94C128 80 136 69 146 67M130 167C115 172 106 182 103 195" fill="none" strokeOpacity=".4" strokeWidth=".8" />
    </g>
  </svg>;
}
