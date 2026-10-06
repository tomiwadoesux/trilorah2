import './preacherLecternArt.css';

/** A sculpted lectern with an open book, a slender microphone and a beveled base. */
export function PreacherLecternArt() {
  return <svg className="tri-lectern-art" viewBox="60 23 182 238" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" strokeWidth=".85" strokeLinejoin="round" strokeLinecap="round">
      <ellipse cx="150" cy="243" rx="64" ry="6" strokeOpacity=".1" strokeWidth=".6" />
      {/* A shallow stone base and tapered central column stay on one vertical axis. */}
      <path d="M86 224L104 212H210L192 224Z" fill="#292929" strokeOpacity=".72" />
      <path d="M86 224H192V232H86ZM192 224L210 212V220L192 232Z" fill="#151515" strokeOpacity=".5" />
      <path d="M94 227H185" strokeOpacity=".18" strokeWidth=".6" />
      <path d="M125 117H170L164 214H131Z" fill="#222" strokeOpacity=".8" />
      <path d="M170 117L185 107L179 204L164 214Z" fill="#121212" strokeOpacity=".46" />
      <path d="M130 128L135 207M163 129L159 207" strokeOpacity=".21" strokeWidth=".65" />
      <path d="M176 122L171 197" strokeOpacity=".14" strokeWidth=".6" />
      {/* The reading desk has a true sloped surface, a visible edge and a page stop. */}
      <path d="M77 108L99 79H222L200 108Z" fill="#232323" strokeOpacity=".8" />
      <path d="M77 108H200V119H77Z" fill="#1a1a1a" strokeOpacity=".7" />
      <path d="M200 108L222 79V90L200 119Z" fill="#111" strokeOpacity=".5" />
      <path d="M84 105H194V110H84Z" fill="#333" strokeOpacity=".6" strokeWidth=".7" />
      <path d="M102 83H209" strokeOpacity=".18" strokeWidth=".6" />
      {/* An open book, with separated covers, folded pages and an off-centre ribbon. */}
      <path d="M108 87L120 71Q142 70 152 80Q165 77 191 82L179 102Q160 96 144 101Q128 92 98 97Z" fill="#121212" strokeOpacity=".64" />
      <path d="M110 83L121 67Q140 66 153 77L144 97Q126 89 101 92Z" fill="#303030" strokeOpacity=".88" />
      <path d="M153 77Q170 71 192 78L179 96Q161 91 144 97Z" fill="#242424" strokeOpacity=".82" />
      <path d="M101 92V97Q127 95 144 102Q163 97 179 101V96M144 97V102" strokeOpacity=".47" strokeWidth=".65" />
      <path d="M123 73Q137 73 146 79M119 78Q133 78 143 84M115 83Q129 83 139 88M161 80Q173 78 184 81M157 85Q169 82 180 85M154 90Q165 87 176 90" strokeOpacity=".28" strokeWidth=".6" />
      <path d="M153 96L148 108L154 105L157 109L162 95" fill="#383838" strokeOpacity=".48" strokeWidth=".6" />
      {/* A gooseneck mic makes the silhouette read as a speaking lectern. */}
      <ellipse cx="204" cy="90" rx="4" ry="2" fill="#171717" strokeOpacity=".45" />
      <path d="M204 89V63Q204 52 194 49L180 45" strokeOpacity=".78" strokeWidth="1.4" />
      <path d="M205.5 89V63Q205.5 51 194.5 47.5" strokeOpacity=".2" strokeWidth=".6" />
      <path d="M170 40L182 43Q185 44 184 47Q183 50 180 49L168 46Q165 45 166 42Q167 39 170 40Z" fill="#292929" strokeOpacity=".85" />
      <path d="M169 41L168 44M172 42L171 45" strokeOpacity=".3" strokeWidth=".6" />
      <g className="tri-lectern-art__nameplate">
        <path d="M135 146L139 143H164L160 146Z" fill="#303030" strokeOpacity=".5" />
        <path d="M135 146H160V170H135ZM160 146L164 143V167L160 170Z" fill="#202020" strokeOpacity=".68" />
        <path d="M147.5 151V165M143 156H152" strokeOpacity=".7" strokeWidth="1" />
      </g>
    </g>
  </svg>;
}
