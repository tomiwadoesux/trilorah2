import { useState, type CSSProperties, type ReactNode } from 'react';
import { ExpandIcon } from '../../ui';
import { createPatches } from './dottedSurface';
import { useEmptyHover } from './useEmptyHover';
import './dottedSurface.css';
import './emptyArt.css';

/*
 * The empty states every panel falls back to — the drawing, the sentence,
 * and the way out of the state.
 *
 * An empty state is the first thing a new church sees and the thing the
 * booth stares at for the ten minutes before a service starts, so these are
 * not edge cases: for a fresh install they ARE the app.
 *
 * The rule the whole set is built on: this is NOT a stock icon over a
 * sentence. Each drawing is the panel's OWN CONTENT rendered as an empty
 * wireframe, in the same hairline language as the dashboard's card art —
 * slots waiting for segments, a waveform that never spiked, a song grid
 * gone dark, an axis with no line yet. The operator sees the shape the
 * panel will take once it fills, which answers "what goes here" better than
 * a symbol does.
 *
 * Two house numbers, because the viewBox lies. Drawings are authored in a
 * 150x92 box and rendered into roughly 190x112, so one user unit is about
 * 1.27px on screen. Keep gaps at 4 units or more or hairlines mush into one
 * grey smear, and keep strokeOpacity at 0.13 or more or the wrapper's own
 * 0.72 takes it under the floor where a 1px line stops rendering on a dark
 * panel at a booth's viewing angle.
 *
 * And: faint data is still data. A drawing cannot buy its way out of
 * looking like content by getting dimmer — the objection is about kind, not
 * brightness. Only the dash says absent, so anything that cannot carry a
 * dash cannot carry absence.
 *
 * The sandbox sheet for all of this is D-30 in the design gallery.
 */

const INK = 'rgb(229 243 242)';

/** Shared empty-state texture and card-wide hover motion. */
export function EmptyMotion({ children, className = '', play = 'hover' }: {
  children: ReactNode;
  className?: string;
  play?: 'always' | 'hover';
}) {
  const root = useEmptyHover(play === 'hover');
  const [patches] = useState(() => createPatches(false, true));
  return (
    <div ref={root} style={patches} className={`tri-empty-surface ${play === 'hover' ? 'tri-play-hover ' : ''}${className}`}>
      {children}
    </div>
  );
}

/**
 * The frame every empty state shares: a drawing, the sentence under it, and
 * an optional second line naming the way out.
 *
 * The drawing is masked to fade downward into the panel rather than ending
 * on a hard edge — the same radial mask idea as ArtLayer, so a trace never
 * competes with the words beneath it.
 */
export function EmptyMark({
  art,
  line,
  hint,
  w = 190,
  h = 112,
  play = 'hover',
  below,
  plain = false,
}: {
  art: ReactNode;
  /*
   * The state, in the panel's own words. An empty string draws the mark
   * alone — for the two places where the surrounding chrome already says
   * it: the transcript's own pill carries its sentence, and the companion's
   * square sits beside a link that reads "no link yet".
   */
  line: string;
  /** The way out of the state. Omitted where there isn't one to name. */
  hint?: string;
  w?: number | string;
  h?: number | string;
  /*
   * Hover starts the drawing across the whole card; leaving gently brakes
   * its native animation timeline, then pauses it at the current frame.
   * 'always' is reserved for ongoing activity such as live listening.
   */
  play?: 'always' | 'hover';
  /** A row under the hint — the run rail parks its big + and clock here. */
  below?: ReactNode;
  /*
   * The hairline wireframes get dimmed to 0.72 and faded out along their
   * bottom edge; the yui540 ports are whole compositions with their own
   * floors and boxes, and the mask was eating them. `plain` hands the art
   * the box and nothing else.
   */
  plain?: boolean;
}) {
  const px = (value: number | string) => typeof value === 'number' ? `${value}px` : value;
  return (
    <EmptyMotion play={play} className="tri-empty-mark">
      <div className={`tri-empty-mark__layout${below ? ' tri-empty-mark__layout--actions' : ''}`} style={{ '--empty-art-w': px(w), '--empty-art-h': px(h) } as CSSProperties}>
        <div className="tri-empty-mark__stage" aria-hidden="true">
          <div className="tri-empty-mark__art" style={plain ? { color: INK } : {
            color: INK,
            opacity: 0.72,
            maskImage: 'linear-gradient(to bottom, #000 74%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000 74%, transparent 100%)',
          }}>
            {art}
          </div>
        </div>
        {(line || hint || below) && <div className="tri-empty-mark__copy">
          {line !== '' && <p className="tri-empty-mark__line">{line}</p>}
          {hint && <p className="tri-empty-mark__hint">{hint}</p>}
          {below && <div className="tri-empty-mark__actions">{below}</div>}
        </div>}
      </div>
    </EmptyMotion>
  );
}

