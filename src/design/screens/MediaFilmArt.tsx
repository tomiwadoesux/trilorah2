import './portraitMediaArt.css';

type FilmSection = { x: number; y: number; control1: number; control2: number; end: number };

const SECTIONS: FilmSection[] = [
  { x: 38, y: 121, control1: 84, control2: 82, end: 107 },
  { x: 106, y: 105, control1: 130, control2: 154, end: 137 },
  { x: 174, y: 138, control1: 121, control2: 81, end: 89 },
];

function point(section: FilmSection, t: number, offset = 0) {
  const u = 1 - t;
  return [section.x + 72 * t,
    u ** 3 * section.y + 3 * u ** 2 * t * section.control1 + 3 * u * t ** 2 * section.control2 + t ** 3 * section.end + offset,
  ];
}

function rail(section: FilmSection, offset: number) {
  return `M${section.x} ${section.y + offset}C${section.x + 24} ${section.control1 + offset} ${section.x + 48} ${section.control2 + offset} ${section.x + 72} ${section.end + offset}`;
}

function inset(section: FilmSection, t0: number, t1: number, top: number, bottom: number) {
  const points = [point(section, t0, top), point(section, (2 * t0 + t1) / 3, top), point(section, (t0 + 2 * t1) / 3, top), point(section, t1, top)];
  return `M${points[0]}L${points.slice(1).join(' ')}L${point(section, t1, bottom)}L${point(section, (t0 + 2 * t1) / 3, bottom)}L${point(section, (2 * t0 + t1) / 3, bottom)}L${point(section, t0, bottom)}Z`;
}

/** A gently curled film ribbon: three frames, punched rails, and a rolled edge. */
export function MediaFilmArt() {
  return (
    <svg className="tri-media-film-art" viewBox="0 0 300 280" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth=".8">
        {[2, 1, 0].map(index => {
          const section = SECTIONS[index];
          const bottom = rail(section, 66);
          return (
            <g key={index} className="tri-media-film-art__section">
              <path d={`${rail(section, 0)}L${section.x + 72} ${section.end + 66}C${section.x + 48} ${section.control2 + 66} ${section.x + 24} ${section.control1 + 66} ${section.x} ${section.y + 66}Z`}
                fill={index === 1 ? '#141414' : '#202020'} strokeOpacity=".75" />
              <path d={`${bottom}L${section.x + 72} ${section.end + 69}C${section.x + 48} ${section.control2 + 69} ${section.x + 24} ${section.control1 + 69} ${section.x} ${section.y + 69}Z`}
                fill="#101010" strokeOpacity=".36" strokeWidth=".6" />
              <path d={inset(section, .13, .87, 14, 52)} fill="#121212" strokeOpacity=".5" strokeWidth=".65" />
              <path d={rail(section, 11)} strokeOpacity=".15" strokeWidth=".5" />
              <path d={rail(section, 55)} strokeOpacity=".15" strokeWidth=".5" />
              {[0, 1, 2, 3, 4, 5].map(hole => (
                <g key={hole} fill="#101010" strokeOpacity=".48" strokeWidth=".55">
                  <path d={inset(section, .055 + hole * .155, .13 + hole * .155, 4, 8)} />
                  <path d={inset(section, .055 + hole * .155, .13 + hole * .155, 58, 62)} />
                </g>
              ))}
              {index === 0 && <path d="M38 121C32 128 31 141 34 154L34 190C30 179 30 160 32 147C33 135 35 126 38 121Z" fill="#171717" strokeOpacity=".48" />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
