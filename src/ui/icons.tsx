/*
 * Icons exported from the Figma file (Section 1) — these are the real
 * drawn paths, not lookalikes from an icon library.
 *
 * Figma bakes a fill onto each export (#E5F3F2 at 75% for settings,
 * #FEC9C9 for trash). Both are switched to `currentColor` here so an icon
 * takes the colour of the text beside it and can be recoloured per use.
 */

interface IconProps {
  /** Rendered box in px. Figma uses 17 for settings, 16 for trash. */
  size?: number;
  className?: string;
}

/** Gear — Figma symbol `settings` (35:212). Natural box 14.15 × 14.57. */
export function SettingsIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14.1516 14.5711"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        fillOpacity="0.75"
        d="M12.8896 8.31796L13.8607 8.89454C14.013 8.98592 14.1036 9.10704 14.1036 9.31954C14.1341 9.47113 14.1341 9.62342 14.0434 9.775L12.6466 12.1734C12.5559 12.2945 12.4341 12.4157 12.2825 12.4461C12.1302 12.4766 11.9786 12.4766 11.8271 12.3859L10.8552 11.8086C10.3396 12.2641 9.73252 12.5984 9.06456 12.8407V13.9641C9.064 14.1249 8.99986 14.279 8.88614 14.3927C8.77242 14.5064 8.61834 14.5706 8.45752 14.5711H5.66456C5.50373 14.5706 5.34965 14.5064 5.23593 14.3927C5.12221 14.279 5.05808 14.1249 5.05752 13.9641V12.7805C4.4072 12.5384 3.80178 12.1896 3.26614 11.7484L2.29502 12.325C2.17318 12.4157 1.99114 12.4157 1.83956 12.3859C1.68797 12.3555 1.56614 12.2641 1.47547 12.1125L0.0786405 9.71408C0.0177238 9.59296 -0.0120262 9.41092 0.0177238 9.25863C0.0481822 9.10704 0.139557 8.98592 0.29114 8.89454L1.26297 8.31796C1.20245 7.97727 1.17188 7.63194 1.1716 7.28592C1.1716 6.95158 1.20206 6.61796 1.26297 6.25317L0.29114 5.67658C0.170015 5.58592 0.0481822 5.46408 0.0177238 5.3125C-0.0120262 5.16092 -0.0120262 5.00862 0.0786405 4.85704L1.53568 2.39842C1.62706 2.27658 1.74818 2.15546 1.90047 2.125C2.05206 2.09454 2.20364 2.09454 2.35522 2.18592L3.32706 2.7625C3.84272 2.30704 4.45047 1.97342 5.11772 1.73046V0.607042C5.11828 0.446094 5.18252 0.291909 5.29639 0.178168C5.41027 0.0644267 5.56453 0.000373321 5.72547 0H8.51772C8.67867 0.000373321 8.83293 0.0644267 8.94681 0.178168C9.06068 0.291909 9.12491 0.446094 9.12547 0.607042V1.76092C9.77552 2.00313 10.3807 2.35192 10.9161 2.79296L11.888 2.21567C12.0091 2.125 12.1911 2.125 12.3434 2.15546C12.495 2.18592 12.6161 2.27658 12.7075 2.42817L14.0725 4.85704C14.1638 4.97817 14.1638 5.16092 14.1334 5.3125C14.1029 5.46408 14.0123 5.58592 13.86 5.67658L12.8888 6.25317C12.9498 6.5875 12.9795 6.95158 12.9795 7.28592C12.9795 7.61954 12.9505 7.95317 12.8896 8.31796ZM11.7661 7.28592C11.7661 6.89067 11.7059 6.49612 11.6146 6.10158C11.5536 5.82817 11.645 5.55546 11.9482 5.40317L12.7982 4.91796L12.0091 3.55158L11.1591 4.0375C11.0451 4.10611 10.9113 4.1344 10.7792 4.11783C10.6471 4.10126 10.5245 4.04079 10.4309 3.94613C9.85364 3.4 9.15593 2.975 8.36614 2.7625C8.23578 2.73289 8.11948 2.65953 8.03661 2.55462C7.95375 2.44972 7.9093 2.3196 7.91068 2.18592V1.21408H6.33252V2.21567C6.33406 2.34947 6.28969 2.47975 6.20681 2.5848C6.12393 2.68985 6.00754 2.76332 5.87706 2.79296C5.09631 2.99764 4.38397 3.40612 3.81297 3.97658C3.71937 4.07141 3.59658 4.13199 3.46437 4.14856C3.33216 4.16514 3.19822 4.13675 3.0841 4.06796L2.2341 3.58204L1.44502 4.94842L2.29502 5.43362C2.50752 5.55546 2.62864 5.82817 2.56772 6.10158C2.47248 6.48958 2.42162 6.88715 2.41614 7.28663C2.41614 7.68117 2.47706 8.07571 2.56772 8.47025C2.6591 8.71321 2.53797 8.98663 2.29502 9.13821L1.44502 9.62413L2.2341 10.9898L3.02318 10.5343C3.1373 10.4655 3.27124 10.4372 3.40345 10.4537C3.53566 10.4703 3.65845 10.5309 3.75206 10.6257C4.32864 11.1718 5.02706 11.5968 5.81614 11.8093C5.94663 11.839 6.06301 11.9124 6.14589 12.0175C6.22877 12.1225 6.27314 12.2528 6.2716 12.3866V13.3578H7.85047V12.3562C7.85047 12.0828 8.03252 11.8398 8.30522 11.7796C9.0863 11.5748 9.79891 11.1661 10.37 10.5953C10.4636 10.5006 10.5862 10.4401 10.7183 10.4235C10.8503 10.407 10.9841 10.4353 11.0982 10.5039L11.9482 10.9898L12.738 9.62413L11.888 9.13821C11.6755 9.01708 11.5536 8.74367 11.6146 8.47025C11.7097 8.08272 11.7606 7.68563 11.7661 7.28663V7.28592ZM4.05522 7.28592C4.05747 6.48143 4.37804 5.71054 4.9469 5.14168C5.51576 4.57282 6.28666 4.25224 7.09114 4.25C7.89563 4.25224 8.66652 4.57282 9.23538 5.14168C9.80424 5.71054 10.1248 6.48143 10.1271 7.28592C10.1246 8.09028 9.80397 8.86099 9.23513 9.4297C8.66629 9.99841 7.8955 10.3189 7.09114 10.3211C6.2869 10.3189 5.51622 9.9985 4.9474 9.42995C4.37858 8.8614 4.05784 8.09086 4.05522 7.28663V7.28592ZM5.27002 7.28592C5.27151 7.76845 5.46386 8.23079 5.80506 8.572C6.14627 8.9132 6.60861 9.10555 7.09114 9.10704C7.5738 9.10573 8.03632 8.91347 8.37768 8.57224C8.71903 8.23102 8.91148 7.76857 8.91297 7.28592C8.91167 6.80314 8.7193 6.34051 8.37793 5.99913C8.03655 5.65776 7.57392 5.46539 7.09114 5.46408C6.60836 5.46558 6.14581 5.65812 5.80456 5.99963C5.46332 6.34114 5.27114 6.80385 5.27002 7.28663V7.28592Z"
      />
    </svg>
  );
}