/*
 * House idiom: 1px non-scaling lines, no fill, colour from the parent.
 *
 * SCALE, because it catches everyone once: the drawing is authored in a
 * 150x92 viewBox but rendered into EmptyMark's 190x112 box, so 1 user unit
 * is about 1.27px on screen. Two consequences, and both are hard rules —
 * keep gaps >= 4 user units or hairlines mush into one grey smear, and keep
 * strokeOpacity >= 0.13 or the wrapper's own 0.72 takes it below the floor
 * where a 1px line stops rendering on a dark panel at a booth's viewing
 * angle.
 *
 * `tri-es-art` is what puts transform-box: fill-box on the children, so a
 * scale or a rotate is about the element's own centre rather than the
 * viewBox origin. Without it ChartArt's columns scaled about the corner.
 */
export function Wire({ vb, children, fit }: { vb: string; children: ReactNode; fit?: boolean }) {
  return (
    <svg
      viewBox={vb}
      /* `fit` keeps a square drawing square inside a square host. The
         default stretches to the box it is given, which is right for the
         150x92 drawings sitting in EmptyMark's fixed frame. */
      preserveAspectRatio={fit ? 'xMidYMid meet' : undefined}
      className="tri-es-art h-full w-full overflow-visible"
    >
      <g fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke">
        {children}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* The drawings                                                        */
/* ------------------------------------------------------------------ */

/*
 * RUN OF SERVICE — the slots a service gets built into.
 *
 * The real rail is a stack of cards with a grip, a title and a slide count.
 * Drawn empty it is that stack with nothing written in it. Two things stop
 * it from being a generic list skeleton, which is what it was:
 *
 * THE SPINE. A rule down the left, solid beside the first slot and dashed
 * below it. A running order is a sequence with a start, and the spine is
 * the only mark in the set that says so — an inbox has no spine. Drawn as
 * two butt-joined segments rather than one line over another, or the solid
 * stroke sits on the dashed one at a different opacity and seams.
 *
 * HETEROGENEOUS ROWS. Each slot's title is a different length and the
 * second row carries a two-token line — the shape of a scripture reference,
 * book then numbers. Identical rows read as a placeholder graphic; uneven
 * ones read as an order that has real, different things in it.
 */
export function RunArt() {
  /* Three rows at a 30 pitch, the last ending at 86 — inside the viewBox,
     where the mask can dissolve it. At the old 32 pitch row 2 ran to 97 and
     escaped through overflow-visible, giving a hard bright edge exactly
     where the drawing was meant to fade out. */
  const rows = [
    { y: 6, o: 0.52, title: 104, solid: true },
    { y: 36, o: 0.3, title: 78, solid: false },
    { y: 66, o: 0.15, title: 64, solid: false },
  ];
  return (
    <Wire vb="0 0 150 92">
      {/* The spine: solid beside the first slot, dashed on down. */}
      <line x1={14} y1={10} x2={14} y2={34} strokeOpacity={0.3} />
      <line
        x1={14}
        y1={34}
        x2={14}
        y2={88}
        strokeDasharray="2 5"
        strokeOpacity={0.14}
        className="tri-es-spine"
      />

      {rows.map((r, i) => (
        /* The breathe/crawl sits on the GROUP, not the rect, so a slot's
           title moves with its own card instead of holding still inside a
           breathing outline. */
        <g
          key={r.y}
          strokeOpacity={r.o}
          className={
            r.solid ? 'tri-es-slot--first' : `tri-es-slot--dashed${i === 2 ? ' tri-es-d2' : ''}`
          }
        >
          <rect
            x={22}
            y={r.y}
            width={116}
            height={24}
            rx={5}
            strokeDasharray={r.solid ? undefined : '3 4'}
          />
          {/* The grip — two dots, 7 apart. A 2x2 at 4 units apart was a
              smudge at this scale; two dots at 7 read as a handle. */}
          <circle cx={31} cy={r.y + 8.5} r={0.9} fill="currentColor" stroke="none" opacity={r.o + 0.18} />
          <circle cx={31} cy={r.y + 15.5} r={0.9} fill="currentColor" stroke="none" opacity={r.o + 0.18} />
          {i === 1 ? (
            /* A scripture segment: book, then the numbers. Two tokens with
               a real gap, because at a 4-unit gap they merge into one rule
               and the whole point is lost. */
            <>
              <line x1={39} y1={r.y + 12} x2={76} y2={r.y + 12} strokeOpacity={r.o * 0.8} />
              <line x1={82} y1={r.y + 12} x2={94} y2={r.y + 12} strokeOpacity={r.o * 0.55} />
            </>
          ) : (
            <line x1={39} y1={r.y + 12} x2={r.title} y2={r.y + 12} strokeOpacity={r.o * 0.8} />
          )}
          {/* The slide count, dashed — a quantity not yet decided. A filled
              pip here read as a real count, or as an overflow menu; only a
              dash can say "hypothetical" in this language. */}
          <line
            x1={118}
            y1={r.y + 12}
            x2={130}
            y2={r.y + 12}
            strokeDasharray="1 3"
            strokeOpacity={r.o * 0.5}
          />
        </g>
      ))}
    </Wire>
  );
}

/*
 * The catches panel's shared furniture.
 *
 * Idle and listening draw the SAME baseline and the same minute scale, so
 * the two states read as one instrument in two conditions rather than as
 * two unrelated pictures. Only what happens above the line differs.
 */
const CATCH_BASE = 52;

/* A scale, not a ruler: minor ticks every minute, a longer one every fifth.
   A regular alternating tick is decoration; a 5-minute major says the axis
   measures a service's length, which is the unit this panel is waiting in. */
export function MinuteScale({ y }: { y: number }) {
  return (
    <>
      {Array.from({ length: 25 }, (_, i) => {
        const major = i % 5 === 0;
        return (
          <line
            key={i}
            x1={8 + i * 5.583}
            y1={y}
            x2={8 + i * 5.583}
            y2={y + (major ? 5 : 2.5)}
            strokeOpacity={major ? 0.32 : 0.15}
          />
        );
      })}
    </>
  );
}

/*
 * CATCHES, NOT LISTENING — the line that never moved.
 *
 * The panel fills when the engine hears scripture, so empty it is the trace
 * that never spiked: a baseline, a scale under it, and the ghosts of three
 * catches that did not happen. A spike, not a hill — a scripture catch is
 * an instant, and three at uneven spacing is what irregular arrival looks
 * like. They are dashed, because in this language dashed is the only thing
 * that can say "absent"; a solid wobble here, however faint, is a waveform,
 * and a waveform in this panel means the mic is open when it is not.
 */
export function FlatlineArt() {
  const ghosts = [
    { d: 'M40 52 L46 28 L52 52', o: 0.28, cls: '' },
    { d: 'M72 52 L77 34 L82 52', o: 0.2, cls: ' tri-es-d2' },
    { d: 'M104 52 L110 24 L116 52', o: 0.15, cls: ' tri-es-d3' },
  ];
  return (
    <Wire vb="0 0 150 92">
      <line x1={8} y1={CATCH_BASE} x2={142} y2={CATCH_BASE} strokeOpacity={0.6} />
      {/* The travelling highlight — a short, genuinely brighter segment of
          the same baseline. Short enough to read as a playhead rather than
          a smear, and bright enough to be seen: at the old 36-unit width
          and 0.9 stroke it was only 1.27x the baseline it rode on. */}
      <line
        x1={8}
        y1={CATCH_BASE}
        x2={30}
        y2={CATCH_BASE}
        strokeOpacity={1}
        className="tri-es-sweep"
      />
      <MinuteScale y={CATCH_BASE} />
      {ghosts.map((g) => (
        <path
          key={g.d}
          d={g.d}
          strokeDasharray="3 4"
          strokeOpacity={g.o}
          className={`tri-es-ghost${g.cls}`}
        />
      ))}
    </Wire>
  );
}

/*
 * CATCHES, LISTENING — the same instrument, running.
 *
 * The engine is up and hearing a room; nothing has come yet. So the
 * baseline and the scale stay exactly as they are at idle, and the space
 * above them fills with the orb's own dot field — the app's established
 * mark for "something is running".
 *
 * The field is SHAPED, not scattered evenly: dense and steady near the
 * line, thinning and flickering harder toward the top. That is what a room
 * sounds like — a constant floor with occasional peaks — and it is the
 * difference between a field and confetti.
 *
 * Three dots sit at the apexes of idle's ghost peaks. Nobody sees it on
 * first look; after a dozen services the two panels read as one instrument
 * saying "here is where a catch would land" in two different voices.
 */
export function ListeningArt() {
  const N = 59;
  const frac = (n: number) => n - Math.floor(n);
  const dots = Array.from({ length: N }, (_, i) => {
    const a = frac(Math.sin(i * 12.9898) * 43758.5453);
    const b = frac(Math.sin(i * 78.233) * 12345.6789);
    const c = frac(Math.sin(i * 39.425) * 24634.6345);
    /* Marched across the width then jittered — a purely random x leaves
       clumps and gaps at this count, which reads as a mistake. */
    const x = 10 + (i / (N - 1)) * 130 + (a - 0.5) * 9;
    /* b^1.7 biases the field toward the baseline: most dots sit low, a few
       reach up. `h` is 0 at the line and 1 at the top of the field. */
    const y = CATCH_BASE - 4 - Math.pow(b, 1.7) * 42;
    const h = (CATCH_BASE - 4 - y) / 42;
    return {
      x,
      y,
      /* Bigger and calmer at the floor, smaller and more restless above. */
      r: 1.5 - h * 0.7 + c * 0.35,
      dur: 2.8 + c * 6.4,
      delay: -(a * 9),
      lo: 0.16 - h * 0.11,
      hi: 0.34 - h * 0.12,
    };
  });
  /* The apexes of idle's three ghost peaks. */
  const apex = [
    { x: 46, y: 28 },
    { x: 77, y: 34 },
    { x: 110, y: 24 },
  ];
  return (
    <Wire vb="0 0 150 92">
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill="currentColor"
          stroke="none"
          className="tri-es-dot"
          style={
            {
              '--tri-es-dur': `${d.dur.toFixed(2)}s`,
              '--tri-es-delay': `${d.delay.toFixed(2)}s`,
              '--tri-es-lo': d.lo.toFixed(3),
              '--tri-es-hi': d.hi.toFixed(3),
            } as CSSProperties
          }
        />
      ))}
      {apex.map((a, i) => (
        <circle
          key={`apex-${a.x}`}
          cx={a.x}
          cy={a.y}
          r={1.3}
          fill="currentColor"
          stroke="none"
          className="tri-es-dot"
          style={
            {
              '--tri-es-dur': `${(5.5 + i * 1.7).toFixed(2)}s`,
              '--tri-es-delay': `${(-2.3 * i).toFixed(2)}s`,
              '--tri-es-lo': '0.10',
              '--tri-es-hi': '0.40',
            } as CSSProperties
          }
        />
      ))}
      <line x1={8} y1={CATCH_BASE} x2={142} y2={CATCH_BASE} strokeOpacity={0.55} />
      <line
        x1={8}
        y1={CATCH_BASE}
        x2={30}
        y2={CATCH_BASE}
        strokeOpacity={1}
        className="tri-es-sweep tri-es-sweep--live"
      />
      <MinuteScale y={CATCH_BASE} />
    </Wire>
  );
}

