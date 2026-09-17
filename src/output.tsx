import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchVerseParts, formatRef, sameRef } from './lib/verse';
import { buildVerseSlides, type VerseSlide } from '../shared/verseDisplay';
import { formatTimerDisplay } from '../shared/timerDisplay';
import './output.css';

/**
 * The projector / stream / stage window: a transparent surface that fades
 * scripture in and out, applies the church's display theme (Themes tab),
 * and can show presentation slides / media images full-bleed. Multiple
 * outputs are distinguished by ?outputId=…, and each one asks main which
 * *role* it plays (BUILD-MAP 2.11):
 *
 *   projector  full-screen verse over the theme background
 *   stream     lower-third on a transparent canvas — OBS / vMix capture it
 *              with "allow transparency" and the verse rides over the camera
 *   stage      confidence monitor: verse, clock, what's coming next
 *
 * On top of that, the screen state (live / clear / black / logo) and the
 * message-alert bar apply to every role. Everything uses the same theme
 * variables, so a verse, an alert, and the logo card always look like one
 * system — EasyWorship's "one theme, every slide".
 */

const outputId = new URLSearchParams(window.location.search).get('outputId') ?? '';
document.body.dataset.outputId = outputId;

interface Shown {
  detection: VerseDetection;
  /** Slices produced by shared/verseDisplay — null while the text loads. */
  slides: VerseSlide[] | null;
  isPreview: boolean;
}

interface Theme {
  fontFamily: string;
  scale: number;
  weight: number;
  color: string;
  backgroundUrl: string;
  overlayOpacity: number;
  backgroundFit: string;
  backgroundPosition: string;
  logoUrl: string;
  churchName: string;
  streamLayout: 'lower-third' | 'full';
  stageShowClock: boolean;
  stageShowNext: boolean;
  /** How a reading is cut into slides — see shared/verseDisplay.ts. */
  breakOnVerse: boolean;
  showVerseNumbers: boolean;
  referenceMode: 'each' | 'last' | 'first' | 'none';
  showTranslation: boolean;
  maxCharsPerSlide: number;
  secondaryVersion: string;
  stageShowVerseText: boolean;
  stageShowTimer: string;
}

const FONT_PRESETS: Record<string, string> = {
  'display-serif': "Georgia, 'Times New Roman', serif",
  'classic-serif': "'Times New Roman', Georgia, serif",
  'modern-sans': "system-ui, -apple-system, 'Segoe UI', sans-serif",
  'bold-slab': "'Alfa Slab One', Georgia, serif",
  'display-rounded': "'Paytone One', system-ui, sans-serif",
};

const DEFAULT_THEME: Theme = {
  fontFamily: FONT_PRESETS['display-serif'],
  scale: 1,
  // Scripture reads at a distance, over a background: a step above regular.
  weight: 600,
  color: '#ffffff',
  backgroundUrl: '',
  overlayOpacity: 0.3,
  backgroundFit: 'cover',
  backgroundPosition: 'center',
  logoUrl: '',
  churchName: '',
  streamLayout: 'lower-third',
  stageShowClock: true,
  stageShowNext: true,
  breakOnVerse: false,
  showVerseNumbers: false,
  referenceMode: 'each',
  showTranslation: true,
  maxCharsPerSlide: 0,
  secondaryVersion: '',
  stageShowVerseText: true,
  stageShowTimer: '',
};