/** Trash — Figma `Button Icon/Variant3` (429:449). Natural box 12 × 14. */
export function TrashIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={(size * 12) / 14}
      height={size}
      viewBox="0 0 12 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M10.3687 5.5C10.6448 5.5 10.8687 5.72386 10.8687 6C10.8687 6.03856 10.8642 6.07699 10.8554 6.11452L9.3628 12.4581C9.1502 13.3615 8.3441 14 7.41597 14H4.58403C3.65593 14 2.84977 13.3615 2.6372 12.4581L1.14459 6.11452C1.08135 5.84572 1.24798 5.57654 1.51678 5.51329C1.55431 5.50446 1.59274 5.5 1.6313 5.5H10.3687ZM6.5 0C7.88071 0 9 1.11929 9 2.5H11C11.5523 2.5 12 2.94772 12 3.5V4C12 4.27614 11.7761 4.5 11.5 4.5H0.5C0.22386 4.5 0 4.27614 0 4V3.5C0 2.94772 0.44772 2.5 1 2.5H3C3 1.11929 4.11929 0 5.5 0H6.5ZM6.5 1.5H5.5C4.94772 1.5 4.5 1.94772 4.5 2.5H7.5C7.5 1.94772 7.05228 1.5 6.5 1.5Z"
      />
    </svg>
  );
}