/*
 * SONGS — the five-across grid with the lights off.
 *
 * The song screen's identity is that grid of lyric cards, five to a row,
 * fixed. With no match it is the same grid drawn as empty frames: a
 * brighter short rule where the title sits, two dimmer longer ones for the
 * words, and every card's lines a different length — ten identical stamps
 * is what made this read as a placeholder graphic rather than as songs.
 */
export function GridArt() {
  const cols = [0, 1, 2, 3, 4];
  /* Ragged per card, so no two are the same shape. */
  const raggedA = [17, 15, 18, 14, 16];
  const raggedB = [12, 14, 10, 13, 11];
  return (
    <Wire vb="0 0 150 92">
      {[0, 1].map((r) =>
        cols.map((c) => {
          const x = 5.5 + c * 28;
          /* Rows at 4-32 and 38-66: the second row used to run to 74 and
             was cut mid-card by the mask, which read as clipping rather
             than as fading. */
          const y = 4 + r * 34;
          /* The far card used to land at 0.065 effective — gone on a dark
             panel, and a grid with a missing corner reads as broken. */
          const o = (0.44 - c * 0.035) * (r ? 0.58 : 1);
          return (
            <g
              key={`${r}-${c}`}
              strokeOpacity={o}
              className="tri-es-card"
              style={{ '--tri-es-delay': `${(c * 0.42 + r * 0.7).toFixed(2)}s` } as CSSProperties}
            >
              <rect x={x} y={y} width={23} height={28} rx={3} strokeDasharray={r ? '3 4' : undefined} />
              {/* Title, then the words. Three rules at 6-7 apart; a fourth
                  would have put them 4.5 units apart, which is mush. */}
              <line x1={x + 4} y1={y + 7} x2={x + 4 + raggedA[c]} y2={y + 7} strokeOpacity={o * 0.75} />
              <line x1={x + 4} y1={y + 14} x2={x + 4 + raggedB[c]} y2={y + 14} strokeOpacity={o * 0.45} />
              <line x1={x + 4} y1={y + 20} x2={x + 4 + raggedA[c] - 4} y2={y + 20} strokeOpacity={o * 0.32} />
            </g>
          );
        }),
      )}
    </Wire>
  );
}

