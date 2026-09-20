import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { VerseSlide } from '../../../shared/verseDisplay';
import type { TextTransition } from '../../../shared/textTransitions';
import { useMediaLibrary, mediaSrc } from './mediaLibrary';

/*
 * D-23 — the one renderer.
 *
 * The O-01 sheet has been saying this is the target for a while: "one
 * renderer shared by this sheet, the Preview monitor, the Program monitor,
 * and the actual projector window — so preview can never disagree with
 * live." This is that component, and the reason it matters is not tidiness.
 *
 * The shipping app's operator preview is a `line-clamp-5` blob while the
 * projector slices the reading into slides with buildVerseSlides. Those two
 * cannot agree by construction: the operator is looking at a paragraph and
 * the congregation is reading slide 2 of 3. Here the preview box and the
 * live box are the SAME component fed different content, so agreeing is not
 * something anyone has to remember to do.
 *
 * Everything below the content is lifted verbatim out of ThemePreview,
 * comments included — the concentric-corner arithmetic, the frame sized by
 * its own contents, the blur's scale(1.04) edge fix. Those notes explain
 * decisions that were expensive to reach and would be re-litigated if they
 * arrived at their new home stripped.
 *
 * Two things are NOT lifted verbatim:
 *   - The hardcoded John 3:16 is a prop now. That is the whole extraction.
 *   - The dashed safe-area rectangle is behind `guide`, off by default. It
 *     was marked editor-only where it stood, and a renderer that draws it
 *     unasked puts a dashed box in front of a congregation.
 */

/** What a screen is showing, borrowed from the app's own ScreenState. */
export type StageScreen = 'live' | 'clear' | 'black' | 'logo';

export interface SlideCanvasProps {
  theme: SlideTheme;
  /** The slide to draw. Null draws the background and whatever `empty` says. */
  slide?: VerseSlide | null;
  /** Shown centred when there is no slide — "nothing staged", and so on. */
  empty?: ReactNode;
  /** The dashed safe-area rectangle. Editor only; never on a stage box. */
  guide?: boolean;
  /**
   * Blacked, cleared or showing the logo. `clear` keeps the background and
   * drops the words, which is what the app's own 'clear' means; `black` and
   * `logo` cover everything, because that is what they are for.
   */
  screen?: StageScreen;
  /** Sits over the picture, bottom-left — the "2 / 3" pager and the like. */
  chrome?: ReactNode;
  /**
   * Draw the screen alone, filling whatever box the caller gives it.
   *
   * The framed form sizes itself — a 16/9 screen plus --tri-card-gap of card
   * all round — which is right for the themes editor, where the canvas is an
   * object sitting in a column. On the stage the PANEL is the frame: a card
   * inside it put two outlines and two insets between the panel's edge and
   * the picture, and the picture paid for both. Seated, the caller owns the
   * size and the inset (--tri-gap, the same gutter the bento uses), and the
   * corner is drawn concentric to the panel's at that inset.
   */
  seated?: boolean;
  /**
   * Makes the guide's corners draggable. Called with the new margin, already
   * snapped and clamped to `safeRange`. Only meaningful with `guide`.
   */
  onSafeMargin?: (next: number) => void;
  /** Reports a corner being held, so the slider beside the picture can stop
   *  easing toward each value and simply be where the hand is. */
  onSafeDrag?: (dragging: boolean) => void;
  /** The same bounds the slider has, so neither control can reach a value
   *  the other cannot show. */
  safeRange?: { min: number; max: number; step: number };
  /**
   * Makes the reference line itself draggable, away from or toward the verse.
   * Called with the new gap, snapped and clamped to `refGapRange`. Like the
   * corners, this is the canvas's way of setting a value the themes bar also
   * has a slider for — drag here and that slider follows.
   */
  onRefGap?: (next: number) => void;
  /** Reports the reference being held, for the same reason onSafeDrag does. */
  onRefGapDrag?: (dragging: boolean) => void;
  /** The gap's bounds, shared with its slider. */
  refGapRange?: { min: number; max: number; step: number };
  /**
   * How the words arrive, played HERE. `play` is a counter: bump it and the
   * text block re-mounts and runs the entrance once — which is how the
   * editor shows a transition the moment it is picked. Absent, words simply
   * appear, as they always have on the stage boxes.
   */
  transition?: { id: TextTransition; ms: number; play: number };
}