/** Circular arrows — reset/revert, distinct from the destructive trash icon. */
export function ResetIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
      <path d="M11.6 5.2A4.9 4.9 0 0 0 3.2 3.7L2 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 2.4V5h2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.4 8.8a4.9 4.9 0 0 0 8.4 1.5L12 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 11.6V9H9.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Chevron Down Icon for Select / Dropdown menu components. */
export function ChevronDownIcon({ size = 10, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        /* Ink centred in the box, not the path. The stroked glyph runs
           y 3.75..8.75 when drawn at 4.5..8, which sits a quarter-unit low —
           enough to read as misaligned beside a line of type, and enough to
           make the open-state 180° flip visibly jump. Drawn a quarter up so
           the ink centre and the box centre are the same point. */
        d="M2.5 4.25L6 7.75L9.5 4.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/*
 * Magnifier — NOT a Figma export. The scriptures search field needed a glyph
 * and the file has none, so this is drawn to the system's own metrics: a
 * 1.6px stroke on a 14 box, matching the hairline weight used elsewhere.
 * Replace it with the real path when Figma has one.
 */
export function SearchIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="6.1" cy="6.1" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.5 9.5L12.7 12.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/*
 * Pencil and plus — also NOT Figma exports, drawn to the same 1.6px stroke as
 * the magnifier above. Replace with the real paths when the file has them.
 */
export function PencilIcon({ size = 12, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M9.6 1.9a1.6 1.6 0 0 1 2.3 2.3l-6.6 6.6-3 .7.7-3 6.6-6.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon({ size = 14, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M7 2.2v9.6M2.2 7h9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* Scan frame — the OCR import affordance. Drawn, not a Figma export. */
export function ScanIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M1.6 5.2V3.2a1.6 1.6 0 0 1 1.6-1.6h2M14.4 5.2V3.2a1.6 1.6 0 0 0-1.6-1.6h-2M1.6 10.8v2a1.6 1.6 0 0 0 1.6 1.6h2M14.4 10.8v2a1.6 1.6 0 0 1-1.6 1.6h-2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="4.4" y="5.6" width="7.2" height="4.8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/*
 * Sparkle — marks a suggestion the engine made rather than something the
 * operator entered. One glyph, used everywhere the machine proposes.
 */
export function SparkleIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M6.6 1.8 7.9 5.3l3.5 1.3-3.5 1.3-1.3 3.5-1.3-3.5L1.8 6.6l3.5-1.3 1.3-3.5Z"
        fill="currentColor"
      />
      <path d="M12.1 8.9l.62 1.67 1.67.62-1.67.62-.62 1.67-.62-1.67-1.67-.62 1.67-.62.62-1.67Z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

/* Film reel — media. Drawn, not a Figma export. */
export function MediaIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <circle cx="7.4" cy="7.4" r="5.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7.4" cy="4.9" r="1.05" fill="currentColor" />
      <circle cx="7.4" cy="9.9" r="1.05" fill="currentColor" />
      <circle cx="4.9" cy="7.4" r="1.05" fill="currentColor" />
      <circle cx="9.9" cy="7.4" r="1.05" fill="currentColor" />
      <path d="M11.6 12.1c1.3 0 2.6.4 2.6 1.1s-1 1.1-2.3 1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* A page with a turned corner — a note against a segment. */
export function NoteIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M2.4 3.6a1.6 1.6 0 0 1 1.6-1.6h8a1.6 1.6 0 0 1 1.6 1.6v5.2l-4.6 4.6H4a1.6 1.6 0 0 1-1.6-1.6V3.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M13.6 8.8H10.6a1.6 1.6 0 0 0-1.6 1.6v3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/*
 * Grip — six dots, the universal "this row can be dragged".
 *
 * Two columns of three, on a 4px pitch, in a 10 × 16 box so it sits on the
 * text baseline grid of a row rather than floating in the middle of one.
 * Drawn, not a Figma export: the file has no handle glyph yet.
 */
export function GripIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={(size * 10) / 16}
      height={size}
      viewBox="0 0 10 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {[3, 8, 13].map((cy) => (
        <g key={cy} fill="currentColor">
          <circle cx="3" cy={cy} r="1.35" />
          <circle cx="7" cy={cy} r="1.35" />
        </g>
      ))}
    </svg>
  );
}

/*
 * Tick — the mark inside a checked box.
 *
 * Stroked rather than filled, and drawn slightly off-centre low, because a
 * geometrically centred tick reads as sitting high inside a square.
 */
export function CheckIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className}>
      <path
        d="M2.5 6.4 4.8 8.7 9.5 3.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/*
 * History — a dial with its arrow running backwards.
 *
 * Drawn, not a Figma export. Same idiom as the scan and note glyphs: a 16
 * box, 1.4 stroke, round joins — so it sits beside them at the same weight
 * rather than reading as a heavier icon from somewhere else.
 *
 * Three parts: the dial, the tail that sweeps off its top into the corner,
 * and the corner itself, which is the arrowhead. The hands are what stop it
 * reading as a plain refresh arrow.
 */