/*
 * RECENT SERVICES — the chart before there is a chart.
 *
 * The tile's real content is a history of past services, so empty it is
 * the axis with nothing plotted on it: five dashed columns stepping down
 * and fading out, with a wide right margin for the services still to come.
 *
 * The heights descend in a clean staircase ON PURPOSE. Varied heights look
 * like measurements — a new church's operator has not yet learnt that
 * dashed means absent, and would read a ragged seven-bar chart as real
 * attendance figures on day one. A perfect staircase reads as a diagram of
 * a chart, which is what it is.
 */
export function ChartArt() {
  const cols = [
    { x: 32, h: 31, o: 0.3 },
    { x: 51, h: 26, o: 0.24 },
    { x: 70, h: 21, o: 0.18 },
    { x: 89, h: 16, o: 0.13 },
    { x: 108, h: 11, o: 0.13 },
  ];
  const AXIS = 69.5;
  return (
    <Wire vb="0 0 150 92">
      {/* The axis, quieter than it was: at 1px it out-brightened every
          column, which inverted the hierarchy of a chart whose subject is
          the columns. */}
      <line x1={20} y1={10} x2={20} y2={AXIS} strokeOpacity={0.5} />
      <line x1={20} y1={AXIS} x2={140} y2={AXIS} strokeOpacity={0.5} />
      {/* Gridlines, last in the hierarchy — with a stub on the axis, so
          they read as measured off it rather than as stray rules. */}
      {[22, 38, 54].map((y, i) => (
        <g key={y}>
          <line x1={17} y1={y} x2={20} y2={y} strokeOpacity={0.24 - i * 0.03} />
          <line
            x1={20}
            y1={y}
            x2={140}
            y2={y}
            strokeDasharray="1 6"
            strokeOpacity={0.13 - i * 0.02}
          />
        </g>
      ))}
      {cols.map((col, i) => (
        <g key={col.x}>
          <rect
            x={col.x}
            y={AXIS - col.h}
            width={11}
            height={col.h}
            strokeDasharray="3 4"
            strokeOpacity={col.o}
            className="tri-es-col"
            style={{ '--tri-es-delay': `${(i * 0.7).toFixed(2)}s` } as CSSProperties}
          />
          {/* A tick under each column: a bare L is a corner, ticks make it
              an axis. */}
          <line
            x1={col.x + 5.5}
            y1={AXIS}
            x2={col.x + 5.5}
            y2={AXIS + 3}
            strokeOpacity={0.28 - i * 0.03}
          />
        </g>
      ))}
    </Wire>
  );
}