/*
 * The projector's entrances (src/output.css, `.tx-*`), at this canvas's size.
 *
 * Same keyframes, same easing, same "opacity plus one thing" — but the wall's
 * numbers are in ITS units and have to be restated in ours, or a preview a
 * quarter the size would rise four times as far and blur four times as hard
 * as the thing it is previewing. The picture is a size container, so:
 *   rise  1.6vh on the wall is 1.6% of the screen's height → 1.6cqh
 *   blur  14px on a 1080-line wall is 14/1080 of its height → 1.3cqh
 *   zoom  a ratio, so it is the same number
 * Keep these three in step with output.css; nothing else can.
 */
const TX_CSS = `
  .tri-tx { animation-duration: var(--tri-tx-ms, 450ms); animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1); animation-fill-mode: both; }
  .tri-tx-fade { animation-name: tri-tx-fade; }
  .tri-tx-rise { animation-name: tri-tx-rise; }
  .tri-tx-blur { animation-name: tri-tx-blur; }
  .tri-tx-zoom { animation-name: tri-tx-zoom; }
  .tri-tx-cut { animation: none; }
  @keyframes tri-tx-fade { from { opacity: 0; } }
  @keyframes tri-tx-rise { from { opacity: 0; transform: translateY(1.6cqh); } }
  @keyframes tri-tx-blur { from { opacity: 0; filter: blur(1.3cqh); } }
  @keyframes tri-tx-zoom { from { opacity: 0; transform: scale(0.965); } }
  @media (prefers-reduced-motion: reduce) { .tri-tx { animation-name: tri-tx-fade !important; } }
`;

/*
 * The four corners of the guide, as things to grab.
 *
 * sx / sy say which way is INWARD for that corner: from the top-left, right
 * and down close the rectangle; from the bottom-right, left and up do.
 * The cursor is the diagonal the corner actually travels along.
 */
const CORNERS = [
  { id: 'tl', sx: 1, sy: 1, at: 'top-0 left-0', tick: 'border-t-2 border-l-2', cursor: 'nwse-resize' },
  { id: 'tr', sx: -1, sy: 1, at: 'top-0 right-0', tick: 'border-t-2 border-r-2', cursor: 'nesw-resize' },
  { id: 'bl', sx: 1, sy: -1, at: 'bottom-0 left-0', tick: 'border-b-2 border-l-2', cursor: 'nesw-resize' },
  { id: 'br', sx: -1, sy: -1, at: 'bottom-0 right-0', tick: 'border-b-2 border-r-2', cursor: 'nwse-resize' },
] as const;

/* Big enough to hit without aiming. The tick it sits over is 8px; this is the
   target, centred on the corner, and it draws nothing. */
const CORNER_HIT = 28;

/** 7, 7.5 — never 7.0. */
const pctLabel = (v: number) => String(Math.round(v * 10) / 10);

/*
 * The nine fields the themes editor writes. Declared here rather than
 * imported from the screen, because the renderer is the thing that decides
 * what it can be told — the editor is one caller of it, not its owner.
 */
export interface SlideTheme {
  backgroundId: string;
  dimness: number;
  blur: number;
  shadow: number;
  font: string;
  /** The scripture body. */
  size: number;
  /** The reference line (John 3:16) — its own size, not a scale of the body. */
  verseSize: number;
  /** Space between the body and the reference, in ems of the body. */
  refGap: number;
  layout: string;
  safeMargin: number;
}