export function HistoryIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M2 8a6 6 0 1 0 6-6 6.5 6.5 0 0 0-4.49 1.83L2 5.33"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 2v3.33h3.33"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 4.67v3.33l2.67 1.33"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/*
 * Book — scripture's mark in a queue row. Drawn in the house idiom: 16 box,
 * 1.4 stroke, round joins. An open spread with a centre fold, so it reads
 * as "bible" at 12px without any text.
 */
export function BookIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8 3.5C6.8 2.6 5.2 2.1 3.4 2.1h-1.2v9.9h1.2c1.8 0 3.4.5 4.6 1.4 1.2-.9 2.8-1.4 4.6-1.4h1.2V2.1h-1.2c-1.8 0-3.4.5-4.6 1.4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8 3.5v9.9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/*
 * Music note — a song's mark in a queue row. A beamed pair, because a single
 * note at 12px reads as a golf club.
 */
export function MusicIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M6.4 11.5V4.2l6.4-1.4v7.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="4.5" cy="11.5" r="1.9" fill="currentColor" />
      <circle cx="10.9" cy="10.2" r="1.9" fill="currentColor" />
    </svg>
  );
}

/*
 * Microphone — the listen-for-service affordance. House idiom: 16 box, 1.4
 * stroke. Capsule, cradle, stem — no base bar, which at 13px turns the
 * whole glyph into a lollipop.
 */
/*
 * Play — NOT a Figma export, drawn to the system's metrics like the
 * magnifier above. Replace it when the file has one.
 *
 * A FILLED triangle, where every other glyph here is a 1.5px stroke: this is
 * the only icon in the set that rides a gold act rather than sitting beside
 * a line of type, and a stroked outline at 12px on a filled button reads as
 * a hollow arrow rather than as play. Corners are joined round at a third of
 * the stroke weight so it is not a needle-sharp wedge next to the system's
 * rounded caps.
 *
 * Nudged a half-unit right of centre: a triangle's optical centre is behind
 * its own centroid, and drawn on the box centre it reads as sitting left.
 */
export function PlayIcon({ size = 12, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3.75 2.4L9.6 5.78a0.25 0.25 0 0 1 0 0.44L3.75 9.6A0.25 0.25 0 0 1 3.4 9.38V2.62A0.25 0.25 0 0 1 3.75 2.4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MicIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <rect x="6" y="1.4" width="4" height="7.4" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.6 7.8v.4a4.4 4.4 0 0 0 8.8 0v-.4M8 12.9v1.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