/*
 * PREACHER TRANSCRIPT — the room above the pill.
 *
 * The trap here is that the transcript pill is NEVER empty: at rest it
 * holds its own sentence ("transcripts appear here"), inside real glass
 * chrome with a real blur and a real border. Drawing a hairline pill would
 * put a wireframe box next to a styled one, which is the exact signature of
 * a component whose CSS failed to load — the worst read an empty state can
 * have. What is actually empty is the HISTORY above the pill.
 *
 * So: no container anywhere. Five lines of finished speech that never
 * happened, bottom-anchored against the pill, receding upward. Every line
 * is dashed — none were ever said — and the dash lengthens while the gap
 * widens going up, so recession is drawn as rhythm rather than as opacity
 * alone. A 2-long dash at 6% still reads as a line dissolving, where a
 * continuous hairline at 6% reads as nothing at all.
 */
export function TranscriptArt() {
  /* Ragged on purpose, and not monotonic: the newest line is mid-sentence
     and short, the two above it ran the full width, one ended a sentence
     early, and the topmost is already half-eaten by the mask. A tidy ramp
     of decreasing widths reads as a pyramid or a chart; real speech wraps
     unevenly and that unevenness is the whole tell. */
  const lines = [
    { y: 68, x2: 96, dash: '5 4', o: 0.32 },
    { y: 55, x2: 136, dash: '5 5', o: 0.25 },
    { y: 42, x2: 118, dash: '4 6', o: 0.19 },
    { y: 29, x2: 134, dash: '3 7', o: 0.15 },
    { y: 16, x2: 74, dash: '2 9', o: 0.13 },
  ];
  return (
    <Wire vb="0 0 150 92">
      {lines.map((l, i) => (
        <line
          key={l.y}
          x1={16}
          y1={l.y}
          x2={l.x2}
          y2={l.y}
          strokeDasharray={l.dash}
          strokeOpacity={l.o}
          className={`tri-es-utter tri-es-t${i}`}
        />
      ))}
      {/* Where the next word would start. One dot — not a caret: the real
          caret is yellow and means speech ARRIVING, which would contradict
          the sentence underneath saying nothing has been heard. */}
      <circle
        cx={102}
        cy={68}
        r={1.1}
        fill="currentColor"
        stroke="none"
        opacity={0.34}
        className="tri-es-next"
      />
    </Wire>
  );
}

/*
 * COMPANION — the square, before there is a code in it.
 *
 * Deliberately NOT a QR skeleton. A QR is recognised by three corner finder
 * patterns, and a drawing faithful enough to read as "a QR" is faithful
 * enough that a congregant's phone will lock onto it, hunt, and fail — the
 * failed-image read the tile's own comment warns about, arrived at from the
 * other side. No other drawing in this set depicts its content literally
 * either: the catches panel draws a baseline, not a spectrogram.
 *
 * What is real here is the square and the link. So the square is drawn and
 * SOLID — the button, the slot and the tile all exist and are ready — the
 * modules are absent, and the link is a rule with nothing written on it.
 * One corner bracket, never three: one cannot be triangulated.
 */
export function CompanionArt() {
  const divisions = [26, 40, 54, 68];
  return (
    <Wire vb="0 0 92 92" fit>
      <rect x={12} y={6} width={68} height={68} rx={4} strokeOpacity={0.46} className="tri-es-qr-frame" />
      {/* A register far too coarse to be data: five divisions, where a real
          code is 21 to 177 modules across. */}
      {divisions.map((v, i) => (
        <g
          key={v}
          strokeDasharray="2 5"
          strokeOpacity={0.15 - i * 0.015}
          className={`tri-es-qr-grid${i % 2 ? ' tri-es-d2' : ''}`}
        >
          <line x1={v + 4} y1={6} x2={v + 4} y2={74} />
          <line x1={12} y1={v - 2} x2={80} y2={v - 2} />
        </g>
      ))}
      {/* One registration mark. A finder set is three; this is one. */}
      <path d="M22 30 L22 20 L32 20" strokeOpacity={0.34} />
      {/* Four modules on the coarse register — enough to say things land on
          this grid, far short of a matrix. They do not animate: a filled
          square that twinkles is the thing most likely to read as data
          arriving, and the twinkle belongs to the listening field alone. */}
      {[
        [33, 31, 0.2],
        [47, 45, 0.16],
        [61, 31, 0.13],
        [33, 59, 0.13],
      ].map(([cx, cy, o]) => (
        <rect
          key={`${cx}-${cy}`}
          x={cx as number}
          y={cy as number}
          width={6}
          height={6}
          fill="currentColor"
          stroke="none"
          opacity={o as number}
        />
      ))}
      {/* The link — the tile's other empty field, and the only caption rule
          in the set. Kept at 78 so the mask fades it without erasing it. */}
      <line x1={12} y1={80} x2={54} y2={80} strokeDasharray="3 4" strokeOpacity={0.22} />
    </Wire>
  );
}

