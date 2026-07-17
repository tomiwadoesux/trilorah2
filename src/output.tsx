import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchVerseText, formatRef, sameRef } from './lib/verse';
import './output.css';

/**
 * The projector / stream window: a transparent surface that fades scripture
 * in and out, applies the church's display theme (Themes tab), and can show
 * presentation slides / media images full-bleed. Multiple outputs are
 * distinguished by ?outputId=…, which is parsed (and stamped on <body>)
 * but never shown.
 */

const outputId = new URLSearchParams(window.location.search).get('outputId') ?? '';
document.body.dataset.outputId = outputId;

interface Shown {
  detection: VerseDetection;
  text: string | null;
  isPreview: boolean;
}

interface Theme {
  fontFamily: string;
  scale: number;
  weight: number;
  color: string;
  backgroundUrl: string;
  overlayOpacity: number;
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
  weight: 400,
  color: '#ffffff',
  backgroundUrl: '',
  overlayOpacity: 0.3,
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
    weight: typeof s.defaultFontWeight === 'number' ? s.defaultFontWeight : 400,
    color: typeof s.defaultTextColor === 'string' && s.defaultTextColor ? s.defaultTextColor : '#ffffff',
    backgroundUrl: typeof s.defaultBackgroundUrl === 'string' ? s.defaultBackgroundUrl : '',
    overlayOpacity:
      typeof s.overlayOpacity === 'number' ? Math.min(1, Math.max(0, s.overlayOpacity)) : 0.3,
  };
}

function OutputSurface() {
  // `shown` keeps the last verse during fade-out; `visible` drives opacity.
  const [shown, setShown] = useState<Shown | null>(null);
  const [visible, setVisible] = useState(false);
  const [media, setMedia] = useState<string | null>(null); // data URL
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const api = window.api;
    if (!api) return;

    const loadTheme = () => {
      void api.getSettings().then((s) => setTheme(themeFromSettings(s))).catch(() => undefined);
    };
    loadTheme();

    const display = (detection: VerseDetection, isPreview: boolean) => {
      setMedia(null); // scripture supersedes a slide
      setShown({ detection, text: null, isPreview });
      setVisible(true);
      void fetchVerseText(detection).then((text) => {
        if (text == null) return;
        setShown((current) =>
          current && sameRef(current.detection, detection) ? { ...current, text } : current,
        );
      });
    };

    const subs: ((() => void) | undefined)[] = [
      api.onVersePreview((d) => display(d, true)),
      api.onVerseDetected((d) => display(d, false)),
      api.onVerseAutoDismiss(() => setVisible(false)),
      api.onShowCleanBackground(() => {
        setVisible(false);
        setMedia(null);
      }),
      api.onThemeChanged?.(loadTheme),
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

  const themedStage = {
    '--verse-font': theme.fontFamily,
    '--verse-scale': String(theme.scale),
    '--verse-weight': String(theme.weight),
    '--verse-color': theme.color,
  } as React.CSSProperties;

  return (
    <>
      {theme.backgroundUrl && (
        <div className="output-background" style={{ backgroundImage: `url(${theme.backgroundUrl})` }}>
          <div className="output-dim" style={{ opacity: theme.overlayOpacity }} />
        </div>
      )}
      {media && (
        <div className="output-media">
          <img src={media} alt="" />
        </div>
      )}
      <div className={`output-stage ${visible ? 'visible' : ''}`} style={themedStage}>
        {shown && (
          <>
            {shown.isPreview && <div className="output-preview-mark">preview</div>}
            {shown.text && <div className="output-verse">{shown.text}</div>}
            <div className="output-ref">
              {formatRef(shown.detection)}
              {shown.detection.version && (
                <span className="output-version">{shown.detection.version}</span>
              )}
            </div>
          </>
        )}
      </div>
      {!window.api && <div className="output-disconnected">output · engine not connected</div>}
    </>
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