function themeFromSettings(s: Record<string, unknown>): Theme {
  const preset = typeof s.scriptureFontPreset === 'string' ? s.scriptureFontPreset : 'display-serif';
  return {
    fontFamily:
      FONT_PRESETS[preset] ??
      (typeof s.defaultFontFamily === 'string' && s.defaultFontFamily !== 'serif'
        ? s.defaultFontFamily
        : DEFAULT_THEME.fontFamily),
    scale: typeof s.defaultFontSize === 'number' && s.defaultFontSize > 0 ? s.defaultFontSize : 1,
    weight: typeof s.defaultFontWeight === 'number' ? s.defaultFontWeight : DEFAULT_THEME.weight,
    color: typeof s.defaultTextColor === 'string' && s.defaultTextColor ? s.defaultTextColor : '#ffffff',
    backgroundUrl: typeof s.defaultBackgroundUrl === 'string' ? s.defaultBackgroundUrl : '',
    overlayOpacity:
      typeof s.overlayOpacity === 'number' ? Math.min(1, Math.max(0, s.overlayOpacity)) : 0.3,
    backgroundFit: typeof s.backgroundFit === 'string' && s.backgroundFit ? s.backgroundFit : 'cover',
    backgroundPosition:
      typeof s.backgroundPosition === 'string' && s.backgroundPosition ? s.backgroundPosition : 'center',
    logoUrl: typeof s.churchLogoUrl === 'string' ? s.churchLogoUrl : '',
    churchName: typeof s.churchName === 'string' ? s.churchName : '',
    streamLayout: s.streamLayout === 'full' ? 'full' : 'lower-third',
    stageShowClock: s.stageShowClock !== false,
    stageShowNext: s.stageShowNext !== false,
    breakOnVerse: s.breakOnVerse === true,
    showVerseNumbers: s.showVerseNumbers === true,
    referenceMode:
      s.referenceMode === 'last' || s.referenceMode === 'first' || s.referenceMode === 'none'
        ? s.referenceMode
        : 'each',
    showTranslation: s.showTranslation !== false,
    maxCharsPerSlide: typeof s.maxCharsPerSlide === 'number' && s.maxCharsPerSlide > 0 ? s.maxCharsPerSlide : 0,
    secondaryVersion: typeof s.secondaryVersion === 'string' ? s.secondaryVersion : '',
    stageShowVerseText: s.stageShowVerseText !== false,
    stageShowTimer: typeof s.stageShowTimer === 'string' ? s.stageShowTimer : '',
  };
}

/** The church's display version, for when a detection carries none. */
function primaryVersion(settings: Record<string, unknown>): string {
  return typeof settings.displayVersion === 'string' && settings.displayVersion
    ? settings.displayVersion
    : 'KJV';
}