/*
 * NOTIFICATIONS — the log, before anything has happened.
 *
 * A stack of entry cards with nothing written in them, top-anchored: the
 * log grows downward, so the drawing is open at the bottom and the third
 * card dissolves into the mask rather than ending on an edge.
 *
 * The right-hand gutter is what keeps this from being the run rail. Every
 * log entry carries a time and the rail carries none, so this stack is
 * weighted RIGHT where the rail's grips weight it LEFT — a difference you
 * can see across a booth without resolving one interior line. No yellow:
 * the log's gold is a real ask needing a decision, and inventing one in an
 * empty state is an alert about nothing.
 */
export function LogArt() {
  const cards = [
    { y: 4, o: 0.52, solid: true, body: 104, body2: 76, stub: 18 },
    { y: 34, o: 0.26, solid: false, body: 92, body2: 68, stub: 16 },
    { y: 64, o: 0.14, solid: false, body: 84, body2: 0, stub: 0 },
  ];
  return (
    <Wire vb="0 0 150 92">
      {cards.map((c, i) => (
        <g
          key={c.y}
          strokeOpacity={c.o}
          className={c.solid ? 'tri-es-slot--first' : `tri-es-slot--dashed${i === 2 ? ' tri-es-d2' : ''}`}
        >
          <rect x={12} y={c.y} width={126} height={26} rx={4} strokeDasharray={c.solid ? undefined : '3 4'} />
          <line
            x1={19}
            y1={c.y + 9}
            x2={19 + c.body}
            y2={c.y + 9}
            strokeDasharray={c.solid ? undefined : '2 5'}
            strokeOpacity={c.o * 0.76}
          />
          {c.body2 > 0 && (
            <line
              x1={19}
              y1={c.y + 16}
              x2={19 + c.body2}
              y2={c.y + 16}
              strokeDasharray={c.solid ? undefined : '2 5'}
              strokeOpacity={c.o * 0.46}
            />
          )}
          {/* The timestamp every entry carries. */}
          {c.stub > 0 && (
            <line
              x1={19}
              y1={c.y + 21.5}
              x2={19 + c.stub}
              y2={c.y + 21.5}
              strokeDasharray="2 5"
              strokeOpacity={c.o * 0.42}
            />
          )}
        </g>
      ))}
      {/* The gutter, running past the cards — the log keeps going. */}
      <line
        x1={131}
        y1={8}
        x2={131}
        y2={88}
        strokeDasharray="2 5"
        strokeOpacity={0.13}
        className="tri-es-slot--dashed tri-es-d3"
      />
    </Wire>
  );
}

/*
 * THE BAND'S KEPT ROOM — a ruled margin, nothing claimed.
 *
 * Every other drawing here foreshadows content that will arrive. This card
 * is empty permanently and on purpose, so there is no shape to foreshadow —
 * which rules out depicting anything. What it draws instead is the act of
 * reserving: a ruled margin and four blank rows, like the unused lines of a
 * ledger.
 *
 * The rows are EQUAL length, not tapering. A taper is a paragraph shape and
 * implies words; equal rows imply a form nobody has filled in. And there is
 * no rect anywhere, because a closed outline with nothing in it is the one
 * shape that reads as a failed asset.
 */
export function KeptArt() {
  return (
    <Wire vb="0 0 150 92">
      {/* The margin — the only solid mark, and the only assertion here:
          someone ruled this space. Short of both edges, so it reads as a
          rule inside a space rather than a divider splitting the card. */}
      <line x1={46} y1={14} x2={46} y2={66} strokeOpacity={0.38} />
      {[24, 35, 46, 57].map((y, i) => (
        <line
          key={y}
          x1={46}
          y1={y}
          x2={112}
          y2={y}
          strokeDasharray="2 5"
          strokeOpacity={0.2 - i * 0.023}
          className="tri-es-kept"
          style={{ '--tri-es-delay': `${(i * -2.4).toFixed(1)}s` } as CSSProperties}
        />
      ))}
    </Wire>
  );
}

/*
 * SERMON NOTES — the outline, before it is written.
 *
 * What separates this from the log and the transcript is HIERARCHY: an
 * outline has points, sub-lines under them, and set-apart items — a
 * scripture, a pulled quote. So the subject of this drawing is left EDGES,
 * and it is the only horizontal-only drawing in the set: no box, no axis,
 * no verticals at all. That also suits its neighbours, since this tile has
 * two hard-edged buttons directly beneath it and a vertical rule pointing
 * down at a button row is a composition problem.
 *
 * Hierarchy is carried three times over — by indent, by opacity, and by
 * dash length — so the outline still reads as an outline on a bad monitor
 * where the dimmest rows are lost.
 */
