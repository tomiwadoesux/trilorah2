import type { ReactNode } from 'react';
import type { VerseSlide } from '../../../shared/verseDisplay';
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
}

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
  size: number;
  verseSize: number;
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
}: SlideCanvasProps) {
  const library = useMediaLibrary();
  const media = library.find((item) => item.id === theme.backgroundId) ?? library[0];
  const atBottom = theme.layout !== 'top';
  const justifyContent = atBottom ? 'flex-end' : 'flex-start';
  const alignItems =
    theme.layout === 'bottom-left' ? 'flex-start' : theme.layout === 'bottom-right' ? 'flex-end' : 'center';
  const fontFamily = theme.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'var(--tri-font, Roboto, sans-serif)';
  const textTransform = theme.font === 'uppercase' ? 'uppercase' : undefined;

  /* 'clear' is the app's word for background-only — the words go, the
     picture stays. Black and logo are covers and handled further down. */
  const words = screen === 'live' && slide;

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
        <div
          className="relative h-full w-full overflow-hidden [corner-shape:var(--tri-corner)]"
          style={{ borderRadius: 'calc(var(--tri-radius-surface) - var(--tri-card-gap))' }}
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
              className="pointer-events-none absolute border border-dashed border-white/35"
              style={{ inset: `${theme.safeMargin}%` }}
            >
              <span className="absolute -top-4 left-0 rounded bg-black/45 px-1 text-[9px] lowercase text-white/65">
                safe area
              </span>
            </span>
          )}

          <div
            className="absolute inset-0 flex"
            style={{
              padding: `${theme.safeMargin}%`,
              justifyContent,
              alignItems,
              textAlign: theme.layout === 'bottom-left' ? 'left' : 'center',
            }}
          >
            {words ? (
              <div
                className="max-w-[92%] text-white"
                style={{
                  fontFamily,
                  fontSize: `${Math.max(17, 27 + theme.size * 2)}px`,
                  fontWeight: 500,
                  lineHeight: 1.2,
                  textTransform,
                  textShadow: `0 2px ${Math.round(5 + theme.shadow / 7)}px rgb(0 0 0 / ${Math.min(0.92, 0.25 + theme.shadow / 110)})`,
                }}
              >
                {/*
                  The reference only when the slide carries one. buildVerseSlides
                  decides that — referenceMode puts it on the first slide, the
                  last, every one, or none — and a renderer that printed it
                  regardless would be showing the operator a slide the
                  projector is not going to draw.
                */}
                {slide.reference && (
                  <p className="m-0 text-[0.46em] font-semibold tracking-[0.08em] opacity-75">{slide.reference}</p>
                )}
                {/* One paragraph per translation. A parallel reading is two
                    lines here and two lines on the wall. */}
                {slide.lines.map((line, i) => (
                  <p
                    key={`${line.version}-${i}`}
                    className={slide.reference || i > 0 ? 'mt-[0.45em] mb-0' : 'm-0'}
                    style={{ fontSize: `${Math.max(0.72, 1 + theme.verseSize * 0.08)}em` }}
                  >
                    {line.text}
                  </p>
                ))}
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

          {/* Over the cover on purpose: the pager still has to be readable
              when the screen is black, or the operator loses their place in
              the reading at exactly the moment they cannot see it. */}
          {chrome && <div className="absolute bottom-0 left-0 right-0 p-2">{chrome}</div>}
        </div>
      </div>
    </div>
  );
}