function useClock(enabled: boolean): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, [enabled]);
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function OutputSurface() {
  // `shown` keeps the last verse during fade-out; `visible` drives opacity.
  const [shown, setShown] = useState<Shown | null>(null);
  const [visible, setVisible] = useState(false);
  const [media, setMedia] = useState<string | null>(null); // data URL
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [role, setRole] = useState<OutputRole>('projector');
  const [screen, setScreen] = useState<ScreenState>('live');
  const [alert, setAlert] = useState<ScreenAlert | null>(null);
  // Stage only: the verse awaiting approval and the engine's queue.
  const [upNext, setUpNext] = useState<VerseDetection | null>(null);
  const [queue, setQueue] = useState<VerseQueueItem[]>([]);
  // Which slice of a multi-slide reading is showing, and the live timers.
  const [slideIndex, setSlideIndex] = useState(0);
  const [timers, setTimers] = useState<TimerSnapshot[]>([]);

  useEffect(() => {
    const api = window.api;
    if (!api) return;

    const loadTheme = () => {
      void api.getSettings().then((s) => setTheme(themeFromSettings(s))).catch(() => undefined);
    };
    loadTheme();
    void api.getOutputRole?.(outputId).then((r) => r && setRole(r)).catch(() => undefined);
    void api.getScreenState?.().then((s) => s && setScreen(s)).catch(() => undefined);
    void api.getAlert?.().then((a) => setAlert(a ?? null)).catch(() => undefined);
    void api.getVerseQueue?.().then((q) => setQueue(q ?? [])).catch(() => undefined);
    void api.listTimers?.().then((t) => setTimers(t ?? [])).catch(() => undefined);

    const display = (detection: VerseDetection, isPreview: boolean) => {
      setMedia(null); // scripture supersedes a slide
      setShown({ detection, slides: null, isPreview });
      setVisible(true);
      setSlideIndex(0);
      setUpNext((n) => (n && sameRef(n, detection) ? null : n));
      // The theme decides how the reading is cut up; this only fetches the
      // words. Read the options from settings at fetch time rather than
      // closing over `theme`, so the effect need not re-subscribe on a theme
      // change (which would drop every engine listener mid-service).
      void (async () => {
        const settings = await api.getSettings().catch(() => null);
        if (!settings) return;
        const opts = themeFromSettings(settings as Record<string, unknown>);
        const primary = await fetchVerseParts(detection);
        if (primary.length === 0) return;
        const secondaryVersion = opts.secondaryVersion;
        const secondaryVerses =
          secondaryVersion && secondaryVersion !== (detection.version ?? primaryVersion(settings))
            ? await fetchVerseParts(detection, secondaryVersion)
            : [];
        const slides = buildVerseSlides(
          {
            book: detection.book,
            chapter: detection.chapter,
            version: detection.version ?? primaryVersion(settings),
          },
          primary,
          {
            breakOnVerse: opts.breakOnVerse,
            showVerseNumbers: opts.showVerseNumbers,
            referenceMode: opts.referenceMode,
            showTranslation: opts.showTranslation,
            maxCharsPerSlide: opts.maxCharsPerSlide,
            secondary:
              secondaryVerses.length > 0
                ? { version: secondaryVersion, verses: secondaryVerses }
                : null,
          },
        );
        setShown((current) =>
          current && sameRef(current.detection, detection) ? { ...current, slides } : current,
        );
      })();
    };

    const subs: ((() => void) | undefined)[] = [
      // Previews stay in the operator's app — the congregation only ever
      // sees a verse after Push to Live (or trusted auto mode) fires
      // on-verse-detected. The stage monitor is the one exception: it shows
      // the pending verse as "up next" so the preacher knows it's coming.
      api.onVerseDetected((d) => display(d, false)),
      api.onVersePreview((d) => setUpNext(d)),
      api.onVerseAutoDismiss(() => setVisible(false)),
      api.onShowCleanBackground(() => {
        setVisible(false);
        setMedia(null);
      }),
      api.onThemeChanged?.(loadTheme),
      api.onScreenState?.((s) => setScreen(s)),
      api.onAlert?.((a) => setAlert(a)),
      api.onQueueUpdated?.((q) => setQueue(q)),
      api.onTimers?.((t) => setTimers(t)),
      // The engine's next/previous voice commands walk multi-slide readings.
      api.onExternalCommand?.((cmd) => {
        if (cmd.command === 'slide-next') setSlideIndex((i) => i + 1);
        if (cmd.command === 'slide-previous') setSlideIndex((i) => Math.max(0, i - 1));
      }),
      api.onShowMedia?.((imagePath) => {
        void api.readImageDataUrl(imagePath).then((dataUrl) => {
          if (dataUrl) {
            setVisible(false); // slide replaces scripture
            setMedia(dataUrl);
          }
        }).catch(() => undefined);
      }),
    ];

    return () => {
      for (const unsub of subs) unsub?.();
    };
  }, []);

  const isStage = role === 'stage';
  const isStream = role === 'stream';
  const clock = useClock(isStage && theme.stageShowClock);
  const showAlert = alert && (alert.target === 'all' || alert.target === role);
  // Stream never paints the theme background: the capture wants alpha.
  const paintBackground = !isStream && theme.backgroundUrl;
  const contentVisible = visible && screen === 'live';
  const nextLabel = upNext ? formatRef(upNext) : queue[0]?.ref ?? null;
  // Clamp rather than wrap: walking past the end of a reading should rest on
  // the last slide, not silently loop back to the top mid-sermon.
  const slides = shown?.slides ?? null;
  const slide = slides && slides.length > 0 ? slides[Math.min(slideIndex, slides.length - 1)] : null;
  const stageTimer = theme.stageShowTimer
    ? timers.find((t) => t.id === theme.stageShowTimer || t.name === theme.stageShowTimer) ?? null
    : null;

  const themedStage = {
    '--verse-font': theme.fontFamily,
    '--verse-scale': String(theme.scale),
    '--verse-weight': String(theme.weight),
    '--verse-color': theme.color,
  } as React.CSSProperties;

  const rootClass = [
    'output-root',
    `role-${role}`,
    `screen-${screen}`,
    isStream ? `layout-${theme.streamLayout}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} style={themedStage}>
      {paintBackground && (
        <div
          className="output-background"
          style={{
            backgroundImage: `url(${theme.backgroundUrl})`,
            backgroundSize: theme.backgroundFit === 'fill' ? '100% 100%' : theme.backgroundFit,
            backgroundPosition: theme.backgroundPosition,
          }}
        >
          <div className="output-dim" style={{ opacity: isStage ? 0.75 : theme.overlayOpacity }} />
        </div>
      )}
      {media && screen === 'live' && (
        <div className="output-media">
          <img src={media} alt="" />
        </div>
      )}
      <div className={`output-stage ${contentVisible ? 'visible' : ''}`}>
        {shown && (
          <>
            {shown.isPreview && <div className="output-preview-mark">preview</div>}
            {slide ? (
              <>
                {slide.lines.map((line, i) => (
                  <div
                    key={line.version + i}
                    className={i === 0 ? 'output-verse' : 'output-verse output-verse-secondary'}
                  >
                    {line.text}
                  </div>
                ))}
                {slide.reference && <div className="output-ref">{slide.reference}</div>}
                {slide.total > 1 && (
                  <div className="output-slide-count">
                    {slide.index} / {slide.total}
                  </div>
                )}
              </>
            ) : (
              // Before the text arrives, the reference alone is better than a
              // blank screen — the congregation can already open their Bibles.
              <div className="output-ref">
                {formatRef(shown.detection)}
                {shown.detection.version && (
                  <span className="output-version">{shown.detection.version}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Stage confidence strip: clock on the left, what's next on the right. */}
      {isStage && (theme.stageShowClock || theme.stageShowNext) && (
        <div className="output-stage-strip">
          {theme.stageShowClock && <span className="output-clock">{clock}</span>}
          {stageTimer && (
            <span
              className={`output-stage-timer ${stageTimer.overrunning ? 'overrunning' : ''}`}
              title={stageTimer.name}
            >
              {formatTimerDisplay(stageTimer.remainingMs)}
            </span>
          )}
          {theme.stageShowNext && (
            <span className="output-next">
              {nextLabel ? (
                <>
                  <span className="output-next-label">{upNext ? 'awaiting approval' : 'queued'}</span>
                  {nextLabel}
                </>
              ) : (
                <span className="output-next-label">nothing queued</span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Black / logo sit above everything except the alert bar. */}
      <div className={`output-black ${screen === 'black' || screen === 'logo' ? 'visible' : ''}`}>
        {screen === 'logo' && (
          <div className="output-logo">
            {theme.logoUrl ? (
              <img src={theme.logoUrl} alt="" />
            ) : (
              <div className="output-logo-name">{theme.churchName || 'Trilorah'}</div>
            )}
          </div>
        )}
      </div>

      {/* Message alert: theme font, high-contrast band, bottom edge. */}
      <div className={`output-alert ${showAlert ? 'visible' : ''}`} aria-live="polite">
        {alert && <span className="output-alert-text">{alert.text}</span>}
      </div>

      {!window.api && <div className="output-disconnected">output · engine not connected</div>}
    </div>
  );
}

const rootEl = document.getElementById('output-root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <OutputSurface />
    </StrictMode>,
  );
}
