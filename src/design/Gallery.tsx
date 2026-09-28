import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { REGISTRY, ALL_ENTRIES, findEntry } from './registry';
import { CloseIcon, ExpandIcon } from '../ui';
import {
  SCREENS,
  SCREEN_TOTAL,
  isScreenId,
  findScreen,
  ALL_SCREEN_STATES,
  allSizes,
  tierForWidth,
  ArtboardProvider,
  type ArtboardSize,
} from './screens/registry';

/*
 * The sandbox shell.
 *
 * Runs in its own Electron window beside the real app, off the same Vite
 * server — so editing a component hot-reloads the specimen sheet and the
 * live screen at the same instant. The toolbar drives the two foundation
 * decisions that cannot be made on paper: booth mode (F-02) and density
 * (F-05).
 *
 * Two surfaces, one window:
 *
 *   Sheets   every variant of one component at once, zoomable to 8× —
 *            the question is "is this component right".
 *   Screens  one full app screen at 1400×900 with a state bar — the
 *            question is "does the app work".
 *
 * They need opposite chrome, which is why this is a mode and not another
 * registry group: a 240px nav is essential for scanning 200 components and
 * fatal for a 1400px screen in a 1400px window. The surface is read off the
 * hash — `S-*` means Screens — so every deep link keeps working and the
 * switcher is only a shortcut.
 */

type Theme = 'light' | 'dark';
type Density = 'compact' | 'comfortable' | 'touch';
type Surface = 'sheets' | 'screens';
type ZoomMode = 'fit' | 'width' | 'manual';

const DENSITIES: Density[] = ['compact', 'comfortable', 'touch'];

/*
 * F-05. The two axes of the Screens surface are size and tier, and they are
 * independent: a big window does not have to mean big controls, which is
 * exactly the question this pairing exists to answer.
 */
const TIER_NOTE: Record<Density, string> = {
  compact: 'A 13" laptop lid, close up — smallest controls the system offers',
  comfortable: 'The default — a laptop on a desk, or a small monitor',
  touch: 'A booth monitor read at arm\'s length or standing',
};

/*
 * Trilorah is a booth product — every screen is designed against the dark
 * ground. Light mode stays in the toolbar as a reminder that F-02 is still
 * open, but it is inert until we actually design it.
 */
const THEME: Theme = 'dark';

/** Zoom, for reading a specimen against the Figma frame pixel for pixel. */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;
/* 1× is the readout itself — click it to come back to actual size. */
const ZOOM_PRESETS = [2, 4, 8];
/** One notch of ⌘+ / ⌘− — a fifth of an octave, so steps feel even at any scale. */
const ZOOM_NOTCH = 2 ** (1 / 5);

/*
 * Clamp, and snap to 1 when close. Without the detent, ⌘-scroll leaves you
 * at 98% or 103% — near enough to look right, far enough that you are no
 * longer measuring true pixels, and with no way to tell by eye.
 */
const clampZoom = (z: number) => {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  return Math.abs(clamped - 1) < 0.04 ? 1 : clamped;
};

const isActualSize = (z: number) => z === 1;

/** Canvas widths worth checking — the app window, and the two panel columns. */
const WIDTHS: [string, number | null][] = [
  ['full', null],
  ['app 1400', 1400],
  ['column 640', 640],
  ['panel 380', 380],
];

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

/**
 * The room the canvas actually has, in CSS px.
 *
 * Returned as a box rather than a scale because there are two useful ways
 * to size an artboard against it and they disagree: `fit` shows the whole
 * screen at once, `width` gives the screen the full width of the canvas and
 * lets it run off the bottom. Only the caller knows which question is being
 * asked.
 *
 * `padKey` is in the deps because the canvas padding changes with the mode,
 * and a padding change moves the content box without moving the border box
 * — so ResizeObserver never fires for it.
 */
