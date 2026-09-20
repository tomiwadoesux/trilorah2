import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchVerseParts, formatRef, sameRef } from './lib/verse';
import { buildVerseSlides, type VerseSlide } from '../shared/verseDisplay';
import { formatTimerDisplay } from '../shared/timerDisplay';
import { getTimerColor } from '../shared/timerColor';
import { fileToDisplayUrl, toDisplayUrl } from '../shared/mediaUrl';
import type { LiveContent } from '../shared/liveContent';
import { clampTransitionMs, isTextTransition, type TextTransition } from '../shared/textTransitions';
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
  verseLayout: string;
  safeMargin: number;
  /** The reference line's own size, independent of the verse body's. */
  refScale: number;
  /** Space between the verse and its reference, in ems of the reference. */
  refGap: number;
  /** How words arrive on the wall. See TEXT_TRANSITIONS in shared/textTransitions.ts. */
  textTransition: TextTransition;
  textTransitionMs: number;
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
  verseLayout: 'top',
  safeMargin: 7,
  refScale: 1,
  /* 4vh was this gap's hard-coded value before it became a control; as an
     em of the reference it lands in the same place at the default size. */
  refGap: 2,
  textTransition: 'fade',
  textTransitionMs: 450,
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
    backgroundUrl: toDisplayUrl(typeof s.defaultBackgroundUrl === 'string' ? s.defaultBackgroundUrl : ''),
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
    verseLayout: typeof s.verseLayout === 'string' ? (s.verseLayout as string) : 'top',
    safeMargin: typeof s.safeMargin === 'number' && s.safeMargin > 0 ? s.safeMargin : 7,
    /* Both default when a theme saved before these existed is read back, so
       an older church file keeps the wall it already had. */
    refScale: typeof s.refScale === 'number' && s.refScale > 0 ? s.refScale : 1,
    refGap: typeof s.refGap === 'number' && s.refGap >= 0 ? s.refGap : 2,
    textTransition: isTextTransition(s.textTransition) ? s.textTransition : 'fade',
    textTransitionMs: clampTransitionMs(s.textTransitionMs),
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
  // A video is streamed (local-media://), never base64'd like a picture: a
  // clip is hundreds of megabytes and would not survive the trip over IPC.
  const [video, setVideo] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // A song section. One of verse / media / song is up at a time: each arrival
  // takes the other two down, mirroring what main remembers as live.
  const [song, setSong] = useState<LiveContent | null>(null);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [role, setRole] = useState<OutputRole>('projector');
  const [screen, setScreen] = useState<ScreenState>('live');
  const [alert, setAlert] = useState<ScreenAlert | null>(null);
  // Stage only: the verse awaiting approval and the engine's queue.
  const [upNext, setUpNext] = useState<VerseDetection | null>(null);
  const [queue, setQueue] = useState<VerseQueueItem[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [timers, setTimers] = useState<TimerSnapshot[]>([]);
  const takenAt = useRef(Date.now());
  const [, setTimerTick] = useState(0);

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
    const takeTimers = (t: TimerSnapshot[]) => {
      takenAt.current = Date.now();
      setTimers(t ?? []);
    };
    void api.listTimers?.().then((t) => takeTimers(t ?? [])).catch(() => undefined);
    // Opened mid-service: pick up whatever song is already on the wall.
    void api.getLiveContent?.().then((c) => c && setSong(c)).catch(() => undefined);

    const display = (detection: VerseDetection, isPreview: boolean) => {
      setMedia(null); // scripture supersedes a slide
      setVideo(null);
      setSong(null);
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
        setVideo(null);
        setSong(null);
      }),
      api.onThemeChanged?.(loadTheme),
      api.onScreenState?.((s) => setScreen(s)),
      api.onAlert?.((a) => setAlert(a)),
      api.onQueueUpdated?.((q) => setQueue(q)),
      api.onTimers?.((t) => takeTimers(t ?? [])),
      // The engine's next/previous voice commands walk multi-slide readings.
      api.onExternalCommand?.((cmd) => {
        if (cmd.command === 'slide-next') setSlideIndex((i) => i + 1);
        if (cmd.command === 'slide-previous') setSlideIndex((i) => Math.max(0, i - 1));
      }),
      api.onMediaControl?.((action) => {
        const v = videoRef.current;
        if (!v) return;
        if (action.type === 'play') void v.play().catch(() => undefined);
        else if (action.type === 'pause') v.pause();
        else if (action.type === 'toggle') v.paused ? void v.play().catch(() => undefined) : v.pause();
        else if (action.type === 'restart') {
          v.currentTime = 0;
          void v.play().catch(() => undefined);
        } else if (action.type === 'volume' && typeof action.value === 'number') {
          v.volume = Math.min(1, Math.max(0, action.value));
        } else if (action.type === 'loop') v.loop = Boolean(action.value);
      }),
      api.onLiveContent?.((content) => {
        setVisible(false);
        setMedia(null);
        setVideo(null);
        setSong(content);
      }),
      api.onShowMedia?.((imagePath, kind) => {
        if (kind === 'video') {
          setVisible(false);
          setSong(null);
          setMedia(null);
          setVideo(fileToDisplayUrl(imagePath));
          return;
        }
        setVideo(null);
        void api.readImageDataUrl(imagePath).then((dataUrl) => {
          if (dataUrl) {
            setVisible(false); // slide replaces scripture
            setSong(null);
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
  const isTimer = role === 'timer';

  useEffect(() => {
    if (!isTimer) return;
    const interval = window.setInterval(() => setTimerTick((n) => n + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isTimer]);

  const clock = useClock((isStage && theme.stageShowClock) || isTimer);
  const showAlert = alert && (alert.target === 'all' || alert.target === role || (isTimer && alert.target === 'stage'));
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

  const atBottom = theme.verseLayout !== 'top';
  const stageJustify = atBottom ? 'flex-end' : 'flex-start';
  const stageAlign =
    theme.verseLayout === 'bottom-left' ? 'flex-start' : theme.verseLayout === 'bottom-right' ? 'flex-end' : 'center';
  const stageTextAlign =
    theme.verseLayout === 'bottom-left' ? 'left' : theme.verseLayout === 'bottom-right' ? 'right' : 'center';

  const themedStage = {
    '--verse-font': theme.fontFamily,
    '--verse-scale': String(theme.scale),
    '--verse-weight': String(theme.weight),
    '--verse-color': theme.color,
    '--safe-margin': `${theme.safeMargin}%`,
    '--ref-scale': String(theme.refScale),
    '--ref-gap': `${theme.refGap}em`,
    '--tx-ms': `${theme.textTransition === 'cut' ? 0 : theme.textTransitionMs}ms`,
    '--stage-justify': stageJustify,
    '--stage-align': stageAlign,
    '--stage-text-align': stageTextAlign,
  } as React.CSSProperties;

  const rootClass = [
    'output-root',
    `role-${role}`,
    `screen-${screen}`,
    isStream ? `layout-${theme.streamLayout}` : '',
    `tx-${theme.textTransition}`,
  ]
    .filter(Boolean)
    .join(' ');

  if (isTimer) {
    const activeTimer = timers.find((t) => t.state === 'running') ?? timers[0] ?? null;
    const drift = activeTimer && activeTimer.state === 'running' ? Date.now() - takenAt.current : 0;
    const ms = activeTimer
      ? activeTimer.state !== 'running'
        ? activeTimer.remainingMs
        : activeTimer.kind === 'elapsed'
          ? activeTimer.remainingMs + drift
          : activeTimer.remainingMs - drift
      : 0;
    // Colour by the phase the store says we are in, not by durationSec. Once
    // the agreed time is spent and grace was granted, remainingMs belongs to
    // the EXTENSION, so dividing it by the sermon's full length would read
    // 3:00 of a 45-minute sermon as 6% and paint the extension red from its
    // first second — exactly the green restart the two-phase design exists
    // to give the preacher.
    const phaseTotalMs = activeTimer
      ? activeTimer.phaseTotalMs || (activeTimer.durationSec ?? 0) * 1000
      : 0;
    const color = activeTimer ? getTimerColor(ms, phaseTotalMs) : '#22c55e';
    // Trust the store's own verdict for the phase flip. Interpolating locally
    // past zero would declare OVERTIME EXCEEDED on the tick the sermon runs
    // out, a second before the snapshot arrives that would have started the
    // extension counting down in green.
    const isOverrun = Boolean(
      activeTimer &&
        (activeTimer.overrunning ||
          (activeTimer.kind === 'countdown' && !activeTimer.inExtension && !activeTimer.extraSec && ms < 0)),
    );
    // "OF 45:00" during the extension would be a lie — the big number is
    // counting the grace, not the sermon — so the caption follows the phase.
    const targetDisplay = phaseTotalMs > 0 ? formatTimerDisplay(phaseTotalMs) : null;
    const activeDisplay = activeTimer ? (activeTimer.state === 'running' ? formatTimerDisplay(ms) : activeTimer.display) : null;
    // Grace the preacher was granted is news the room should keep seeing —
    // including after the extension itself runs out, which is precisely when
    // someone will ask why the clock is red. It says EXTRA TIME while the
    // extension is the thing counting down, so the big number is unambiguous.
    const extensionLabel =
      activeTimer && activeTimer.extraSec && activeTimer.extraSec > 0
        ? `+${Math.round(activeTimer.extraSec / 60)} MIN ${activeTimer.inExtension ? 'EXTRA TIME' : 'EXTENSION'}`
        : null;

    return (
      <div className={`output-root role-timer screen-${screen}`}>
        {/* Top bar: Timer title + Sanctuary clock */}
        <div className="timer-screen-topbar">
          <div className="timer-screen-title">
            {activeTimer ? activeTimer.name : 'SANCTUARY TIMER'}
          </div>
          <div className="timer-screen-clock">
            {clock}
          </div>
        </div>

        {/* Center: Giant Countdown Display */}
        <div className="timer-screen-center">
          {activeTimer ? (
            isOverrun ? (
              <>
                {targetDisplay && (
                  <div className="timer-screen-target-top">
                    TARGET: {targetDisplay}
                  </div>
                )}
                <div
                  className="timer-screen-digits"
                  style={{ color: '#ef4444', textShadow: '0 0 35px rgba(239, 68, 68, 0.6)' }}
                >
                  {activeDisplay}
                </div>
                <div className="timer-screen-overtime-label">
                  OVERTIME EXCEEDED
                </div>
                {extensionLabel && (
                  <div className="timer-screen-extension-badge">{extensionLabel}</div>
                )}
              </>
            ) : (
              <>
                <div
                  className="timer-screen-digits"
                  style={{ color, textShadow: `0 0 30px ${color}60` }}
                >
                  {activeDisplay}
                </div>
                {targetDisplay && (
                  <div className="timer-screen-target-top" style={{ marginTop: '2vh', fontSize: 'clamp(1.2rem, 2.5vw, 3.2vw)' }}>
                    OF {targetDisplay}
                  </div>
                )}
                {extensionLabel && (
                  <div className="timer-screen-extension-badge">{extensionLabel}</div>
                )}
              </>
            )
          ) : (
            <>
              <div
                className="timer-screen-digits"
                style={{ color: '#22c55e', textShadow: '0 0 30px rgba(34, 197, 94, 0.4)' }}
              >
                {clock}
              </div>
              <div className="timer-screen-target-top" style={{ marginTop: '2vh', letterSpacing: '0.25em' }}>
                STANDBY · SERVICE READY
              </div>
            </>
          )}
        </div>

        {/* Bottom bar: Live cue pill or status */}
        <div className="timer-screen-bottombar">
          <div className="timer-screen-verse-cue">
            {shown && shown.detection ? (
              <span>LIVE: {formatRef(shown.detection)} {shown.detection.version || ''}</span>
            ) : (
              <span>STAGE TIMER</span>
            )}
          </div>
          <div>
            {activeTimer ? (
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>
                {activeTimer.state}
              </span>
            ) : null}
          </div>
        </div>

        {/* Black / logo overlays */}
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

        {/* Message alerts (nursery / stage alert) */}
        <div className={`output-alert ${showAlert ? 'visible' : ''}`} aria-live="polite">
          {alert && <span className="output-alert-text">{alert.text}</span>}
        </div>

        {!window.api && <div className="output-disconnected">output · engine not connected</div>}
      </div>
    );
  }

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
      {video && screen === 'live' && (
        <div className="output-media">
          {/* Sound from ONE window only. Every output gets the same broadcast,
              and three windows each playing the soundtrack is three copies a
              few milliseconds apart — an echo through the house PA. The main
              output carries the audio; the stream and stage copies are mute.
              When it ends it rests on its last frame; the operator clears it. */}
          <video
            ref={videoRef}
            key={video}
            src={video}
            autoPlay
            playsInline
            muted={outputId !== 'main'}
          />
        </div>
      )}
      {song && screen === 'live' && (
        <div className="output-stage visible output-song">
          {/* Keyed by what is showing, so each new section re-mounts and the
              entrance plays again; the same section re-sent does not. */}
          <div className="output-enter" key={`${song.title}|${song.label}|${song.lines?.[0] ?? ''}`}>
          {song.lines?.map((line: string, i: number) => (
            <div key={i} className="output-verse">
              {line}
            </div>
          ))}
          <div className="output-ref">
            {song.title}
            {song.label && <span className="output-version">{song.label}</span>}
          </div>
          </div>
        </div>
      )}
      <div className={`output-stage ${contentVisible ? 'visible' : ''} ${atBottom ? '' : 'ref-above'}`}>
        {shown && (
          <div className="output-enter" key={`${formatRef(shown.detection)}|${slideIndex}`}>
            {shown.isPreview && <div className="output-preview-mark">preview</div>}
            {slide ? (
              <>
                {!atBottom && slide.reference && <div className="output-ref">{slide.reference}</div>}
                {slide.lines.map((line, i) => (
                  <div
                    key={line.version + i}
                    className={i === 0 ? 'output-verse' : 'output-verse output-verse-secondary'}
                  >
                    {line.text}
                  </div>
                ))}
                {atBottom && slide.reference && <div className="output-ref">{slide.reference}</div>}
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
          </div>
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