export function SlideCanvas({
  theme,
  slide = null,
  empty,
  guide = false,
  screen = 'live',
  chrome,
  seated = false,
  onSafeMargin,
  onSafeDrag,
  onRefGap,
  onRefGapDrag,
  refGapRange = { min: 0, max: 3, step: 0.05 },
  safeRange = { min: 3, max: 20, step: 0.5 },
  transition,
}: SlideCanvasProps) {
  const library = useMediaLibrary();
  const media = library.find((item) => item.id === theme.backgroundId) ?? library[0];
  const atBottom = theme.layout !== 'top';
  const justifyContent = atBottom ? 'flex-end' : 'flex-start';
  const alignItems =
    theme.layout === 'bottom-left' ? 'flex-start' : theme.layout === 'bottom-right' ? 'flex-end' : 'center';
  const textAlign =
    theme.layout === 'bottom-left' ? 'left' : theme.layout === 'bottom-right' ? 'right' : 'center';
  const fontFamily = theme.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'var(--tri-font, Roboto, sans-serif)';
  const textTransform = theme.font === 'uppercase' ? 'uppercase' : undefined;

  /* 'clear' is the app's word for background-only — the words go, the
     picture stays. Black and logo are covers and handled further down. */
  const words = screen === 'live' && slide;

  /*
   * Dragging a corner.
   *
   * The margin is ONE number — the wall insets all four sides by it — so
   * there is nothing to drag but that, and whichever corner is held the other
   * three move with it. The pointer's travel is read against the canvas, not
   * the screen: the inset is a percentage of the picture's width across and
   * of its height down, so a drag is turned into "percent of width inward"
   * and "percent of height inward" and the two are averaged. That average is
   * the pointer's travel projected onto the corner's own diagonal — movement
   * along it counts in full, movement square to it counts for nothing, which
   * is what a corner that can only slide along one line should do.
   *
   * Measured from where the press began (not from the pointer's absolute
   * position) so the corner does not jump to the cursor on grab, and the
   * pointer is captured so the drag survives leaving the 28px target, which
   * it does immediately.
   */
  const pictureRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ x: number; y: number; margin: number; sx: number; sy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggable = guide && !!onSafeMargin;

  const onCornerDown = (e: ReactPointerEvent<HTMLSpanElement>, sx: number, sy: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { x: e.clientX, y: e.clientY, margin: theme.safeMargin, sx, sy };
    setDragging(true);
    onSafeDrag?.(true);
  };
  const onCornerMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const g = grab.current;
    const rect = pictureRef.current?.getBoundingClientRect();
    if (!g || !rect || rect.width === 0 || rect.height === 0) return;
    const across = (((e.clientX - g.x) * g.sx) / rect.width) * 100;
    const down = (((e.clientY - g.y) * g.sy) / rect.height) * 100;
    const raw = g.margin + (across + down) / 2;
    const snapped = Math.round(raw / safeRange.step) * safeRange.step;
    const next = Math.min(safeRange.max, Math.max(safeRange.min, snapped));
    if (next !== theme.safeMargin) onSafeMargin?.(next);
  };
  const onCornerUp = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!grab.current) return;
    grab.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    onSafeDrag?.(false);
  };

  /*
   * Dragging the reference.
   *
   * Same bargain as the corners: the thing you move on the picture is the
   * thing the slider sets, so either one can drive it and the other follows.
   * Travel is read DOWN the picture and converted to ems of the body text,
   * because that is the unit the gap is stored in — a gap in pixels would
   * mean something different on the preview than on a 1080-line wall.
   *
   * Sign: with the verse above the reference (the bottom layouts) dragging
   * DOWN opens the gap; with the reference above (the top layout) dragging
   * down closes it. refSign is that, so the reference always follows the
   * pointer rather than running away from it.
   */
  const refGrab = useRef<{ y: number; gap: number } | null>(null);
  const [refDragging, setRefDragging] = useState(false);
  const refDraggable = guide && !!onRefGap;
  const refSign = atBottom ? 1 : -1;

  const onRefDown = (e: ReactPointerEvent<HTMLParagraphElement>) => {
    if (e.button !== 0 || !refDraggable) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    refGrab.current = { y: e.clientY, gap: theme.refGap };
    setRefDragging(true);
    onRefGapDrag?.(true);
  };
  const onRefMove = (e: ReactPointerEvent<HTMLParagraphElement>) => {
    const g = refGrab.current;
    if (!g) return;
    /* The body's computed px size is the em the gap is measured in. */
    const em = Math.max(17, 27 + theme.size * 2);
    const moved = ((e.clientY - g.y) * refSign) / em;
    const snapped = Math.round((g.gap + moved) / refGapRange.step) * refGapRange.step;
    const next = Math.min(refGapRange.max, Math.max(refGapRange.min, snapped));
    if (next !== theme.refGap) onRefGap?.(next);
  };
  const onRefUp = (e: ReactPointerEvent<HTMLParagraphElement>) => {
    if (!refGrab.current) return;
    refGrab.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setRefDragging(false);
    onRefGapDrag?.(false);
  };

  const picture = (
    <div
      ref={pictureRef}
      className="relative h-full w-full overflow-hidden [corner-shape:var(--tri-corner)]"
      style={{
        /* A size container so the entrance keyframes can be stated as a
           fraction of THIS screen, the way the wall states them as a
           fraction of itself. Safe: the caller always gives the picture
           both dimensions. */
        containerType: 'size',
        /* Concentric either way — the outer radius less whatever stands
           between this corner and that one: the card's inset when framed,
           the panel's gutter when seated. */
        borderRadius: `calc(var(--tri-radius-surface) - var(${seated ? '--tri-gap' : '--tri-card-gap'}))`,
      }}
    >
      <img
        src={mediaSrc(media)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: `blur(${theme.blur}px)`, transform: theme.blur > 0 ? 'scale(1.04)' : undefined }}
      />
      <span aria-hidden className="absolute inset-0 bg-black" style={{ opacity: theme.dimness / 100 }} />
      {/* Editor-only guide: the projector never draws this line. It makes
          the exact area the safe-margin slider reserves visible here. */}
      {guide && (
        <span
          aria-hidden
          className="pointer-events-none absolute z-10 border border-dashed border-white/40"
          /*
           * THE safe rectangle — and the words' box below is positioned by
           * the identical declaration, on purpose. `inset: N%` is N% of the
           * width across and N% of the HEIGHT down, which is what the wall
           * does (.output-stage in src/output.css). Percentage PADDING is
           * N% of the width on all four sides — a different, squarer
           * rectangle — and a text box laid out with one inside a guide
           * drawn with the other is a verse that is visibly off-centre in
           * the area it is supposed to demonstrate. One source, stated twice.
           */
          style={{ inset: `${theme.safeMargin}%` }}
        >
          {CORNERS.map((c) => (
            <span
              key={c.id}
              className={`absolute ${c.at} h-2 w-2 ${c.tick}`}
              style={{
                /* Centred on the guide's own corner, the way the hit target
                   is, so the tick and the thing you grab are one place. */
                transform: `translate(${c.sx > 0 ? '-50%' : '50%'}, ${c.sy > 0 ? '-50%' : '50%'})`,
                borderColor: 'var(--tri-accent-yellow)',
              }}
            />
          ))}
          {/* Inside the rectangle once the margin is too thin to hold it
              above: at 3% there is no room over the line, and the picture
              clips whatever is put there. */}
          <span
            className={`absolute left-0 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[9px] lowercase tracking-wide shadow-sm ${
              theme.safeMargin < 6 ? 'top-1 ml-1' : '-top-4'
            }`}
            style={{ color: dragging ? 'var(--tri-accent-yellow)' : 'rgb(255 255 255 / 0.8)' }}
          >
            safe area · {pctLabel(theme.safeMargin)}%
          </span>
        </span>
      )}

      <div
        className="absolute flex flex-col"
        style={{
          inset: `${theme.safeMargin}%`,
          justifyContent,
          alignItems,
          textAlign,
        }}
      >
        {words ? (
          <div
            /* Re-mounted when `play` changes, which is what replays the
               entrance — the same trick the wall uses on .output-enter.
               max-w-full, not the 92% this had: the safe rectangle IS the
               limit, the wall lets a line run to it, and a second, invisible
               margin inside the drawn one made the preview wrap earlier than
               the room would see. */
            key={transition ? `tx-${transition.play}` : undefined}
            className={`flex max-w-full flex-col text-white ${transition ? `tri-tx tri-tx-${transition.id}` : ''}`}
            style={{
              ...(transition ? ({ '--tri-tx-ms': `${transition.ms}ms` } as React.CSSProperties) : null),
              fontFamily,
              fontSize: `${Math.max(17, 27 + theme.size * 2)}px`,
              fontWeight: 500,
              lineHeight: 1.2,
              textTransform,
              textShadow: `0 2px ${Math.round(5 + theme.shadow / 7)}px rgb(0 0 0 / ${Math.min(0.92, 0.25 + theme.shadow / 110)})`,
              alignItems: alignItems === 'flex-start' ? 'flex-start' : alignItems === 'flex-end' ? 'flex-end' : 'center',
            }}
          >
            {!atBottom && slide.reference && (
              <p
                className="m-0 font-semibold tracking-[0.08em] opacity-75"
                onPointerDown={onRefDown}
                onPointerMove={onRefMove}
                onPointerUp={onRefUp}
                onPointerCancel={onRefUp}
                style={{
                  /* Its OWN size, off the container's em, so the two sliders
                     never pull on each other: verseSize moves this line and
                     nothing else. */
                  fontSize: `${Math.max(0.28, 0.46 + theme.verseSize * 0.035)}em`,
                  marginBottom: `${theme.refGap}em`,
                  cursor: refDraggable ? 'ns-resize' : undefined,
                  touchAction: refDraggable ? 'none' : undefined,
                  color: refDragging ? 'var(--tri-accent-yellow)' : undefined,
                }}
              >
                {slide.reference}
              </p>
            )}
            {/* The body is the container's own em — `size` sets it up on the
                wrapper — so nothing here scales it a second time. The margin
                is only ever the space BETWEEN body lines; the space to the
                reference belongs to the reference, above or below. */}
            {slide.lines.map((line, i) => (
              <p key={`${line.version}-${i}`} className={i > 0 ? 'mt-[0.45em] mb-0' : 'm-0'}>
                {line.text}
              </p>
            ))}
            {atBottom && slide.reference && (
              <p
                className="m-0 font-semibold tracking-[0.08em] opacity-75"
                onPointerDown={onRefDown}
                onPointerMove={onRefMove}
                onPointerUp={onRefUp}
                onPointerCancel={onRefUp}
                style={{
                  fontSize: `${Math.max(0.28, 0.46 + theme.verseSize * 0.035)}em`,
                  marginTop: `${theme.refGap}em`,
                  cursor: refDraggable ? 'ns-resize' : undefined,
                  touchAction: refDraggable ? 'none' : undefined,
                  color: refDragging ? 'var(--tri-accent-yellow)' : undefined,
                }}
              >
                {slide.reference}
              </p>
            )}
          </div>
        ) : screen === 'live' && empty ? (
          /* Not styled like scripture: an empty stage is chrome talking
             to the operator, and setting "nothing staged" in the
             projector's own face would read for a second as something
             that had gone out to the room. */
          <span className="text-[length:var(--tri-size-xs)] lowercase text-white/38">{empty}</span>
        ) : null}
      </div>

      {/*
        The covers. Black kills the screen and logo puts the church's mark
        on black — both are opaque, both sit over everything including the
        picture, which is the difference between them and 'clear'.
      */}
      {(screen === 'black' || screen === 'logo') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          {screen === 'logo' && (
            <span className="text-[length:var(--tri-size-sm)] uppercase tracking-[0.3em] text-white/30">
              logo
            </span>
          )}
        </div>
      )}

      {/* The grab targets. Siblings of the guide rather than children: the
          guide is pointer-events-none so it can never eat a click meant for
          the picture, and these are the four spots where that is reversed.
          Above everything, because a corner at a thin margin sits under the
          hairline layer and at a fat one sits under the words. */}
      {draggable &&
        CORNERS.map((c) => (
          <span
            key={c.id}
            role="presentation"
            title="drag to set the safe margin"
            onPointerDown={(e) => onCornerDown(e, c.sx, c.sy)}
            onPointerMove={onCornerMove}
            onPointerUp={onCornerUp}
            onPointerCancel={onCornerUp}
            className="absolute z-20 touch-none select-none"
            style={{
              width: CORNER_HIT,
              height: CORNER_HIT,
              cursor: c.cursor,
              [c.sx > 0 ? 'left' : 'right']: `calc(${theme.safeMargin}% - ${CORNER_HIT / 2}px)`,
              [c.sy > 0 ? 'top' : 'bottom']: `calc(${theme.safeMargin}% - ${CORNER_HIT / 2}px)`,
            }}
          />
        ))}
      {transition && <style>{TX_CSS}</style>}

      {/* Over the cover on purpose: the pager still has to be readable
          when the screen is black, or the operator loses their place in
          the reading at exactly the moment they cannot see it. */}
      {chrome && <div className="absolute bottom-0 left-0 right-0 p-2">{chrome}</div>}
      {/* Seated, the card's hairline went with the card, and a dark picture
          on a dark panel loses its edge without one. Its own layer, last:
          an inset shadow on the box itself is painted UNDER the picture. */}
      {seated && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 [corner-shape:var(--tri-corner)]"
          style={{ borderRadius: 'inherit', boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.12)' }}
        />
      )}
    </div>
  );

  if (seated) return picture;

  return (
    /*
     * The projector, as its own surface — no left padding standing in for a
     * gutter now that the row spaces itself on --tri-gap.
     *
     * The frame is --tri-card-gap on every side and the screen inside it is
     * drawn at `--tri-radius-surface - --tri-card-gap`, which is the
     * concentric-corner rule: an inner corner offset inward by the frame
     * width stays parallel to the outer one the whole way round. Any other
     * inner radius and the two curves cross, which is what makes a framed
     * screen look glued in rather than seated.
     */
    <div className="flex h-full min-h-0 min-w-0 items-center justify-center">
      <div
        className="tri-rounded-surface relative overflow-hidden bg-[rgb(255_255_255_/_0.032)] p-[var(--tri-card-gap)]"
        style={{
          /*
           * The FRAME takes the screen's shape rather than the row's height.
           *
           * Filling the row and centring a 16/9 screen inside it left 5px of
           * frame at the sides and 33px top and bottom — and a frame of two
           * different widths cannot have concentric corners at any single
           * inner radius, which is why the curves visibly disagreed. The
           * inset has to be the same number on all four sides for
           * `radius - inset` to hold, so the box is sized by its contents:
           * a 16/9 screen plus --tri-card-gap of frame all round.
           *
           * It takes the row's full height and derives its width from that,
           * capped at the half's width so a wide row cannot push it past its
           * own column. Equal-height with the editor when the row is the
           * limit, equal-width when the column is.
           */
          height: '100%',
          maxWidth: '100%',
          aspectRatio: 'calc(16 / 9)',
          boxShadow: 'inset 0 0 0 var(--tri-border) rgb(255 255 255 / 0.12)',
        }}
      >
        {/*
          The screen fills the frame exactly — the frame is already 16/9 plus
          the inset, so there is nothing left over to centre in. That is what
          makes the corner arithmetic true: --tri-card-gap on all four sides,
          inner radius at `--tri-radius-surface - --tri-card-gap`, the two
          curves parallel the whole way round.
        */}
        {picture}
      </div>
    </div>
  );
}