export function OutlineArt() {
  /* Seven rows at a 9 pitch, not nine at 7.2: at render size the tighter
     stack turned three indent levels into one grey texture, and hierarchy
     is the only thing this drawing has to say. The indent steps are 16 and
     10 units — big enough that the left edge alone carries the structure
     when the dimmest rows drop out. */
  const rows = [
    { i: 12, x2: 124, dash: '5 5', o: 0.44, mark: false },
    { i: 28, x2: 104, dash: '3 4', o: 0.26, mark: false },
    { i: 28, x2: 112, dash: '3 4', o: 0.22, mark: false },
    { i: 38, x2: 100, dash: '3 4', o: 0.18, mark: true },
    { i: 12, x2: 110, dash: '5 5', o: 0.32, mark: false },
    { i: 28, x2: 96, dash: '3 4', o: 0.2, mark: false },
    { i: 38, x2: 88, dash: '3 4', o: 0.15, mark: true },
  ];
  return (
    <Wire vb="0 0 150 92">
      {rows.map((r, n) => {
        const y = 10 + n * 9;
        return (
          <g key={y}>
            {/* A scripture or a quote: the margin mark is the only solid
                thing here, so the STRUCTURE of a citation exists while the
                citation itself does not. */}
            {r.mark && <line x1={r.i - 9} y1={y} x2={r.i - 3} y2={y} strokeOpacity={r.o + 0.14} />}
            <line
              x1={r.i}
              y1={y}
              x2={r.x2}
              y2={y}
              strokeDasharray={r.dash}
              strokeOpacity={r.o}
              className={`tri-es-outline tri-es-o${(n % 3) + 1}`}
            />
          </g>
        );
      })}
    </Wire>
  );
}



/* ------------------------------------------------------------------ */
/* Motion marks — yui540's demos, ported whole                         */
/* ------------------------------------------------------------------ */

/*
 * These are yui540's animations THEMSELVES, not gestures borrowed from
 * them: the DOM shapes, the pixel geometry, every keyframe value and its
 * easing are copied from the files in design/motion/yui540/source (MIT,
 * © 2026 yui540). Three adaptations only, all asked for:
 *
 *   COLOUR   her grey ramp on white (#666…#ccc) becomes the same ramp in
 *            this app's ink on near-black, darkest-on-white mapping to
 *            brightest-on-dark. The variables in emptyArt.css keep her
 *            names (--g666 is what #666 became) so a port stays legible
 *            against its source.
 *   LOOPING  her once-through demos (dominoes, the stack, the seesaw,
 *            the scroll) are merged into infinite timelines — the same
 *            frame values at the same relative spacing, expressed as
 *            percentages of a cycle with a rest, so each segment keeps
 *            its own ease-in-out exactly as the two-animation chains had.
 *   PLAY     native animation timelines accelerate on card hover and
 *            gently brake on leave, resuming from the resting frame.
 *
 * Each demo was authored on a 320 stage with everything centred, so each
 * port renders that stage and scales it into the box it is given.
 */

/** yui540's 320 stage, scaled into a square box. */
function Yui({ box, children, crop = false }: { box: number; children: ReactNode; crop?: boolean }) {
  return (
    <div
      className="tri-ma tri-yui mx-auto"
      style={{ width: box, height: box, overflow: crop ? 'hidden' : undefined }}
    >
      <div className="tri-yui__stage" style={{ transform: `scale(${box / 320})` }}>
        {children}
      </div>
    </div>
  );
}

/*
 * RUN OF SERVICE — 積み木 pop-up stack (2026-04-18/tips-4).
 *
 * The bottom block pushes itself up out of nothing once, exactly as the
 * demo mounts; the top block's jump — her four frames, -40% with a 6°
 * tip, the settle, the -20% afterbounce — repeats on a cycle with a rest.
 * Jump starts and ends at translateY(0), so the loop has no seam.
 */
export function PopStackArt() {
  return (
    <Yui box={180}>
      <div className="tri-pop">
        <div className="tri-pop__block" />
        <div className="tri-pop__block" />
      </div>
    </Yui>
  );
}

/*
 * CATCHES, NOT LISTENING — ドミノ dominoes (2026-04-18/tips-2).
 *
 * Her four tiles at her four end-angles (60/61/66/90 with the 5° rock
 * back at 80%), 0.65s each, delays 0.2–0.5s — baked into a 3.8s loop
 * that stands the row back up, last tile first. Idle they stand still,
 * which is the honest frame for "not listening".
 */
export function DominoArt() {
  return (
    <Yui box={170}>
      <div className="tri-dom">
        <div className="tri-dom__block" />
        <div className="tri-dom__block" />
        <div className="tri-dom__block" />
        <div className="tri-dom__block" />
      </div>
    </Yui>
  );
}

/*
 * PREACHER TRANSCRIPT — 巻き物 scroll unroll (2026-04-25/tips-1).
 *
 * Her construction whole: the line that draws itself under the title,
 * the roll that travels -420% while counter-rotating 360°, the glyphs
 * that hop up from below the fold with her 0.95/1.15 squash — then all
 * of it in reverse, as her 1.7s-delayed reverse chains did. The four
 * glyph spans are blank blocks here: the words belong to the pill below,
 * which already says "transcripts appear here".
 */
export function UnrollArt() {
  return (
    <Yui box={180}>
      <div className="tri-scroll">
        <div className="tri-scroll__title">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="tri-scroll__line" />
        <div className="tri-scroll__roll" />
      </div>
    </Yui>
  );
}