function useCanvasBox(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  padKey: string,
): { w: number; h: number } {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const measure = () => {
      const style = getComputedStyle(el);
      setBox({
        w: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        h: el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled, padKey]);
  return box;
}

export function Gallery() {
  const hash = useHashRoute();
  const surface: Surface = isScreenId(hash) ? 'screens' : 'sheets';

  const entry = findEntry(hash || null);
  const { screen, state } = findScreen(hash);

  /* Seeded from the window rather than pinned to `comfortable`. Picking an
     artboard adopts that size's tier (see the effect below), but until one is
     picked the artboard is the window itself — and judging it at a tier the
     window would never use is what made a wide display read as tiny type.
     The tier control still overrides this; it is a starting point, not a
     lock. */
  const [density, setDensity] = useState<Density>(() => tierForWidth(window.innerWidth));
  const [width, setWidth] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  /*
   * How the artboard is sized against the canvas.
   *
   *   width   the screen spans the full width of the canvas and scrolls
   *           vertically — the default, because a screen is reviewed by
   *           reading it, and reading wants the type as large as the
   *           canvas can carry.
   *   fit     the whole screen at once, for judging the composition.
   *   manual  whatever you last zoomed to.
   */
  const [zoomMode, setZoomMode] = useState<ZoomMode>('width');

  /*
   * The window the app is pretending to be. Computed once — `allSizes`
   * reads window.screen for the "this display" entry, which cannot change
   * without the window moving to another monitor.
   */
  const sizes = useMemo(() => allSizes(), []);
  const [size, setSize] = useState<ArtboardSize>(sizes[0]);

  /*
   * Fullscreen is not a bigger preview — it is the app.
   *
   * On the Screens surface it hands the whole display to the artboard at
   * 1:1: the size becomes the window we are actually in, the zoom becomes
   * 100%, and every piece of sandbox chrome leaves. What is on the glass is
   * then exactly what an operator sees with the app maximised on this
   * machine, which is the only way to judge whether the layout works — a
   * 2560-wide screen fitted into a 1400-wide window is 55%, and nobody can
   * judge type at 55%.
   *
   * The chrome is not destroyed, only lifted off the top edge. Push the
   * pointer into the top strip and it comes back down, with the fullscreen
   * button now reading ✕ — so leaving is the same gesture as leaving any
   * other window, rather than a keystroke you have to know. Esc still works.
   */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chromeHover, setChromeHover] = useState(false);
  useEffect(() => {
    const onChange = () => {
      const on = !!document.fullscreenElement;
      setIsFullscreen(on);
      /* Leaving with Esc must not strand the chrome in its hover state. */
      if (!on) setChromeHover(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    /* Inside Electron the window is fullscreened natively — the HTML API
       was refusing the request there. In a plain browser it still works. */
    const native = window.api?.toggleWindowFullscreen;
    if (native) {
      void native().then((on) => {
        setIsFullscreen(on);
        if (!on) setChromeHover(false);
      });
      return;
    }
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  /*
   * The real window, measured — not window.screen.
   *
   * screen.width is the display; what the artboard has to match is what the
   * app is given, which differs by whatever the OS keeps for itself. Reading
   * the viewport means the fullscreen artboard is exactly the box the app
   * would get, with no scrollbar and no letterbox at the bottom edge.
   */
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* Coming back to a surface should land where you left it, not at the top. */
  const lastSheet = useRef(ALL_ENTRIES[0].id);
  const lastScreen = useRef(ALL_SCREEN_STATES[0]);
  useEffect(() => {
    if (!hash) return;
    if (surface === 'screens') lastScreen.current = hash;
    else lastSheet.current = hash;
  }, [hash, surface]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = THEME;
    root.dataset.density = density;
    root.dataset.surface = surface;
  }, [density, surface]);

  // ⌘K-less quick nav: j/k step through the sheet list — or, on the Screens
  // surface, through the states of the screen you are looking at.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const list = surface === 'screens' ? ALL_SCREEN_STATES : ALL_ENTRIES.map((x) => x.id);
      const current = surface === 'screens' ? state.id : entry.id;
      const i = list.indexOf(current);
      const next = list[e.key === 'j' ? i + 1 : i - 1];
      if (next) window.location.hash = next;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entry.id, state.id, surface]);

  // + / − / 0 zoom the specimens only. Unmodified on purpose: ⌘+ belongs to
  // Electron's default View menu, which zooms the whole window — chrome and
  // all — and that defeats the point of measuring a specimen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === '=' || e.key === '+') {
        setZoomMode('manual');
        setZoom((z) => clampZoom(z * ZOOM_NOTCH));
      } else if (e.key === '-' || e.key === '_') {
        setZoomMode('manual');
        setZoom((z) => clampZoom(z / ZOOM_NOTCH));
      } else if (e.key === '0') {
        setZoomMode('manual');
        setZoom(1);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Pinch / ⌘-scroll over the canvas. Trackpad pinch arrives as a wheel event
  // with ctrlKey set, so the same handler covers both.
  const canvasRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomMode('manual');
      setZoom((z) => clampZoom(z * Math.exp(-e.deltaY / 300)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /*
   * Immersive — Screens, fullscreen, artboard = window. The Sheets surface
   * is excluded on purpose: a specimen sheet fullscreen is just a taller
   * page, and hiding the nav there would only lose you the list.
   */
  const immersive = surface === 'screens' && isFullscreen;
  const displayBoard = useMemo<ArtboardSize>(
    () => ({
      id: 'display',
      label: 'this display',
      w: viewport.w,
      h: viewport.h,
      tier: tierForWidth(viewport.w),
      note: `The window as it actually is right now — ${viewport.w} × ${viewport.h}`,
      full: true,
    }),
    [viewport.w, viewport.h],
  );
  /* What is being drawn. Everything downstream reads this rather than
     `size`, so fullscreen cannot leave one measurement behind. */
  const board = immersive ? displayBoard : size;

  const auto = zoomMode !== 'manual';
  const box = useCanvasBox(canvasRef, surface === 'screens', immersive ? 'immersive' : zoomMode);
  const fitScale = box.w ? Math.min(box.w / board.w, box.h / board.h) : 1;
  const widthScale = box.w ? box.w / board.w : 1;
  const autoScale = Math.min(ZOOM_MAX, Math.max(0.1, zoomMode === 'fit' ? fitScale : widthScale));
  /* 1:1 in immersive, always. A scaled fullscreen is a lie about type size. */
  const effectiveZoom = immersive ? 1 : surface === 'screens' && auto ? autoScale : zoom;

  const built = ALL_ENTRIES.length;
  const total = REGISTRY.reduce((n, g) => n + g.total, 0);

  const go = (next: Surface) => {
    window.location.hash = next === 'screens' ? lastScreen.current : lastSheet.current;
    setZoomMode(next === 'screens' ? 'width' : 'manual');
    if (next === 'sheets') setZoom(1);
  };

  const screens = surface === 'screens';

  return (
    <div className={screens ? 'flex h-screen flex-col bg-paper text-ink' : 'min-h-screen bg-paper text-ink'}>
      {/* ---------------------------------------------------------- */}
      {/* Nav — sheets only. On Screens the window belongs to the      */}
      {/* artboard, so the screen list moves into the toolbar.         */}
      {/* ---------------------------------------------------------- */}
      {!screens && (
        <aside
          data-gallery-chrome
          className="fixed inset-y-0 left-0 w-60 overflow-y-auto border-r border-hairline bg-surface"
        >
          <div className="border-b border-hairline px-4 py-3">
            <div className="text-sm font-bold tracking-[0.3em]">TRILORAH</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-widest text-neutral-400">
              design sandbox
            </div>
            <div className="mt-2 font-mono text-[10px] text-neutral-400">
              {built} / {total} built
            </div>
          </div>

          <nav className="py-2">
            {REGISTRY.map((group) => (
              <div key={group.title} className="mb-3">
                <div className="flex items-baseline justify-between px-4 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                    {group.title}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-300">
                    {group.entries.length}/{group.total}
                  </span>
                </div>
                {group.entries.map((e) => {
                  const active = e.id === entry.id;
                  return (
                    <a
                      key={e.id}
                      href={`#${e.id}`}
                      className={`flex items-baseline gap-x-2 px-4 py-1.5 text-xs transition-colors ${
                        active
                          ? 'bg-accent text-[var(--color-on-accent)]'
                          : 'text-neutral-500 hover:text-ink'
                      }`}
                    >
                      <span className="font-mono text-[10px] opacity-60">{e.id}</span>
                      <span>{e.title}</span>
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>

          <p className="px-4 pb-6 text-[10px] leading-relaxed text-neutral-400">
            j / k to step through sheets. + / − / 0 or ⌘-scroll to zoom the canvas.
            Full list in design/UI-INVENTORY.md.
          </p>
        </aside>
      )}

      {/* ---------------------------------------------------------- */}
      {/* Toolbar + canvas                                            */}
      {/* ---------------------------------------------------------- */}
      <div className={screens ? 'flex min-h-0 flex-1 flex-col' : 'ml-60'}>
        {/* ---------------------------------------------------------- */}
        {/* The chrome, as one block.                                   */}
        {/* Grouped only so fullscreen can lift the toolbar and the     */}
        {/* state bar off the top edge together — they are one strip to */}
        {/* the eye, and sliding them separately would look like two    */}
        {/* things arriving. `contents` outside fullscreen, so the      */}
        {/* wrapper adds no box to the ordinary layout.                 */}
        {/* ---------------------------------------------------------- */}
        <div
          className={
            immersive
              ? `fixed inset-x-0 top-0 z-50 shadow-[0_18px_40px_rgb(0_0_0_/_0.45)] transition-transform duration-200 ease-out ${
                  chromeHover ? 'translate-y-0' : '-translate-y-full'
                }`
              : 'contents'
          }
          onMouseEnter={immersive ? () => setChromeHover(true) : undefined}
          onMouseLeave={immersive ? () => setChromeHover(false) : undefined}
        >
        <header
          data-gallery-chrome
          className={`${screens ? 'shrink-0' : 'sticky top-0 z-10'} flex items-center gap-x-6 border-b border-hairline bg-surface px-6 py-2`}
        >
          <SurfaceSwitch surface={surface} onChange={go} />

          {screens ? (
            <ToolbarGroup label="screen">
              {SCREENS.map((s) => (
                <ToolbarOption
                  key={s.id}
                  active={s.id === screen.id}
                  onClick={() => {
                    window.location.hash = s.states[0].id;
                  }}
                >
                  {s.id} {s.title}
                </ToolbarOption>
              ))}
              <span className="ml-1 font-mono text-[10px] text-neutral-400">
                {SCREENS.length}/{SCREEN_TOTAL}
              </span>
            </ToolbarGroup>
          ) : null}

          {screens ? (
            /* Labelled by width alone — the names are long and a designer
               reads widths anyway. Full name and reason are in the title. */
            <ToolbarGroup label="tier">
              {DENSITIES.map((d) => (
                <ToolbarOption
                  key={d}
                  active={density === d}
                  onClick={() => setDensity(d)}
                  title={TIER_NOTE[d]}
                >
                  {d}
                </ToolbarOption>
              ))}
            </ToolbarGroup>
          ) : null}

          {screens ? (
            <ToolbarGroup label="size">
              {sizes.map((sz) => (
                <ToolbarOption
                  key={sz.id}
                  /* Nothing here is selected in fullscreen: the display is
                     driving the size, and leaving one of these lit would be
                     the toolbar claiming a width the artboard does not have. */
                  active={!immersive && sz.id === size.id}
                  /* Choosing a size is choosing not to be fullscreen — the
                     two are the same decision made in opposite directions.
                     It also adopts the size's natural tier as the default:
                     judging a 2560 booth monitor at the laptop tier is how
                     "the type is tiny on big screens" happens. The tier
                     control still overrides after. */
                  onClick={() => {
                    setSize(sz);
                    setDensity(sz.tier);
                    if (document.fullscreenElement) void document.exitFullscreen();
                  }}
                  title={`${sz.label} — ${sz.w} × ${sz.h}, opens at the ${sz.tier} tier. ${sz.note}`}
                >
                  {sz.id === 'display' ? 'display' : sz.w}
                </ToolbarOption>
              ))}
            </ToolbarGroup>
          ) : (
            <>
              <ToolbarGroup label="theme">
                {(['light', 'dark'] as Theme[]).map((t) => (
                  <ToolbarOption
                    key={t}
                    active={THEME === t}
                    disabled={t !== THEME}
                    title={t !== THEME ? 'Dark only for now — light mode is not designed yet' : undefined}
                    onClick={() => {}}
                  >
                    {t}
                  </ToolbarOption>
                ))}
              </ToolbarGroup>

              <ToolbarGroup label="density">
                {DENSITIES.map((d) => (
                  <ToolbarOption key={d} active={density === d} onClick={() => setDensity(d)}>
                    {d}
                  </ToolbarOption>
                ))}
              </ToolbarGroup>

              <ToolbarGroup label="width">
                {WIDTHS.map(([label, w]) => (
                  <ToolbarOption key={label} active={width === w} onClick={() => setWidth(w)}>
                    {label}
                  </ToolbarOption>
                ))}
              </ToolbarGroup>
            </>
          )}

          <ToolbarGroup label="zoom">
            {screens && (
              <>
                <ToolbarOption
                  active={zoomMode === 'width'}
                  onClick={() => setZoomMode('width')}
                  title="Give the screen the full width of the canvas — it scrolls if it is taller"
                >
                  width
                </ToolbarOption>
                <ToolbarOption
                  active={zoomMode === 'fit'}
                  onClick={() => setZoomMode('fit')}
                  title="Show the whole screen at once, however small that makes it"
                >
                  fit
                </ToolbarOption>
              </>
            )}
            <ToolbarOption
              active={false}
              onClick={() => {
                setZoomMode('manual');
                setZoom((z) => clampZoom((auto ? autoScale : z) / ZOOM_NOTCH));
              }}
            >
              −
            </ToolbarOption>
            {/* Actual size is the one value worth recognising without reading:
                at 100% the readout takes the accent, so it is unmistakable. */}
            <button
              type="button"
              onClick={() => {
                setZoomMode('manual');
                setZoom(1);
              }}
              title={
                isActualSize(effectiveZoom)
                  ? 'Actual size — 1 canvas px = 1 screen px'
                  : 'Reset to 100% (press 0)'
              }
              className={`w-14 rounded px-1 py-0.5 text-center font-mono text-[10px] font-semibold tabular-nums transition-colors ${
                isActualSize(effectiveZoom)
                  ? 'bg-accent text-[var(--color-on-accent)]'
                  : 'text-neutral-400 hover:text-ink'
              }`}
            >
              {Math.round(effectiveZoom * 100)}%
            </button>
            <ToolbarOption
              active={false}
              onClick={() => {
                setZoomMode('manual');
                setZoom((z) => clampZoom((auto ? autoScale : z) * ZOOM_NOTCH));
              }}
            >
              +
            </ToolbarOption>
            {(screens ? [1, 2] : ZOOM_PRESETS).map((z) => (
              <ToolbarOption
                key={z}
                active={!auto && Math.abs(zoom - z) < 0.001}
                onClick={() => {
                  setZoomMode('manual');
                  setZoom(z);
                }}
              >
                {z}×
              </ToolbarOption>
            ))}
          </ToolbarGroup>

          <div className="ml-auto flex items-center gap-x-3">
            {screens && (
              <>
                <span className="font-mono text-[10px] text-neutral-400">
                  {board.w} × {board.h} · {board.label}
                </span>
                {/* Two jobs, one button, because it is the same idea both
                    ways round: this is the control for whether the artboard
                    owns the display. In it, the glyph is the ✕ every window
                    closes with — you found the strip, the way out is where
                    your eye already is. */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={
                    isFullscreen
                      ? 'Close — back to the sandbox (Esc)'
                      : 'Hand the whole display to the app at 1:1 — the only way to read a 2560-wide screen at a usable scale'
                  }
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                    isFullscreen
                      ? 'text-[#eac7c6] hover:bg-[rgb(234_199_198_/_0.14)]'
                      : 'text-neutral-400 hover:text-ink'
                  }`}
                >
                  {isFullscreen ? <CloseIcon size={12} /> : <ExpandIcon size={12} />}
                  {isFullscreen ? 'close' : 'fullscreen'}
                </button>
              </>
            )}
            <span className="font-mono text-[10px] text-neutral-400">
              {window.api ? 'engine connected' : 'no engine'}
            </span>
          </div>
        </header>

        {/* The state bar. Screens only — this is what replaces the sheet's
            every-variant-at-once, which does not survive at screen size. */}
        {screens && (
          <div
            data-gallery-chrome
            className="shrink-0 border-b border-hairline bg-surface px-6 py-2"
          >
            <div className="flex items-center gap-x-2">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                state
              </span>
              <div className="flex flex-wrap items-center gap-0.5">
                {screen.states.map((st) => (
                  <ToolbarOption
                    key={st.id}
                    active={st.id === state.id}
                    onClick={() => {
                      window.location.hash = st.id;
                    }}
                    title={st.note}
                  >
                    {st.label}
                  </ToolbarOption>
                ))}
              </div>
              <span className="ml-2 shrink-0 font-mono text-[10px] text-neutral-400">
                {state.id}
              </span>
            </div>
            <p className="mt-1.5 max-w-4xl text-[11px] leading-relaxed text-neutral-400">
              {state.note}
            </p>
          </div>
        )}
        </div>

        {/* The reveal strip. Four pixels of the top edge, which is the same
            place a Mac puts its own hidden menu bar — so the gesture is one
            the hand already knows. It sits under the chrome's z-index, so
            once the toolbar is down the pointer is over the toolbar and the
            strip cannot fight it for the hover. */}
        {immersive && (
          <div
            className="fixed inset-x-0 top-0 z-40 h-1"
            onMouseEnter={() => setChromeHover(true)}
          />
        )}

        <main
          ref={canvasRef}
          className={
            screens
              ? `min-h-0 flex-1 ${immersive ? 'overflow-hidden p-0' : `overflow-auto ${zoomMode === 'width' ? 'p-0' : 'p-6'}`}`
              : 'px-10 py-10'
          }
        >
          {screens ? (
            <div className="flex justify-center">
              {/* Bare in fullscreen: the drop shadow and the 10px corner are
                  what say "this is a window sitting on a canvas", and in
                  fullscreen it is not sitting on anything. */}
              <Artboard zoom={effectiveZoom} w={board.w} h={board.h} bare={immersive}>
                <ArtboardProvider value={board}>
                  <screen.Component state={state.id} />
                </ArtboardProvider>
              </Artboard>
            </div>
          ) : (
            <ZoomCanvas zoom={zoom}>
              <div style={width ? { maxWidth: width } : undefined} className={width ? 'mx-auto' : ''}>
                <entry.Component />
              </div>
            </ZoomCanvas>
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * The one control that moves between the two halves of the sandbox.
 *
 * Deliberately the leftmost thing in the toolbar and the only control that
 * survives both surfaces, so "where am I and how do I get back" is answered
 * in the same place every time.
 */
function SurfaceSwitch({
  surface,
  onChange,
}: {
  surface: Surface;
  onChange: (s: Surface) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-x-0.5 rounded border border-hairline p-0.5">
      {(['sheets', 'screens'] as Surface[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
            surface === s
              ? 'bg-accent text-[var(--color-on-accent)]'
              : 'text-neutral-400 hover:text-ink'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/**
 * A screen at true app size, scaled as a whole.
 *
 * Unlike ZoomCanvas this never reflows: the artboard is pinned to the real
 * window's 1400×900 and only the scale changes, because a screen that
 * reflowed when you zoomed out would be answering a question nobody asked.
 */
function Artboard({
  zoom,
  w,
  h,
  bare = false,
  children,
}: {
  zoom: number;
  w: number;
  h: number;
  /** Fullscreen: no shadow, no corner — the artboard is the whole display. */
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ width: w * zoom, height: h * zoom }} className="shrink-0">
      <div
        style={{
          width: w,
          height: h,
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
          borderRadius: bare ? 0 : 10,
          boxShadow: bare
            ? undefined
            : '0 24px 70px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(255 255 255 / 0.07)',
        }}
        className="overflow-hidden"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Magnifies the specimens without scaling the gallery chrome.
 *
 * A magnifier, deliberately, not a narrower viewport: the content keeps the
 * layout width it has at 100% and is scaled up from there, so a variant
 * matrix at 8× is the same matrix, larger. (Sizing the content at 1/zoom
 * instead would reflow it — four columns crushing into each other as you
 * zoom, which is the opposite of inspecting a specimen. Use the `width`
 * control for reflow; that is what it is for.)
 *
 * `transform` doesn't affect layout, so the sizer box has to be given the
 * scaled dimensions by hand, or the page won't scroll to the far edge of a
 * zoomed sheet.
 */
function ZoomCanvas({ zoom, children }: { zoom: number; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  // The frame stays at the canvas's natural width whatever the zoom, so it
  // is the one safe thing to measure — reading the scaled content instead
  // would feed its own output back in.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame}>
      <div style={{ width: width * zoom, height: height * zoom }}>
        <div
          ref={content}
          style={{
            width: width || undefined,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-x-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </span>
      <div className="flex items-center gap-x-0.5">{children}</div>
    </div>
  );
}

function ToolbarOption({
  active,
  onClick,
  disabled = false,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
        disabled
          ? 'cursor-not-allowed text-neutral-400 opacity-30'
          : active
            ? 'bg-accent text-[var(--color-on-accent)]'
            : 'text-neutral-400 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