/*
 * COMPANION — ひっくり返す rolling blocks (2026-05-14/tips-3).
 *
 * Her loop untouched — the 1.9s cycle, the corner-pivot roll to 90°, the
 * 8° inner counter-lean, the left block's squash-and-rise feeding under
 * it. Two changes: the faces carry QR furniture (a finder ring on the
 * feeder, data modules on the roller — this tile is waiting for a code),
 * and her ground sheet is gone, since the square button is the ground.
 * Her ::before faces became real divs so the modules could ride them;
 * the classes and keyframes on them are hers verbatim.
 */
export function QrRollArt() {
  return (
    <Yui box={150}>
      <div className="tri-roll">
        <div className="tri-roll__box">
          <div className="tri-roll__left">
            <div className="tri-roll__left-face">
              <i className="tri-roll__finder" />
              <i className="tri-roll__dot tri-roll__dot--a" />
            </div>
          </div>
          <div className="tri-roll__main">
            <div className="tri-roll__main-face">
              <i className="tri-roll__dot tri-roll__dot--b" />
              <i className="tri-roll__dot tri-roll__dot--c" />
              <i className="tri-roll__dot tri-roll__dot--d" />
              <i className="tri-roll__dot tri-roll__dot--e" />
            </div>
          </div>
        </div>
      </div>
    </Yui>
  );
}

/*
 * SERMON NOTES — ティッシュ tissue box (2026-05-14/tips-1).
 *
 * Her box (the two-tone case, the trapezoid clip on the sheets) and her
 * two papers on her 1.4s cycle: one pulled up, growing 50%→80% and flying
 * off at 20°, the next pushed up underneath. Each sheet carries three
 * placeholder rules — every tissue is a page of the outline this panel
 * is waiting for.
 */
export function TissueNotesArt({ size = 170 }: { size?: number } = {}) {
  const lines = (
    <>
      <i className="tri-tissue__rule" style={{ top: '22%', width: '58%' }} />
      <i className="tri-tissue__rule" style={{ top: '44%', width: '44%' }} />
      <i className="tri-tissue__rule" style={{ top: '66%', width: '50%' }} />
    </>
  );
  return (
    <Yui box={size}>
      <div className="tri-tissue">
        <div className="tri-tissue__paper2">{lines}</div>
        <div className="tri-tissue__paper1">{lines}</div>
      </div>
    </Yui>
  );
}

/*
 * NOTIFICATIONS — 回転 orbit (2026-05-02/tips-4).
 *
 * Hers exactly: the centre disc, the wide 6s ring carrying its moon, the
 * inner satellite on her 1.6s ease-and-hold spin, and the big two-tone
 * ball whose own face counter-spins at the orbit's rate so its shading
 * never turns. Cropped at the stage edge as her container cropped it.
 */
export function OrbitLogArt() {
  return (
    <Yui box={170} crop>
      <div className="tri-orbit">
        <div className="tri-orbit__box">
          <div className="tri-orbit__big" />
          <div className="tri-orbit__small" />
          <div className="tri-orbit__orbit">
            <div className="tri-orbit__large" />
          </div>
        </div>
      </div>
    </Yui>
  );
}

/*
 * THE KEPT ROOM — 積み木 balancing blocks (2026-04-18/tips-1).
 *
 * Her seesaw: big ball, bar, small ball, each with its own entry tilt
 * and its own three-frame wobble home, her half-and-half gradients kept
 * in grey. The two-animation chains are merged so the whole settle
 * repeats — a space held open, forever almost deciding.
 */
export function BalanceArt() {
  return (
    <Yui box={170}>
      <div className="tri-bal">
        <div className="tri-bal__large" />
        <div className="tri-bal__bar" />
        <div className="tri-bal__small" />
      </div>
    </Yui>
  );
}

/*
 * ON AIR — loading-3's equalizer (2025-03-11/loading-3.svg), bars only.
 *
 * Her ten one-unit bars with the two waves running through them — the
 * slow outer swell whose height each bar takes from its own --scale-y,
 * and the fast 0.15s shiver inside — including her nth-child cascade
 * exactly as written. Fill rides currentColor, so the meter takes the
 * sign's gold. Mounted only while the engine is listening.
 */
export function EqBars({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="tri-ma tri-eq"
      width={size * 1.8}
      height={size}
      viewBox="0 0 26 15"
      aria-hidden="true"
    >
      <defs>
        <symbol id="tri-eq-line">
          <rect y={4.5} width={1} height={6} fill="currentColor" />
        </symbol>
      </defs>
      <g>
        {[0.62, 3.32, 6.02, 8.72, 11.42, 14.12, 16.82, 19.52, 22.22, 24.92].map((x) => (
          <g key={x} className="tri-eq__wrap">
            <use className="tri-eq__line" href="#tri-eq-line" x={x} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/*
 * The bento's open cue uses the same Solar Bold glyph as other expand
 * controls. Scales in on hover, breathes, then scales out on leave.
 */
export function ExpandCue() {
  return (
    <span aria-hidden className="tri-cue pointer-events-none absolute right-2.5 top-2">
      <ExpandIcon size={14} className="tri-cue__icon" />
    </span>
  );
}
